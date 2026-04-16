// ═══════════════════════════════════════════════════════════════════════════════
// v11.0.5: COACH & AGENT PROMPT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * v11.0.5: Render Coach Prompts section in Guardrails (LifeAI mode)
 */
function renderCoachPrompts() {
  var container = document.getElementById('coachPromptsContainer');
  if (!container) return;
  
  var coaches = [
    { id: 'personal', name: 'Personal Assistant', icon: '◇', desc: 'General life organization and task management' },
    { id: 'coach', name: 'Life Coach', icon: '◆', desc: 'Goal achievement, motivation, and accountability' },
    { id: 'wellness', name: 'Wellness Guide', icon: '❤', desc: 'Health, fitness, nutrition, and mental wellness' },
    { id: 'taxintelligence', name: 'Tax Intelligence', icon: '$', desc: 'Tax preparation, deductions, and compliance' }
  ];
  
  var customPrompts = JSON.parse(localStorage.getItem('roweos_life_coach_prompts') || '{}');
  
  var html = '';
  coaches.forEach(function(coach) {
    var hasCustom = !!customPrompts[coach.id];
    var isExpanded = hasCustom ? 'expanded' : '';
    
    html += '<div class="identity-card ' + isExpanded + '" data-coach="' + coach.id + '" style="margin: 0;">';
    html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)" style="padding: 12px 16px;">';
    html += '    <div class="identity-card-icon" style="color: var(--life-accent);">' + coach.icon + '</div>';
    html += '    <div class="identity-card-title">';
    html += '      <h3 style="font-size: var(--text-base); margin: 0;">' + coach.name + '</h3>';
    html += '      <p style="font-size: var(--text-sm); margin: 0; color: var(--text-muted);">' + coach.desc + '</p>';
    html += '    </div>';
    html += '    <div class="identity-card-meta">';
    html += '      <span class="identity-card-badge" style="background: var(--life-accent); color: #fff; ' + (hasCustom ? '' : 'display:none;') + '">Custom</span>';
    html += '    </div>';
    html += '    <svg class="identity-card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    html += '  </div>';
    html += '  <div class="identity-card-body" style="padding: 12px 16px;">';
    html += '    <textarea id="coachPrompt_' + coach.id + '" rows="8" style="width: 100%; padding: var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-family: monospace; font-size: var(--text-sm); line-height: 1.5; resize: vertical;" placeholder="Enter custom system prompt for ' + coach.name + '...">' + escapeHtml(customPrompts[coach.id] || '') + '</textarea>';
    html += '    <div style="display: flex; gap: var(--space-2); margin-top: 10px;">';
    html += '      <button class="btn btn-small" onclick="saveCoachPrompt(\'' + coach.id + '\')">Save</button>';
    html += '      <button class="btn btn-secondary btn-small" onclick="viewDefaultCoachPrompt(\'' + coach.id + '\')">View Default</button>';
    html += '      <button class="btn btn-danger btn-small" onclick="resetCoachPrompt(\'' + coach.id + '\')" ' + (hasCustom ? '' : 'disabled') + '>Reset to Default</button>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

/**
 * v11.0.5: Save custom coach prompt
 */
function saveCoachPrompt(coachId) {
  var textarea = document.getElementById('coachPrompt_' + coachId);
  if (!textarea) return;
  
  var value = textarea.value.trim();
  var customPrompts = JSON.parse(localStorage.getItem('roweos_life_coach_prompts') || '{}');
  
  if (value) {
    customPrompts[coachId] = value;
  } else {
    delete customPrompts[coachId];
  }
  
  localStorage.setItem('roweos_life_coach_prompts', JSON.stringify(customPrompts));
  syncLifeAIToFirestore({ coachPrompts: customPrompts });
  renderCoachPrompts();
  showToast('Coach prompt saved', 'success');
}

/**
 * v11.0.5: View default coach prompt
 */
function viewDefaultCoachPrompt(coachId) {
  var defaultPrompt = getDefaultCoachPrompt(coachId);
  var textarea = document.getElementById('coachPrompt_' + coachId);
  
  if (confirm('View the default prompt? This will replace your current text (unsaved changes will be lost).')) {
    if (textarea) textarea.value = defaultPrompt;
  }
}

/**
 * v11.0.5: Reset coach prompt to default
 */
function resetCoachPrompt(coachId) {
  if (!confirm('Reset to default prompt? Your custom prompt will be deleted.')) return;
  
  var customPrompts = JSON.parse(localStorage.getItem('roweos_life_coach_prompts') || '{}');
  delete customPrompts[coachId];
  localStorage.setItem('roweos_life_coach_prompts', JSON.stringify(customPrompts));
  syncLifeAIToFirestore({ coachPrompts: customPrompts });

  renderCoachPrompts();
  showToast('Coach prompt reset to default', 'success');
}

/**
 * v11.0.5: Get default coach prompt (without user knowledge - that's injected at runtime)
 */
function getDefaultCoachPrompt(coachId) {
  var userName = localStorage.getItem('roweos_user_name') || 'there';
  
  if (coachId === 'personal') {
    return 'You are LifeAI, a personal intelligence assistant for ' + userName + '.\n\nYOUR ROLE:\nYou help ' + userName + ' organize their personal life, track goals, manage tasks, and provide thoughtful assistance.\n\nGUIDELINES:\n- Be warm, supportive, and genuinely helpful\n- Remember context from our conversations\n- Help with goal tracking, task management, and life organization\n- Provide thoughtful advice when asked\n- Never use emojis in your responses';
  }
  
  if (coachId === 'coach') {
    return 'You are a Life Coach for ' + userName + '.\n\nYOUR ROLE:\nYou help ' + userName + ' achieve their goals through motivation, accountability, and strategic planning.\n\nCOACHING APPROACH:\n- Ask powerful questions that promote self-reflection\n- Help break down big goals into actionable steps\n- Celebrate progress and acknowledge challenges\n- Hold ' + userName + ' accountable to commitments\n\nGUIDELINES:\n- Be encouraging but direct\n- Focus on solutions and forward movement\n- Never use emojis in your responses';
  }
  
  if (coachId === 'wellness') {
    return 'You are a Wellness Guide for ' + userName + '.\n\nYOUR ROLE:\nYou support ' + userName + '\'s holistic wellbeing including physical health, mental wellness, sleep, nutrition, and stress management.\n\nWELLNESS APPROACH:\n- Take a holistic view of health and wellbeing\n- Provide evidence-based wellness guidance\n- Help establish healthy habits and routines\n- Support mental health with empathy and care\n\nGUIDELINES:\n- Be warm and supportive\n- Suggest professional help when appropriate\n- Never use emojis in your responses';
  }
  
  if (coachId === 'taxintelligence') {
    return 'You are Tax Intelligence for ' + userName + '.\n\nYour only goal is to maximize ' + userName + '\'s legal tax outcome while staying fully compliant.\n\nCORE PRINCIPLES:\n- Evidence-first: Never invent expenses or facts\n- Reconciliation: Cross-check totals across forms and statements\n- Explainability: Cite IRS rules for every recommendation\n- Optimization within the rules\n\nCOMPLIANCE GUARDRAILS:\n- No invented or backfilled expenses\n- No suppression of income\n- Business and personal tracked distinctly\n\nGUIDELINES:\n- Be thorough but clear\n- Produce audit-ready workpapers\n- Never use emojis in your responses';
  }
  
  return '';
}

/**
 * v11.0.5: Render Agent Prompts section in Guardrails (BrandAI mode)
 */
function renderAgentPrompts() {
  var container = document.getElementById('agentPromptsContainer');
  if (!container) return;
  
  var agents = [
    { id: 'strategy', name: 'Strategy Agent', icon: '◈', desc: 'Strategic analysis and competitive intelligence' },
    { id: 'marketing', name: 'Marketing Agent', icon: '◇', desc: 'Content creation and campaign strategy' },
    { id: 'operations', name: 'Operations Agent', icon: '◆', desc: 'Workflows, processes, and templates' },
    { id: 'documents', name: 'Documents Agent', icon: '◎', desc: 'Professional documentation and reports' },
    { id: 'intelligence', name: 'Intelligence Agent', icon: '◎', desc: 'Market intelligence, lead gen, and competitive research' },
    { id: 'research', name: 'Research Agent', icon: '◉', desc: 'Deep research and market analysis' }
  ];
  
  var customPrompts = JSON.parse(localStorage.getItem('roweos_brand_agent_prompts') || '{}');
  
  var html = '';
  agents.forEach(function(agent) {
    var hasCustom = !!customPrompts[agent.id];
    var isExpanded = hasCustom ? 'expanded' : '';
    
    html += '<div class="identity-card ' + isExpanded + '" data-agent="' + agent.id + '" style="margin: 0;">';
    html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)" style="padding: 12px 16px;">';
    html += '    <div class="identity-card-icon" style="color: var(--accent);">' + agent.icon + '</div>';
    html += '    <div class="identity-card-title">';
    html += '      <h3 style="font-size: var(--text-base); margin: 0;">' + agent.name + '</h3>';
    html += '      <p style="font-size: var(--text-sm); margin: 0; color: var(--text-muted);">' + agent.desc + '</p>';
    html += '    </div>';
    html += '    <div class="identity-card-meta">';
    html += '      <span class="identity-card-badge" style="' + (hasCustom ? '' : 'display:none;') + '">Custom</span>';
    html += '    </div>';
    html += '    <svg class="identity-card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    html += '  </div>';
    html += '  <div class="identity-card-body" style="padding: 12px 16px;">';
    html += '    <textarea id="agentPrompt_' + agent.id + '" rows="8" style="width: 100%; padding: var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-family: monospace; font-size: var(--text-sm); line-height: 1.5; resize: vertical;" placeholder="Enter custom system prompt for ' + agent.name + '...">' + escapeHtml(customPrompts[agent.id] || '') + '</textarea>';
    html += '    <div style="display: flex; gap: var(--space-2); margin-top: 10px;">';
    html += '      <button class="btn btn-small" onclick="saveAgentPrompt(\'' + agent.id + '\')">Save</button>';
    html += '      <button class="btn btn-secondary btn-small" onclick="viewDefaultAgentPrompt(\'' + agent.id + '\')">View Default</button>';
    html += '      <button class="btn btn-danger btn-small" onclick="resetAgentPrompt(\'' + agent.id + '\')" ' + (hasCustom ? '' : 'disabled') + '>Reset to Default</button>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

/**
 * v11.0.5: Save custom agent prompt
 */
function saveAgentPrompt(agentId) {
  var textarea = document.getElementById('agentPrompt_' + agentId);
  if (!textarea) return;
  
  var value = textarea.value.trim();
  var customPrompts = JSON.parse(localStorage.getItem('roweos_brand_agent_prompts') || '{}');
  
  if (value) {
    customPrompts[agentId] = value;
  } else {
    delete customPrompts[agentId];
  }
  
  localStorage.setItem('roweos_brand_agent_prompts', JSON.stringify(customPrompts));
  renderAgentPrompts();
  showToast('Agent prompt saved', 'success');
}

/**
 * v11.0.5: View default agent prompt
 */
function viewDefaultAgentPrompt(agentId) {
  var agent = agents.find(function(a) { return a.id === agentId; });
  if (!agent) return;
  
  var defaultPrompt = agent.systemPrompt || '';
  var textarea = document.getElementById('agentPrompt_' + agentId);
  
  if (confirm('View the default prompt? This will replace your current text (unsaved changes will be lost).')) {
    if (textarea) textarea.value = defaultPrompt;
  }
}

/**
 * v11.0.5: Reset agent prompt to default
 */
function resetAgentPrompt(agentId) {
  if (!confirm('Reset to default prompt? Your custom prompt will be deleted.')) return;
  
  var customPrompts = JSON.parse(localStorage.getItem('roweos_brand_agent_prompts') || '{}');
  delete customPrompts[agentId];
  localStorage.setItem('roweos_brand_agent_prompts', JSON.stringify(customPrompts));
  
  renderAgentPrompts();
  showToast('Agent prompt reset to default', 'success');
}

// Memory Functions (Phase 7)
var brandMemory = {};

function loadBrandMemory() {
  var saved = localStorage.getItem('roweos_brand_memory');
  if (saved) {
    brandMemory = JSON.parse(saved);
  }
  // v12.2.6: Migrate data from legacy 'brandMemory' key if it exists
  var legacy = localStorage.getItem('brandMemory');
  if (legacy) {
    try {
      var legacyData = JSON.parse(legacy);
      // Merge legacy data into main brandMemory (don't overwrite existing)
      for (var key in legacyData) {
        if (legacyData.hasOwnProperty(key) && !brandMemory[key]) {
          brandMemory[key] = legacyData[key];
        }
      }
      // Save merged data to canonical key and remove legacy
      localStorage.setItem('roweos_brand_memory', JSON.stringify(brandMemory));
      localStorage.removeItem('brandMemory');
    } catch(e) { console.warn('[loadBrandMemory] Legacy migration error:', e); }
  }
  // v29.1: Migrate index-based keys to ID-based keys
  migrateBrandMemoryKeys();
  // Don't call updateMemoryUI here - it will be called when the view is shown
}

function saveBrandMemory() {
  try {
    localStorage.setItem('roweos_brand_memory', JSON.stringify(brandMemory));
  } catch (e) {
    // v15.14: Handle localStorage quota exceeded — truncate doc content and retry
    if (e.name === 'QuotaExceededError' || (e.message && e.message.indexOf('quota') !== -1)) {
      console.warn('[Memory] Quota exceeded, truncating stored documents');
      Object.keys(brandMemory).forEach(function(key) {
        if (brandMemory[key] && brandMemory[key].documents) {
          brandMemory[key].documents.forEach(function(doc) {
            if (doc.content && doc.content.length > 5000) {
              doc.content = doc.content.substring(0, 5000) + '\n[Truncated to save storage]';
            }
          });
        }
      });
      try {
        localStorage.setItem('roweos_brand_memory', JSON.stringify(brandMemory));
      } catch (e2) {
        showToast('Storage full. Delete old documents to free space.', 'error');
        console.error('[Memory] Cannot save even after truncation:', e2);
        return;
      }
      showToast('Document content truncated to save storage space', 'warning');
    } else {
      throw e;
    }
  }
  // v25.1: Write-through to Firestore (replaces deprecated syncToFirebase)
  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('profile/main', { brandMemory: JSON.parse(localStorage.getItem('roweos_brand_memory') || '{}') });
  }
}

// v29.1: Get stable brand memory key using brand ID (not index, which shifts on reorder)
function getBrandMemoryKey(brandIdx) {
  if (typeof brandIdx === 'undefined' || brandIdx === null) brandIdx = (typeof selectedBrand === 'number' ? selectedBrand : 0);
  if (typeof brands !== 'undefined' && brands[brandIdx] && brands[brandIdx].id) {
    return brands[brandIdx].id;
  }
  // Fallback to index-based key (legacy)
  return 'brand_' + brandIdx;
}

// v29.1: Migrate brand memory from index-based keys to ID-based keys
function migrateBrandMemoryKeys() {
  if (typeof brands === 'undefined' || !brands.length) return;
  var changed = false;
  for (var i = 0; i < brands.length; i++) {
    var oldKey = 'brand_' + i;
    var newKey = brands[i].id;
    if (!newKey || oldKey === newKey) continue;
    if (brandMemory[oldKey] && !brandMemory[newKey]) {
      console.log('[Memory] v29.1: Migrating brandMemory key', oldKey, '->', newKey);
      brandMemory[newKey] = brandMemory[oldKey];
      delete brandMemory[oldKey];
      changed = true;
    }
  }
  if (changed) {
    saveBrandMemory();
    console.log('[Memory] v29.1: Brand memory keys migrated to ID-based');
  }
}

// Brand Knowledge Repository
var currentKnowledgeBrand = 'brand_0';
var brandKnowledgeData = JSON.parse(localStorage.getItem('roweos_brand_knowledge') || '{}');

// Initialize default knowledge for each brand
// v13.0: Default brand knowledge removed. Users build their own via Identity + Memory.
var defaultBrandKnowledge = {};

// Brand knowledge is loaded on demand from brands array or left empty for AI to fill

function selectBrandPill(element, brandKey) {
  // v9.1.14: Pills removed - just handle brand switching logic
  // element may be null when called from search results
  
  // Save current knowledge before switching
  saveBrandKnowledge();
  
  // Switch to new brand
  currentKnowledgeBrand = brandKey;
  
  // Update selectedBrand global
  var brandIdx = parseInt(brandKey.replace('brand_', ''));
  if (!isNaN(brandIdx) && brandIdx >= 0 && brandIdx < brands.length) {
    selectedBrand = brandIdx;
  }
  
  loadBrandKnowledge(brandKey);
  
  // Update Identity view title if visible
  renderMemoryBrandPills();
}

function loadBrandKnowledge(brandKey) {
  // Handle both old key format and new brand_ format
  var brandIdx = 0;
  if (brandKey.startsWith('brand_')) {
    brandIdx = parseInt(brandKey.replace('brand_', ''));
  } else {
    // Map old keys to indices
    var oldKeyMap = {
      'rowe-collection': 0,
      'solo-training': 1,
      'retreats': 2,
      'reserve': 3,
      'rowe-co': 4
    };
    brandIdx = oldKeyMap[brandKey] || 0;
  }
  
  var brand = brands[brandIdx];
  if (!brand) return;
  
  // Try to get saved knowledge, fall back to brand data or defaults
  var knowledge = brandKnowledgeData[brandKey];
  if (!knowledge) {
    // Check if brand has data from onboarding
    // v9.1.14: Handle visual being an object with colors/fonts
    var visualStr = '';
    if (brand.visual) {
      if (typeof brand.visual === 'string') {
        visualStr = brand.visual;
      } else if (typeof brand.visual === 'object') {
        var parts = [];
        if (brand.visual.colors && brand.visual.colors.length) {
          parts.push('Colors: ' + brand.visual.colors.join(', '));
        }
        if (brand.visual.fonts && brand.visual.fonts.length) {
          parts.push('Typography: ' + brand.visual.fonts.join(', '));
        }
        visualStr = parts.join('\n');
      }
    }
    
    // v9.1.14: Handle voice being an object with tone/vocabulary
    var voiceStr = '';
    if (brand.voice) {
      if (typeof brand.voice === 'string') {
        voiceStr = brand.voice;
      } else if (typeof brand.voice === 'object') {
        var voiceParts = [];
        if (brand.voice.tone) {
          voiceParts.push('Tone: ' + brand.voice.tone);
        }
        if (brand.voice.vocabulary && brand.voice.vocabulary.length) {
          voiceParts.push('Key vocabulary: ' + brand.voice.vocabulary.join(', '));
        }
        voiceStr = voiceParts.join('\n');
      }
    }
    
    knowledge = {
      name: brand.name,
      tagline: brand.tagline || 'Brand tagline',
      essence: brand.essence || '',
      voice: voiceStr,
      audience: brand.audience || '',
      messaging: brand.messaging || '',
      visual: visualStr,
      competitive: brand.competitive || '',
      insights: brand.insights || ''
    };
  }
  
  // v9.1.14: Add null checks for all elements
  var nameEl = document.getElementById('knowledgeBrandName');
  var taglineEl = document.getElementById('knowledgeBrandTagline');
  if (nameEl) nameEl.textContent = knowledge.name;
  if (taglineEl) taglineEl.textContent = knowledge.tagline;
  
  var essenceEl = document.getElementById('knowledge-essence');
  var voiceEl = document.getElementById('knowledge-voice');
  var audienceEl = document.getElementById('knowledge-audience');
  var messagingEl = document.getElementById('knowledge-messaging');
  var visualEl = document.getElementById('knowledge-visual');
  var competitiveEl = document.getElementById('knowledge-competitive');
  
  if (essenceEl) essenceEl.value = knowledge.essence || '';
  if (voiceEl) voiceEl.value = knowledge.voice || '';
  if (audienceEl) audienceEl.value = knowledge.audience || '';
  if (messagingEl) messagingEl.value = knowledge.messaging || '';
  if (visualEl) visualEl.value = knowledge.visual || '';
  if (competitiveEl) competitiveEl.value = knowledge.competitive || '';
  
  // v9.1.14: Load insights from per-brand knowledge store (document uploads)
  // This takes priority over the brandKnowledgeData cache
  var brandName = brands[brandIdx]?.name;
  // v27.0: Null-check knowledge-insights element (may not be in DOM yet)
  var _kiEl = document.getElementById('knowledge-insights');
  if (_kiEl) {
    if (brandName && typeof getBrandKnowledge === 'function') {
      var perBrandKnowledge = getBrandKnowledge(brandName);
      if (perBrandKnowledge && perBrandKnowledge.insights && perBrandKnowledge.insights.length > 0) {
        var insightsText = perBrandKnowledge.insights.map(function(i) {
          var text = typeof i === 'object' ? i.text : i;
          return '• ' + text;
        }).join('\n');
        _kiEl.value = insightsText;
      } else {
        _kiEl.value = knowledge.insights || '';
      }
    } else {
      _kiEl.value = knowledge.insights || '';
    }
  }
}

function saveBrandKnowledge() {
  var brandKey = currentKnowledgeBrand;
  // v27.0: Safe element reads with null checks
  function _kVal(id) { var el = document.getElementById(id); return el ? (el.value || el.textContent || '') : ''; }

  brandKnowledgeData[brandKey] = {
    name: _kVal('knowledgeBrandName'),
    tagline: _kVal('knowledgeBrandTagline'),
    essence: _kVal('knowledge-essence'),
    voice: _kVal('knowledge-voice'),
    audience: _kVal('knowledge-audience'),
    messaging: _kVal('knowledge-messaging'),
    visual: _kVal('knowledge-visual'),
    competitive: _kVal('knowledge-competitive'),
    insights: _kVal('knowledge-insights')
  };
  
  localStorage.setItem('roweos_brand_knowledge', JSON.stringify(brandKnowledgeData));
  // v25.1: Write-through brand knowledge to Firestore
  writeDB('profile/main', { brandKnowledge: brandKnowledgeData });
  // v15.14: Track prompt update timestamp
  if (typeof saveBrandAIPromptTimestamp === 'function') {
    saveBrandAIPromptTimestamp(selectedBrand);
  }
  showToast('Brand knowledge saved', 'success');
}

function toggleKnowledgeSection(header) {
  var content = header.nextElementSibling;
  var toggle = header.querySelector('.section-toggle');
  
  if (content.classList.contains('expanded')) {
    content.classList.remove('expanded');
    content.style.maxHeight = '0';
    content.style.padding = '0 16px';
    header.classList.add('collapsed');
  } else {
    content.classList.add('expanded');
    content.style.maxHeight = '500px';
    content.style.padding = '16px';
    header.classList.remove('collapsed');
  }
}

function askClaudeAboutBrand() {
  var brandKey = currentKnowledgeBrand;
  var knowledge = brandKnowledgeData[brandKey];
  
  // Create a prompt asking Claude to expand on the brand
  var prompt = 'Based on what you know about ' + knowledge.name + ', can you help expand our brand knowledge? Here\'s what we currently have:\n\n';
  prompt += 'Essence: ' + knowledge.essence + '\n\n';
  prompt += 'Voice & Tone: ' + knowledge.voice + '\n\n';
  prompt += 'Please provide additional insights, suggestions, or refinements that could strengthen this brand\'s positioning.';
  
  // Navigate to BrandAI with this prompt
  showView('agent');
  setTimeout(function() {
    var inputField = document.getElementById('agentUserInput');
    if (inputField) {
      inputField.value = prompt;
      inputField.focus();
    }
  }, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// v9.1.14: INTELLIGENT DOCUMENT PROCESSING PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * v9.1.14: Extract text from PDF using PDF.js
 * @param {File} file - PDF file to extract text from
 * @returns {Promise<string>} - Extracted text content
 */
// v13.0: Fixed ES5 compliance
async function extractTextFromPDF(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js library not loaded');
  }

  // Read file as ArrayBuffer using FileReader (ES5 compatible)
  var arrayBuffer = await new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { reject(new Error('Failed to read PDF file')); };
    reader.readAsArrayBuffer(file);
  });

  var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  var fullText = '';

  for (var i = 1; i <= pdf.numPages; i++) {
    var page = await pdf.getPage(i);
    var textContent = await page.getTextContent();
    var pageText = textContent.items.map(function(item) { return item.str; }).join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

/**
 * v9.1.14: Extract text from various document formats
 * @param {File} file - File to extract text from
 * @returns {Promise<string>} - Extracted text content
 */
// v13.0: Fixed ES5 compliance
async function extractTextFromDocument(file) {
  var fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    return await extractTextFromPDF(file);
  }

  // For text-based formats, read as text
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { reject(new Error('Failed to read file')); };
    reader.readAsText(file);
  });
}

/**
 * v9.1.14: Chunk text into manageable pieces for AI analysis
 * @param {string} text - Full text content
 * @param {number} maxChunkSize - Maximum characters per chunk
 * @returns {Array<string>} - Array of text chunks
 */
// v13.0: Fixed ES5 compliance
function chunkText(text, maxChunkSize) {
  if (!maxChunkSize) maxChunkSize = 1500;
  var sentences = text.split(/[.!?]+/);
  var chunks = [];
  var currentChunk = '';

  for (var s = 0; s < sentences.length; s++) {
    var trimmedSentence = sentences[s].trim();
    if (!trimmedSentence) continue;

    if ((currentChunk + trimmedSentence).length > maxChunkSize) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence + '. ';
    } else {
      currentChunk += trimmedSentence + '. ';
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks;
}

/**
 * v9.1.14: Analyze document content with BrandAI (Claude)
 * @param {Array<string>} chunks - Text chunks to analyze
 * @param {string} brandName - Name of the brand
 * @returns {Promise<Object>} - Structured analysis results
 */
// v13.0: Fixed ES5 compliance
async function analyzeDocumentWithAI(chunks, brandName) {
  // v22.49: Use client's selected provider, not hardcoded Anthropic
  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
  var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey');
  var openaiKey = apiKeys.openai;
  var googleKey = apiKeys.google;
  var activeProvider = localStorage.getItem('selectedProvider') || 'anthropic';

  if (activeProvider === 'anthropic' && !anthropicKey) activeProvider = openaiKey ? 'openai' : googleKey ? 'google' : '';
  if (activeProvider === 'openai' && !openaiKey) activeProvider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
  if (activeProvider === 'google' && !googleKey) activeProvider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

  if (!activeProvider) {
    throw new Error('Please add an API key in Settings.');
  }

  // Combine chunks for analysis (limit to prevent token overflow)
  var combinedText = chunks.slice(0, 8).join('\n\n');

  var analysisPrompt = 'You are analyzing a business document for "' + brandName + '". Extract structured brand information.\n\n' +
    'DOCUMENT CONTENT:\n' + combinedText + '\n\n' +
    'Analyze this document and extract the following in JSON format. Be thorough but concise. If information is not present, use null:\n\n' +
    '{\n' +
    '  "summary": "2-3 sentence overview of the document\'s key content",\n' +
    '  "products": "Products or services mentioned (comma-separated list or null)",\n' +
    '  "targetAudience": "Who the brand serves based on this document (or null)",\n' +
    '  "voiceTone": "The writing tone/voice used (e.g., \'professional\', \'casual\', \'luxurious\')",\n' +
    '  "vocabulary": ["5-10 key terms or phrases that define this brand\'s language"],\n' +
    '  "insights": ["3-5 strategic observations about the brand based on this document"],\n' +
    '  "values": ["Core values or principles evident in the document"],\n' +
    '  "differentiators": "What makes this brand unique based on the document (or null)",\n' +
    '  "brandPromise": "Any brand promise or commitment mentioned (or null)"\n' +
    '}\n\n' +
    'Respond ONLY with valid JSON. No explanation or markdown.';

  var response, data, content;

  if (activeProvider === 'anthropic') {
    var claudeModel = localStorage.getItem('claudeModel') || 'claude-sonnet-4-6';
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 2048,
        messages: [{ role: 'user', content: analysisPrompt }]
      })
    });
    if (!response.ok) {
      var aErr = ''; try { var aErrJson = await response.json(); aErr = aErrJson.error && aErrJson.error.message || ''; } catch(e) {}
      throw new Error(aErr || 'Anthropic API failed (HTTP ' + response.status + ')');
    }
    data = await response.json();
    content = (data.content && data.content[0] && data.content[0].text) || '';
  } else if (activeProvider === 'openai') {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + openaiKey
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        max_output_tokens: 2048,
        input: [{ role: 'user', content: analysisPrompt }],
        store: false
      })
    });
    if (!response.ok) {
      var oErr = ''; try { var oErrJson = await response.json(); oErr = oErrJson.error && oErrJson.error.message || ''; } catch(e) {}
      throw new Error(oErr || 'OpenAI API failed (HTTP ' + response.status + ')');
    }
    data = await response.json();
    content = data.output_text || '';
  } else if (activeProvider === 'google') {
    var gemModel = 'gemini-3.1-pro-preview';
    try { var bs = brandSettings[selectedBrand]; if (bs && bs.provider === 'google' && bs.model) gemModel = bs.model; } catch(e) {}
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + googleKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: analysisPrompt }] }]
      })
    });
    if (!response.ok) {
      var gErr = ''; try { var gErrJson = await response.json(); gErr = gErrJson.error && gErrJson.error.message || ''; } catch(e) {}
      throw new Error(gErr || 'Google API failed (HTTP ' + response.status + ')');
    }
    data = await response.json();
    content = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts ? data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('') : '') || '';
  }

  if (!content) {
    throw new Error('No content in AI response');
  }

  // Parse JSON response
  var jsonStr = content.trim();
  if (jsonStr.indexOf('```') === 0) {
    jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error('Failed to parse AI response:', content);
    return {
      summary: content.substring(0, 200),
      products: null,
      targetAudience: null,
      voiceTone: null,
      vocabulary: [],
      insights: ['Document analyzed but structured extraction failed'],
      values: [],
      differentiators: null,
      brandPromise: null
    };
  }
}

/**
 * v9.1.14: Store brand knowledge from document analysis
 * @param {string} brandName - Name of the brand
 * @param {Object} documentData - Document metadata
 * @param {Object} analysis - AI analysis results
 * @returns {Object} - Updated knowledge object
 */
// v13.0: Fixed ES5 compliance
function storeBrandKnowledge(brandName, documentData, analysis) {
  var key = 'roweos_brand_knowledge_' + brandName.replace(/\s+/g, '_').toLowerCase();
  var knowledge = JSON.parse(localStorage.getItem(key) || JSON.stringify({
    documents: [],
    insights: [],
    systemPromptAdditions: ''
  }));

  // Add document
  knowledge.documents.push({
    name: documentData.name,
    uploadedAt: Date.now(),
    chunkCount: documentData.chunks.length,
    summary: analysis.summary,
    extractedData: analysis
  });

  // v9.1.14: Merge insights with source tracking (for removal later)
  if (analysis.insights && analysis.insights.length > 0) {
    analysis.insights.forEach(function(insight) {
      if (!insight) return;

      // Check for duplicates (compare text only)
      var isDuplicate = knowledge.insights.some(function(existing) {
        var existingText = typeof existing === 'object' ? existing.text : existing;
        return existingText === insight;
      });

      if (!isDuplicate) {
        // Store as object with source for later removal
        knowledge.insights.push({
          text: insight,
          source: documentData.name,
          addedAt: Date.now()
        });
      }
    });
  }

  // Build system prompt addition from all document knowledge
  var promptAddition = '\n\n=== LEARNED BRAND KNOWLEDGE (from uploaded documents) ===\n';

  if (analysis.products) {
    promptAddition += 'Products/Services: ' + analysis.products + '\n';
  }
  if (analysis.targetAudience) {
    promptAddition += 'Target Audience: ' + analysis.targetAudience + '\n';
  }
  if (analysis.voiceTone) {
    promptAddition += 'Document Voice: ' + analysis.voiceTone + '\n';
  }
  if (analysis.vocabulary && analysis.vocabulary.length > 0) {
    promptAddition += 'Key Vocabulary: ' + analysis.vocabulary.join(', ') + '\n';
  }
  if (analysis.differentiators) {
    promptAddition += 'Differentiators: ' + analysis.differentiators + '\n';
  }
  if (analysis.brandPromise) {
    promptAddition += 'Brand Promise: ' + analysis.brandPromise + '\n';
  }
  if (knowledge.insights.length > 0) {
    promptAddition += '\nKey Insights:\n';
    // Get last 10 insights, handle both object and string formats
    knowledge.insights.slice(-10).forEach(function(insight) {
      var insightText = typeof insight === 'object' ? insight.text : insight;
      promptAddition += '- ' + insightText + '\n';
    });
  }

  knowledge.systemPromptAdditions = promptAddition;

  localStorage.setItem(key, JSON.stringify(knowledge));

  // v15.14: Track prompt timestamp when Identity data changes from document analysis
  if (typeof saveBrandAIPromptTimestamp === 'function') {
    saveBrandAIPromptTimestamp(selectedBrand);
  }

  return knowledge;
}

/**
 * v9.1.14: Get stored brand knowledge
 * @param {string} brandName - Name of the brand
 * @returns {Object|null} - Brand knowledge or null
 */
function getBrandKnowledge(brandName) {
  var key = 'roweos_brand_knowledge_' + brandName.replace(/\s+/g, '_').toLowerCase();
  var stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

/**
 * v9.1.14: Auto-populate Identity view fields from document analysis
 * @param {number} brandIndex - Index of the brand
 * @param {Object} analysis - AI analysis results
 */
// v13.0: Fixed ES5 compliance
function autoPopulateIdentity(brandIndex, analysis) {
  var brand = brands[brandIndex];
  var updated = false;
  
  // Only fill empty fields - never overwrite existing data
  if (!brand.products && analysis.products) {
    brand.products = analysis.products;
    updated = true;
  }
  if (!brand.targetAudience && !brand.audience && analysis.targetAudience) {
    brand.audience = analysis.targetAudience;
    updated = true;
  }
  if (!brand.ethos && analysis.values && analysis.values.length > 0) {
    brand.ethos = analysis.values.join(', ');
    updated = true;
  }
  if (!brand.promise && analysis.brandPromise) {
    brand.promise = analysis.brandPromise;
    updated = true;
  }
  if (!brand.positioning && analysis.differentiators) {
    brand.positioning = analysis.differentiators;
    updated = true;
  }
  
  // Update voice if empty
  if (brand.voice && typeof brand.voice === 'object') {
    if (!brand.voice.tone && analysis.voiceTone) {
      brand.voice.tone = analysis.voiceTone;
      updated = true;
    }
    if ((!brand.voice.vocabulary || brand.voice.vocabulary.length === 0) && analysis.vocabulary) {
      brand.voice.vocabulary = analysis.vocabulary;
      updated = true;
    }
  } else if (!brand.voice && analysis.voiceTone) {
    brand.voice = analysis.voiceTone;
    updated = true;
  }
  
  if (updated) {
    saveBrands();
    showToast('Brand identity updated with document insights', 'success');
    console.log('[v9.1.14] Auto-populated brand fields from document analysis');
  }
  
  return updated;
}

/**
 * v9.1.14: Update processing UI state
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} status - Status message
 * @param {string} step - Current step description
 */
function updateProcessingUI(progress, status, step) {
  // v9.1.14: Use Identity processing overlay (merged views)
  var overlay = document.getElementById('identityProcessing') || document.getElementById('documentProcessingOverlay');
  var textEl = document.getElementById('identityProcessingText') || document.getElementById('processingStatus');

  if (overlay) overlay.style.display = 'flex';
  if (textEl) textEl.textContent = status + (step ? ' - ' + step : '');
}

/**
 * v9.1.14: Hide processing overlay
 */
function hideProcessingUI() {
  var overlay = document.getElementById('identityProcessing') || document.getElementById('documentProcessingOverlay');
  if (overlay) overlay.style.display = 'none';
}

/**
 * v9.1.14: Save brand insights to localStorage
 */
// v13.0: Fixed ES5 compliance
function saveBrandInsights() {
  var textarea = document.getElementById('knowledge-insights');
  if (!textarea) return;

  var brand = brands[selectedBrand];
  var brandName = brand ? brand.name : '';
  if (!brandName) return;

  var key = 'roweos_brand_knowledge_' + brandName.replace(/\s+/g, '_').toLowerCase();
  var knowledge = JSON.parse(localStorage.getItem(key) || '{"documents":[],"insights":[],"systemPromptAdditions":""}');

  // Parse textarea content into insights array
  var lines = textarea.value.split('\n').filter(function(line) { return line.trim(); });
  knowledge.insights = lines.map(function(line) { return line.replace(/^[•\-\*]\s*/, '').trim(); });

  // Update system prompt additions
  if (knowledge.insights.length > 0) {
    knowledge.systemPromptAdditions = '\n\n=== BRAND INSIGHTS ===\n' +
      knowledge.insights.map(function(i) { return '- ' + i; }).join('\n');
  }

  localStorage.setItem(key, JSON.stringify(knowledge));
  console.log('[v9.1.14] Brand insights saved:', knowledge.insights.length, 'items');

  // v15.14: Auto-update prompt timestamp when insights change
  if (typeof saveBrandAIPromptTimestamp === 'function') {
    saveBrandAIPromptTimestamp(selectedBrand);
  }
}

/**
 * v9.1.14: Load and display brand insights
 */
// v13.0: Fixed ES5 compliance
function loadBrandInsights() {
  var brand = brands[selectedBrand];
  var brandName = brand ? brand.name : '';
  if (!brandName) return;

  var knowledge = getBrandKnowledge(brandName);
  var textarea = document.getElementById('knowledge-insights');
  var countEl = document.getElementById('memoryInsightCount');
  
  // v9.1.14: Always update textarea - clear if no insights
  if (textarea) {
    if (knowledge && knowledge.insights && knowledge.insights.length > 0) {
      // v9.1.14: Handle both object format {text, source} and legacy string format
      textarea.value = knowledge.insights.map(function(i) {
        var text = typeof i === 'object' ? i.text : i;
        return '• ' + text;
      }).join('\n');
    } else {
      // Clear textarea when no insights
      textarea.value = '';
    }
  }
  
  if (countEl) {
    countEl.textContent = knowledge?.insights?.length || 0;
  }
}

/**
 * v9.1.14: Handle drag and drop for documents
 * @param {DragEvent} event - Drop event
 */
function handleDocumentDrop(event) {
  event.preventDefault();
  var files = event.dataTransfer.files;
  if (files.length > 0) {
    // Trigger the same handler as file input
    handleMemoryUpload({ target: { files: files } });
  }
}

/**
 * v9.1.14: Enhanced document upload with AI processing
 * @param {Event} event - File input change event
 */
async function handleMemoryUpload(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;
  
  var brandKey = getBrandMemoryKey(selectedBrand);
  var brandName = (brands[selectedBrand] ? brands[selectedBrand].name : '') || 'Unknown Brand';
  
  if (!brandMemory[brandKey]) {
    brandMemory[brandKey] = { documents: [], chunks: 0, lastUpdate: null };
  }
  
  // Process each file
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    
    try {
      // Show processing UI
      updateProcessingUI(5, 'Processing ' + file.name, 'Reading document...');
      
      // Step 1: Extract text
      updateProcessingUI(15, 'Extracting text...', 'Reading ' + file.name);
      var text = await extractTextFromDocument(file);
      
      if (!text || text.trim().length === 0) {
        showToast('No text content found in ' + file.name, 'warning');
        continue;
      }
      
      // Step 2: Chunk text
      updateProcessingUI(30, 'Processing content...', 'Chunking text...');
      var chunks = chunkText(text, 1500);
      console.log('[v9.1.14] Document chunked:', chunks.length, 'chunks');
      
      // Step 3: AI Analysis
      updateProcessingUI(45, 'Analyzing with BrandAI...', 'Learning about your brand...');
      var analysis = await analyzeDocumentWithAI(chunks, brandName);
      console.log('[v9.1.14] AI Analysis complete:', analysis);
      
      // Step 4: Store knowledge
      updateProcessingUI(75, 'Saving knowledge...', 'Updating brand memory...');
      var knowledge = storeBrandKnowledge(brandName, {
        name: file.name,
        chunks: chunks
      }, analysis);
      
      // Step 5: Update brand memory (existing system)
      brandMemory[brandKey].documents.push({
        name: file.name,
        size: file.size,
        type: file.type,
        chunks: chunks.length,
        uploadDate: new Date().toISOString(),
        processed: true,
        summary: analysis.summary
      });
      brandMemory[brandKey].chunks += chunks.length;
      brandMemory[brandKey].lastUpdate = new Date().toISOString();
      
      // Step 6: Auto-populate Identity fields
      updateProcessingUI(90, 'Updating identity...', 'Applying insights...');
      autoPopulateIdentity(selectedBrand, analysis);
      
      // Step 7: Update insights textarea
      loadBrandInsights();
      
      // Complete
      updateProcessingUI(100, 'Complete!', 'Document processed successfully');
      
      saveBrandMemory();
      updateMemoryUI();
      
      // Short delay to show completion
      await new Promise(function(resolve) { setTimeout(resolve, 800); });
      
      showToast('Document "' + file.name + '" processed and learned', 'success');
      
    } catch (error) {
      console.error('[v9.1.14] Document processing error:', error);
      showToast('Error processing ' + file.name + ': ' + error.message, 'error');
      
      // Still save the document metadata even if AI analysis failed
      brandMemory[brandKey].documents.push({
        name: file.name,
        size: file.size,
        type: file.type,
        chunks: 0,
        uploadDate: new Date().toISOString(),
        processed: false,
        error: error.message
      });
      saveBrandMemory();
      updateMemoryUI();
    }
  }
  
  hideProcessingUI();
  
  // Reset file input
  if (event.target && event.target.value) {
    event.target.value = '';
  }
}

/* ═══════════════════════════════════════════════════════════════
   IDENTITY UI v9.1.14 - Clean Expandable Sections JavaScript
   ═══════════════════════════════════════════════════════════════ */

// Identity section mapping to brand fields
var identitySectionMap = {
  essence: ['philosophy', 'coreBelief', 'mission', 'ethos'],
  voice: ['voice', 'tone', 'approach'],
  audience: ['audience'],
  messaging: ['promise', 'cta', 'tagline'],
  products: ['products', 'services', 'pricing'],
  visual: ['visual', 'constraints'],
  competitive: ['competitive', 'partnerships']
};

/**
 * v24.15: Show identity category tab (Brand User / Brand Knowledge / Platform Memory)
 */
function showIdentityCategory(cat) {
  var cats = ['user', 'knowledge', 'platform'];
  cats.forEach(function(c) {
    var panel = document.getElementById('identityCat_' + c);
    if (panel) panel.style.display = (c === cat) ? '' : 'none';
  });
  // v26.1: Update pill nav active state
  updatePillNavActive('identityPillNav', cat);
  // v24.15: Render platform memory sections on demand
  if (cat === 'platform') {
    if (typeof renderBloomKnowledgeSection === 'function') renderBloomKnowledgeSection();
    if (typeof renderAutomationMemoryList === 'function') renderAutomationMemoryList();
  }
}

/**
 * Toggle identity card expand/collapse
 */
function toggleIdentityCard(headerEl) {
  var card = headerEl.closest('.identity-card');
  if (card) {
    card.classList.toggle('expanded');
  }
}

/**
 * v12.2.4: Update brand role (owner vs employee)
 */
function updateBrandRole(role) {
  var brand = brands[selectedBrand];
  if (!brand) return;

  if (!brand.roleData) brand.roleData = {};
  brand.roleData.type = role;

  // Update UI
  var employeeFields = document.getElementById('employeeRoleFields');
  var ownerFields = document.getElementById('ownerRoleFields');
  var ownerLabel = document.getElementById('roleOwnerLabel');
  var employeeLabel = document.getElementById('roleEmployeeLabel');

  if (role === 'employee') {
    if (employeeFields) employeeFields.style.display = 'block';
    if (ownerFields) ownerFields.style.display = 'none';
    if (employeeLabel) employeeLabel.style.borderColor = 'var(--accent)';
    if (ownerLabel) ownerLabel.style.borderColor = 'transparent';
  } else {
    if (employeeFields) employeeFields.style.display = 'none';
    if (ownerFields) ownerFields.style.display = 'block';
    if (ownerLabel) ownerLabel.style.borderColor = 'var(--accent)';
    if (employeeLabel) employeeLabel.style.borderColor = 'transparent';
  }

  saveBrands();
  // v15.32: Save feedback + timestamp
  saveBrandAIPromptTimestamp(selectedBrand);
  refreshIdentityTimestamp();
  // v18.8: Re-render role badge to reflect changes immediately
  if (typeof renderIdentityRoleBadge === 'function') renderIdentityRoleBadge();
  showToast('Role updated', 'success');
}

/**
 * v12.2.4: Save brand role field
 */
function saveBrandRoleField(field) {
  var brand = brands[selectedBrand];
  if (!brand) return;

  if (!brand.roleData) brand.roleData = {};

  var inputId = 'identity-role-' + field;
  if (field === 'ownerTitle') inputId = 'identity-owner-title';

  var input = document.getElementById(inputId);
  if (input) {
    brand.roleData[field] = input.value;
    saveBrands();
    // v15.32: Update identity timestamp
    saveBrandAIPromptTimestamp(selectedBrand);
    refreshIdentityTimestamp();
    // v18.8: Re-render role badge to reflect changes immediately
    if (typeof renderIdentityRoleBadge === 'function') renderIdentityRoleBadge();
  }
}

/**
 * v12.2.4: Load brand role data
 */
function loadBrandRole() {
  var brand = brands[selectedBrand];
  if (!brand) return;

  var roleData = brand.roleData || {};
  var role = roleData.type || 'owner';

  // Set radio button
  var radios = document.querySelectorAll('input[name="brandRole"]');
  radios.forEach(function(radio) {
    radio.checked = (radio.value === role);
  });

  // Show/hide fields
  var employeeFields = document.getElementById('employeeRoleFields');
  var ownerFields = document.getElementById('ownerRoleFields');
  var ownerLabel = document.getElementById('roleOwnerLabel');
  var employeeLabel = document.getElementById('roleEmployeeLabel');

  if (role === 'employee') {
    if (employeeFields) employeeFields.style.display = 'block';
    if (ownerFields) ownerFields.style.display = 'none';
    if (employeeLabel) employeeLabel.style.borderColor = 'var(--accent)';
    if (ownerLabel) ownerLabel.style.borderColor = 'transparent';
  } else {
    if (employeeFields) employeeFields.style.display = 'none';
    if (ownerFields) ownerFields.style.display = 'block';
    if (ownerLabel) ownerLabel.style.borderColor = 'var(--accent)';
    if (employeeLabel) employeeLabel.style.borderColor = 'transparent';
  }

  // Fill in fields
  var titleInput = document.getElementById('identity-role-title');
  var professionInput = document.getElementById('identity-role-profession');
  var descInput = document.getElementById('identity-role-description');
  var ownerTitleInput = document.getElementById('identity-owner-title');

  if (titleInput) titleInput.value = roleData.title || '';
  if (professionInput) professionInput.value = roleData.profession || '';
  if (descInput) descInput.value = roleData.description || '';
  if (ownerTitleInput) ownerTitleInput.value = roleData.ownerTitle || '';
}

/**
 * v12.2.4: Pending document files for context modal
 */
var pendingDocFiles = [];
var pendingDocMode = 'brand'; // 'brand' or 'life'
var currentViewingDoc = null;

/**
 * v12.2.4: Handle LifeAI document upload - show context modal
 */
function handleLifeIdentityUpload(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;
  openDocContextModal(Array.from(files), 'life');
  event.target.value = '';
}

/**
 * v12.2.4: Handle LifeAI document drop - show context modal
 */
function handleLifeIdentityDocDrop(event) {
  event.preventDefault();
  var files = event.dataTransfer.files;
  if (!files || files.length === 0) return;
  openDocContextModal(Array.from(files), 'life');
}

/**
 * v12.2.4: Open document context modal
 */
function openDocContextModal(files, mode) {
  pendingDocFiles = files;
  pendingDocMode = mode;

  var modal = document.getElementById('docContextModal');
  // v14.2: Null-check fallback with error toast
  if (!modal) {
    console.error('[openDocContextModal] Modal element not found');
    showToast('Could not open document dialog', 'error');
    return;
  }

  var fileNameText = document.getElementById('docContextFileNameText');
  var modeLabel = document.getElementById('docContextModeLabel');
  var typeInput = document.getElementById('docContextType');
  var instructionsInput = document.getElementById('docContextInstructions');

  if (fileNameText) {
    if (files.length === 1) {
      fileNameText.textContent = files[0].name;
    } else {
      fileNameText.textContent = files.length + ' files selected';
    }
  }

  if (modeLabel) modeLabel.textContent = mode === 'life' ? 'LifeAI' : 'BrandAI';
  if (typeInput) typeInput.value = '';
  if (instructionsInput) instructionsInput.value = '';
  // v14.2: Ensure z-index above LifeAI overlays and set display
  modal.style.display = 'flex';
  modal.style.zIndex = '10001';
  modal.classList.add('show');
}

/**
 * v12.2.4: Close document context modal
 */
function closeDocContextModal() {
  var modal = document.getElementById('docContextModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  // v14.0: Remove any backdrop/blur overlay that may persist
  document.querySelectorAll('.modal-backdrop, .modal-overlay-blur').forEach(function(el) {
    el.remove();
  });
  document.body.style.overflow = '';
  document.body.classList.remove('modal-open');
  pendingDocFiles = [];
}

/**
 * v12.2.4: Process document with context
 */
async function processDocWithContext() {
  var typeInput = document.getElementById('docContextType');
  var instrInput = document.getElementById('docContextInstructions');
  var docType = typeInput ? typeInput.value : '';
  var instructions = instrInput ? instrInput.value : '';

  // v13.9: Capture files and mode BEFORE closing modal (which clears pendingDocFiles)
  var filesToProcess = pendingDocFiles.slice();
  var modeToUse = pendingDocMode;

  closeDocContextModal();

  // v14.0: Add processing timeout (5 minutes max)
  var timeoutId = setTimeout(function() {
    closeDocContextModal();
    showToast('Document processing timed out', 'error');
  }, 300000);

  try {
    for (var i = 0; i < filesToProcess.length; i++) {
      if (modeToUse === 'life') {
        await processLifeIdentityFile(filesToProcess[i], docType, instructions);
      } else {
        await processIdentityDocumentWithContext(filesToProcess[i], docType, instructions);
      }
    }
  } catch (err) {
    console.error('[processDocWithContext] Error:', err);
    // v14.0: Ensure modal cleanup on error
    closeDocContextModal();
    showToast('Error processing document: ' + err.message, 'error');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * v12.2.4: Process LifeAI document file with context and AI analysis
 */
async function processLifeIdentityFile(file, docType, instructions) {
  var processing = document.getElementById('lifeIdentityProcessing');
  var processingText = document.getElementById('lifeIdentityProcessingText');
  if (processing) processing.style.display = 'flex';
  if (processingText) processingText.textContent = 'Reading ' + file.name + '...';

  try {
    var content = await readFileContent(file);
    var docId = Date.now();

    // Create document entry
    var lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
    if (!lifeMemory.documents) lifeMemory.documents = [];

    var docEntry = {
      id: docId,
      name: file.name,
      type: file.type,
      size: file.size,
      docType: docType,
      instructions: instructions,
      content: '',  // v15.25: Raw content not persisted, only AI analysis
      uploadedAt: new Date().toISOString(),
      insights: [],
      processed: false,
      source: 'upload'
    };

    lifeMemory.documents.push(docEntry);
    // v15.14: Handle quota exceeded
    try {
      localStorage.setItem('roweos_life_memory', JSON.stringify(lifeMemory));
    } catch (quotaErr) {
      if (quotaErr.name === 'QuotaExceededError' || (quotaErr.message && quotaErr.message.indexOf('quota') !== -1)) {
        // Truncate older document content to make room
        lifeMemory.documents.forEach(function(d) {
          if (d.content && d.content.length > 5000) {
            d.content = d.content.substring(0, 5000) + '\n[Truncated to save storage]';
          }
        });
        try { localStorage.setItem('roweos_life_memory', JSON.stringify(lifeMemory)); } catch(e2) {
          showToast('Storage full. Delete old documents to free space.', 'error');
          throw e2;
        }
        showToast('Older documents truncated to save storage', 'warning');
      } else { throw quotaErr; }
    }
    renderLifeIdentityDocs();

    // Now analyze with AI
    if (processingText) processingText.textContent = 'Analyzing with AI...';
    var insights = await extractLifeInsights(content, file.name, docType, instructions);

    // Update document with insights
    lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
    var docIndex = lifeMemory.documents.findIndex(function(d) { return d.id === docId; });
    if (docIndex >= 0 && insights) {
      lifeMemory.documents[docIndex].insights = insights.insights || [];
      // v24.12: Guard against object summary
      lifeMemory.documents[docIndex].summary = typeof insights.summary === 'string' ? insights.summary : (insights.summary && insights.summary.summary ? insights.summary.summary : '');
      lifeMemory.documents[docIndex].processed = true;
    }
    localStorage.setItem('roweos_life_memory', JSON.stringify(lifeMemory));
    // v26.4: Route through single sync (replaces direct writeDB call)
    syncLifeAIToFirestore({ memory: JSON.stringify(lifeMemory) });

    renderLifeIdentityDocs();
    showToast('Document analyzed - ' + (insights?.insights?.length || 0) + ' insights extracted', 'success');

    // v14.0: Auto-show document insights after successful processing
    if (typeof showDocInsights === 'function' && docId) {
      showDocInsights(docId, 'life');
    }

  } catch (error) {
    console.error('[processLifeIdentityFile] Error:', error);
    showToast('Error processing document: ' + error.message, 'error');
  } finally {
    if (processing) processing.style.display = 'none';
  }
}

/**
 * v12.2.4: Extract insights from document for LifeAI
 */
async function extractLifeInsights(content, fileName, docType, instructions) {
  // v22.49: Use client's selected provider, not hardcoded Anthropic
  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
  var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey');
  var openaiKey = apiKeys.openai;
  var googleKey = apiKeys.google;
  var activeProvider = localStorage.getItem('selectedProvider') || 'anthropic';

  if (activeProvider === 'anthropic' && !anthropicKey) activeProvider = openaiKey ? 'openai' : googleKey ? 'google' : '';
  if (activeProvider === 'openai' && !openaiKey) activeProvider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
  if (activeProvider === 'google' && !googleKey) activeProvider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

  if (!activeProvider) {
    console.log('[extractLifeInsights] No API key available');
    return { summary: '', insights: [] };
  }

  var userName = localStorage.getItem('roweos_user_name') || 'the user';

  var prompt = 'Analyze this personal document for ' + userName + ' and extract insights for their Life AI assistant.\n\n';
  if (docType) prompt += 'DOCUMENT TYPE: ' + docType + '\n';
  if (instructions) prompt += 'USER INSTRUCTIONS: ' + instructions + '\n';
  prompt += '\nExtract meaningful insights that will help a personal AI assistant better understand and help this person.\n\n';
  prompt += 'Return JSON with this structure:\n';
  prompt += '{\n';
  prompt += '  "summary": "2-3 sentence summary of what this document reveals about the person",\n';
  prompt += '  "insights": [\n';
  prompt += '    { "category": "health|goals|preferences|history|relationships|work|finance|other", "title": "Short title", "content": "The insight detail", "importance": "high|medium|low" },\n';
  prompt += '    ...\n';
  prompt += '  ]\n';
  prompt += '}\n\n';
  prompt += 'Document content:\n' + content.substring(0, 12000);

  try {
    var response, data, text;

    if (activeProvider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: localStorage.getItem('claudeModel') || 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      data = await response.json();
      if (data.error) { console.error('[extractLifeInsights] API error:', data.error); return { summary: '', insights: [] }; }
      text = (data.content && data.content[0] && data.content[0].text) || '';
    } else if (activeProvider === 'openai') {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
        body: JSON.stringify({ model: 'gpt-4.1-mini', max_output_tokens: 4000, input: [{ role: 'user', content: prompt }], store: false })
      });
      data = await response.json();
      if (data.error) { console.error('[extractLifeInsights] API error:', data.error); return { summary: '', insights: [] }; }
      text = data.output_text || '';
    } else if (activeProvider === 'google') {
      var gemModel = 'gemini-3.1-pro-preview';
      try { var bs = brandSettings[selectedBrand]; if (bs && bs.provider === 'google' && bs.model) gemModel = bs.model; } catch(e) {}
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + googleKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      data = await response.json();
      if (data.error) { console.error('[extractLifeInsights] API error:', data.error); return { summary: '', insights: [] }; }
      text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts ? data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('') : '') || '';
    }

    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[extractLifeInsights] Error:', error);
  }

  return { summary: '', insights: [] };
}

/**
 * v12.2.4: Render LifeAI documents list with insight counts and click to view
 */
function renderLifeIdentityDocs() {
  var container = document.getElementById('lifeIdentityDocsList');
  var countEl = document.getElementById('lifeDocCount');
  var insightEl = document.getElementById('lifeInsightCount');
  if (!container) return;

  var lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
  var docs = lifeMemory.documents || [];

  // Count total insights
  var totalInsights = 0;
  docs.forEach(function(doc) {
    totalInsights += (doc.insights || []).length;
  });

  if (countEl) countEl.textContent = docs.length;
  if (insightEl) insightEl.textContent = totalInsights;

  if (docs.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No documents yet. Upload health records, journals, goals, or other personal documents.</div>';
    return;
  }

  var html = '';
  docs.forEach(function(doc, idx) {
    var insightCount = (doc.insights || []).length;
    var hasInsights = insightCount > 0;

    html += '<div class="identity-doc-item" onclick="showDocInsights(' + doc.id + ', \'life\')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-tertiary); border-radius: var(--radius-md); margin-bottom: var(--space-2); cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background=\'var(--bg-quaternary)\'" onmouseout="this.style.background=\'var(--bg-tertiary)\'">';
    html += '<div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + (hasInsights ? 'var(--accent)' : 'currentColor') + '" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
    html += '<div style="flex: 1; min-width: 0;">';
    html += '<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(doc.name) + '</div>';
    if (doc.docType) {
      html += '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + escapeHtml(doc.docType) + '</div>';
    }
    html += '</div>';
    html += '</div>';
    html += '<div style="display: flex; align-items: center; gap: 8px;">';
    if (hasInsights) {
      html += '<span style="font-size: var(--text-xs); color: var(--accent); background: rgba(212,175,55,0.1); padding: 2px 8px; border-radius: 10px;">' + insightCount + ' insights</span>';
    } else if (doc.processed) {
      html += '<span style="font-size: var(--text-xs); color: var(--text-muted);">No insights</span>';
    } else {
      html += '<span style="font-size: var(--text-xs); color: var(--text-muted);">Processing...</span>';
    }
    html += '<button onclick="event.stopPropagation(); removeLifeIdentityDoc(' + idx + ')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    html += '</button>';
    html += '</div>';
    html += '</div>';
  });

  container.innerHTML = html;
}

/**
 * v12.2.4: Show document insights modal
 */
function showDocInsights(docId, mode) {
  var doc = null;
  var docIndex = -1;

  if (mode === 'life') {
    var lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
    var lifeDocs = lifeMemory.documents || [];
    // Try to find by id first
    doc = lifeDocs.find(function(d) { return d.id === docId; });
    // If not found and docId is a valid index, use index
    if (!doc && typeof docId === 'number' && docId >= 0 && docId < lifeDocs.length) {
      doc = lifeDocs[docId];
      docIndex = docId;
    }
  } else {
    var brandKey = getBrandMemoryKey(selectedBrand);
    if (brandMemory[brandKey] && brandMemory[brandKey].documents) {
      var brandDocs = brandMemory[brandKey].documents;
      // Try to find by id first
      doc = brandDocs.find(function(d) { return d.id === docId; });
      // If not found and docId is a valid index, use index
      if (!doc && typeof docId === 'number' && docId >= 0 && docId < brandDocs.length) {
        doc = brandDocs[docId];
        docIndex = docId;
      }
    }
  }

  if (!doc) {
    showToast('Document not found', 'error');
    return;
  }

  currentViewingDoc = { doc: doc, mode: mode };

  var modal = document.getElementById('docInsightsModal');
  var fileNameText = document.getElementById('docInsightsFileNameText');
  var contextEl = document.getElementById('docInsightsContext');
  var dateEl = document.getElementById('docInsightsDate');
  var summaryEl = document.getElementById('docInsightsSummary');
  var summaryText = document.getElementById('docInsightsSummaryText');
  var listEl = document.getElementById('docInsightsList');
  var emptyEl = document.getElementById('docInsightsEmpty');

  if (fileNameText) fileNameText.textContent = doc.name;
  if (contextEl) {
    var contextParts = [];
    if (doc.docType) contextParts.push('Type: ' + doc.docType);
    if (doc.source === 'chat') contextParts.push('Added from chat');
    // v13.9: Show user-provided instructions alongside doc context
    if (doc.instructions) contextParts.push('Instructions: ' + doc.instructions);
    contextEl.textContent = contextParts.join(' • ') || '';
    contextEl.style.display = contextParts.length ? 'block' : 'none';
  }
  if (dateEl) dateEl.textContent = 'Uploaded ' + new Date(doc.uploadedAt).toLocaleDateString();

  // Show summary if available
  if (summaryEl && summaryText) {
    var summaryContent = '';
    if (doc.summary) {
      // Handle both string and object formats
      if (typeof doc.summary === 'string') {
        summaryContent = doc.summary;
      } else if (doc.summary.summary) {
        summaryContent = doc.summary.summary;
      }
    }
    if (summaryContent) {
      summaryText.textContent = summaryContent;
      summaryEl.style.display = 'block';
    } else {
      summaryEl.style.display = 'none';
    }
  }

  // Render insights - check both doc.insights and doc.summary.allInsights
  var insights = doc.insights || [];
  if (insights.length === 0 && doc.summary && doc.summary.allInsights) {
    insights = doc.summary.allInsights;
  }
  if (listEl) {
    if (insights.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      var html = '';
      insights.forEach(function(insight) {
        var categoryColors = {
          health: '#22c55e',
          goals: '#3b82f6',
          preferences: '#a855f7',
          history: '#f59e0b',
          relationships: '#ec4899',
          work: '#06b6d4',
          finance: '#eab308',
          essence: '#a89878',
          voice: '#a78bfa',
          audience: '#f472b6',
          messaging: '#4ade80',
          products: '#fbbf24',
          visual: '#06b6d4',
          competitive: '#f97316',
          other: '#6b7280'
        };
        var color = categoryColors[insight.category] || '#6b7280';

        html += '<div style="padding: 14px 16px; background: var(--bg-tertiary); border-radius: var(--radius-md); border-left: 3px solid ' + color + '; cursor: pointer; transition: background 0.2s;" onclick="handleInsightCategoryClick(\'' + escapeHtml(insight.category || 'insight') + '\', \'' + escapeHtml(insight.title || 'Insight') + '\')" onmouseover="this.style.background=\'var(--bg-elevated)\'" onmouseout="this.style.background=\'var(--bg-tertiary)\'">';
        html += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
        html += '<span style="font-size: var(--text-xs); color: ' + color + '; background: ' + color + '20; padding: 2px 8px; border-radius: 10px; text-transform: capitalize; cursor: pointer;">' + (insight.category || 'insight') + '</span>';
        if (insight.importance === 'high') {
          html += '<span style="font-size: var(--text-xs); color: #ef4444;">High priority</span>';
        }
        html += '</div>';
        html += '<div style="font-weight: 500; margin-bottom: 4px;">' + escapeHtml(insight.title || 'Insight') + '</div>';
        html += '<div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5;">' + escapeHtml(insight.content || '') + '</div>';
        html += '</div>';
      });
      listEl.innerHTML = html;
    }
  }

  // v22.51: Use show class (CSS controls visibility via opacity/visibility)
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('show');
  }
}

// v14.3: Handle click on insight card - navigate to chat with pre-filled prompt
function handleInsightCategoryClick(category, title) {
  // Close insights modal
  var modal = document.getElementById('docInsightsModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('show');
  }

  // Determine if we're in LifeAI or BrandAI mode
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';

  // Navigate to chat view
  showView('agent');

  // Pre-fill the chat input
  setTimeout(function() {
    var input = document.getElementById('followupCommand');
    if (input) {
      input.value = 'Tell me more about my ' + category + ' insights, specifically about: ' + title;
      input.focus();
      // Auto-resize textarea if needed
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    }
  }, 300);
}

/**
 * v12.2.4: Close document insights modal
 */
function closeDocInsightsModal() {
  var modal = document.getElementById('docInsightsModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('show');
  }
  // v14.0: Clean up any lingering backdrop/overlay elements
  document.querySelectorAll('.modal-backdrop, .modal-overlay-blur').forEach(function(el) {
    el.remove();
  });
  document.body.style.overflow = '';
  document.body.classList.remove('modal-open');
  // Reset file input so the same file can be re-uploaded
  var fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(function(input) { input.value = ''; });
  currentViewingDoc = null;
}

/**
 * v12.2.4: Re-analyze current document
 */
async function reanalyzeDocument() {
  if (!currentViewingDoc) return;

  var doc = currentViewingDoc.doc;
  var mode = currentViewingDoc.mode;

  closeDocInsightsModal();

  if (mode === 'life') {
    var processing = document.getElementById('lifeIdentityProcessing');
    var processingText = document.getElementById('lifeIdentityProcessingText');
    if (processing) processing.style.display = 'flex';
    if (processingText) processingText.textContent = 'Re-analyzing ' + doc.name + '...';

    try {
      var insights = await extractLifeInsights(doc.content, doc.name, doc.docType, doc.instructions);

      var lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
      var docIndex = (lifeMemory.documents || []).findIndex(function(d) { return d.id === doc.id; });
      if (docIndex >= 0 && insights) {
        lifeMemory.documents[docIndex].insights = insights.insights || [];
        // v24.12: Guard against object summary
        lifeMemory.documents[docIndex].summary = typeof insights.summary === 'string' ? insights.summary : (insights.summary && insights.summary.summary ? insights.summary.summary : '');
        lifeMemory.documents[docIndex].processed = true;
      }
      localStorage.setItem('roweos_life_memory', JSON.stringify(lifeMemory));

      renderLifeIdentityDocs();
      showToast('Document re-analyzed - ' + (insights?.insights?.length || 0) + ' insights', 'success');
    } catch (error) {
      showToast('Error re-analyzing: ' + error.message, 'error');
    } finally {
      if (processing) processing.style.display = 'none';
    }
  } else {
    // Brand document re-analysis
    var processingEl = document.getElementById('identityProcessing');
    var processingTextEl = document.getElementById('identityProcessingText');
    if (processingEl) processingEl.style.display = 'flex';
    if (processingTextEl) processingTextEl.textContent = 'Re-analyzing ' + doc.name + '...';

    try {
      var brandName = (brands[selectedBrand] ? brands[selectedBrand].name : '') || 'Unknown';
      var summary = await extractIdentityInsights(doc.content || '', doc.name, brandName);

      var brandKey = getBrandMemoryKey(selectedBrand);
      var docIndex = (brandMemory[brandKey]?.documents || []).findIndex(function(d) { return d.id === doc.id; });
      if (docIndex >= 0 && summary) {
        // v24.11: Store summary string (not full object) to prevent [object Object] display
        brandMemory[brandKey].documents[docIndex].summary = typeof summary === 'string' ? summary : (summary.summary || '');
        brandMemory[brandKey].documents[docIndex].processed = true;
      }
      saveBrandMemory();

      loadIdentityDocs();
      showToast('Document re-analyzed', 'success');
    } catch (error) {
      showToast('Error re-analyzing: ' + error.message, 'error');
    } finally {
      if (processingEl) processingEl.style.display = 'none';
    }
  }
}

/**
 * v12.2.4: Check for attached files and show save-to-identity option
 */
function checkForSaveToIdentity(streamContainer, aiResponse, mode) {
  // Check if the first message in conversation had attached files
  if (!currentConversation || currentConversation.length === 0) return;

  var userMsg = currentConversation[0];
  if (!userMsg.attachedFiles || userMsg.attachedFiles.length === 0) return;

  // Create save-to-identity action bar
  var actionBar = document.createElement('div');
  actionBar.className = 'chat-save-identity-bar';
  actionBar.style.cssText = 'margin-top: 12px; padding: 12px 16px; background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; gap: 12px;';

  var infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1;';
  infoDiv.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a89878" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' +
    '<div style="flex: 1;">' +
      '<div style="font-weight: 500; color: var(--text-primary); font-size: var(--text-sm);">Save document to ' + (mode === 'life' ? 'Life' : 'Brand') + ' Identity?</div>' +
      '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + userMsg.attachedFiles.length + ' file(s) analyzed - save insights for future reference</div>' +
    '</div>';

  var btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display: flex; gap: 8px;';

  var dismissBtn = document.createElement('button');
  dismissBtn.style.cssText = 'padding: 6px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; font-size: var(--text-sm);';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.onclick = function() { actionBar.remove(); };

  var saveBtn = document.createElement('button');
  saveBtn.style.cssText = 'padding: 6px 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: var(--accent-text, #fff); cursor: pointer; font-size: var(--text-sm); font-weight: 500;';
  saveBtn.textContent = 'Save to Identity';
  saveBtn.onclick = function() {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    saveChatDocToIdentity(userMsg.attachedFiles, aiResponse, mode);
    actionBar.remove();
  };

  btnGroup.appendChild(dismissBtn);
  btnGroup.appendChild(saveBtn);
  actionBar.appendChild(infoDiv);
  actionBar.appendChild(btnGroup);

  // Find the message bubble to append to
  if (streamContainer && streamContainer.parentElement) {
    var bubble = streamContainer.closest('.conversation-message-bubble') || streamContainer.parentElement;
    bubble.appendChild(actionBar);
  }
}

/**
 * v12.2.4: Save document from chat to Identity
 */
async function saveChatDocToIdentity(attachedFiles, aiResponse, mode) {
  var savedCount = 0;

  for (var i = 0; i < attachedFiles.length; i++) {
    var file = attachedFiles[i];
    var docId = Date.now() + i;
    var fileContent = file.content || '';

    if (mode === 'life') {
      // Save to LifeAI Identity
      var lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
      if (!lifeMemory.documents) lifeMemory.documents = [];

      // Extract insights from AI response
      var insights = extractInsightsFromResponse(aiResponse, 'life');

      lifeMemory.documents.push({
        id: docId,
        name: file.name,
        type: file.type,
        size: file.size,
        content: fileContent.substring(0, 500000),
        docType: 'Chat Analysis',
        uploadedAt: new Date().toISOString(),
        insights: insights,
        summary: 'Analyzed via LifeAI chat',
        processed: true,
        source: 'chat'
      });

      localStorage.setItem('roweos_life_memory', JSON.stringify(lifeMemory));
      savedCount++;

      // v22.50: Also run life insights extraction to populate life identity
      if (fileContent && typeof extractLifeInsights === 'function') {
        try {
          var lifeInsights = await extractLifeInsights(fileContent, file.name, '', '');
          if (lifeInsights && lifeInsights.insights) {
            lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
            var lifeDocIdx = (lifeMemory.documents || []).findIndex(function(d) { return d.id === docId; });
            if (lifeDocIdx >= 0) {
              lifeMemory.documents[lifeDocIdx].insights = lifeInsights.insights;
              // v24.12: Guard against object summary
              var _lifeSumVal = lifeInsights.summary;
              lifeMemory.documents[lifeDocIdx].summary = typeof _lifeSumVal === 'string' ? _lifeSumVal : (_lifeSumVal && _lifeSumVal.summary ? _lifeSumVal.summary : lifeMemory.documents[lifeDocIdx].summary);
            }
            localStorage.setItem('roweos_life_memory', JSON.stringify(lifeMemory));
          }
        } catch(lifeErr) {
          console.warn('[saveChatDocToIdentity] Life insights extraction error:', lifeErr);
        }
      }

    } else {
      // Save to BrandAI Identity
      var brandKey = getBrandMemoryKey(selectedBrand);
      if (!brandMemory[brandKey]) {
        brandMemory[brandKey] = { documents: [], chunks: 0, lastUpdate: null };
      }

      // Extract insights from AI response
      var brandInsights = extractInsightsFromResponse(aiResponse, 'brand');

      brandMemory[brandKey].documents.push({
        id: docId,
        name: file.name,
        size: file.size,
        chunks: fileContent ? Math.ceil(fileContent.length / 2000) : 0,
        content: fileContent.substring(0, 500000),
        docType: 'Chat Analysis',
        uploadedAt: new Date().toISOString(),
        insights: brandInsights,
        summary: 'Analyzed via BrandAI chat',
        processed: true,
        source: 'chat'
      });
      brandMemory[brandKey].lastUpdate = new Date().toISOString();
      saveBrandMemory();
      savedCount++;

      // v22.50: Run identity extraction to populate identity sections (essence, voice, etc.)
      // Uses the AI's analysis response as content to extract from — avoids redundant API call
      var extractContent = aiResponse || fileContent;
      if (extractContent && typeof extractIdentityInsightsWithContext === 'function') {
        try {
          var brandName = brands[selectedBrand] ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'Unknown';
          showToast('Extracting identity insights...', 'info');
          var extracted = await extractIdentityInsightsWithContext(extractContent, file.name, brandName, 'Chat Analysis', '');
          if (extracted) {
            // Update document with rich insights
            var dIdx = brandMemory[brandKey].documents.findIndex(function(d) { return d.id === docId; });
            if (dIdx >= 0) {
              // v24.11: Store summary string (not full object) to prevent [object Object] display
              brandMemory[brandKey].documents[dIdx].summary = typeof extracted === 'string' ? extracted : (extracted.summary || '');
              brandMemory[brandKey].documents[dIdx].insights = extracted.allInsights || brandInsights;
              brandMemory[brandKey].documents[dIdx].processed = true;
            }
            saveBrandMemory();
            // Refresh Identity docs list if visible
            if (typeof loadIdentityDocs === 'function') loadIdentityDocs();
            if (typeof loadIdentityData === 'function') loadIdentityData();
          }
        } catch(extErr) {
          console.warn('[saveChatDocToIdentity] Identity extraction error:', extErr);
        }
      }
    }
  }

  showToast(savedCount + ' document(s) saved to ' + (mode === 'life' ? 'Life' : 'Brand') + ' Identity with section insights', 'success');
  // v25.1: Write-through handled by saveBrandMemory() calls above
}

/**
 * v12.2.4: Extract insights from AI response text
 */
function extractInsightsFromResponse(response, mode) {
  var insights = [];

  // Simple extraction based on response structure
  // Look for bullet points, numbered lists, key findings
  var lines = response.split('\n');
  var currentCategory = 'other';

  var categoryKeywords = {
    health: ['health', 'medical', 'medication', 'symptom', 'diagnosis', 'treatment', 'wellness'],
    goals: ['goal', 'objective', 'target', 'milestone', 'achieve', 'plan'],
    preferences: ['prefer', 'like', 'favorite', 'style', 'choice'],
    work: ['work', 'job', 'career', 'professional', 'business', 'company'],
    finance: ['finance', 'money', 'budget', 'investment', 'savings', 'expense'],
    essence: ['brand', 'identity', 'mission', 'vision', 'value', 'purpose'],
    voice: ['voice', 'tone', 'communication', 'style', 'language'],
    audience: ['audience', 'customer', 'client', 'demographic', 'target market'],
    messaging: ['message', 'tagline', 'slogan', 'value proposition'],
    products: ['product', 'service', 'offering', 'solution']
  };

  lines.forEach(function(line) {
    line = line.trim();
    // Look for bullet points or key statements
    if ((line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || line.match(/^\d+\./)) && line.length > 20) {
      var content = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');

      // Detect category
      var detectedCategory = 'other';
      var lowerLine = line.toLowerCase();
      Object.keys(categoryKeywords).forEach(function(cat) {
        categoryKeywords[cat].forEach(function(kw) {
          if (lowerLine.includes(kw)) {
            detectedCategory = cat;
          }
        });
      });

      insights.push({
        category: detectedCategory,
        title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        content: content,
        importance: 'medium'
      });
    }
  });

  // Limit to 10 insights
  return insights.slice(0, 10);
}

/**
 * v12.2.4: Remove LifeAI document
 */
function removeLifeIdentityDoc(idx) {
  var lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
  if (!lifeMemory.documents) return;

  lifeMemory.documents.splice(idx, 1);
  localStorage.setItem('roweos_life_memory', JSON.stringify(lifeMemory));
  renderLifeIdentityDocs();
  showToast('Document removed', 'info');
}

/**
 * Auto-save identity field on blur
 */
function autoSaveIdentityField(section, type) {
  // v14.0: Bounds check and toast on failure
  if (selectedBrand < 0 || selectedBrand >= brands.length) {
    showToast('No brand selected - unable to save', 'warning');
    return;
  }
  var brand = brands[selectedBrand];
  if (!brand) {
    showToast('Brand not found - unable to save', 'warning');
    return;
  }

  var textarea = document.getElementById('identity-' + section + '-' + type);
  if (!textarea) return;

  try {
    // Initialize identity data structure if needed
    if (!brand.identityData) brand.identityData = {};
    if (!brand.identityData[section]) brand.identityData[section] = {};

    brand.identityData[section][type] = textarea.value;

    // Save to localStorage
    saveBrands();
    // v15.32: Update identity timestamp
    saveBrandAIPromptTimestamp(selectedBrand);
    refreshIdentityTimestamp();
  } catch (e) {
    showToast('Failed to save: ' + e.message, 'error');
    return;
  }

  // Update badge visibility
  updateIdentityBadges(section);

  // v9.1.14: Show inline saved indicator (not toast - too noisy)
  showIdentitySavedIndicator(section);
  
  // v9.1.14: Trigger background sync to Firebase
  if (typeof queueBackgroundSync === 'function') {
    queueBackgroundSync();
  }
}

/**
 * v9.1.14: Show inline "Saved ✓" indicator for Identity section
 */
function showIdentitySavedIndicator(section) {
  // Find the card for this section
  var card = document.querySelector('.identity-card[data-section="' + section + '"]');
  if (!card) return;
  
  // Look for existing indicator or create one in the meta section
  var indicator = card.querySelector('.identity-saved-indicator');
  if (!indicator) {
    // Find the meta section to append to
    var meta = card.querySelector('.identity-card-meta');
    if (!meta) return;
    
    indicator = document.createElement('span');
    indicator.className = 'identity-saved-indicator';
    indicator.style.cssText = 'font-size: var(--text-sm); color: var(--accent); opacity: 0; transition: opacity 0.3s ease; display: inline-flex; align-items: center; gap: var(--space-1); margin-left: var(--space-2);';
    indicator.innerHTML = icon('check', {size: 12, strokeWidth: 2.5}) + ' Saved';
    meta.appendChild(indicator);
  }
  
  // Show the indicator
  indicator.style.opacity = '1';
  
  // Hide after 2 seconds
  clearTimeout(indicator._hideTimeout);
  indicator._hideTimeout = setTimeout(function() {
    indicator.style.opacity = '0';
  }, 2000);
}

/**
 * Update badges showing owner/AI content
 */
function updateIdentityBadges(section) {
  var brand = brands[selectedBrand];
  if (!brand || !brand.identityData) return;
  
  var data = brand.identityData[section] || {};
  
  var ownerBadge = document.getElementById('badge-' + section + '-owner');
  var aiBadge = document.getElementById('badge-' + section + '-ai');
  
  if (ownerBadge) {
    var ownerValue = typeof data.owner === 'string' ? data.owner : '';
    ownerBadge.style.display = ownerValue && ownerValue.trim() ? 'inline-block' : 'none';
  }
  if (aiBadge) {
    // v9.1.14: Handle AI as string or array
    var hasAi = false;
    if (typeof data.ai === 'string' && data.ai.trim()) {
      hasAi = true;
    } else if (Array.isArray(data.ai) && data.ai.length > 0) {
      hasAi = true;
    }
    aiBadge.style.display = hasAi ? 'inline-block' : 'none';
  }
}

/**
 * v9.1.14: Make AI insight editable (focus the textarea)
 */
function makeAiInsightEditable(section) {
  var textarea = document.getElementById('identity-' + section + '-ai');
  if (textarea) {
    textarea.focus();
    textarea.parentElement.classList.add('editing');
  }
}

/**
 * v24.13: Reorganize all identity content with AI - categorizes more clearly without losing depth
 */
function reorganizeIdentityWithAI() {
  var brand = brands[selectedBrand];
  if (!brand) { showToast('No brand selected', 'error'); return; }
  var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
  var allContent = {};
  var hasContent = false;
  sections.forEach(function(s) {
    var ownerEl = document.getElementById('identity-' + s + '-owner');
    var aiEl = document.getElementById('identity-' + s + '-ai');
    var owner = ownerEl ? ownerEl.value.trim() : (brand.identityData && brand.identityData[s] ? (brand.identityData[s].owner || '') : '');
    var ai = aiEl ? aiEl.value.trim() : (brand.identityData && brand.identityData[s] ? (brand.identityData[s].ai || '') : '');
    if (Array.isArray(ai)) ai = ai.join('\n');
    if (owner || ai) { allContent[s] = { owner: owner, ai: ai }; hasContent = true; }
  });
  if (!hasContent) { showToast('No identity content to reorganize', 'warning'); return; }
  showToast('Reorganizing identity content...', 'info');
  var prompt = 'You are reorganizing brand identity content for ' + brand.name + '. Your goal is to take ALL existing content and reorganize it into cleaner, more structured categories. CRITICAL RULES:\n- Do NOT lose ANY detail or depth. Every piece of information must be preserved.\n- Categorize and structure the content more clearly with headers, bullet points, and logical groupings.\n- Remove redundancy (same info repeated across sections) but keep ALL unique details.\n- Use clear formatting: headers for sub-categories, bullet points for lists.\n- Return a JSON object with these exact keys: essence, voice, audience, messaging, products, visual, competitive\n- Each key should have a string value with the reorganized content for that section.\n\nHere is all the current identity content:\n\n';
  sections.forEach(function(s) {
    if (allContent[s]) {
      prompt += '=== ' + s.toUpperCase() + ' ===\n';
      if (allContent[s].ai) prompt += 'AI Insights:\n' + allContent[s].ai + '\n\n';
      if (allContent[s].owner) prompt += 'Owner Definition:\n' + allContent[s].owner + '\n\n';
    }
  });
  prompt += '\nReturn ONLY a JSON object with the 7 section keys. Each value is a string with the reorganized, well-structured content. Merge AI insights and owner definitions into one cohesive text per section.';
  // v25.1: Multi-provider support - resolve provider from user settings using roweos_api_keys JSON
  var modelMap = { anthropic: 'claude-sonnet-4-20250514', openai: 'gpt-4o', google: 'gemini-2.5-flash' };
  var provider = localStorage.getItem('selectedProvider') || 'anthropic';
  var apiKey = '';
  try {
    var _reorgKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    apiKey = _reorgKeys[provider] || '';
    if (!apiKey) {
      // Fall back through other providers
      var fallbacks = ['anthropic', 'openai', 'google'].filter(function(p) { return p !== provider; });
      for (var fi = 0; fi < fallbacks.length; fi++) {
        apiKey = _reorgKeys[fallbacks[fi]] || '';
        if (apiKey) { provider = fallbacks[fi]; break; }
      }
    }
  } catch(e) {}
  if (!apiKey) { showToast('No API key configured -- add one in Settings > API Keys', 'error'); return; }
  var model = modelMap[provider];
  var systemPrompt = 'You reorganize brand identity content. Return ONLY valid JSON, no markdown fences.';
  makeScheduledTaskAPICall(provider, model, apiKey, systemPrompt, prompt, 0, 8000).then(function(text) {
    if (!text) { showToast('AI returned empty response', 'error'); return; }
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { showToast('Could not parse AI response', 'error'); return; }
    try {
      var reorganized = JSON.parse(jsonMatch[0]);
      // Show confirmation modal
      var modalHtml = '<div style="max-height:60vh;overflow-y:auto;font-size:13px;">';
      sections.forEach(function(s) {
        if (reorganized[s]) {
          modalHtml += '<div style="margin-bottom:16px;"><strong style="color:var(--accent);text-transform:capitalize;">' + s + '</strong>';
          modalHtml += '<pre style="white-space:pre-wrap;color:var(--text-secondary);margin:4px 0 0;font-size:12px;font-family:inherit;">' + escapeHtml(reorganized[s]).substring(0, 500) + (reorganized[s].length > 500 ? '...' : '') + '</pre></div>';
        }
      });
      modalHtml += '</div>';
      showConfirmModal('Apply Reorganized Identity?', modalHtml, function() {
        if (!brand.identityData) brand.identityData = {};
        sections.forEach(function(s) {
          if (reorganized[s]) {
            if (!brand.identityData[s]) brand.identityData[s] = {};
            brand.identityData[s].owner = reorganized[s];
            var ownerEl = document.getElementById('identity-' + s + '-owner');
            if (ownerEl) ownerEl.value = reorganized[s];
          }
        });
        saveBrands();
        // v25.1: saveBrands() already writes through to Firestore
        showToast('Identity reorganized successfully', 'success');
      });
    } catch(e) { showToast('Failed to parse reorganized content', 'error'); }
  }).catch(function(err) { showToast('Reorganize failed: ' + err.message, 'error'); });
}

/**
 * v24.13: Push updated identity to system prompt with before/after diff approval
 */
function pushIdentityToSystemPrompt() {
  var brand = brands[selectedBrand];
  if (!brand) { showToast('No brand selected', 'error'); return; }
  var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
  // Build current identity content
  var identityContent = '';
  sections.forEach(function(s) {
    var ownerEl = document.getElementById('identity-' + s + '-owner');
    var aiEl = document.getElementById('identity-' + s + '-ai');
    var owner = ownerEl ? ownerEl.value.trim() : (brand.identityData && brand.identityData[s] ? (brand.identityData[s].owner || '') : '');
    var ai = aiEl ? aiEl.value.trim() : (brand.identityData && brand.identityData[s] ? (brand.identityData[s].ai || '') : '');
    if (Array.isArray(ai)) ai = ai.join('\n');
    if (owner || ai) {
      identityContent += '\n' + s.charAt(0).toUpperCase() + s.slice(1) + ':\n';
      if (owner) identityContent += owner + '\n';
      if (ai) identityContent += ai + '\n';
    }
  });
  if (!identityContent.trim()) { showToast('No identity content to push', 'warning'); return; }
  // Get current system prompt additions
  var currentAdditions = '';
  try {
    var knowledge = getBrandKnowledge(brand.name);
    if (knowledge && knowledge.systemPromptAdditions) currentAdditions = knowledge.systemPromptAdditions;
  } catch(e) {}
  // Build new system prompt additions from identity
  var newAdditions = '=== BRAND IDENTITY (from Identity View) ===\n';
  newAdditions += identityContent;
  // Show diff modal
  var diffHtml = '<div style="max-height:60vh;overflow-y:auto;font-size:13px;">';
  diffHtml += '<div style="margin-bottom:16px;"><strong style="color:var(--text-muted);">BEFORE (current system prompt additions):</strong>';
  diffHtml += '<pre style="white-space:pre-wrap;color:var(--text-secondary);margin:8px 0;padding:12px;background:rgba(255,0,0,0.05);border-radius:8px;font-size:12px;font-family:inherit;max-height:200px;overflow-y:auto;">' + escapeHtml(currentAdditions || '(empty - no identity in prompt yet)') + '</pre></div>';
  diffHtml += '<div><strong style="color:var(--accent);">AFTER (new identity-based prompt):</strong>';
  diffHtml += '<pre style="white-space:pre-wrap;color:var(--text-primary);margin:8px 0;padding:12px;background:rgba(var(--brand-accent-rgb),0.05);border-radius:8px;font-size:12px;font-family:inherit;max-height:200px;overflow-y:auto;">' + escapeHtml(newAdditions) + '</pre></div>';
  diffHtml += '</div>';
  showConfirmModal('Push Identity to System Prompt?', diffHtml, function() {
    // Save to brand knowledge systemPromptAdditions
    try {
      var knowledgeKey = 'roweos_brand_knowledge_' + brand.name.replace(/\s+/g, '_').toLowerCase();
      var knowledge = {};
      try { knowledge = JSON.parse(localStorage.getItem(knowledgeKey) || '{}'); } catch(e) {}
      knowledge.systemPromptAdditions = newAdditions;
      knowledge.lastPushedAt = new Date().toISOString();
      localStorage.setItem(knowledgeKey, JSON.stringify(knowledge));
      writeDB('profile/main', { brandKnowledge: knowledge }); // v25.1
      showToast('Identity pushed to system prompt', 'success');
    } catch(e) { showToast('Failed to update system prompt: ' + e.message, 'error'); }
  });
}

/**
 * v9.1.14: Refine Identity field with BrandAI conversation
 * Opens BrandAI chat with a pre-filled prompt to discuss and refine the specific identity category
 */
/**
 * v24.13: Logo variant upload and management
 */
function handleLogoVariantUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  var brand = brands[selectedBrand];
  if (!brand) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var maxSize = 400;
      var w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/png', 0.85);
      if (!brand.logoVariants) brand.logoVariants = [];
      var label = prompt('Label for this logo variant (e.g., "Primary", "Icon Only", "Light BG"):');
      brand.logoVariants.push({ id: Date.now(), data: dataUrl, label: label || 'Logo', addedAt: new Date().toISOString() });
      saveBrands();
      renderLogoVariants();
      // v25.1: saveBrands() already writes through to Firestore
      showToast('Logo variant added', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeLogoVariant(variantId) {
  var brand = brands[selectedBrand];
  if (!brand || !brand.logoVariants) return;
  brand.logoVariants = brand.logoVariants.filter(function(v) { return v.id !== variantId; });
  saveBrands();
  renderLogoVariants();
  // v25.1: saveBrands() already writes through to Firestore
}

function renderLogoVariants() {
  var grid = document.getElementById('logoVariantsGrid');
  if (!grid) return;
  var brand = brands[selectedBrand];
  var variants = (brand && brand.logoVariants) || [];
  var countBadge = document.getElementById('badge-logos-count');
  if (countBadge) {
    countBadge.textContent = variants.length;
    countBadge.style.display = variants.length > 0 ? 'inline-block' : 'none';
  }
  if (variants.length === 0) { grid.innerHTML = '<p style="font-size:12px;color:var(--text-muted);grid-column:1/-1;">No logo variants added yet</p>'; return; }
  var html = '';
  variants.forEach(function(v) {
    html += '<div style="position:relative;background:var(--bg-tertiary);border-radius:var(--radius-md);padding:8px;text-align:center;">';
    html += '<img src="' + v.data + '" style="max-width:100%;max-height:80px;border-radius:4px;object-fit:contain;" alt="' + escapeHtml(v.label) + '">';
    html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">' + escapeHtml(v.label) + '</div>';
    html += '<button onclick="removeLogoVariant(' + v.id + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.5);border:none;color:#fff;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:10px;line-height:18px;padding:0;" title="Remove">&times;</button>';
    html += '</div>';
  });
  grid.innerHTML = html;
}

/**
 * v24.13: Visual identity reference photo upload
 */
function handleVisualRefUpload(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;
  var brand = brands[selectedBrand];
  if (!brand) return;
  if (!brand.visualRefPhotos) brand.visualRefPhotos = [];
  var processed = 0;
  for (var i = 0; i < files.length; i++) {
    (function(file) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var maxSize = 600;
          var w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) {
            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
            else { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          brand.visualRefPhotos.push({ id: Date.now() + Math.random(), data: canvas.toDataURL('image/jpeg', 0.8), addedAt: new Date().toISOString() });
          processed++;
          if (processed === files.length) {
            saveBrands();
            renderVisualRefPhotos();
            // v25.1: saveBrands() already writes through to Firestore
            showToast(files.length + ' reference photo(s) added', 'success');
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    })(files[i]);
  }
  event.target.value = '';
}

function removeVisualRefPhoto(photoId) {
  var brand = brands[selectedBrand];
  if (!brand || !brand.visualRefPhotos) return;
  brand.visualRefPhotos = brand.visualRefPhotos.filter(function(p) { return p.id !== photoId; });
  saveBrands();
  renderVisualRefPhotos();
  // v25.1: saveBrands() already writes through to Firestore
}

function renderVisualRefPhotos() {
  var container = document.getElementById('visualRefPhotos');
  if (!container) return;
  var brand = brands[selectedBrand];
  var photos = (brand && brand.visualRefPhotos) || [];
  if (photos.length === 0) { container.innerHTML = ''; return; }
  var html = '';
  photos.forEach(function(p) {
    html += '<div style="position:relative;width:100px;height:100px;border-radius:var(--radius-md);overflow:hidden;background:var(--bg-tertiary);">';
    html += '<img src="' + p.data + '" style="width:100%;height:100%;object-fit:cover;">';
    html += '<button onclick="removeVisualRefPhoto(' + p.id + ')" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border:none;color:#fff;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:10px;line-height:18px;padding:0;" title="Remove">&times;</button>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function refineIdentityWithBrandAI(section, displayName) {
  var brand = brands[selectedBrand];
  if (!brand) {
    showToast('No brand selected', 'error');
    return;
  }
  
  // v9.1.14: Get current value from OWNER field (Your Definition), not AI field
  var currentValue = '';
  var aiInsights = '';
  
  // Check identityData first (saved data)
  if (brand.identityData && brand.identityData[section]) {
    currentValue = brand.identityData[section].owner || '';
    aiInsights = brand.identityData[section].ai || '';
    if (Array.isArray(aiInsights)) {
      aiInsights = aiInsights.join('\n');
    }
  }
  
  // Also check textarea if visible (in case unsaved changes)
  var ownerTextarea = document.getElementById('identity-' + section + '-owner');
  if (ownerTextarea && ownerTextarea.value.trim()) {
    currentValue = ownerTextarea.value.trim();
  }
  
  // Store the section we're refining for later use
  window.identityRefineContext = {
    section: section,
    displayName: displayName,
    brandName: brand.name
  };
  
  // Build the prompt with actual content
  var prompt = 'I want to refine the ' + displayName + ' for ' + brand.name + '.';
  
  if (currentValue) {
    prompt += '\n\nHere\'s what we currently have defined:\n\n"' + currentValue + '"';
    if (aiInsights) {
      prompt += '\n\nPrevious AI insights:\n' + aiInsights;
    }
    prompt += '\n\nLet\'s discuss how we can improve or expand on this. Ask me questions to help clarify and strengthen this aspect of the brand.';
  } else {
    prompt += '\n\nWe don\'t have anything defined yet for this category. Help me define our ' + displayName.toLowerCase() + ' by asking me some questions about the brand.';
  }
  
  // Switch to BrandAI view
  showView('agent');
  
  // Clear any existing conversation and start fresh
  newConversation();
  
  // Set the prompt in the input field
  setTimeout(function() {
    var inputField = document.getElementById('agentCommand');
    if (inputField) {
      inputField.value = prompt;
      inputField.style.height = 'auto';
      inputField.style.height = Math.min(inputField.scrollHeight, 200) + 'px';
      inputField.focus();
    }
    
    // Show a toast explaining the feature
    showToast('Discuss with BrandAI, then click "Apply to Identity" when ready', 'info');
  }, 100);
  
  // Add the "Apply to Identity" button to the chat interface
  setTimeout(function() {
    addApplyToIdentityButton(section, displayName);
  }, 200);
}

/**
 * v9.1.14: Add "Apply to Identity" button to the chat interface
 */
function addApplyToIdentityButton(section, displayName) {
  // Check if button already exists
  if (document.getElementById('applyToIdentityBtn')) return;
  
  // Find the followup container (conversation input area)
  var followupContainer = document.getElementById('agentConversation')?.querySelector('.chat-input-v2');
  if (!followupContainer) return;
  
  // Create the button
  var btn = document.createElement('button');
  btn.id = 'applyToIdentityBtn';
  btn.className = 'identity-apply-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Apply to ' + displayName;
  btn.onclick = function() {
    generateApplyPreview(section, displayName);
  };
  
  // v9.1.14: SOLID background - detect light/dark mode
  var isLightMode = document.documentElement.classList.contains('light-mode');
  var bgColor = isLightMode ? '#f0f0f0' : '#2a2a2f';
  var hoverBg = isLightMode ? '#e0e0e0' : '#3a3a40';
  
  btn.style.cssText = 'position: absolute; top: -44px; right: 0; padding: 8px 14px; background: ' + bgColor + '; border: 1px solid var(--accent); border-radius: var(--radius-md); color: var(--accent); font-size: var(--text-sm); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease; z-index: 10;';
  
  // Add hover effects
  btn.onmouseover = function() {
    btn.style.background = hoverBg;
  };
  btn.onmouseout = function() {
    btn.style.background = bgColor;
  };
  
  // Style the SVG
  var svg = btn.querySelector('svg');
  if (svg) {
    svg.style.cssText = 'width: 14px; height: 14px;';
  }
  
  // Make container relative for absolute positioning
  followupContainer.style.position = 'relative';
  
  followupContainer.appendChild(btn);
}

/**
 * v9.1.14: Generate preview via BrandAI before applying to Identity
 */
async function generateApplyPreview(section, displayName) {
  // Get the current conversation
  if (!currentConversation || currentConversation.length === 0) {
    showToast('Have a conversation with BrandAI first', 'warning');
    return;
  }
  
  // Get current Identity content for this section
  var brand = brands[selectedBrand];
  var currentContent = '';
  if (brand && brand.identityData && brand.identityData[section]) {
    currentContent = brand.identityData[section].owner || '';
  }
  
  // Build conversation context
  var conversationSummary = currentConversation.map(function(msg) {
    return msg.role === 'user' ? 'User: ' + msg.content : 'BrandAI: ' + msg.content;
  }).join('\n\n');
  
  // Show loading state
  var btn = document.getElementById('applyToIdentityBtn');
  if (btn) {
    btn.innerHTML = '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg> Generating preview...';
    btn.disabled = true;
  }
  
  try {
    // Get API key
    var apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    var apiKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey');
    
    if (!apiKey) {
      showToast('No API key configured', 'error');
      resetApplyButton(section, displayName);
      return;
    }
    
    // v9.1.14: Ask for both new content AND a refinement summary
    var prompt = `Based on this conversation, generate the updated content for the "${displayName}" section of the brand identity.

Current ${displayName} content:
${currentContent || '(empty)'}

Conversation:
${conversationSummary.substring(0, 6000)}

Return a JSON object with exactly these two fields:
1. "content": The new "${displayName}" content (2-4 substantive sentences that incorporate the refinements discussed)
2. "summary": A brief 1-sentence summary of what was refined/changed (e.g., "Clarified target demographic focus from general consumers to luxury-seeking professionals aged 35-55")

Return ONLY valid JSON, no markdown, no explanations.`;

    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: localStorage.getItem('claudeModel') || 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    var data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }
    
    var responseText = data.content?.[0]?.text || '';
    
    if (!responseText) {
      throw new Error('No content generated');
    }
    
    // v9.1.14: Parse JSON response
    var newContent = '';
    var refinementSummary = '';
    
    try {
      // Try to parse as JSON
      var parsed = JSON.parse(responseText.trim());
      newContent = parsed.content || '';
      refinementSummary = parsed.summary || '';
    } catch (e) {
      // Fallback: use response as content directly
      newContent = responseText;
      refinementSummary = 'Refined based on BrandAI conversation';
    }
    
    if (!newContent) {
      throw new Error('No content generated');
    }
    
    // Store refinement summary for later
    window.identityRefinementSummary = refinementSummary;
    
    // Show the preview confirmation modal
    showApplyPreviewModal(section, displayName, currentContent, newContent, refinementSummary);
    
  } catch (error) {
    console.error('[generateApplyPreview] Error:', error);
    showToast('Error generating preview: ' + error.message, 'error');
    resetApplyButton(section, displayName);
  }
}

/**
 * v9.1.14: Reset the apply button after error
 */
function resetApplyButton(section, displayName) {
  var btn = document.getElementById('applyToIdentityBtn');
  if (btn) {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Apply to ' + displayName;
    btn.disabled = false;
  }
}

/**
 * v9.1.14: Show preview modal with before/after comparison
 */
function showApplyPreviewModal(section, displayName, currentContent, newContent, refinementSummary) {
  // Reset the button first
  resetApplyButton(section, displayName);
  
  // Create modal overlay
  var overlay = document.createElement('div');
  overlay.id = 'identityApplyModal';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: var(--space-5);';
  
  // Create modal content
  var modal = document.createElement('div');
  modal.style.cssText = 'background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 28px; max-width: 700px; width: 100%; max-height: 85vh; overflow-y: auto;';
  
  // v9.1.14: Include refinement summary in modal
  var summarySection = refinementSummary ? 
    '<div style="margin-bottom: var(--space-4); padding: 12px 14px; background: linear-gradient(135deg, rgba(212,175,55,0.1), rgba(168,152,120,0.05)); border-radius: var(--radius-md); border-left: 3px solid var(--accent);">' +
      '<div style="font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
        'What Changed' +
      '</div>' +
      '<p style="margin: 0; color: var(--text-primary); font-size: var(--text-base); line-height: 1.5;">' + escapeHtml(refinementSummary) + '</p>' +
    '</div>' : '';
  
  modal.innerHTML = 
    '<div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-5);">' +
      '<div style="width: 40px; height: 40px; background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(168,152,120,0.1)); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="2" style="width: 20px; height: 20px;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
      '</div>' +
      '<div>' +
        '<h3 style="margin: 0; color: var(--text-primary); font-size: var(--text-xl); font-weight: 600;">Update ' + escapeHtml(displayName) + '</h3>' +
        '<p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: var(--text-base);">Here\'s what it will say now</p>' +
      '</div>' +
    '</div>' +
    
    summarySection +
    
    (currentContent ? 
      '<div style="margin-bottom: var(--space-4);">' +
        '<div style="font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: var(--space-2);">Current Content</div>' +
        '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; color: var(--text-secondary); font-size: var(--text-base); line-height: 1.6; max-height: 120px; overflow-y: auto; opacity: 0.7;">' +
          escapeHtml(currentContent) +
        '</div>' +
      '</div>' : '') +
    
    '<div style="margin-bottom: var(--space-6);">' +
      '<div style="font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 6px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
        'New Content' +
      '</div>' +
      '<div style="background: linear-gradient(135deg, rgba(212,175,55,0.08), rgba(168,152,120,0.04)); border: 1px solid rgba(212,175,55,0.3); border-radius: var(--radius-md); padding: var(--space-4); color: var(--text-primary); font-size: var(--text-base); line-height: 1.7; max-height: 250px; overflow-y: auto;">' +
        escapeHtml(newContent) +
      '</div>' +
    '</div>' +
    
    '<div style="display: flex; gap: var(--space-3); justify-content: flex-end;">' +
      '<button onclick="closeIdentityApplyModal()" style="padding: 12px 24px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer; font-size: var(--text-base); font-weight: 500; transition: all 0.2s;">Cancel</button>' +
      '<button onclick="confirmApplyToIdentity(\'' + section + '\')" style="padding: 12px 24px; background: var(--accent); border: none; border-radius: var(--radius-md); color: #1a1a1a; cursor: pointer; font-size: var(--text-base); font-weight: 600; transition: all 0.2s; display: flex; align-items: center; gap: var(--space-2);">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px;"><path d="M20 6L9 17l-5-5"/></svg>' +
        'Confirm Apply to ' + escapeHtml(displayName) +
      '</button>' +
    '</div>';
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Store content for later
  window.identityApplyContent = newContent;
  window.identityApplySection = section;
  
  // Close on overlay click
  overlay.onclick = function(e) {
    if (e.target === overlay) closeIdentityApplyModal();
  };
  
  // Close on Escape key
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeIdentityApplyModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

/**
 * v9.1.14: Close the apply to identity modal
 */
function closeIdentityApplyModal() {
  var modal = document.getElementById('identityApplyModal');
  if (modal) modal.remove();
  window.identityApplyContent = null;
  window.identityApplySection = null;
}

/**
 * v9.1.14: Confirm and apply content to Identity field
 */
function confirmApplyToIdentity(section) {
  var content = window.identityApplyContent;
  if (!content) {
    showToast('No content to apply', 'error');
    closeIdentityApplyModal();
    return;
  }
  
  // Update the Identity field - apply to OWNER field (main content)
  var brand = brands[selectedBrand];
  if (!brand.identityData) brand.identityData = {};
  if (!brand.identityData[section]) brand.identityData[section] = { owner: '', ai: '' };
  
  // Get the old content for reference
  var oldContent = brand.identityData[section].owner || '';
  
  brand.identityData[section].owner = content;
  
  // v9.1.14: Add "Refined with BrandAI" entry to AI Insights with actual summary
  var timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  var refinementSummary = window.identityRefinementSummary || 'Refined based on BrandAI conversation';
  
  var refinementNote = '✦ Refined with BrandAI (' + timestamp + ')\n' + refinementSummary;
  
  // Add to AI insights (prepend to existing)
  var existingAi = brand.identityData[section].ai || '';
  if (typeof existingAi === 'string') {
    brand.identityData[section].ai = refinementNote + (existingAi ? '\n\n' + existingAi : '');
  } else if (Array.isArray(existingAi)) {
    // Convert array to string format
    brand.identityData[section].ai = refinementNote + (existingAi.length > 0 ? '\n\n' + existingAi.join('\n') : '');
  }
  
  saveBrands();
  
  // Update textarea if visible
  var textarea = document.getElementById('identity-' + section + '-owner');
  if (textarea) {
    textarea.value = content;
  }
  
  // Update AI insights textarea if visible
  var aiTextarea = document.getElementById('identity-' + section + '-ai');
  if (aiTextarea) {
    aiTextarea.value = brand.identityData[section].ai;
  }
  
  // Update badges - ensure AI badge shows
  updateIdentityBadges(section);
  
  // Close modal
  closeIdentityApplyModal();
  
  // Remove the apply button
  var applyBtn = document.getElementById('applyToIdentityBtn');
  if (applyBtn) applyBtn.remove();
  
  // Clear refine context and summary
  window.identityRefineContext = null;
  window.identityRefinementSummary = null;
  
  // Get display name for toast
  var sectionNames = {
    essence: 'Brand Essence',
    voice: 'Voice & Tone', 
    audience: 'Target Audience',
    messaging: 'Key Messaging',
    products: 'Products & Services',
    visual: 'Visual Identity',
    competitive: 'Competitive Position'
  };
  var displayName = sectionNames[section] || section;
  
  showToast(displayName + ' updated successfully!', 'success');
  
  // Switch back to Identity view after a moment
  setTimeout(function() {
    showView('memory');
    
    // Scroll to the updated section
    var card = document.querySelector('.identity-card[data-section="' + section + '"]');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash the card
      card.style.transition = 'box-shadow 0.3s ease';
      card.style.boxShadow = '0 0 0 2px var(--accent)';
      setTimeout(function() {
        card.style.boxShadow = 'none';
      }, 2000);
    }
  }, 300);
}

// v12.0.0: escapeHtml moved to utils.escapeHtml (alias at top of JS section)

/**
 * Load identity data for current brand
 */
function loadIdentityData() {
  var brand = brands[selectedBrand];
  if (!brand) return;
  
  console.log('[loadIdentityData] Loading for brand:', brand.name);
  
  // Update header
  var titleEl = document.getElementById('memoryBrandTitle');
  var taglineEl = document.getElementById('memoryBrandTagline');
  if (titleEl) titleEl.textContent = brand.name;
  if (taglineEl) taglineEl.textContent = brand.tagline || 'Brand Identity';

  // v15.15: Show last saved + last synced timestamps
  try {
    var tsContainer = document.getElementById('identityTimestamps');
    if (tsContainer) {
      var timestamps = JSON.parse(localStorage.getItem('roweos_prompt_timestamps') || '{}');
      var brandKey = getBrandMemoryKey(selectedBrand);
      var lastSaved = timestamps[brandKey] ? new Date(timestamps[brandKey]).toLocaleString() : null;
      var syncTs = JSON.parse(localStorage.getItem('roweos_identity_sync_timestamps') || '{}');
      var lastSynced = syncTs[brandKey] ? new Date(syncTs[brandKey]).toLocaleString() : null;
      var html = '';
      if (lastSaved) html += '<span>Last saved: ' + lastSaved + '</span>';
      if (lastSynced) html += '<span>Last synced: ' + lastSynced + '</span>';
      tsContainer.innerHTML = html || '<span>Not yet saved</span>';
    }
  } catch(tsErr) {}

  // Initialize identity data if needed
  if (!brand.identityData) {
    brand.identityData = {};
    
    // Migrate existing brand fields to new structure
    migrateExistingBrandData(brand);
  }
  
  // Load each section
  var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
  sections.forEach(function(section) {
    var data = brand.identityData[section] || {};
    
    // Load owner definition
    var ownerTextarea = document.getElementById('identity-' + section + '-owner');
    if (ownerTextarea) {
      ownerTextarea.value = data.owner || '';
    }
    
    // v9.1.14: Load AI insights into textarea
    var aiTextarea = document.getElementById('identity-' + section + '-ai');
    if (aiTextarea) {
      // Handle both string and array formats
      if (typeof data.ai === 'string') {
        aiTextarea.value = data.ai;
      } else if (Array.isArray(data.ai) && data.ai.length > 0) {
        // Convert array to string for textarea
        aiTextarea.value = data.ai.map(function(insight) {
          return typeof insight === 'string' ? insight : insight.text;
        }).join('\n• ');
        if (aiTextarea.value) aiTextarea.value = '• ' + aiTextarea.value;
      } else {
        aiTextarea.value = '';
      }
    }
    
    // Update badges
    updateIdentityBadges(section);
  });
  
  // Load documents
  loadIdentityDocs();
}

/**
 * Migrate existing brand data to new identity structure
 */
function migrateExistingBrandData(brand) {
  // Map old fields to new sections
  var migrations = {
    essence: ['philosophy', 'coreBelief', 'mission', 'ethos'].filter(f => brand[f]).map(f => brand[f]).join('\n\n'),
    voice: ['voice', 'tone', 'approach'].filter(f => brand[f]).map(f => brand[f]).join('\n\n'),
    audience: brand.audience || '',
    messaging: [brand.promise, brand.cta].filter(f => f).join('\n\n'),
    products: [brand.products, brand.services].filter(f => f).join('\n\n'),
    visual: brand.visual || '',
    competitive: brand.competitive || ''
  };
  
  Object.keys(migrations).forEach(function(section) {
    if (migrations[section]) {
      brand.identityData[section] = {
        owner: migrations[section],
        ai: []
      };
    }
  });
}

/**
 * Render AI insights for a section
 */
function renderAIInsights(container, insights) {
  if (!insights || insights.length === 0) {
    container.innerHTML = '<div class="identity-ai-insights-empty">No AI insights yet. Upload documents to let BrandAI learn.</div>';
    return;
  }
  
  var html = insights.map(function(insight) {
    var sourceHtml = insight.source ? '<span class="identity-insight-source">' + escapeHtml(insight.source) + '</span>' : '';
    var text = typeof insight === 'string' ? insight : insight.text;
    return '<div class="identity-insight-item">' +
      '<span class="identity-insight-bullet">•</span>' +
      '<span>' + escapeHtml(text) + sourceHtml + '</span>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

/**
 * Save all identity data
 */
function saveAllIdentityData() {
  var brand = brands[selectedBrand];
  if (!brand) return;

  if (!brand.identityData) brand.identityData = {};

  var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
  sections.forEach(function(section) {
    var textarea = document.getElementById('identity-' + section + '-owner');
    if (textarea) {
      if (!brand.identityData[section]) brand.identityData[section] = {};
      brand.identityData[section].owner = textarea.value;
    }
  });

  // v15.37: Save role data — check both Identity view and Edit Brand modal radios
  if (!brand.roleData) brand.roleData = {};
  var roleRadio = document.querySelector('input[name="brandRole"]:checked') || document.querySelector('input[name="editBrandRole"]:checked');
  if (roleRadio) {
    brand.roleData.type = roleRadio.value;
    console.log('[Identity] Saved role type:', roleRadio.value, 'for brand:', brand.shortName || brand.name);
  }
  var roleTitleEl = document.getElementById('identity-role-title');
  if (roleTitleEl) brand.roleData.title = roleTitleEl.value;
  var roleProfEl = document.getElementById('identity-role-profession');
  if (roleProfEl) brand.roleData.profession = roleProfEl.value;
  var roleDescEl = document.getElementById('identity-role-description');
  if (roleDescEl) brand.roleData.description = roleDescEl.value;
  var ownerTitleEl = document.getElementById('identity-owner-title');
  if (ownerTitleEl) brand.roleData.ownerTitle = ownerTitleEl.value;

  saveBrands();
  // v15.32: Update timestamp + trigger background sync
  saveBrandAIPromptTimestamp(selectedBrand);
  refreshIdentityTimestamp();
  // v25.1: saveBrands() already writes through to Firestore
  showToast('All changes saved', 'success');
}

/**
 * v12.2.4: Load identity documents with clickable insights view
 */
function loadIdentityDocs() {
  var brandKey = getBrandMemoryKey(selectedBrand);
  var memory = brandMemory[brandKey] || { documents: [], chunks: 0 };
  var brand = brands[selectedBrand];

  // Update stats
  var docCountEl = document.getElementById('identityDocCount');
  var insightCountEl = document.getElementById('identityInsightCount');

  if (docCountEl) docCountEl.textContent = memory.documents.length;

  // v12.2.4: Count insights from documents
  var totalInsights = 0;
  memory.documents.forEach(function(doc) {
    totalInsights += (doc.insights || []).length;
  });
  // Also count from identity sections
  if (brand && brand.identityData) {
    Object.values(brand.identityData).forEach(function(section) {
      if (section.ai && Array.isArray(section.ai)) {
        totalInsights += section.ai.length;
      }
    });
  }
  if (insightCountEl) insightCountEl.textContent = totalInsights;

  // Render docs list
  var listEl = document.getElementById('identityDocsList');
  if (!listEl) return;

  if (memory.documents.length === 0) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = memory.documents.map(function(doc, i) {
    var insightCount = (doc.insights || []).length;
    var hasInsights = insightCount > 0 || doc.summary;
    var statusColor = hasInsights ? 'var(--accent)' : (doc.processed ? 'var(--success)' : 'var(--text-muted)');
    var iconColor = hasInsights ? 'var(--accent)' : 'currentColor';

    var statusHtml = '';
    if (hasInsights) {
      statusHtml = '<span style="font-size: var(--text-xs); color: var(--accent); background: rgba(212,175,55,0.1); padding: 2px 8px; border-radius: 10px;">' + insightCount + ' insights</span>';
    } else if (doc.processed) {
      statusHtml = '<span style="font-size: var(--text-xs); color: var(--text-muted);">Analyzed</span>';
    } else {
      statusHtml = '<span style="font-size: var(--text-xs); color: var(--text-muted);">Processing...</span>';
    }

    // v12.2.4: Show docType if available
    var metaText = doc.docType ? escapeHtml(doc.docType) : ((doc.chunks || 0) + ' chunks');

    return '<div class="identity-doc-item" onclick="showDocInsights(' + (doc.id || i) + ', \'brand\')" style="display: grid; grid-template-columns: auto 1fr auto auto; gap: var(--space-3); align-items: center; padding: var(--space-3); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: var(--space-2); cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'var(--bg-secondary)\'">' +
      '<div class="identity-doc-icon" style="color: ' + iconColor + ';"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div>' +
      '<div class="identity-doc-info">' +
        '<div class="identity-doc-name" style="font-weight: 500; color: var(--text-primary);">' + escapeHtml(doc.name) + '</div>' +
        '<div class="identity-doc-meta" style="font-size: var(--text-sm); color: var(--text-muted); margin-top: 2px;">' + metaText + '</div>' +
      '</div>' +
      '<div class="identity-doc-status">' + statusHtml + '</div>' +
      '<button class="identity-doc-remove" onclick="event.stopPropagation(); removeIdentityDoc(' + i + ')" title="Remove" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: var(--space-1);">' +
        icon('close', {size: 14}) +
      '</button>' +
    '</div>';
  }).join('');
}

// v28.4: Launch Research view with brand's website URL pre-filled
function launchResearchFromIdentity() {
  var urlInput = document.getElementById('dpWebsiteInput') || document.getElementById('identityWebsiteUrl');
  if (!urlInput || !urlInput.value.trim()) {
    showToast('Please enter a website URL in the Digital Presence section', 'warning');
    return;
  }
  var url = urlInput.value.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  // Navigate to Research view and pre-fill the URL
  showView('research');
  var researchInput = document.getElementById('researchUrlInput');
  if (researchInput) {
    researchInput.value = url;
    // Auto-start the research after a brief delay for view transition
    setTimeout(function() {
      if (typeof startResearchFromView === 'function') startResearchFromView();
    }, 300);
  }
}

/**
 * v9.1.14: Extract brand info from website in Identity view
 */
async function extractFromIdentityWebsite() {
  // v20.6: Read from Digital Presence card input (dpWebsiteInput), fallback to legacy identityWebsiteUrl
  var urlInput = document.getElementById('dpWebsiteInput') || document.getElementById('identityWebsiteUrl');
  var statusDiv = document.getElementById('dpExtractStatus');
  var statusText = document.getElementById('dpExtractStatusText');
  var extractBtn = document.getElementById('dpExtractBtn');

  if (!urlInput) return;

  var url = urlInput.value.trim();
  if (!url) {
    showToast('Please enter a website URL in the Digital Presence section', 'warning');
    return;
  }
  
  // Add protocol if missing
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  
  // v20.6: Show status + disable button
  if (extractBtn) extractBtn.disabled = true;
  if (statusDiv) {
    statusDiv.style.display = 'flex';
    if (statusText) statusText.textContent = 'Fetching website content...';
  }

  try {
    // v22.49: Use client's selected provider, not hardcoded Anthropic
    var apiKeys = {};
    try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
    var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey');
    var openaiKey = apiKeys.openai;
    var googleKey = apiKeys.google;
    var activeProvider = localStorage.getItem('selectedProvider') || 'anthropic';

    // Resolve which key to actually use: prefer selectedProvider, fall back to any available
    if (activeProvider === 'anthropic' && !anthropicKey) activeProvider = openaiKey ? 'openai' : googleKey ? 'google' : '';
    if (activeProvider === 'openai' && !openaiKey) activeProvider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
    if (activeProvider === 'google' && !googleKey) activeProvider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

    if (!activeProvider) {
      showToast('Please set up an API key in Settings first', 'error');
      if (statusDiv) statusDiv.style.display = 'none';
      if (extractBtn) extractBtn.disabled = false;
      return;
    }
    
    // v20.7: Use own fetch-site-meta endpoint instead of broken third-party proxies
    if (statusText) statusText.textContent = 'Fetching website content...';
    var fetchUrl = window.location.origin + '/api/fetch-site-meta';
    var metaResp = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, mode: 'content' })
    });
    if (!metaResp.ok) {
      var errData = {};
      try { errData = await metaResp.json(); } catch(e) {}
      throw new Error(errData.error || 'Could not fetch website (HTTP ' + metaResp.status + ')');
    }
    var fetchData = await metaResp.json();
    var pageTitle = fetchData.title || '';
    var pageContent = fetchData.content || '';

    if (!pageContent || pageContent.length < 50) {
      throw new Error('Could not extract meaningful content from this website');
    }

    var websiteContent = 'Website: ' + url + '\n\n' +
      'Title: ' + pageTitle + '\n\n' +
      'Page Content:\n' + pageContent;
    
    if (statusText) statusText.textContent = 'Analyzing brand identity...';
    
    // v20.7: ES5-safe prompt construction
    var brandName = (brands[selectedBrand] && brands[selectedBrand].name) || 'Unknown Brand';

    var prompt = 'Analyze this website content for the brand "' + brandName + '" and extract comprehensive brand identity information.\n\n' +
      'Return JSON with this exact structure. For each section, write 2-4 detailed sentences that could serve as the primary content for that brand identity section. Make each section substantive and actionable.\n\n' +
      '{\n  "summary": "A 2-3 sentence executive summary of the brand based on their website",\n' +
      '  "essence": { "content": "2-4 sentences describing the brand\'s core identity, mission, purpose, positioning, and what makes them unique.", "keyPoints": ["Key insight 1", "Key insight 2"] },\n' +
      '  "voice": { "content": "2-4 sentences describing the brand\'s voice, tone, communication style, and personality.", "keyPoints": ["Key insight 1", "Key insight 2"] },\n' +
      '  "audience": { "content": "2-4 sentences describing the target audience, customer personas, and who the brand serves.", "keyPoints": ["Key insight 1", "Key insight 2"] },\n' +
      '  "messaging": { "content": "2-4 sentences describing key messages, value propositions, taglines, and main points.", "keyPoints": ["Key insight 1", "Key insight 2"] },\n' +
      '  "products": { "content": "2-4 sentences describing the products, services, and offerings available.", "keyPoints": ["Key insight 1", "Key insight 2"] },\n' +
      '  "visual": { "content": "2-4 sentences about visual identity observations from the website.", "keyPoints": ["Key insight 1", "Key insight 2"] },\n' +
      '  "competitive": { "content": "2-4 sentences about competitive positioning and market differentiation.", "keyPoints": ["Key insight 1", "Key insight 2"] }\n' +
      '}\n\nOnly include sections where you can extract meaningful information.\n\nWebsite content:\n' + websiteContent;

    // v22.49: Multi-provider support — use client's selected provider
    var response, data, content;

    if (activeProvider === 'anthropic') {
      // v22.49: Validate model name — fall back to known-good model if stored value is invalid
      var claudeModel = localStorage.getItem('claudeModel') || 'claude-sonnet-4-6';
      var validModels = ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
      if (validModels.indexOf(claudeModel) === -1 && claudeModel.indexOf('claude') === -1) {
        claudeModel = 'claude-sonnet-4-6';
      }
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!response.ok) {
        var errBody = '';
        try { var errJson = await response.json(); errBody = errJson.error && errJson.error.message || JSON.stringify(errJson); } catch(e) {}
        throw new Error(errBody || 'Anthropic API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      if (data.error) throw new Error(data.error.message || 'API error');
      content = (data.content && data.content[0] && data.content[0].text) || '';
    } else if (activeProvider === 'openai') {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + openaiKey
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          max_output_tokens: 4000,
          input: [{ role: 'user', content: prompt }],
          store: false
        })
      });
      if (!response.ok) throw new Error('OpenAI API request failed (HTTP ' + response.status + ')');
      data = await response.json();
      if (data.error) throw new Error(data.error.message || 'API error');
      content = data.output_text || '';
    } else if (activeProvider === 'google') {
      // v22.49: Use stored model from brandSettings, fallback to gemini-3.1-pro-preview
      var gemModel = 'gemini-3.1-pro-preview';
      try {
        var bs = brandSettings[selectedBrand];
        if (bs && bs.provider === 'google' && bs.model) gemModel = bs.model;
      } catch(e) {}
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + googleKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (!response.ok) {
        var gErr = '';
        try { var gErrJson = await response.json(); gErr = gErrJson.error && gErrJson.error.message || JSON.stringify(gErrJson); } catch(e) {}
        throw new Error(gErr || 'Google API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      if (data.error) throw new Error(data.error.message || 'API error');
      content = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts ? data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('') : '') || '';
    }
    
    // Parse extracted data
    var jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var extracted = JSON.parse(jsonMatch[0]);
      
      // v9.1.14: Apply to Identity sections (same logic as document extraction)
      var brand = brands[selectedBrand];
      if (!brand.identityData) brand.identityData = {};
      
      var sectionsUpdated = [];
      var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
      
      sections.forEach(function(section) {
        if (!extracted[section]) return;

        // v20.9: Ensure section is always an object (may be a string from older data)
        if (!brand.identityData[section] || typeof brand.identityData[section] !== 'object') {
          brand.identityData[section] = { owner: (typeof brand.identityData[section] === 'string' ? brand.identityData[section] : ''), ai: [] };
        }
        if (!Array.isArray(brand.identityData[section].ai)) brand.identityData[section].ai = [];

        // If the owner field is empty, populate it with extracted content
        if (!brand.identityData[section].owner && extracted[section].content) {
          brand.identityData[section].owner = extracted[section].content;
          sectionsUpdated.push(section);

          // Update textarea in UI if visible
          var textarea = document.getElementById('identity-' + section + '-owner');
          if (textarea) {
            textarea.value = extracted[section].content;
          }
        }

        // Add keyPoints as supplementary AI insights
        if (extracted[section].keyPoints && Array.isArray(extracted[section].keyPoints)) {
          extracted[section].keyPoints.forEach(function(point) {
            var exists = brand.identityData[section].ai.some(function(existing) {
              return existing.text === point;
            });
            
            if (!exists) {
              brand.identityData[section].ai.push({
                text: point,
                source: url,
                addedAt: new Date().toISOString()
              });
            }
          });
        }
      });
      
      // Save website URL to brand
      brand.website = url;
      brands[selectedBrand] = brand;
      saveBrands();
      
      // Update UI badges
      sections.forEach(function(section) {
        updateIdentityBadges(section);
      });
      
      // Refresh Identity view
      if (typeof renderBrandIdentityView === 'function') {
        renderBrandIdentityView();
      }
      
      // Show feedback
      if (sectionsUpdated.length > 0) {
        showToast('Populated ' + sectionsUpdated.length + ' Identity sections from website!', 'success');
      } else {
        showToast('Website analyzed (sections already have content)', 'success');
      }
      
      if (statusText) statusText.textContent = 'Extraction complete!';
      if (extractBtn) extractBtn.disabled = false;
      setTimeout(function() {
        if (statusDiv) statusDiv.style.display = 'none';
      }, 2000);

    } else {
      throw new Error('Could not parse extracted data');
    }

  } catch (error) {
    console.error('Website extraction error:', error);
    showToast('Error extracting brand info: ' + error.message, 'error');
    if (statusDiv) statusDiv.style.display = 'none';
    if (extractBtn) extractBtn.disabled = false;
  }
}

/**
 * v12.2.4: Handle identity file upload - show context modal
 */
function handleIdentityUpload(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;
  openDocContextModal(Array.from(files), 'brand');
  event.target.value = '';
}

/**
 * v12.2.4: Handle identity drop zone - show context modal
 */
function handleIdentityDocDrop(event) {
  event.preventDefault();
  var files = event.dataTransfer.files;
  if (!files || files.length === 0) return;
  openDocContextModal(Array.from(files), 'brand');
}

/**
 * v12.2.4: Process identity document with context
 */
async function processIdentityDocumentWithContext(file, docType, instructions) {
  var brandKey = getBrandMemoryKey(selectedBrand);
  var brandName = (brands[selectedBrand] ? brands[selectedBrand].name : '') || 'Unknown';

  var processingEl = document.getElementById('identityProcessing');
  var processingTextEl = document.getElementById('identityProcessingText');
  if (processingEl) processingEl.style.display = 'flex';
  if (processingTextEl) processingTextEl.textContent = 'Reading ' + file.name + '...';

  try {
    var content = await readFileContent(file);
    var chunks = chunkText(content, 2000);
    var docId = Date.now();

    // Initialize brand memory
    if (!brandMemory[brandKey]) {
      brandMemory[brandKey] = { documents: [], chunks: 0, lastUpdate: null };
    }

    // Add document with context
    brandMemory[brandKey].documents.push({
      id: docId,
      name: file.name,
      size: file.size,
      chunks: chunks.length,
      docType: docType,
      instructions: instructions,
      content: content.substring(0, 100000),
      uploadedAt: new Date().toISOString(),
      processed: false,
      source: 'upload'
    });
    brandMemory[brandKey].chunks += chunks.length;
    brandMemory[brandKey].lastUpdate = new Date().toISOString();

    saveBrandMemory();
    loadIdentityDocs();

    // Process with AI
    if (processingTextEl) processingTextEl.textContent = 'Analyzing with AI...';

    // Build enhanced prompt with context
    var summary = await extractIdentityInsightsWithContext(content, file.name, brandName, docType, instructions);

    // Update document with results
    var docIndex = brandMemory[brandKey].documents.findIndex(function(d) { return d.id === docId; });
    if (docIndex >= 0) {
      brandMemory[brandKey].documents[docIndex].processed = true;
      if (summary) {
        // v24.11: Store summary string (not full object) to prevent [object Object] display
        brandMemory[brandKey].documents[docIndex].summary = typeof summary === 'string' ? summary : (summary.summary || '');
        brandMemory[brandKey].documents[docIndex].insights = summary.allInsights || [];
      }
    }
    saveBrandMemory();

    loadIdentityDocs();
    loadIdentityData();

    var insightCount = (summary && summary.allInsights) ? summary.allInsights.length : 0;
    showToast('Document analyzed - ' + insightCount + ' insights extracted', 'success');

    // v14.0: Auto-show document insights after successful processing
    if (typeof showDocInsights === 'function' && docId) {
      showDocInsights(docId, 'brand');
    }

  } catch (error) {
    console.error('[processIdentityDocumentWithContext] Error:', error);
    showToast('Error processing document: ' + error.message, 'error');
  } finally {
    if (processingEl) processingEl.style.display = 'none';
  }
}

/**
 * v12.2.4: Extract identity insights with user context
 */
async function extractIdentityInsightsWithContext(content, fileName, brandName, docType, instructions) {
  // v22.50: Multi-provider support + fix [object Object] bug
  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
  var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey');
  var openaiKey = apiKeys.openai;
  var googleKey = apiKeys.google;
  var activeProvider = localStorage.getItem('selectedProvider') || 'anthropic';

  if (activeProvider === 'anthropic' && !anthropicKey) activeProvider = openaiKey ? 'openai' : googleKey ? 'google' : '';
  if (activeProvider === 'openai' && !openaiKey) activeProvider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
  if (activeProvider === 'google' && !googleKey) activeProvider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

  if (!activeProvider) {
    showToast('No API key configured. Add one in System settings.', 'error');
    return null;
  }

  var prompt = 'Analyze this document for a brand called "' + brandName + '" and extract brand identity information.\n\n';
  if (docType) prompt += 'DOCUMENT TYPE: ' + docType + '\n';
  if (instructions) prompt += 'USER INSTRUCTIONS: ' + instructions + '\n\n';

  prompt += 'Return JSON with this structure. For each section, write 2-4 detailed sentences. Also include an "allInsights" array that lists every insight extracted.\n\n';
  prompt += '{\n';
  prompt += '  "summary": "2-3 sentence executive summary",\n';
  prompt += '  "essence": { "content": "Brand identity content...", "keyPoints": ["point1", "point2"] },\n';
  prompt += '  "voice": { "content": "Brand voice content...", "keyPoints": ["point1", "point2"] },\n';
  prompt += '  "audience": { "content": "Target audience content...", "keyPoints": ["point1", "point2"] },\n';
  prompt += '  "messaging": { "content": "Key messaging content...", "keyPoints": ["point1", "point2"] },\n';
  prompt += '  "products": { "content": "Products/services content...", "keyPoints": ["point1", "point2"] },\n';
  prompt += '  "visual": { "content": "Visual identity content...", "keyPoints": ["point1", "point2"] },\n';
  prompt += '  "competitive": { "content": "Competitive position content...", "keyPoints": ["point1", "point2"] },\n';
  prompt += '  "allInsights": [\n';
  prompt += '    { "category": "essence|voice|audience|messaging|products|visual|competitive", "title": "Short title", "content": "The insight" },\n';
  prompt += '    ...\n';
  prompt += '  ]\n';
  prompt += '}\n\n';
  prompt += 'Respond ONLY with valid JSON. No explanation or markdown.\n\n';
  // v15.3: Send up to 80K chars for large PDFs (was 12K, missed most of 40-page docs)
  prompt += 'Document content:\n' + content.substring(0, 80000);

  try {
    var response, data, text;

    if (activeProvider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: localStorage.getItem('claudeModel') || 'claude-sonnet-4-6',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!response.ok) {
        var aErr = ''; try { var aErrJson = await response.json(); aErr = aErrJson.error && aErrJson.error.message || ''; } catch(e) {}
        throw new Error(aErr || 'Anthropic API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      text = (data.content && data.content[0] && data.content[0].text) || '';
    } else if (activeProvider === 'openai') {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
        body: JSON.stringify({ model: 'gpt-4.1-mini', max_output_tokens: 8000, input: [{ role: 'user', content: prompt }], store: false })
      });
      if (!response.ok) {
        var oErr = ''; try { var oErrJson = await response.json(); oErr = oErrJson.error && oErrJson.error.message || ''; } catch(e) {}
        throw new Error(oErr || 'OpenAI API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      text = data.output_text || '';
    } else if (activeProvider === 'google') {
      var gemModel = 'gemini-3.1-pro-preview';
      try { var bs = brandSettings[selectedBrand]; if (bs && bs.provider === 'google' && bs.model) gemModel = bs.model; } catch(e) {}
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + googleKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) {
        var gErr = ''; try { var gErrJson = await response.json(); gErr = gErrJson.error && gErrJson.error.message || ''; } catch(e) {}
        throw new Error(gErr || 'Google API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts ? data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('') : '') || '';
    }

    if (!text) {
      throw new Error('No content in AI response');
    }

    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var extracted = JSON.parse(jsonMatch[0]);

      // Apply to identity sections
      var brand = brands[selectedBrand];
      if (!brand.identityData) brand.identityData = {};

      var sectionsUpdated = [];
      var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];

      sections.forEach(function(section) {
        if (!extracted[section]) return;
        if (!brand.identityData[section]) brand.identityData[section] = {};

        if (extracted[section].content) {
          // v22.50: Fix [object Object] — convert existing array to string before appending
          var existing = brand.identityData[section].ai || '';
          if (Array.isArray(existing)) {
            existing = existing.map(function(item) {
              return typeof item === 'string' ? item : (item.text || '');
            }).join('\n');
          }
          brand.identityData[section].ai = existing ? existing + '\n\n' + extracted[section].content : extracted[section].content;
          sectionsUpdated.push(section);
        }
      });

      saveBrands();

      if (sectionsUpdated.length > 0) {
        console.log('[extractIdentityInsightsWithContext] Updated sections:', sectionsUpdated);
      }

      return extracted;
    }
  } catch (error) {
    console.error('[extractIdentityInsightsWithContext] Error:', error);
    showToast('AI extraction failed: ' + error.message, 'error');
  }

  return null;
}

/**
 * Read file content as text
 */
function readFileContent(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    
    reader.onload = function(e) {
      resolve(e.target.result);
    };
    
    reader.onerror = function(e) {
      reject(new Error('Failed to read file'));
    };
    
    // Handle different file types
    var ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') {
      // For PDFs, we'll read as array buffer and extract text
      reader.onload = async function(e) {
        try {
          var text = await extractPDFText(e.target.result);
          resolve(text);
        } catch (err) {
          // Fallback - just note it's a PDF
          resolve('[PDF Document: ' + file.name + '] - PDF text extraction requires processing.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Text-based files
      reader.readAsText(file);
    }
  });
}

/**
 * Extract text from PDF (basic extraction)
 */
async function extractPDFText(arrayBuffer) {
  // Check if pdf.js is available
  if (typeof pdfjsLib !== 'undefined') {
    try {
      var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      var text = '';
      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        text += content.items.map(function(item) { return item.str; }).join(' ') + '\n';
      }
      return text;
    } catch (err) {
      console.error('[extractPDFText] Error:', err);
      throw err;
    }
  }
  
  // Basic fallback - try to extract readable strings
  var bytes = new Uint8Array(arrayBuffer);
  var text = '';
  var inText = false;
  var buffer = '';
  
  for (var i = 0; i < bytes.length; i++) {
    var byte = bytes[i];
    // Look for readable ASCII characters
    if (byte >= 32 && byte <= 126) {
      buffer += String.fromCharCode(byte);
      inText = true;
    } else if (inText && buffer.length > 3) {
      text += buffer + ' ';
      buffer = '';
      inText = false;
    } else {
      buffer = '';
      inText = false;
    }
  }
  
  // Clean up extracted text
  text = text.replace(/\s+/g, ' ').trim();
  
  if (text.length < 100) {
    throw new Error('Could not extract meaningful text from PDF');
  }
  
  return text;
}

/**
 * Process identity document with AI
 */
async function processIdentityDocument(file) {
  var brandKey = getBrandMemoryKey(selectedBrand);
  var brandName = (brands[selectedBrand] ? brands[selectedBrand].name : '') || 'Unknown';
  
  // Show processing
  var processingEl = document.getElementById('identityProcessing');
  var processingTextEl = document.getElementById('identityProcessingText');
  if (processingEl) processingEl.style.display = 'flex';
  if (processingTextEl) processingTextEl.textContent = 'Reading ' + file.name + '...';
  
  try {
    // Read file content
    var content = await readFileContent(file);
    
    // Chunk the content
    var chunks = chunkText(content, 2000);
    
    // Initialize brand memory
    if (!brandMemory[brandKey]) {
      brandMemory[brandKey] = { documents: [], chunks: 0, lastUpdate: null };
    }
    
    // Add document
    brandMemory[brandKey].documents.push({
      name: file.name,
      size: file.size,
      chunks: chunks.length,
      uploadedAt: new Date().toISOString(),
      processed: false
    });
    brandMemory[brandKey].chunks += chunks.length;
    brandMemory[brandKey].lastUpdate = new Date().toISOString();
    
    // Save memory
    saveBrandMemory();
    
    // Update UI
    loadIdentityDocs();
    
    // Process with AI if API key available
    if (processingTextEl) processingTextEl.textContent = 'Analyzing with AI...';
    
    // v9.1.14: Capture summary from AI analysis
    var summary = await extractIdentityInsights(content, file.name, brandName);
    
    // Mark as processed and save summary
    var docIndex = brandMemory[brandKey].documents.length - 1;
    brandMemory[brandKey].documents[docIndex].processed = true;
    if (summary) {
      // v24.12: Guard against object summary (extractIdentityInsights may return object)
      brandMemory[brandKey].documents[docIndex].summary = typeof summary === 'string' ? summary : (summary.summary || '');
    }
    saveBrandMemory();
    
    loadIdentityDocs();
    loadIdentityData();
    
    showToast('Document processed successfully', 'success');
    
  } catch (error) {
    console.error('[processIdentityDocument] Error:', error);
    showToast('Error processing document: ' + error.message, 'error');
  } finally {
    if (processingEl) processingEl.style.display = 'none';
  }
}

/**
 * Extract insights from document content using AI
 */
async function extractIdentityInsights(content, fileName, brandName) {
  // v22.50: Multi-provider support (was Anthropic-only)
  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
  var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey');
  var openaiKey = apiKeys.openai;
  var googleKey = apiKeys.google;
  var activeProvider = localStorage.getItem('selectedProvider') || 'anthropic';

  if (activeProvider === 'anthropic' && !anthropicKey) activeProvider = openaiKey ? 'openai' : googleKey ? 'google' : '';
  if (activeProvider === 'openai' && !openaiKey) activeProvider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
  if (activeProvider === 'google' && !googleKey) activeProvider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

  if (!activeProvider) {
    showToast('No API key configured. Add one in System settings.', 'error');
    return null;
  }

  // v22.50: ES5 compliant prompt (was template literal)
  var prompt = 'Analyze this document for a brand called "' + brandName + '" and extract comprehensive brand identity information.\n\n' +
    'Return JSON with this exact structure. For each section, write 2-4 detailed sentences that could serve as the primary content for that brand identity section.\n\n' +
    '{\n' +
    '  "summary": "A 2-3 sentence executive summary of what this document reveals about the brand",\n' +
    '  "essence": { "content": "Brand core identity, mission, purpose, positioning...", "keyPoints": ["point1", "point2"] },\n' +
    '  "voice": { "content": "Brand voice, tone, communication style...", "keyPoints": ["point1", "point2"] },\n' +
    '  "audience": { "content": "Target audience, demographics, psychographics...", "keyPoints": ["point1", "point2"] },\n' +
    '  "messaging": { "content": "Key messages, value propositions, taglines...", "keyPoints": ["point1", "point2"] },\n' +
    '  "products": { "content": "Products, services, offerings...", "keyPoints": ["point1", "point2"] },\n' +
    '  "visual": { "content": "Visual identity, colors, typography, imagery...", "keyPoints": ["point1", "point2"] },\n' +
    '  "competitive": { "content": "Competitive positioning, differentiation...", "keyPoints": ["point1", "point2"] }\n' +
    '}\n\n' +
    'Only include sections where you find relevant information. Respond ONLY with valid JSON.\n\n' +
    'Document content:\n' + content.substring(0, 12000);

  try {
    var response, data, text;

    if (activeProvider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: localStorage.getItem('claudeModel') || 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!response.ok) {
        var aErr = ''; try { var aErrJson = await response.json(); aErr = aErrJson.error && aErrJson.error.message || ''; } catch(e) {}
        throw new Error(aErr || 'Anthropic API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      text = (data.content && data.content[0] && data.content[0].text) || '';
    } else if (activeProvider === 'openai') {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
        body: JSON.stringify({ model: 'gpt-4.1-mini', max_output_tokens: 4000, input: [{ role: 'user', content: prompt }], store: false })
      });
      if (!response.ok) {
        var oErr = ''; try { var oErrJson = await response.json(); oErr = oErrJson.error && oErrJson.error.message || ''; } catch(e) {}
        throw new Error(oErr || 'OpenAI API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      text = data.output_text || '';
    } else if (activeProvider === 'google') {
      var gemModel = 'gemini-3.1-pro-preview';
      try { var bs = brandSettings[selectedBrand]; if (bs && bs.provider === 'google' && bs.model) gemModel = bs.model; } catch(e) {}
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + googleKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) {
        var gErr = ''; try { var gErrJson = await response.json(); gErr = gErrJson.error && gErrJson.error.message || ''; } catch(e) {}
        throw new Error(gErr || 'Google API failed (HTTP ' + response.status + ')');
      }
      data = await response.json();
      text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts ? data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('') : '') || '';
    }

    if (!text) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var extracted = JSON.parse(jsonMatch[0]);

      // Apply extracted content directly to Identity sections
      var brand = brands[selectedBrand];
      if (!brand.identityData) brand.identityData = {};

      var sectionsUpdated = [];
      var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];

      sections.forEach(function(section) {
        if (!extracted[section]) return;

        // v20.9: Ensure section is always an object (may be a string from older data)
        if (!brand.identityData[section] || typeof brand.identityData[section] !== 'object') {
          brand.identityData[section] = { owner: (typeof brand.identityData[section] === 'string' ? brand.identityData[section] : ''), ai: [] };
        }
        if (!Array.isArray(brand.identityData[section].ai)) brand.identityData[section].ai = [];

        // If the owner field is empty, populate it with extracted content
        if (!brand.identityData[section].owner && extracted[section].content) {
          brand.identityData[section].owner = extracted[section].content;
          sectionsUpdated.push(section);

          var textarea = document.getElementById('identity-' + section + '-owner');
          if (textarea) {
            textarea.value = extracted[section].content;
          }
        }

        // Add keyPoints as supplementary AI insights
        if (extracted[section].keyPoints && Array.isArray(extracted[section].keyPoints)) {
          extracted[section].keyPoints.forEach(function(point) {
            var exists = brand.identityData[section].ai.some(function(existing) {
              return existing.text === point;
            });

            if (!exists) {
              brand.identityData[section].ai.push({
                text: point,
                source: fileName,
                addedAt: new Date().toISOString()
              });
            }
          });
        }
      });

      saveBrands();

      sections.forEach(function(section) {
        updateIdentityBadges(section);
      });

      if (sectionsUpdated.length > 0) {
        showToast('Populated ' + sectionsUpdated.length + ' Identity sections from document!', 'success');
      } else {
        showToast('AI insights extracted (sections already have content)', 'success');
      }

      if (typeof renderIdentityView === 'function') {
        renderIdentityView();
      }

      return extracted.summary || null;
    }
  } catch (error) {
    console.error('[extractIdentityInsights] AI error:', error);
    showToast('Error extracting insights: ' + error.message, 'error');
  }
  return null;
}

/**
 * Remove identity document
 */
function removeIdentityDoc(index) {
  var brandKey = getBrandMemoryKey(selectedBrand);
  
  if (!brandMemory[brandKey] || !brandMemory[brandKey].documents[index]) {
    showToast('Document not found', 'error');
    return;
  }
  
  var doc = brandMemory[brandKey].documents[index];
  
  // Remove document
  brandMemory[brandKey].chunks -= doc.chunks;
  brandMemory[brandKey].documents.splice(index, 1);
  saveBrandMemory();
  
  // Update UI
  loadIdentityDocs();
  showToast('Document removed', 'success');
}

/**
 * v9.1.14: Refactored - Brand pills removed, now just updates title/tagline
 * Brand switching handled by sidebar dropdown
 */
function renderMemoryBrandPills() {
  // v9.1.14: Load new Identity UI data
  loadIdentityData();

  // v18.2: Read selectedBrand but never WRITE it back — prevents reset during sync
  var currentBrandIdx = selectedBrand;
  if (typeof currentBrandIdx !== 'number' || isNaN(currentBrandIdx) || currentBrandIdx < 0 || currentBrandIdx >= brands.length) {
    // Prefer localStorage as source of truth over DOM which may be stale
    var stored = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
    if (!isNaN(stored) && stored >= 0 && stored < brands.length) {
      currentBrandIdx = stored;
    } else {
      currentBrandIdx = parseInt(document.getElementById('brand')?.value || 0);
      if (isNaN(currentBrandIdx) || currentBrandIdx < 0 || currentBrandIdx >= brands.length) {
        currentBrandIdx = 0;
      }
    }
  }

  currentKnowledgeBrand = getBrandMemoryKey(currentBrandIdx);

  // v9.1.14: Update brand title and tagline in merged Identity view
  var brand = brands[currentBrandIdx];
  if (brand) {
    var titleEl = document.getElementById('memoryBrandTitle');
    var taglineEl = document.getElementById('memoryBrandTagline');
    if (titleEl) titleEl.textContent = brand.name;
    if (taglineEl) taglineEl.textContent = brand.tagline || 'Brand Identity';

    // v27.0: Update Research button with current brand's website
    var researchBtn = document.getElementById('identityResearchBtn');
    if (researchBtn) {
      var bWebsite = brand.website || '';
      if (bWebsite) {
        researchBtn.style.display = '';
        researchBtn.setAttribute('onclick', "launchResearch('" + bWebsite.replace(/'/g, "\\'") + "', " + currentBrandIdx + ")");
      } else {
        researchBtn.style.display = 'none';
      }
    }

    // Also update deleted brands badge
    var badgeEl = document.getElementById('memoryDeletedBrandsCount');
    if (badgeEl && window.deletedBrands) {
      if (window.deletedBrands.length > 0) {
        badgeEl.textContent = window.deletedBrands.length;
        badgeEl.style.display = 'inline-block';
      } else {
        badgeEl.style.display = 'none';
      }
    }
  }
  
  // Load the correct brand's knowledge
  loadBrandKnowledge('brand_' + currentBrandIdx);
}

function updateMemoryUI() {
  var brandKey = getBrandMemoryKey(selectedBrand);
  var memory = brandMemory[brandKey] || { documents: [], chunks: 0, lastUpdate: null };
  var brandName = (brands[selectedBrand] ? brands[selectedBrand].name : '') || '';
  
  // v9.1.14: Use Identity view element IDs (merged views)
  var docCountEl = document.getElementById('identityDocCount') || document.getElementById('memoryDocCount');
  var insightCountEl = document.getElementById('identityInsightCount') || document.getElementById('memoryInsightCount');
  var listEl = document.getElementById('identityDocsList') || document.getElementById('memoryDocumentsList');
  
  if (docCountEl) {
    docCountEl.textContent = memory.documents.length;
  }
  
  // v9.1.14: Show insight count from brand knowledge
  if (insightCountEl && brandName) {
    var knowledge = getBrandKnowledge ? getBrandKnowledge(brandName) : null;
    insightCountEl.textContent = knowledge?.insights?.length || 0;
  }
  
  if (!listEl) return;
  
  if (memory.documents.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; padding: var(--space-6); color: var(--text-secondary);">No documents uploaded yet. Upload PDFs or text files to teach BrandAI about your brand.</div>';
  } else {
    listEl.innerHTML = memory.documents.map(function(doc, i) {
      // v9.1.14: Show processed status with AI summary
      var statusClass = doc.processed ? 'complete' : (doc.error ? 'error' : '');
      var statusIcon = doc.processed ? '✓' : (doc.error ? '✗' : '○');
      var statusText = doc.processed ? 'AI Analyzed' : (doc.error ? 'Error' : 'Uploaded');
      var statusColor = doc.processed ? 'var(--success)' : (doc.error ? 'var(--error)' : 'var(--text-muted)');
      
      // v9.1.14: Show AI summary if available — v24.11: handle object format
      var _docSum = doc.summary ? (typeof doc.summary === 'string' ? doc.summary : (doc.summary.summary || '')) : '';
      var summaryHtml = _docSum ?
        '<div class="doc-ai-summary" style="font-size: var(--text-sm); color: var(--text-secondary); margin-top: var(--space-2); padding: 8px 12px; background: rgba(212, 175, 55, 0.08); border-radius: var(--radius-xs);">' +
        '<span style="color: var(--accent); font-weight: 500;">AI Summary:</span> ' +
        escapeHtml(_docSum) + '</div>' : '';
      
      return '<div class="identity-doc-item ' + statusClass + '" style="padding: var(--space-3); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: var(--space-2);">' +
        '<div style="display: flex; justify-content: space-between; align-items: flex-start;">' +
          '<div style="flex: 1;">' +
            '<div style="font-weight: 500; color: var(--text-primary);">' + escapeHtml(doc.name) + '</div>' +
            '<div style="font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-1);">' + 
              (doc.chunks || 0) + ' chunks • ' + ((doc.size || 0) / 1024).toFixed(1) + 'KB • ' +
              '<span style="color: ' + statusColor + '">' + statusIcon + ' ' + statusText + '</span></div>' +
          '</div>' +
          '<button class="btn btn-secondary btn-small" onclick="removeMemoryDoc(' + i + ')" style="margin-left: var(--space-3);">Remove</button>' +
        '</div>' +
        summaryHtml +
      '</div>';
    }).join('');
  }
  
  // v9.1.14: Load brand insights into textarea
  loadBrandInsights();
}

function removeMemoryDoc(index) {
  var brandKey = getBrandMemoryKey(selectedBrand);
  var brandName = (brands[selectedBrand] ? brands[selectedBrand].name : '');
  
  if (!brandMemory[brandKey] || !brandMemory[brandKey].documents[index]) {
    showToast('Document not found', 'error');
    return;
  }
  
  var doc = brandMemory[brandKey].documents[index];
  
  // v9.1.14: Show custom removal modal
  showDocumentRemovalModal(doc.name, index, brandKey, brandName);
}

/**
 * v9.1.14: Show modal asking whether to remove learned insights
 */
function showDocumentRemovalModal(docName, docIndex, brandKey, brandName) {
  // Create modal HTML
  var modalHtml = `
    <div id="docRemovalModal" class="api-key-modal active" onclick="closeDocRemovalModal()">
      <div class="api-key-modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
        <h3 class="api-key-modal-title">Remove Document</h3>
        <p class="api-key-modal-desc">Remove "${escapeHtml(docName)}" from ${escapeHtml(brandName || 'this brand')}?</p>
        
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-4); margin: 20px 0;">
          <p style="color: var(--text-primary); margin: 0 0 12px 0; font-weight: 500;">Also remove learned insights?</p>
          <p style="color: var(--text-secondary); font-size: var(--text-base); margin: 0 0 16px 0;">
            If you select "Yes", any brand knowledge, vocabulary, and system prompt additions extracted from this document will also be removed from the brand's memory.
          </p>
          
          <div style="display: flex; gap: var(--space-3);">
            <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; padding: 10px 16px; background: var(--bg-tertiary); border: 2px solid var(--border-color); border-radius: var(--radius-md); flex: 1; transition: all 0.2s;">
              <input type="radio" name="removeInsights" value="yes" style="accent-color: var(--accent);">
              <span style="color: var(--text-primary);">Yes, remove insights</span>
            </label>
            <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; padding: 10px 16px; background: var(--bg-tertiary); border: 2px solid var(--border-color); border-radius: var(--radius-md); flex: 1; transition: all 0.2s;">
              <input type="radio" name="removeInsights" value="no" checked style="accent-color: var(--accent);">
              <span style="color: var(--text-primary);">No, keep insights</span>
            </label>
          </div>
        </div>
        
        <div class="api-key-modal-actions" style="margin-top: var(--space-6);">
          <button class="api-key-modal-btn api-key-modal-btn-cancel" onclick="closeDocRemovalModal()">Cancel</button>
          <button class="api-key-modal-btn api-key-modal-btn-save" onclick="confirmDocRemoval(${docIndex}, '${brandKey}', '${brandName ? brandName.replace(/'/g, "\\'") : ''}', '${docName.replace(/'/g, "\\'")}')">Remove Document</button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to DOM
  var modalContainer = document.createElement('div');
  modalContainer.id = 'docRemovalModalContainer';
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
}

function closeDocRemovalModal() {
  var container = document.getElementById('docRemovalModalContainer');
  if (container) {
    container.remove();
  }
}

function confirmDocRemoval(docIndex, brandKey, brandName, docName) {
  // Check if user wants to remove insights
  var removeInsights = document.querySelector('input[name="removeInsights"]:checked')?.value === 'yes';
  
  // Remove document from brandMemory
  if (brandMemory[brandKey]) {
    var doc = brandMemory[brandKey].documents[docIndex];
    if (doc) {
      brandMemory[brandKey].chunks -= doc.chunks || 0;
      brandMemory[brandKey].documents.splice(docIndex, 1);
      brandMemory[brandKey].lastUpdate = new Date().toISOString();
      saveBrandMemory();
    }
  }
  
  // Handle brand knowledge removal
  if (brandName) {
    var knowledgeKey = 'roweos_brand_knowledge_' + brandName.replace(/\s+/g, '_').toLowerCase();
    var knowledge = JSON.parse(localStorage.getItem(knowledgeKey) || '{"documents":[],"insights":[],"systemPromptAdditions":""}');
    
    if (removeInsights) {
      // Remove everything associated with this document
      // Remove matching document from knowledge
      knowledge.documents = knowledge.documents.filter(function(kDoc) {
        return kDoc.name !== docName;
      });
      
      // v9.1.14: If this was the last document, clear ALL insights (including legacy)
      if (knowledge.documents.length === 0) {
        knowledge.insights = [];
        knowledge.systemPromptAdditions = '';
        console.log('[confirmDocRemoval] Last document removed - clearing all insights');
      } else {
        // Remove insights that were extracted from this document
        // (Insights are tagged with their source document)
        if (knowledge.insights && knowledge.insights.length > 0) {
          knowledge.insights = knowledge.insights.filter(function(insight) {
            // Handle both object format {text, source} and legacy string format
            if (typeof insight === 'object' && insight.source) {
              return insight.source !== docName;
            }
            // Keep legacy string insights (they have no source tracking)
            return true;
          });
        }
        
        // Regenerate system prompt from remaining documents
        knowledge.systemPromptAdditions = regenerateSystemPrompt(knowledge);
      }
      
      localStorage.setItem(knowledgeKey, JSON.stringify(knowledge));
      showToast('Document and learned insights removed', 'success');
    } else {
      // Only remove the document reference, keep insights
      knowledge.documents = knowledge.documents.filter(function(kDoc) {
        return kDoc.name !== docName;
      });
      localStorage.setItem(knowledgeKey, JSON.stringify(knowledge));
      showToast('Document removed (insights preserved)', 'success');
    }
  } else {
    showToast('Document removed', 'success');
  }
  
  // Close modal and update UI
  closeDocRemovalModal();
  updateMemoryUI();
  
  // Update insights textarea if insights were removed
  if (removeInsights) {
    loadBrandInsights();
  }
}

/**
 * v9.1.14: Regenerate system prompt additions from remaining documents
 * @param {Object} knowledge - Brand knowledge object
 * @returns {string} - Regenerated system prompt additions
 */
function regenerateSystemPrompt(knowledge) {
  if (!knowledge.documents || knowledge.documents.length === 0) {
    return '';
  }
  
  var promptAddition = '\n\n=== LEARNED BRAND KNOWLEDGE (from uploaded documents) ===\n';
  
  // Aggregate data from all remaining documents
  var allProducts = [];
  var allAudience = [];
  var allVocab = [];
  var allDifferentiators = [];
  
  knowledge.documents.forEach(function(doc) {
    if (doc.extractedData) {
      var data = doc.extractedData;
      if (data.products) allProducts.push(data.products);
      if (data.targetAudience) allAudience.push(data.targetAudience);
      if (data.vocabulary && data.vocabulary.length) allVocab = allVocab.concat(data.vocabulary);
      if (data.differentiators) allDifferentiators.push(data.differentiators);
    }
  });
  
  if (allProducts.length > 0) {
    promptAddition += 'Products/Services: ' + [...new Set(allProducts)].join('; ') + '\n';
  }
  if (allAudience.length > 0) {
    promptAddition += 'Target Audience: ' + [...new Set(allAudience)].join('; ') + '\n';
  }
  if (allVocab.length > 0) {
    promptAddition += 'Key Vocabulary: ' + [...new Set(allVocab)].join(', ') + '\n';
  }
  if (allDifferentiators.length > 0) {
    promptAddition += 'Differentiators: ' + [...new Set(allDifferentiators)].join('; ') + '\n';
  }
  
  // Add remaining insights
  if (knowledge.insights && knowledge.insights.length > 0) {
    promptAddition += '\nKey Insights:\n';
    knowledge.insights.slice(-10).forEach(function(insight) {
      var text = typeof insight === 'object' ? insight.text : insight;
      promptAddition += '• ' + text + '\n';
    });
  }
  
  return promptAddition;
}

function clearBrandMemory() {
  if (!confirm('Clear all memory and learned knowledge for this brand? This cannot be undone.')) return;
  var brandKey = getBrandMemoryKey(selectedBrand);
  var brandName = (brands[selectedBrand] ? brands[selectedBrand].name : '');
  
  brandMemory[brandKey] = { documents: [], chunks: 0, lastUpdate: null };
  saveBrandMemory();
  
  // v9.1.14: Also clear brand knowledge
  if (brandName) {
    var knowledgeKey = 'roweos_brand_knowledge_' + brandName.replace(/\s+/g, '_').toLowerCase();
    localStorage.removeItem(knowledgeKey);
  }
  
  // Clear insights textarea
  var insightsEl = document.getElementById('knowledge-insights');
  if (insightsEl) {
    insightsEl.value = '';
  }
  
  updateMemoryUI();
  showToast('Brand memory and knowledge cleared', 'success');
}

// Export Functions (Phase 8)
function exportBrandConfig() {
  var brand = brands[selectedBrand];
  var config = {
    brand: brand,
    guardrails: guardrailsConfig,
    identity: JSON.parse(localStorage.getItem('roweos_identity_config') || '{}'),
    exportDate: new Date().toISOString(),
    version: '1.9.2'
  };
  
  downloadJSON(config, 'roweos-' + brand.name.toLowerCase().replace(/\s+/g, '-') + '-config.json');
  showToast('Brand configuration exported', 'success');
}

// v16.0: Removed duplicate exportAllBrands() (v1.9.2) — canonical version is at ~line 113679 (v2.50.0)

function downloadJSON(data, filename) {
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function handleConfigImport(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var config = JSON.parse(e.target.result);
      if (config.guardrails) {
        var defaults = { agentToggles: { strategy: true, marketing: true, operations: true, documents: true }, escalationTopics: [], blockedContent: {}, scopeRules: {}, refusals: {} };
        guardrailsConfig = { agentToggles: config.guardrails.agentToggles || defaults.agentToggles, escalationTopics: config.guardrails.escalationTopics || defaults.escalationTopics, blockedContent: config.guardrails.blockedContent || defaults.blockedContent, scopeRules: config.guardrails.scopeRules || defaults.scopeRules, refusals: config.guardrails.refusals || defaults.refusals };
        localStorage.setItem('roweos_guardrails', JSON.stringify(guardrailsConfig));
      }
      if (config.identity) {
        localStorage.setItem('roweos_identity_config', JSON.stringify(config.identity));
      }
      showToast('Configuration imported successfully', 'success');
      loadGuardrails();
      loadIdentityConfig();
    } catch (err) {
      showToast('Invalid configuration file', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function cloneBrandPreset() {
  var sourceBrand = parseInt(document.getElementById('cloneSourceBrand').value);
  var newName = document.getElementById('cloneNewName').value.trim();
  
  if (!newName) {
    showToast('Please enter a name for the new brand', 'warning');
    return;
  }
  
  showToast('Brand cloning would create: ' + newName + ' (from ' + brands[sourceBrand].name + ')', 'info');
}

function generateSystemPrompt() {
  var previewEl = document.getElementById('systemPromptPreview');
  if (!previewEl) return;
  
  // Check if there's a custom prompt for this brand
  var customPrompts = JSON.parse(localStorage.getItem('roweos_custom_system_prompts') || '{}');
  if (customPrompts[selectedBrand]) {
    previewEl.value = customPrompts[selectedBrand];
    return;
  }
  
  // Otherwise generate default prompt
  var brand = brands[selectedBrand];
  var identity = JSON.parse(localStorage.getItem('roweos_identity_config') || '{}');
  
  var prompt = 'You are ' + (identity.personaName || 'BrandAI') + ', ' + (identity.personaTitle || 'a brand assistant') + ' for ' + brand.name + '.\n\n';
  prompt += 'BRAND CONTEXT:\n';
  prompt += '- Industry: ' + (brand.industry || 'Luxury Services') + '\n';
  prompt += '- Description: ' + (brand.description || 'A premium brand') + '\n\n';
  
  if (identity.tones && identity.tones.length > 0) {
    prompt += 'TONE: ' + identity.tones.join(', ') + '\n\n';
  }
  
  if (guardrailsConfig.escalationTopics.length > 0) {
    prompt += 'ESCALATION TOPICS (defer to humans): ' + guardrailsConfig.escalationTopics.join(', ') + '\n\n';
  }
  
  prompt += 'Always maintain brand voice and defer sensitive topics to human team members.';
  
  previewEl.value = prompt;
}

function copySystemPrompt() {
  var textarea = document.getElementById('systemPromptPreview');
  textarea.select();
  document.execCommand('copy');
  showToast('System prompt copied', 'success');
}

// System Prompt Editing Functions
var originalSystemPrompt = '';

function toggleSystemPromptEdit() {
  var textarea = document.getElementById('systemPromptPreview');
  var editBtn = document.getElementById('editSystemPromptBtn');
  var saveBtn = document.getElementById('saveSystemPromptBtn');
  var cancelBtn = document.getElementById('cancelSystemPromptBtn');
  var generateBtn = document.querySelector('[onclick="generateSystemPrompt()"]');
  var copyBtn = document.querySelector('[onclick="copySystemPrompt()"]');
  
  // Store original content
  originalSystemPrompt = textarea.value;
  
  // Enable editing
  textarea.removeAttribute('readonly');
  textarea.style.background = 'var(--bg-secondary)';
  textarea.style.borderColor = 'var(--accent)';
  textarea.focus();
  
  // Update buttons
  editBtn.style.display = 'none';
  generateBtn.style.display = 'none';
  copyBtn.style.display = 'none';
  saveBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'inline-block';
}

function saveSystemPrompt() {
  var textarea = document.getElementById('systemPromptPreview');
  var editBtn = document.getElementById('editSystemPromptBtn');
  var saveBtn = document.getElementById('saveSystemPromptBtn');
  var cancelBtn = document.getElementById('cancelSystemPromptBtn');
  var generateBtn = document.querySelector('[onclick="generateSystemPrompt()"]');
  var copyBtn = document.querySelector('[onclick="copySystemPrompt()"]');
  
  // Save custom system prompt to localStorage
  var customPrompts = JSON.parse(localStorage.getItem('roweos_custom_system_prompts') || '{}');
  customPrompts[selectedBrand] = textarea.value;
  localStorage.setItem('roweos_custom_system_prompts', JSON.stringify(customPrompts));
  
  // Disable editing
  textarea.setAttribute('readonly', true);
  textarea.style.background = 'var(--bg-primary)';
  textarea.style.borderColor = 'var(--border-color)';
  
  // Update buttons
  editBtn.style.display = 'inline-block';
  generateBtn.style.display = 'inline-block';
  copyBtn.style.display = 'inline-block';
  saveBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
  
  showToast('System prompt saved', 'success');
}

function cancelSystemPromptEdit() {
  var textarea = document.getElementById('systemPromptPreview');
  var editBtn = document.getElementById('editSystemPromptBtn');
  var saveBtn = document.getElementById('saveSystemPromptBtn');
  var cancelBtn = document.getElementById('cancelSystemPromptBtn');
  var generateBtn = document.querySelector('[onclick="generateSystemPrompt()"]');
  var copyBtn = document.querySelector('[onclick="copySystemPrompt()"]');
  
  // Restore original content
  textarea.value = originalSystemPrompt;
  
  // Disable editing
  textarea.setAttribute('readonly', true);
  textarea.style.background = 'var(--bg-primary)';
  textarea.style.borderColor = 'var(--border-color)';
  
  // Update buttons
  editBtn.style.display = 'inline-block';
  generateBtn.style.display = 'inline-block';
  copyBtn.style.display = 'inline-block';
  saveBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
}

// BrandAI Main System Prompt Functions
var originalBrandAIPrompt = '';

function generateBrandAIPrompt() {
  var previewEl = document.getElementById('brandAISystemPrompt');
  if (!previewEl) return;

  console.log('[BrandAI Preview] Generating prompt for brand:', selectedBrand);

  // Check if there's a custom prompt for this brand
  var customPrompts = JSON.parse(localStorage.getItem('roweos_brandai_main_prompts') || '{}');
  if (customPrompts[selectedBrand]) {
    console.log('[BrandAI Preview] Found custom prompt (length:', customPrompts[selectedBrand].length, 'chars)');
    previewEl.value = customPrompts[selectedBrand];
    updateBrandAIPromptTimestamp();
    return;
  }

  console.log('[BrandAI Preview] No custom prompt found, generating full dynamic prompt');

  // v15.14: Generate dynamic BrandAI prompt WITH Identity Intelligence (like LifeAI)
  var brand = brands[selectedBrand];
  if (!brand) return;

  var prompt = 'You are the dedicated AI operator for ' + brand.name + '. You ARE this brand - respond as an on-brand concierge who deeply understands and embodies this specific brand\'s identity, voice, and values.\n\n';
  prompt += 'PRIME DIRECTIVE:\n';
  prompt += '- ALWAYS respond in the voice and context of ' + brand.name + ' - never generic responses.\n';
  prompt += '- Use the brand context below to inform EVERY response.\n';
  prompt += '- Protect the brand. No hype, no desperation, no sales-y voice. Quiet competence.\n';
  prompt += '- Be operational. Provide clear next steps, templates, options.\n';
  prompt += '- Be consistent. Every response from the same premium, thoughtful brand system.\n\n';

  prompt += 'CAPABILITIES:\n';
  prompt += '- You have access to web search via the web_search tool. Use it when you need:\n';
  prompt += '  * Current information beyond your knowledge cutoff\n';
  prompt += '  * Real-time data (pricing, trends, competitors, news)\n';
  prompt += '  * Research on specific topics\n';
  prompt += '  * Verification of facts\n';
  prompt += '- Search proactively when the request requires current information\n';
  prompt += '- After searching, synthesize findings with brand context\n\n';

  prompt += '===== YOU ARE: ' + brand.name + ' =====\n\n';

  // Core brand identity
  if (brand.tagline) prompt += 'TAGLINE: ' + brand.tagline + '\n\n';
  if (brand.essence) prompt += 'ESSENCE: ' + brand.essence + '\n\n';
  if (brand.philosophy) prompt += 'PHILOSOPHY: ' + brand.philosophy + '\n\n';
  if (brand.coreBelief) prompt += 'CORE BELIEF: ' + brand.coreBelief + '\n\n';
  if (brand.mission) prompt += 'MISSION: ' + brand.mission + '\n\n';
  if (brand.ethos) prompt += 'ETHOS: ' + brand.ethos + '\n\n';
  if (brand.vision) prompt += 'VISION: ' + brand.vision + '\n\n';

  // Industry and positioning
  if (brand.industry) prompt += 'INDUSTRY: ' + brand.industry + '\n';
  if (brand.positioning || brand.products) prompt += 'PRODUCTS/POSITIONING: ' + (brand.products || brand.positioning) + '\n';
  if (brand.audience) prompt += 'TARGET AUDIENCE: ' + brand.audience + '\n';
  if (brand.promise) prompt += 'BRAND PROMISE: ' + brand.promise + '\n';
  if (brand.cta) prompt += 'PRIMARY CTA: ' + brand.cta + '\n';
  prompt += '\n';

  // Voice and communication
  if (brand.voice) prompt += 'VOICE: ' + brand.voice + '\n';
  if (brand.tone) prompt += 'TONE: ' + brand.tone + '\n';
  if (brand.approach) prompt += 'APPROACH: ' + brand.approach + '\n';
  prompt += '\n';

  // Vocabulary guidance
  if (brand.vocabDo) prompt += 'VOCABULARY DO: ' + brand.vocabDo + '\n';
  if (brand.vocabDont) prompt += 'VOCABULARY DON\'T: ' + brand.vocabDont + '\n';
  if (brand.constraints) prompt += 'CONSTRAINTS: ' + brand.constraints + '\n';
  prompt += '\n';

  // Values
  if (brand.values) {
    if (Array.isArray(brand.values)) {
      prompt += 'VALUES: ' + brand.values.join(', ') + '\n\n';
    } else {
      prompt += 'VALUES: ' + brand.values + '\n\n';
    }
  }

  // Additional context fields
  if (brand.trainingApproach) prompt += 'TRAINING APPROACH: ' + brand.trainingApproach + '\n';
  if (brand.programs) prompt += 'PROGRAMS: ' + brand.programs + '\n';
  if (brand.adaEssentials) prompt += 'ADA ESSENTIALS: ' + brand.adaEssentials + '\n';
  if (brand.experience) prompt += 'EXPERIENCE: ' + brand.experience + '\n';
  if (brand.properties) prompt += 'PROPERTIES: ' + brand.properties + '\n';
  if (brand.services) prompt += 'SERVICES: ' + brand.services + '\n';
  if (brand.pricing) prompt += 'PRICING: ' + brand.pricing + '\n';
  if (brand.partnerships) prompt += 'PARTNERSHIPS: ' + brand.partnerships + '\n';
  if (brand.deliverables) prompt += 'DELIVERABLES: ' + brand.deliverables + '\n';
  if (brand.location) prompt += 'LOCATION: ' + brand.location + '\n';
  if (brand.contacts) prompt += 'CONTACTS: ' + brand.contacts + '\n';

  // Visual identity
  if (brand.visual) {
    if (brand.visual.colors && brand.visual.colors.length > 0) {
      prompt += 'BRAND COLORS: ' + brand.visual.colors.join(', ') + '\n';
    }
    if (brand.visual.fonts && brand.visual.fonts.length > 0) {
      prompt += 'BRAND FONTS: ' + brand.visual.fonts.join(', ') + '\n';
    }
  }
  prompt += '\n';

  // v15.14: INJECT IDENTITY INTELLIGENCE — documents, insights, knowledge
  if (typeof getBrandIdentityIntelligence === 'function') {
    var identityData = getBrandIdentityIntelligence(brand);
    if (identityData) {
      prompt += identityData;
      console.log('[BrandAI Preview] Injected Identity Intelligence (' + identityData.length + ' chars)');
    } else {
      console.log('[BrandAI Preview] No Identity Intelligence found for this brand');
    }
  }

  previewEl.value = prompt;

  // v15.14: Track timestamp of this generation
  saveBrandAIPromptTimestamp(selectedBrand);
  updateBrandAIPromptTimestamp();
}

// v15.14: Save timestamp when BrandAI prompt is generated/updated
function saveBrandAIPromptTimestamp(brandIdx) {
  try {
    var timestamps = JSON.parse(localStorage.getItem('roweos_prompt_timestamps') || '{}');
    var brand = brands[brandIdx];
    var key = (brand && brand.name) ? brand.name : ('brand_' + brandIdx);
    timestamps[key] = new Date().toISOString();
    localStorage.setItem('roweos_prompt_timestamps', JSON.stringify(timestamps));
  } catch (e) {
    console.warn('[BrandAI] Error saving timestamp:', e);
  }
}

// v15.32: Live-refresh the Identity timestamp display after any save
function refreshIdentityTimestamp() {
  try {
    var tsContainer = document.getElementById('identityTimestamps');
    if (!tsContainer) return;
    var brand = brands[selectedBrand];
    if (!brand) return;
    var timestamps = JSON.parse(localStorage.getItem('roweos_prompt_timestamps') || '{}');
    var brandKey = getBrandMemoryKey(selectedBrand);
    var lastSaved = timestamps[brandKey] ? new Date(timestamps[brandKey]).toLocaleString() : null;
    var syncTs = JSON.parse(localStorage.getItem('roweos_identity_sync_timestamps') || '{}');
    var lastSynced = syncTs[brandKey] ? new Date(syncTs[brandKey]).toLocaleString() : null;
    var html = '';
    if (lastSaved) html += '<span>Last saved: ' + lastSaved + '</span>';
    if (lastSynced) html += '<span>Last synced: ' + lastSynced + '</span>';
    tsContainer.innerHTML = html || '<span>Not yet saved</span>';
  } catch(e) {}
}

// v15.14: Display last-updated timestamp in Guardrails UI
function updateBrandAIPromptTimestamp() {
  var el = document.getElementById('brandAIPromptTimestamp');
  if (!el) return;
  try {
    var timestamps = JSON.parse(localStorage.getItem('roweos_prompt_timestamps') || '{}');
    var ts = timestamps['brand_' + selectedBrand];
    if (ts) {
      var d = new Date(ts);
      el.textContent = 'Last updated: ' + d.toLocaleDateString() + ' at ' + formatDateTimeDisplay(d);
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  } catch (e) {
    el.style.display = 'none';
  }
}

function copyBrandAIPrompt() {
  var textarea = document.getElementById('brandAISystemPrompt');
  textarea.select();
  document.execCommand('copy');
  showToast('BrandAI prompt copied', 'success');
}

function toggleBrandAIPromptEdit() {
  var textarea = document.getElementById('brandAISystemPrompt');
  
  if (textarea.readOnly) {
    originalBrandAIPrompt = textarea.value;
    textarea.readOnly = false;
    textarea.style.borderColor = '#a89878';
    document.getElementById('editBrandAIPromptBtn').style.display = 'none';
    document.getElementById('saveBrandAIPromptBtn').style.display = 'inline-block';
    document.getElementById('cancelBrandAIPromptBtn').style.display = 'inline-block';
  }
}

function saveBrandAIPrompt() {
  var textarea = document.getElementById('brandAISystemPrompt');
  var customPrompts = JSON.parse(localStorage.getItem('roweos_brandai_main_prompts') || '{}');
  
  console.log('[BrandAI] Saving custom prompt for brand:', selectedBrand);
  console.log('[BrandAI] Prompt being saved (length):', textarea.value.length);
  console.log('[BrandAI] Contains "Mr. Rowe":', textarea.value.includes('Mr. Rowe'));
  
  customPrompts[selectedBrand] = textarea.value;
  localStorage.setItem('roweos_brandai_main_prompts', JSON.stringify(customPrompts));
  
  console.log('[BrandAI] Saved successfully. Verifying...');
  var verified = JSON.parse(localStorage.getItem('roweos_brandai_main_prompts') || '{}');
  console.log('[BrandAI] Verification - stored prompt length:', verified[selectedBrand] ? verified[selectedBrand].length : 0);
  
  textarea.readOnly = true;
  textarea.style.borderColor = 'var(--border-color)';
  
  document.getElementById('editBrandAIPromptBtn').style.display = 'inline-block';
  document.getElementById('saveBrandAIPromptBtn').style.display = 'none';
  document.getElementById('cancelBrandAIPromptBtn').style.display = 'none';

  // v15.14: Track timestamp on manual save
  saveBrandAIPromptTimestamp(selectedBrand);
  updateBrandAIPromptTimestamp();

  showToast('BrandAI system prompt saved', 'success');
}

function cancelBrandAIPromptEdit() {
  var textarea = document.getElementById('brandAISystemPrompt');
  textarea.value = originalBrandAIPrompt;
  textarea.readOnly = true;
  textarea.style.borderColor = 'var(--border-color)';
  
  document.getElementById('editBrandAIPromptBtn').style.display = 'inline-block';
  document.getElementById('saveBrandAIPromptBtn').style.display = 'none';
  document.getElementById('cancelBrandAIPromptBtn').style.display = 'none';
}

function resetBrandAIPromptToDefault() {
  if (!confirm('This will reset the BrandAI system prompt to the default version with all brand details. Any custom edits will be lost. Continue?')) {
    return;
  }
  
  console.log('[BrandAI] Resetting to default prompt for brand:', selectedBrand);
  
  // Remove custom prompt from localStorage
  var customPrompts = JSON.parse(localStorage.getItem('roweos_brandai_main_prompts') || '{}');
  delete customPrompts[selectedBrand];
  localStorage.setItem('roweos_brandai_main_prompts', JSON.stringify(customPrompts));
  
  console.log('[BrandAI] Custom prompt deleted from localStorage');
  
  // Regenerate default prompt
  generateBrandAIPrompt();
  
  console.log('[BrandAI] Default prompt regenerated');
  showToast('BrandAI prompt reset to default', 'success');
}

// ═══════════════════════════════════════════════════════════════
// LIFEAI MAIN SYSTEM PROMPT FUNCTIONS
// v10.5.25: Parallel to BrandAI but for personal life mode
// ═══════════════════════════════════════════════════════════════

var originalLifeAIPrompt = '';
var customLifeAIPrompt = localStorage.getItem('roweos_life_main_prompt') || '';

/**
 * v10.5.25: Generate LifeAI system prompt from profile
 */
function generateLifeAIPrompt() {
  var previewEl = document.getElementById('lifeAISystemPrompt');
  if (!previewEl) return;

  // Check for custom prompt first
  if (customLifeAIPrompt) {
    previewEl.value = customLifeAIPrompt;
    updateLifeAIPromptTimestamp();
    return;
  }

  // Generate default from profile
  var prompt = buildLifeAISystemPrompt();
  previewEl.value = prompt;

  // v15.14: Track timestamp
  saveLifeAIPromptTimestamp();
  updateLifeAIPromptTimestamp();
}

// v15.14: Save timestamp when LifeAI prompt is generated/refreshed
function saveLifeAIPromptTimestamp() {
  try {
    var timestamps = JSON.parse(localStorage.getItem('roweos_prompt_timestamps') || '{}');
    timestamps['lifeai'] = new Date().toISOString();
    localStorage.setItem('roweos_prompt_timestamps', JSON.stringify(timestamps));
  } catch (e) {
    console.warn('[LifeAI] Error saving timestamp:', e);
  }
}

// v15.14: Display last-updated timestamp for LifeAI
function updateLifeAIPromptTimestamp() {
  var el = document.getElementById('lifeAIPromptTimestamp');
  if (!el) return;
  try {
    var timestamps = JSON.parse(localStorage.getItem('roweos_prompt_timestamps') || '{}');
    var ts = timestamps['lifeai'];
    if (ts) {
      var d = new Date(ts);
      el.textContent = 'Last updated: ' + d.toLocaleDateString() + ' at ' + formatDateTimeDisplay(d);
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  } catch (e) {
    el.style.display = 'none';
  }
}

/**
 * v10.5.25: Copy LifeAI prompt to clipboard
 */
function copyLifeAIPrompt() {
  var textarea = document.getElementById('lifeAISystemPrompt');
  textarea.select();
  document.execCommand('copy');
  showToast('LifeAI prompt copied', 'success');
}

/**
 * v10.5.25: Toggle edit mode for LifeAI prompt
 */
function toggleLifeAIPromptEdit() {
  var textarea = document.getElementById('lifeAISystemPrompt');
  
  if (textarea.readOnly) {
    originalLifeAIPrompt = textarea.value;
    textarea.readOnly = false;
    textarea.style.borderColor = 'var(--life-accent, #22c55e)';
    document.getElementById('editLifeAIPromptBtn').style.display = 'none';
    document.getElementById('saveLifeAIPromptBtn').style.display = 'inline-block';
    document.getElementById('cancelLifeAIPromptBtn').style.display = 'inline-block';
  }
}

/**
 * v10.5.25: Save custom LifeAI prompt
 */
function saveLifeAIPrompt() {
  var textarea = document.getElementById('lifeAISystemPrompt');
  customLifeAIPrompt = textarea.value;
  localStorage.setItem('roweos_life_main_prompt', customLifeAIPrompt);
  syncLifeAIToFirestore({ mainSystemPrompt: customLifeAIPrompt });

  textarea.readOnly = true;
  textarea.style.borderColor = 'var(--border-color)';
  
  document.getElementById('editLifeAIPromptBtn').style.display = 'inline-block';
  document.getElementById('saveLifeAIPromptBtn').style.display = 'none';
  document.getElementById('cancelLifeAIPromptBtn').style.display = 'none';
  
  showToast('LifeAI prompt saved', 'success');
}

/**
 * v10.5.25: Cancel LifeAI prompt edit
 */
function cancelLifeAIPromptEdit() {
  var textarea = document.getElementById('lifeAISystemPrompt');
  textarea.value = originalLifeAIPrompt;
  textarea.readOnly = true;
  textarea.style.borderColor = 'var(--border-color)';
  
  document.getElementById('editLifeAIPromptBtn').style.display = 'inline-block';
  document.getElementById('saveLifeAIPromptBtn').style.display = 'none';
  document.getElementById('cancelLifeAIPromptBtn').style.display = 'none';
}

/**
 * v10.5.25: Reset LifeAI prompt to default
 */
function resetLifeAIPromptToDefault() {
  if (!confirm('This will reset the LifeAI system prompt to the default version. Any custom edits will be lost. Continue?')) {
    return;
  }
  
  customLifeAIPrompt = '';
  localStorage.removeItem('roweos_life_main_prompt');
  syncLifeAIToFirestore({ mainSystemPrompt: '' });
  generateLifeAIPrompt();
  showToast('LifeAI prompt reset to default', 'success');
}

/**
 * v10.5.25: Update Guardrails view based on current mode
 */
function updateGuardrailsForMode() {
  var inLifeMode = isLifeMode();
  
  // Toggle visibility of brand/life sections
  document.querySelectorAll('.brand-mode-only').forEach(function(el) {
    el.style.display = inLifeMode ? 'none' : '';
  });
  document.querySelectorAll('.life-mode-only').forEach(function(el) {
    el.style.display = inLifeMode ? '' : 'none';
  });
  
  // Update title and description
  var titleEl = document.getElementById('guardrailsTitle');
  var descEl = document.getElementById('guardrailsDesc');
  
  if (titleEl) {
    titleEl.textContent = inLifeMode ? 'Life Settings' : 'Guardrails';
  }
  if (descEl) {
    descEl.textContent = inLifeMode 
      ? 'Configure your personal AI assistant\'s behavior, focus areas, and boundaries.'
      : 'Define agent scopes, behavioral boundaries, and content rules for your brands.';
  }
  
  // Populate the relevant prompt
  if (inLifeMode) {
    generateLifeAIPrompt();
    renderLifeFocusRules();
  } else {
    generateBrandAIPrompt();
    if (typeof renderScopeRules === 'function') renderScopeRules();
  }
}

/**
 * v10.5.25: Render Life Focus Areas in Guardrails
 */
function renderLifeFocusRules() {
  var container = document.getElementById('lifeFocusEditor');
  if (!container) return;
  
  var profile = getLifeAIProfile();
  var focusAreas = profile.focusAreas || ['Health & Wellness', 'Career & Growth', 'Relationships'];
  
  var html = '<div class="scope-rules-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4);">';
  
  focusAreas.forEach(function(area, idx) {
    var rules = profile.focusRules && profile.focusRules[area] || '';
    html += '<div class="scope-rule-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-4);">';
    html += '<div style="font-weight: 500; color: var(--text-primary); margin-bottom: var(--space-2);">' + area + '</div>';
    html += '<textarea class="scope-rule-input" data-area="' + area + '" placeholder="Enter focus rules for ' + area + '..." style="width: 100%; min-height: 80px; padding: var(--space-2); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--text-base); resize: vertical;">' + rules + '</textarea>';
    html += '</div>';
  });
  
  html += '</div>';
  
  // Add focus area button
  html += '<div style="margin-top: var(--space-4);">';
  html += '<button class="btn btn-secondary btn-small" onclick="addLifeFocusArea()">+ Add Focus Area</button>';
  html += '</div>';
  
  container.innerHTML = html;
}

/**
 * v10.5.25: Add new life focus area
 */
function addLifeFocusArea() {
  var areaName = prompt('Enter new focus area name (e.g., "Fitness", "Learning", "Side Projects"):');
  if (!areaName || !areaName.trim()) return;
  
  var profile = getLifeAIProfile();
  if (!profile.focusAreas) profile.focusAreas = ['Health & Wellness', 'Career & Growth', 'Relationships'];
  
  if (profile.focusAreas.includes(areaName.trim())) {
    showToast('Focus area already exists', 'warning');
    return;
  }
  
  profile.focusAreas.push(areaName.trim());
  saveLifeAIProfile(profile);
  renderLifeFocusRules();
  showToast('Focus area added', 'success');
}

/**
 * v10.5.25: Save life focus rules
 */
function saveLifeFocusRules() {
  var profile = getLifeAIProfile();
  if (!profile.focusRules) profile.focusRules = {};
  
  document.querySelectorAll('#lifeFocusEditor .scope-rule-input').forEach(function(textarea) {
    var area = textarea.dataset.area;
    profile.focusRules[area] = textarea.value;
  });
  
  saveLifeAIProfile(profile);
  showToast('Focus rules saved', 'success');
}

/**
 * v10.5.25: Update Studio view based on mode
 */
function updateStudioForMode() {
  var inLifeMode = isLifeMode();
  console.log('[updateStudioForMode] Mode:', inLifeMode ? 'LIFE' : 'BRAND');
  
  // v10.5.25: Ensure html element has correct mode class for CSS rules
  if (inLifeMode) {
    document.documentElement.classList.add('life-mode');
    document.documentElement.classList.remove('brand-mode');
  } else {
    document.documentElement.classList.add('brand-mode');
    document.documentElement.classList.remove('life-mode');
  }
  
  // Toggle visibility of brand-mode sections - explicit hide/show
  document.querySelectorAll('#studioView .brand-mode-only').forEach(function(el) {
    el.style.display = inLifeMode ? 'none' : '';
  });
  
  // Toggle visibility of life-mode sections
  // v10.5.25: Clear inline styles so CSS !important rules take effect cleanly
  document.querySelectorAll('#studioView .life-mode-only').forEach(function(el) {
    if (inLifeMode) {
      // Remove inline display so CSS !important (block/flex) takes over
      el.style.removeProperty('display');
    } else {
      el.style.display = 'none';
    }
  });
  
  // Also explicitly show/hide the lifeTasksSection and creator section
  var creatorSection = document.getElementById('lifeCreatorSection');
  var lifeTasksSection = document.getElementById('lifeTasksSection');
  var universalOpsSection = document.getElementById('universalOpsSection');
  var brandCreatorSection = document.getElementById('brandCreatorSection');
  var pinnedSection = document.getElementById('pinnedSection');
  var recentSection = document.getElementById('recentSection');
  
  console.log('[updateStudioForMode] Section elements found:', {
    creator: !!creatorSection,
    lifeTasks: !!lifeTasksSection,
    universal: !!universalOpsSection
  });
  
  if (inLifeMode) {
    // Show life sections
    if (creatorSection) creatorSection.style.display = 'block';
    if (lifeTasksSection) lifeTasksSection.style.display = 'block';
    // Hide brand sections
    if (universalOpsSection) universalOpsSection.style.display = 'none';
    if (brandCreatorSection) brandCreatorSection.style.display = 'none';
    if (pinnedSection) pinnedSection.style.display = 'none';
    if (recentSection) recentSection.style.display = 'none';
  } else {
    // Show brand sections
    if (universalOpsSection) universalOpsSection.style.display = 'block';
    if (brandCreatorSection) brandCreatorSection.style.display = '';
    // Hide life sections
    if (creatorSection) creatorSection.style.display = 'none';
    if (lifeTasksSection) lifeTasksSection.style.display = 'none';
  }
  
  // Update title
  var titleEl = document.getElementById('studioTitle');
  var brandNameEl = document.getElementById('studioBrandName');
  var lifeNameEl = document.getElementById('studioLifeName');
  
  if (titleEl) {
    // v24.27: Use querySelector to update only the span, not wipe out the ? button
    var titleSpan = titleEl.querySelector('span');
    if (titleSpan) {
      titleSpan.textContent = inLifeMode ? 'Life Studio' : 'Agent Studio';
    }
  }
  
  // Handle brand name visibility
  if (brandNameEl) {
    brandNameEl.style.display = inLifeMode ? 'none' : '';
    if (!inLifeMode) {
      // v19.4: Sync studioSelectedBrand to match global selectedBrand
      studioSelectedBrand = selectedBrand;
      var studioBrandEl = document.getElementById('studioBrand');
      if (studioBrandEl) studioBrandEl.value = selectedBrand;
      var brand = brands[selectedBrand];
      brandNameEl.textContent = brand ? (brand.shortName || brand.name) : 'Select a brand';
    }
  }
  
  // Handle life name visibility and content
  if (lifeNameEl) {
    lifeNameEl.style.display = inLifeMode ? '' : 'none';
    if (inLifeMode) {
      var profile = getLifeAIProfile();
      lifeNameEl.textContent = profile.name || 'Personal Tasks';
    }
  }
  
  // v26.2: Pill nav is now rendered dynamically in showView based on mode
  // (Old agentSelector/lifeAgentSelector tab visibility toggle removed)
  
  // Render appropriate operations
  if (inLifeMode) {
    renderLifeOps();
  }
}

/**
 * v10.5.25: Render LifeAI operations in Studio
 */
function renderLifeOps() {
  console.log('[renderLifeOps] Starting render, window.lifeOps:', window.lifeOps ? window.lifeOps.length : 'undefined');
  var creatorContainer = document.getElementById('lifeOps');
  var tasksContainer = document.getElementById('lifeTasksOps');
  console.log('[renderLifeOps] Containers found:', { creator: !!creatorContainer, tasks: !!tasksContainer });
  if (!creatorContainer && !tasksContainer) return;
  
  // lifeOps is defined globally on window
  if (!window.lifeOps || !window.lifeOps.length) {
    if (tasksContainer) tasksContainer.innerHTML = '<p style="color: var(--text-muted);">No life operations available.</p>';
    return;
  }
  
  // Category colors for LifeAI (similar to BrandAI agent colors)
  var lifeCategoryColors = {
    planning: { bg: '#a78bfa', label: 'PLANNING' },      // Purple
    development: { bg: '#f472b6', label: 'DEVELOPMENT' }, // Pink
    wellness: { bg: '#4ade80', label: 'WELLNESS' },       // Green
    relationships: { bg: '#fbbf24', label: 'RELATIONSHIPS' }, // Yellow
    finances: { bg: '#60a5fa', label: 'FINANCES' },       // Blue
    taxes: { bg: '#10b981', label: 'TAX COPILOT' },       // Emerald green - v10.5.25
    home: { bg: '#fb923c', label: 'HOME' },               // Orange
    creativity: { bg: '#c084fc', label: 'CREATIVITY' },   // Light purple
    reflection: { bg: '#22d3d7', label: 'REFLECTION' }    // Teal
  };
  
  // v10.5.25: CREATOR section - only show AI-generated/custom tasks with sparkle
  if (creatorContainer) {
    var customOps = generatedLifeOps || [];
    if (customOps.length === 0) {
      creatorContainer.innerHTML = '<p style="color: var(--text-muted); padding: var(--space-4); text-align: center; font-size: var(--text-base);">Use the input above to create custom tasks, or click "Generate Personalized Tasks" for AI suggestions based on your profile.</p>';
    } else {
      var html = '';
      customOps.forEach(function(op) {
        var catInfo = lifeCategoryColors[op.category] || { bg: '#888', label: op.category ? op.category.toUpperCase() : 'CUSTOM' };
        html += renderLifeOpCard(op, catInfo, true); // true = isAIGenerated
      });
      creatorContainer.innerHTML = html;
    }
  }
  
  // LIFE TASKS section - show all standard operations
  if (tasksContainer) {
    var html = '';
    window.lifeOps.forEach(function(op) {
      var catInfo = lifeCategoryColors[op.category] || { bg: '#888', label: op.category.toUpperCase() };
      html += renderLifeOpCard(op, catInfo, false);
    });
    tasksContainer.innerHTML = html;
  }
}

/**
 * v10.5.25: Render a single LifeAI operation card
 * @param {Object} op - Operation object
 * @param {Object} catInfo - Category color/label info
 * @param {boolean} isAIGenerated - Whether this is an AI-generated/custom task
 */
function renderLifeOpCard(op, catInfo, isAIGenerated) {
  var category = op.category || 'planning';
  var sparkleIcon = isAIGenerated ? '<svg class="ai-sparkle-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px; color: var(--life-accent, #60a5fa);"><path d="M8 0l1.5 4.5L14 6l-4.5 1.5L8 12l-1.5-4.5L2 6l4.5-1.5L8 0z"/><path d="M13 9l.75 2.25L16 12l-2.25.75L13 15l-.75-2.25L10 12l2.25-.75L13 9z" opacity="0.6"/></svg>' : '';
  var aiClass = isAIGenerated ? ' ai-generated' : '';
  
  return '<div class="studio-v2-card' + aiClass + '" data-category="' + category + '" onclick="selectLifeOperation(' + op.id + ')">' +
    '<div class="studio-v2-card-header">' +
      '<span class="studio-v2-card-name">' + sparkleIcon + op.name + '</span>' +
      '<span class="studio-v2-card-badge" style="background: ' + catInfo.bg + '; color: #000; font-weight: 600; font-size: var(--text-2xs); padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">' + catInfo.label + '</span>' +
    '</div>' +
    '<div class="studio-v2-card-desc">' + op.desc + '</div>' +
  '</div>';
}

/**
 * v10.5.25: Select LifeAI agent category
 */
function selectLifeAgent(category) {
  // v26.2: Update unified pill nav
  updatePillNavActive('studioPillNav', category);
  
  // Category colors
  var lifeCategoryColors = {
    planning: { bg: '#a78bfa', label: 'PLANNING' },
    development: { bg: '#f472b6', label: 'DEVELOPMENT' },
    wellness: { bg: '#4ade80', label: 'WELLNESS' },
    relationships: { bg: '#fbbf24', label: 'RELATIONSHIPS' },
    finances: { bg: '#60a5fa', label: 'FINANCES' },
    taxes: { bg: '#10b981', label: 'TAX COPILOT' },  // v10.5.25
    home: { bg: '#fb923c', label: 'HOME' },
    creativity: { bg: '#c084fc', label: 'CREATIVITY' },
    reflection: { bg: '#22d3d7', label: 'REFLECTION' },
    image: { bg: '#a89878', label: 'IMAGE' }
  };
  
  // Filter operations
  var filtered = category === 'all' ? window.lifeOps : window.lifeOps.filter(function(op) {
    return op.category === category;
  });
  
  // Filter generated ops too
  var filteredGenerated = category === 'all' ? generatedLifeOps : generatedLifeOps.filter(function(op) {
    return op.category === category;
  });
  
  // Render CREATOR section (generated ops only)
  var creatorContainer = document.getElementById('lifeOps');
  if (creatorContainer) {
    if (filteredGenerated.length === 0) {
      creatorContainer.innerHTML = '<p style="color: var(--text-muted); padding: var(--space-4); text-align: center; font-size: var(--text-base);">Use the input above to create custom tasks, or click "Generate Personalized Tasks" for AI suggestions based on your profile.</p>';
    } else {
      var html = '';
      filteredGenerated.forEach(function(op) {
        var catInfo = lifeCategoryColors[op.category] || { bg: '#888', label: op.category ? op.category.toUpperCase() : 'CUSTOM' };
        html += renderLifeOpCard(op, catInfo, true);
      });
      creatorContainer.innerHTML = html;
    }
  }
  
  // Render LIFE TASKS section (standard ops)
  var tasksContainer = document.getElementById('lifeTasksOps');
  if (tasksContainer) {
    var html = '';
    filtered.forEach(function(op) {
      var catInfo = lifeCategoryColors[op.category] || { bg: '#888', label: op.category.toUpperCase() };
      html += renderLifeOpCard(op, catInfo, false);
    });
    
    if (!filtered.length) {
      html = '<p style="color: var(--text-muted); padding: var(--space-5);">No tasks in this category.</p>';
    }
    
    tasksContainer.innerHTML = html;
  }
}

/**
 * v10.5.25: Select a life operation - show config panel like BrandAI
 */
function selectLifeOperation(opId) {
  var op = window.lifeOps.find(function(o) { return o.id === opId; });
  if (!op) {
    // Check if it's a custom/generated op
    op = (window.generatedLifeOps || []).find(function(o) { return o.id === opId; });
  }
  if (!op) return;
  
  // Deselect all cards
  document.querySelectorAll('.studio-v2-card').forEach(function(c) { 
    c.classList.remove('selected'); 
  });
  
  // Find and select the clicked card
  var cards = document.querySelectorAll('.studio-v2-card');
  cards.forEach(function(card) {
    if (card.onclick && card.onclick.toString().includes(opId.toString())) {
      card.classList.add('selected');
    }
  });
  
  // Set selectedOp for runSelectedOperation to use
  selectedOp = op;
  
  // Show config panel - reuse BrandAI's showConfigPanel
  showConfigPanel(op);
  
  // Track as recent
  if (typeof addToRecent === 'function') {
    addToRecent(op.id);
  }
  
  // Update run button
  if (typeof updateRunButton === 'function') {
    updateRunButton();
  }
}

/**
 * v10.5.25: Create custom life operation
 */
function createCustomLifeOperation() {
  var input = document.getElementById('lifeAICreatorInput');
  if (!input || !input.value.trim()) {
    showToast('Please describe the task you need help with', 'warning');
    return;
  }
  
  var customOp = {
    id: 9000 + Date.now(),
    name: 'Custom Task',
    desc: input.value.trim(),
    category: 'custom',
    outputs: [],
    aiGenerated: true
  };
  
  // Add to generated ops array
  generatedLifeOps.push(customOp);
  saveGeneratedLifeOps();
  
  // Clear input
  input.value = '';
  
  // Re-render to show the new task in creator section
  renderLifeOps();
  
  // Select the new operation (shows config panel)
  selectedOp = customOp;
  showConfigPanel(customOp);
  
  showToast('Custom task created! Click "Run Agent" to execute.', 'success');
}

/**
 * v10.5.25: Save generated life ops to localStorage
 */
function saveGeneratedLifeOps() {
  try {
    localStorage.setItem('roweos_generated_life_ops', JSON.stringify(generatedLifeOps));
  } catch (e) {
    console.error('[LifeAI] Error saving generated ops:', e);
  }
}

/**
 * v10.5.25: Load generated life ops from localStorage
 */
function loadGeneratedLifeOps() {
  try {
    generatedLifeOps = JSON.parse(localStorage.getItem('roweos_generated_life_ops') || '[]');
  } catch (e) {
    generatedLifeOps = [];
  }
}

/**
 * v10.5.25: Generate AI recommendations for life tasks
 */
async function generateLifeAIRecommendations() {
  var btn = document.querySelector('#lifeCreatorSection .studio-v2-generate-btn');
  if (!btn || btn.classList.contains('generating')) return;

  // v13.3: Use full life context for deeper analysis
  var ctx = getFullLifeContext();

  // Get API key
  var provider = lifeAISelectedProvider || 'anthropic';
  var model = 'claude-sonnet-4-6';
  var apiKey = await getApiKey(provider);

  if (!apiKey) {
    showToast('API key not configured', 'error');
    return;
  }

  // UI feedback
  btn.classList.add('generating');
  btn.innerHTML = '<div class="loading-spinner" style="width:14px;height:14px;margin-right:8px;"></div><span>Generating...</span>';
  showToast('Analyzing your profile to generate personalized tasks...', 'info');

  // v13.3: Build enriched prompt with LifeAI identity data
  var prompt = 'You are a personal life strategist. Based on this person\'s profile, suggest 5-8 specific LifeAI operations.\n\n';

  prompt += 'ABOUT THE USER:\n';
  if (ctx.name) prompt += '- Name: ' + ctx.name + '\n';
  if (ctx.role) prompt += '- Role: ' + ctx.role + '\n';
  if (ctx.location) prompt += '- Location: ' + ctx.location + '\n';
  if (ctx.values && ctx.values.length) prompt += '- Values: ' + ctx.values.join(', ') + '\n';
  if (ctx.goals && ctx.goals.length) prompt += '- Life Goals: ' + ctx.goals.join(', ') + '\n';
  if (ctx.interests && ctx.interests.length) prompt += '- Interests: ' + ctx.interests.join(', ') + '\n';
  if (ctx.focusAreas && ctx.focusAreas.length) prompt += '- Focus Areas: ' + ctx.focusAreas.join(', ') + '\n';

  // Rhythm preferences
  if (ctx.rhythmPrefs && ctx.rhythmPrefs.areas) {
    prompt += '- Rhythm Focus: ' + ctx.rhythmPrefs.areas.join(', ') + '\n';
  }

  // Fallback: try legacy profile
  if (!ctx.name && !ctx.role) {
    try {
      var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
      if (profile) {
        if (profile.name) prompt += '- Name: ' + profile.name + '\n';
        if (profile.lifeAreas && profile.lifeAreas.length) prompt += '- Focus Areas: ' + profile.lifeAreas.join(', ') + '\n';
        if (profile.goals && profile.goals.length) prompt += '- Goals: ' + profile.goals.join(', ') + '\n';
        if (profile.commStyle) prompt += '- Communication Style: ' + profile.commStyle + '\n';
      }
    } catch(e) {}
  }

  // Active goals
  if (ctx.pulseGoals && ctx.pulseGoals.length > 0) {
    prompt += '\nACTIVE GOALS:\n';
    ctx.pulseGoals.forEach(function(g) { prompt += '- ' + g.title + ' (' + g.progress + '% done)\n'; });
  }

  // Recent runs (avoid duplicates)
  if (ctx.recentRuns && ctx.recentRuns.length > 0) {
    prompt += '\nRECENTLY RUN (do not suggest these): ' + ctx.recentRuns.slice(0, 5).join(', ') + '\n';
  }

  // Journal mood
  if (ctx.recentTags && ctx.recentTags.length > 0) {
    prompt += '\nRECENT JOURNAL THEMES: ' + ctx.recentTags.join(', ') + '\n';
  }

  prompt += '\nGenerate 5-8 operations personalized to this user. Use their specific details in names.\n';
  prompt += 'BAD: "Wellness Check-In"\nGOOD: "Morning Yoga Routine for Back Pain" (if user mentioned back issues)\n\n';
  prompt += 'Return ONLY a JSON array: [{"name":"...","desc":"...","category":"planning|development|wellness|relationships|finances|home|creativity|reflection","outputs":["..."]}]\n';

  try {
    var response = await callBrandAIGeneratorAPI(provider, model, apiKey, prompt);
    var cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    var operations = JSON.parse(cleanResponse);

    if (Array.isArray(operations) && operations.length > 0) {
      // v13.3: Store as generated life ops using generatedBrandOps with mode flag
      // v24.12: Keep custom-created life ops when regenerating
      var existingNonLife = generatedBrandOps.filter(function(op) { return op.generatedForMode !== 'life' || op.customCreated; });
      operations.forEach(function(op, idx) {
        existingNonLife.push({
          id: 'gen-life-' + Date.now() + '-' + idx,
          name: op.name,
          desc: op.desc || '',
          category: op.category || 'planning',
          brand: null,
          outputs: op.outputs || ['Custom output'],
          aiGenerated: true,
          generatedForMode: 'life',
          generatedAt: new Date().toISOString()
        });
      });
      generatedBrandOps = existingNonLife;
      saveBrandAIGeneratedOps();

      // Also add to legacy generatedLifeOps for compatibility
      operations.forEach(function(task) {
        generatedLifeOps.push({
          id: 9000 + Date.now() + Math.random() * 1000,
          name: task.name,
          desc: task.desc || '',
          category: task.category || 'planning',
          outputs: task.outputs || [],
          aiGenerated: true,
          generatedAt: new Date().toISOString()
        });
      });
      if (typeof saveGeneratedLifeOps === 'function') saveGeneratedLifeOps();
      if (typeof renderLifeOps === 'function') renderLifeOps();
      renderOperations();

      showToast('Generated ' + operations.length + ' personalized operations', 'success');
    } else {
      showToast('Could not generate tasks. Try again.', 'warning');
    }
  } catch(e) {
    console.error('v13.3: LifeAI generation error:', e);
    showToast('Could not generate operations: ' + e.message, 'error');
  } finally {
    btn.classList.remove('generating');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/></svg><span>Generate Personalized Tasks</span>';
  }
}

// ═══════════════════════════════════════════════════════════════
// v10.5.25: LIFE RHYTHM - CALENDAR, ROUTINES, HABITS, GOALS
// ═══════════════════════════════════════════════════════════════

// Life Rhythm Data Structures
var lifeHabits = JSON.parse(localStorage.getItem('roweos_life_habits') || '[]');
var lifeGoals = JSON.parse(localStorage.getItem('roweos_life_goals') || '[]');
var lifeRoutines = JSON.parse(localStorage.getItem('roweos_life_routines') || '[]');
var lifeCalendarView = 'month';
var lifeWeekOffset = 0;
var lifeDragItem = null;

/**
 * Initialize Life Rhythm view
 */
function initLifeRhythm() {
  // v13.2: Check for personalization survey
  // v25.1: No longer auto-fill hardcoded defaults — the onboarding survey
  // (showLifeRhythmSurvey -> generatePersonalizedDefaults) populates routines,
  // habits, and goals based on what the user selects. This prevents the
  // recurring 6:30am preset conflict.
  var prefs = null;
  try { prefs = JSON.parse(localStorage.getItem('roweos_life_rhythm_preferences') || 'null'); } catch(e) {}
  if (!prefs) {
    showLifeRhythmSurvey();
  }

  // Only save empty arrays if nothing exists yet (no hardcoded presets)
  // Actual items come from the onboarding survey via generatePersonalizedDefaults()

  renderLifeRhythm();
}

/**
 * v13.2: Show Life Rhythm personalization survey
 */
function showLifeRhythmSurvey() {
  var container = document.getElementById('rhythmLifeContent');
  if (!container) return;

  // Check if survey already showing
  if (document.getElementById('lifeRhythmSurvey')) return;

  var overlay = document.createElement('div');
  overlay.id = 'lifeRhythmSurvey';
  overlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);';

  var areas = [
    { key: 'health', label: 'Health & Fitness', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>' },
    { key: 'productivity', label: 'Productivity', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>' },
    { key: 'mindfulness', label: 'Mindfulness', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>' },
    { key: 'relationships', label: 'Relationships', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' },
    { key: 'learning', label: 'Learning', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>' },
    { key: 'finance', label: 'Finance', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' },
    { key: 'creativity', label: 'Creativity', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' }
  ];

  var checkboxes = areas.map(function(a) {
    return '<label style="display: flex; align-items: center; gap: var(--space-3); padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md); cursor: pointer; border: 1px solid var(--border-color); transition: all 0.15s ease;" onmouseover="this.style.borderColor=\'var(--life-accent)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'">' +
      '<input type="checkbox" class="rhythm-pref-check" value="' + a.key + '" style="accent-color: var(--life-accent); width: 18px; height: 18px;">' +
      '<div style="color: var(--life-accent);">' + a.icon + '</div>' +
      '<span style="color: var(--text-primary); font-weight: 500;">' + a.label + '</span>' +
    '</label>';
  }).join('');

  overlay.innerHTML = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: var(--space-6); max-width: 480px; width: 90%;">' +
    '<div style="text-align: center; margin-bottom: var(--space-5);">' +
      '<div style="font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-2);">Personalize Your Rhythm</div>' +
      '<div style="color: var(--text-muted);">Select the areas you want to focus on. We\'ll customize your routines, habits, and goals.</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin-bottom: var(--space-5);">' + checkboxes + '</div>' +
    '<button class="pulse-3-btn pulse-3-btn-primary" onclick="saveLifeRhythmSurvey()" style="width: 100%; padding: 12px; font-size: var(--text-base); background: var(--life-accent, #22c55e); border: none; border-radius: var(--radius-lg); color: #fff; font-weight: 600; cursor: pointer;">Get Started</button>' +
    '<button onclick="dismissLifeRhythmSurvey()" style="width: 100%; padding: 10px; margin-top: var(--space-2); font-size: var(--text-sm); background: none; border: 1px solid var(--border-color); border-radius: var(--radius-lg); color: var(--text-muted); cursor: pointer;">Skip for now</button>' +
  '</div>';

  container.style.position = 'relative';
  container.appendChild(overlay);
}

/**
 * v13.2: Save survey selections and generate personalized defaults
 */
function saveLifeRhythmSurvey() {
  var checks = document.querySelectorAll('.rhythm-pref-check:checked');
  var selected = [];
  checks.forEach(function(c) { selected.push(c.value); });

  if (selected.length === 0) {
    showToast('Please select at least one area', 'warning');
    return;
  }

  var prefs = { areas: selected, completedAt: new Date().toISOString() };
  localStorage.setItem('roweos_life_rhythm_preferences', JSON.stringify(prefs));

  // Generate personalized defaults
  generatePersonalizedDefaults(prefs);

  // Remove survey overlay
  var overlay = document.getElementById('lifeRhythmSurvey');
  if (overlay) overlay.style.display = 'none';
  if (overlay) overlay.remove();

  // v13.9: Ensure Rhythm re-renders after survey with personalized content
  renderLifeRhythm();
  setTimeout(function() {
    if (typeof renderLifeRhythm === 'function') renderLifeRhythm();
  }, 100);
  showToast('Rhythm personalized!', 'success');
  // v26.4: Route through single sync (replaces direct writeDB call)
  syncLifeAIToFirestore({ rhythmPreferences: prefs });
}

// v15.21: Dismiss survey without saving — uses all defaults
function dismissLifeRhythmSurvey() {
  var overlay = document.getElementById('lifeRhythmSurvey');
  if (overlay) overlay.remove();
  // Save default prefs so survey doesn't show again
  var defaultPrefs = { areas: ['health', 'productivity', 'mindfulness'], completedAt: new Date().toISOString(), skipped: true };
  localStorage.setItem('roweos_life_rhythm_preferences', JSON.stringify(defaultPrefs));
  renderLifeRhythm();
  syncLifeAIToFirestore({ rhythmPreferences: defaultPrefs }); // v26.4
}

/**
 * v13.4: Render survey results as data cards in Rhythm left panel
 */
function renderLifeRhythmSurveyWidgets() {
  var container = document.getElementById('rhythmLifeContent');
  if (!container) return;
  // Remove old survey widgets if any
  var old = document.getElementById('rhythmSurveyWidgets');
  if (old) old.remove();
  try {
    var prefs = JSON.parse(localStorage.getItem('roweos_life_rhythm_preferences') || 'null');
    if (!prefs || !prefs.areas || prefs.areas.length === 0) return;
    var areaLabels = { health: 'Health & Fitness', productivity: 'Productivity', mindfulness: 'Mindfulness', relationships: 'Relationships', learning: 'Learning', finance: 'Finance', creativity: 'Creativity' };
    var areaIcons = {
      health: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
      productivity: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>',
      mindfulness: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>',
      relationships: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
      learning: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
      finance: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
      creativity: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
    };
    var html = '<div id="rhythmSurveyWidgets" data-widget-id="survey" style="margin-top:var(--space-4);padding:var(--space-4);background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-xl);">';
    html += '<div style="font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3);">Focus Areas</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    prefs.areas.forEach(function(area) {
      html += '<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--life-accent,#22c55e)15;border:1px solid var(--life-accent,#22c55e)40;border-radius:var(--radius-md);font-size:12px;color:var(--life-accent,#22c55e);">';
      html += (areaIcons[area] || '') + ' ' + (areaLabels[area] || area);
      html += '</div>';
    });
    html += '</div></div>';
    // Insert after the main content area (before calendar)
    var goalsPanel = document.getElementById('lifeGoalsPanel');
    if (goalsPanel && goalsPanel.parentElement) {
      goalsPanel.parentElement.insertAdjacentHTML('beforeend', html);
    }
  } catch(e) {}
}

/**
 * v15.4: Rhythm Widget Builder — toggle visibility and reorder left panel cards
 */
var rhythmWidgetDefaults = [
  { id: 'routine', label: "Today's Routine", visible: true },
  { id: 'habits', label: 'Daily Habits', visible: true },
  { id: 'goals', label: 'Active Goals', visible: true },
  { id: 'patterns', label: 'Patterns', visible: true },
  { id: 'survey', label: 'Focus Areas', visible: true }
];

function getRhythmWidgetConfig() {
  try {
    var saved = JSON.parse(localStorage.getItem('roweos_rhythm_widget_config') || 'null');
    if (saved && Array.isArray(saved)) return saved;
  } catch(e) {}
  return rhythmWidgetDefaults.map(function(w) { return { id: w.id, visible: w.visible }; });
}

function saveRhythmWidgetConfig(config) {
  localStorage.setItem('roweos_rhythm_widget_config', JSON.stringify(config));
  // v26.4: Sync to Firestore
  syncLifeAIToFirestore({ rhythmWidgetConfig: config });
}

function applyRhythmWidgetLayout() {
  var config = getRhythmWidgetConfig();
  var panel = document.querySelector('.life-routine-panel');
  if (!panel) return;

  // v26.4: Use data-attribute matching instead of index-based (position-independent)
  var widgetMap = {};
  panel.querySelectorAll('[data-widget-id]').forEach(function(el) {
    widgetMap[el.dataset.widgetId] = el;
  });

  // Reorder and toggle visibility
  config.forEach(function(w) {
    var el = widgetMap[w.id];
    if (el) {
      el.style.display = w.visible ? '' : 'none';
      el.style.order = '';
      panel.appendChild(el);
    }
  });
}

function openRhythmWidgetBuilder() {
  var existing = document.getElementById('rhythmWidgetBuilderOverlay');
  if (existing) { existing.remove(); return; }

  var config = getRhythmWidgetConfig();
  var labels = {};
  rhythmWidgetDefaults.forEach(function(w) { labels[w.id] = w.label; });

  var overlay = document.createElement('div');
  overlay.id = 'rhythmWidgetBuilderOverlay';
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;';

  var html = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: var(--space-6); max-width: 420px; width: 90%;">';
  html += '<div style="text-align: center; margin-bottom: var(--space-5);">';
  html += '  <div style="font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-2);">Widget Builder</div>';
  html += '  <div style="color: var(--text-muted); font-size: var(--text-sm);">Toggle widgets on/off. Drag to reorder.</div>';
  html += '</div>';
  html += '<div id="rhythmWidgetBuilderList" style="display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-5);">';

  config.forEach(function(w, idx) {
    html += '<div class="rhythm-widget-builder-item" data-widget-id="' + w.id + '" draggable="true" style="display: flex; align-items: center; gap: var(--space-3); padding: 10px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: grab;">';
    html += '  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="opacity: 0.4; flex-shrink: 0;"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/></svg>';
    html += '  <span style="flex: 1; font-size: var(--text-sm); font-weight: 500; color: var(--text-primary);">' + (labels[w.id] || w.id) + '</span>';
    html += '  <label style="position: relative; width: 36px; height: 20px; flex-shrink: 0;">';
    html += '    <input type="checkbox" class="rhythm-wb-toggle" data-idx="' + idx + '" ' + (w.visible ? 'checked' : '') + ' style="opacity: 0; position: absolute; width: 100%; height: 100%; cursor: pointer; z-index: 1; margin: 0;">';
    html += '    <span style="position: absolute; inset: 0; border-radius: 10px; background: ' + (w.visible ? 'var(--life-accent, #22c55e)' : 'var(--bg-tertiary)') + '; border: 1px solid var(--border-color); transition: all 0.2s;"></span>';
    html += '    <span style="position: absolute; top: 2px; left: ' + (w.visible ? '18px' : '2px') + '; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: all 0.2s;"></span>';
    html += '  </label>';
    html += '</div>';
  });

  html += '</div>';
  html += '<div style="display: flex; gap: var(--space-3);">';
  html += '  <button onclick="resetRhythmWidgets()" class="btn" style="flex: 1; padding: 10px;">Reset</button>';
  html += '  <button onclick="saveRhythmWidgetBuilder()" class="btn btn-primary" style="flex: 1; padding: 10px;">Save</button>';
  html += '</div>';
  html += '</div>';

  overlay.innerHTML = html;
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);

  // Add toggle interactivity
  overlay.querySelectorAll('.rhythm-wb-toggle').forEach(function(toggle) {
    toggle.addEventListener('change', function() {
      var span = this.parentElement.querySelectorAll('span');
      if (span[0]) span[0].style.background = this.checked ? 'var(--life-accent, #22c55e)' : 'var(--bg-tertiary)';
      if (span[1]) span[1].style.left = this.checked ? '18px' : '2px';
    });
  });

  // Simple drag reorder
  var listEl = document.getElementById('rhythmWidgetBuilderList');
  var dragItem = null;
  listEl.querySelectorAll('.rhythm-widget-builder-item').forEach(function(item) {
    item.addEventListener('dragstart', function() { dragItem = this; this.style.opacity = '0.5'; });
    item.addEventListener('dragend', function() { dragItem = null; this.style.opacity = '1'; });
    item.addEventListener('dragover', function(e) { e.preventDefault(); });
    item.addEventListener('drop', function(e) {
      e.preventDefault();
      if (dragItem && dragItem !== this) {
        var items = Array.prototype.slice.call(listEl.children);
        var fromIdx = items.indexOf(dragItem);
        var toIdx = items.indexOf(this);
        if (fromIdx < toIdx) {
          listEl.insertBefore(dragItem, this.nextSibling);
        } else {
          listEl.insertBefore(dragItem, this);
        }
      }
    });
  });
}

function saveRhythmWidgetBuilder() {
  var list = document.getElementById('rhythmWidgetBuilderList');
  if (!list) return;
  var newConfig = [];
  list.querySelectorAll('.rhythm-widget-builder-item').forEach(function(item) {
    var id = item.dataset.widgetId;
    var toggle = item.querySelector('.rhythm-wb-toggle');
    newConfig.push({ id: id, visible: toggle ? toggle.checked : true });
  });
  saveRhythmWidgetConfig(newConfig);

  var overlay = document.getElementById('rhythmWidgetBuilderOverlay');
  if (overlay) overlay.remove();

  renderLifeRhythm();
  showToast('Widget layout saved', 'success');
}

function resetRhythmWidgets() {
  localStorage.removeItem('roweos_rhythm_widget_config');
  // v26.4: Sync reset to Firestore
  syncLifeAIToFirestore({ rhythmWidgetConfig: rhythmWidgetDefaults.map(function(w) { return { id: w.id, visible: w.visible }; }) });
  var overlay = document.getElementById('rhythmWidgetBuilderOverlay');
  if (overlay) overlay.remove();
  renderLifeRhythm();
  showToast('Widgets reset to default', 'info');
}

/**
 * v13.2: Generate personalized routines, habits, and goals based on survey
 */
function generatePersonalizedDefaults(prefs) {
  // v13.9: Defensive initialization — ensure arrays exist before merging
  console.log('[Survey] generatePersonalizedDefaults called with:', JSON.stringify(prefs));
  if (typeof lifeRoutines === 'undefined' || !Array.isArray(lifeRoutines)) { window.lifeRoutines = []; }
  if (typeof lifeHabits === 'undefined' || !Array.isArray(lifeHabits)) { window.lifeHabits = []; }
  if (typeof lifeGoals === 'undefined' || !Array.isArray(lifeGoals)) { window.lifeGoals = []; }

  var areas = prefs.areas || [];
  var newRoutines = [];
  var newHabits = [];
  var newGoals = [];
  var baseId = Date.now();

  if (areas.indexOf('health') !== -1) {
    // v25.1: No pre-set time to avoid recurring calendar conflicts — user sets their own schedule
    newHabits.push({ id: baseId++, name: 'Drink 8 glasses of water', streak: 0, completedDates: [] });
    newHabits.push({ id: baseId++, name: '10,000 steps', streak: 0, completedDates: [] });
    newGoals.push({ id: baseId++, name: 'Build a consistent fitness routine', progress: 0, dueDate: null });
  }
  if (areas.indexOf('productivity') !== -1) {
    newRoutines.push({ id: baseId++, name: 'Deep work block', time: '09:00', duration: 90, status: '' });
    newHabits.push({ id: baseId++, name: 'Plan tomorrow tonight', streak: 0, completedDates: [] });
    newRoutines.push({ id: baseId++, name: 'Weekly review', time: '17:00', duration: 30, status: '' });
    newGoals.push({ id: baseId++, name: 'Establish a productive daily system', progress: 0, dueDate: null });
  }
  if (areas.indexOf('mindfulness') !== -1) {
    newRoutines.push({ id: baseId++, name: 'Morning meditation', time: '07:00', duration: 15, status: '' });
    newHabits.push({ id: baseId++, name: 'Gratitude journaling', streak: 0, completedDates: [] });
    newGoals.push({ id: baseId++, name: 'Practice daily mindfulness', progress: 0, dueDate: null });
  }
  if (areas.indexOf('relationships') !== -1) {
    newHabits.push({ id: baseId++, name: 'Reach out to a friend', streak: 0, completedDates: [] });
    newGoals.push({ id: baseId++, name: 'Strengthen personal connections', progress: 0, dueDate: null });
  }
  if (areas.indexOf('learning') !== -1) {
    newRoutines.push({ id: baseId++, name: 'Reading time', time: '20:00', duration: 30, status: '' });
    newHabits.push({ id: baseId++, name: 'Learn something new', streak: 0, completedDates: [] });
    newGoals.push({ id: baseId++, name: 'Read 12 books this year', progress: 0, dueDate: null });
  }
  if (areas.indexOf('finance') !== -1) {
    newHabits.push({ id: baseId++, name: 'Track expenses', streak: 0, completedDates: [] });
    newGoals.push({ id: baseId++, name: 'Build financial awareness', progress: 0, dueDate: null });
  }
  if (areas.indexOf('creativity') !== -1) {
    newRoutines.push({ id: baseId++, name: 'Creative session', time: '14:00', duration: 45, status: '' });
    newHabits.push({ id: baseId++, name: 'Create or make something', streak: 0, completedDates: [] });
    newGoals.push({ id: baseId++, name: 'Develop a creative practice', progress: 0, dueDate: null });
  }

  // Merge routines (add only non-duplicates)
  var existingRoutineNames = lifeRoutines.map(function(r) { return r.name.toLowerCase(); });
  newRoutines.forEach(function(r) {
    if (existingRoutineNames.indexOf(r.name.toLowerCase()) === -1) {
      lifeRoutines.push(r);
    }
  });
  saveLifeRoutines();

  // Merge habits
  var existingHabitNames = lifeHabits.map(function(h) { return h.name.toLowerCase(); });
  newHabits.forEach(function(h) {
    if (existingHabitNames.indexOf(h.name.toLowerCase()) === -1) {
      lifeHabits.push(h);
    }
  });
  saveLifeHabits();

  // Merge goals
  var existingGoalNames = lifeGoals.map(function(g) { return (g.name || '').toLowerCase(); });
  newGoals.forEach(function(g) {
    if (existingGoalNames.indexOf(g.name.toLowerCase()) === -1) {
      lifeGoals.push(g);
    }
  });
  saveLifeGoals();

  // v13.9: Force individual render calls to ensure UI updates
  console.log('[Survey] Personalized defaults merged. Routines:', lifeRoutines.length, 'Habits:', lifeHabits.length, 'Goals:', lifeGoals.length);
  if (typeof renderLifeRoutineList === 'function') renderLifeRoutineList();
  if (typeof renderLifeHabitsList === 'function') renderLifeHabitsList();
  if (typeof renderLifeGoalsPanel === 'function') renderLifeGoalsPanel();
}

/**
 * Get default routines
 * v25.1: Removed hardcoded preset routines (6:30am wake up, etc.) that caused
 * recurring conflicts in Rhythm. Users now fill these in during onboarding survey
 * via generatePersonalizedDefaults() instead of getting pre-populated items.
 */
function getDefaultLifeRoutines() {
  return [];
}

/**
 * Get default habits
 * v25.1: Removed hardcoded defaults — onboarding survey populates these
 */
function getDefaultLifeHabits() {
  return [];
}

/**
 * Get default goals
 * v25.1: Removed hardcoded defaults — onboarding survey populates these
 */
function getDefaultLifeGoals() {
  return [];
}

/**
 * v13.2: Analyze life patterns from local data
 */
function analyzeLifePatterns() {
  var container = document.getElementById('lifePatternsContent');
  if (!container) return;

  var patterns = [];
  var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Task completion by day of week
  var dayStats = [0, 0, 0, 0, 0, 0, 0];
  (todos || []).filter(function(t) { return t.completed && t.completedAt; }).forEach(function(t) {
    try {
      var day = new Date(t.completedAt).getDay();
      dayStats[day]++;
    } catch(e) {}
  });
  var maxDay = dayStats.indexOf(Math.max.apply(null, dayStats));
  var totalCompleted = dayStats.reduce(function(a, b) { return a + b; }, 0);
  if (totalCompleted > 0) {
    patterns.push({
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--life-accent)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      label: 'Most productive day',
      value: dayNames[maxDay] + ' (' + dayStats[maxDay] + ' tasks)'
    });
  }

  // Habit streaks
  var bestHabit = { name: 'None', streak: 0 };
  (lifeHabits || []).forEach(function(h) {
    if ((h.streak || 0) > bestHabit.streak) {
      bestHabit = { name: h.name, streak: h.streak };
    }
  });
  if (bestHabit.streak > 0) {
    patterns.push({
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--life-accent)" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>',
      label: 'Strongest habit',
      value: bestHabit.name + ' (' + bestHabit.streak + ' day streak)'
    });
  }

  // Journal frequency (last 30 days)
  var thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var recentEntries = (pulse2JournalEntries || []).filter(function(e) {
    return new Date(e.timestamp).getTime() > thirtyDaysAgo;
  });
  var uniqueDays = {};
  recentEntries.forEach(function(e) { uniqueDays[e.date] = true; });
  var journalDayCount = Object.keys(uniqueDays).length;
  patterns.push({
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--life-accent)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>',
    label: 'Journal frequency',
    value: journalDayCount + ' days in last 30'
  });

  // Routine completion rate
  var routineCompleted = (lifeRoutines || []).filter(function(r) { return r.status === 'completed'; }).length;
  var routineTotal = (lifeRoutines || []).length;
  if (routineTotal > 0) {
    var routinePct = Math.round((routineCompleted / routineTotal) * 100);
    patterns.push({
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--life-accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      label: 'Today\'s routine',
      value: routinePct + '% complete (' + routineCompleted + '/' + routineTotal + ')'
    });
  }

  if (patterns.length === 0) {
    container.innerHTML = '<div class="life-empty-state">Not enough data yet. Keep using RoweOS!</div>';
    return;
  }

  var html = patterns.map(function(p) {
    return '<div style="display: flex; align-items: center; gap: var(--space-3); padding: 8px 0; border-bottom: 1px solid var(--border-color);">' +
      '<div style="flex-shrink: 0;">' + p.icon + '</div>' +
      '<div style="flex: 1;">' +
        '<div style="font-size: var(--text-sm); color: var(--text-muted);">' + p.label + '</div>' +
        '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">' + escapeHtml(p.value) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
  showToast('Patterns analyzed', 'success');
}

/**
 * Render all Life Rhythm content
 */
function renderLifeRhythm() {
  // v15.4: Apply widget order and visibility from saved preferences
  applyRhythmWidgetLayout();

  renderLifeRoutineList();
  renderLifeHabitsList();
  renderLifeGoalsPanel();
  renderLifeCalendar();
  updateLifeWeekDisplay();
  renderLifeRhythmSurveyWidgets();
  
  // v10.5.25: Auto-select today and show day panel
  // v15.43: Skip auto-open on mobile — user must tap a day
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  if (window.innerWidth > 768) {
    openLifeDayView(todayStr);
  }
  
  // Mark today as selected in calendar
  setTimeout(function() {
    var allDays = document.querySelectorAll('#lifeCalendar .calendar-month-day');
    allDays.forEach(function(day) {
      day.classList.remove('selected');
      if (day.dataset.date === todayStr) {
        day.classList.add('selected');
      }
    });
  }, 50);
}

// ═══════════════════════════════════════════════════════════════════════════
// v15.37: Rhythm AI Goal Tasks — Generate daily task recommendations from Pulse goals
// ═══════════════════════════════════════════════════════════════════════════

function getRhythmGoalTasksCacheKey() {
  var today = new Date().toISOString().slice(0, 10);
  var mode = isLifeMode() ? 'life' : 'brand_' + (selectedBrand || 0);
  return 'roweos_rhythm_ai_tasks_' + mode + '_' + today;
}

function loadCachedGoalTasks() {
  try {
    var data = localStorage.getItem(getRhythmGoalTasksCacheKey());
    return data ? JSON.parse(data) : null;
  } catch(e) { return null; }
}

function saveCachedGoalTasks(tasks) {
  try {
    localStorage.setItem(getRhythmGoalTasksCacheKey(), JSON.stringify(tasks));
  } catch(e) { console.warn('[Rhythm AI Tasks] Cache save error:', e); }
}

function generateGoalTasks(forceRefresh) {
  // Check for active goals
  var lifeMode = isLifeMode();
  var activeGoals = pulseGoals.filter(function(g) {
    if (g.archived || g.completed) return false;
    if (lifeMode && g.source !== 'lifeai') return false;
    if (!lifeMode && g.source === 'lifeai') return false;
    return true;
  });

  if (activeGoals.length === 0) {
    hideGoalTasksSection();
    return;
  }

  // Check cache first
  if (!forceRefresh) {
    var cached = loadCachedGoalTasks();
    if (cached && cached.length > 0) {
      renderGoalTasksSection(cached);
      return;
    }
  }

  // Cap at 5 goals
  var goalsForAI = activeGoals.slice(0, 5);

  // Show loading state
  showGoalTasksLoading();

  // Build prompt
  var goalDescriptions = goalsForAI.map(function(g, i) {
    var pendingItems = [];
    if (g.items) {
      pendingItems = g.items.filter(function(it) { return !it.completed; }).slice(0, 3);
    }
    if (g.sections) {
      g.sections.forEach(function(s) {
        if (s.items) {
          pendingItems = pendingItems.concat(s.items.filter(function(it) { return !it.completed; }).slice(0, 2));
        }
      });
    }
    var pendingText = pendingItems.length > 0 ? ' Pending items: ' + pendingItems.map(function(it) { return it.text; }).join(', ') : '';
    return (i + 1) + '. "' + g.title + '" (ID: ' + g.id + ')' + pendingText;
  }).join('\n');

  var prompt = 'I have these active goals:\n' + goalDescriptions + '\n\nFor each goal, suggest ONE specific, actionable task I can do TODAY to make progress. Keep each task under 20 words. Respond ONLY with a JSON array like: [{"goalId":"...","task":"..."}]. No other text.';

  // Try to call AI API
  var provider = localStorage.getItem('roweos_ai_provider') || 'anthropic';
  var apiKey = '';
  var model = '';

  if (provider === 'anthropic') {
    apiKey = localStorage.getItem('roweos_anthropic_key') || '';
    model = localStorage.getItem('roweos_anthropic_model') || 'claude-sonnet-4-20250514';
  } else if (provider === 'openai') {
    apiKey = localStorage.getItem('roweos_openai_key') || '';
    model = localStorage.getItem('roweos_openai_model') || 'gpt-5.4';
  } else if (provider === 'google') {
    apiKey = localStorage.getItem('roweos_google_key') || '';
    model = localStorage.getItem('roweos_google_model') || 'gemini-2.0-flash';
  }

  if (!apiKey) {
    // Fallback: use next pending item text from each goal
    var fallbackTasks = goalsForAI.map(function(g) {
      var nextItem = null;
      if (g.items) nextItem = g.items.find(function(it) { return !it.completed; });
      if (!nextItem && g.sections) {
        for (var s = 0; s < g.sections.length; s++) {
          if (g.sections[s].items) {
            nextItem = g.sections[s].items.find(function(it) { return !it.completed; });
            if (nextItem) break;
          }
        }
      }
      return {
        goalId: g.id,
        goalTitle: g.title,
        task: nextItem ? nextItem.text : 'Review progress on "' + g.title + '"',
        dismissed: false
      };
    });
    saveCachedGoalTasks(fallbackTasks);
    renderGoalTasksSection(fallbackTasks);
    return;
  }

  callBrandAIGeneratorAPI(provider, model, apiKey, prompt).then(function(result) {
    var responseText = '';
    if (result && result.text) responseText = result.text;
    else if (result && typeof result === 'string') responseText = result;

    // Parse JSON from response
    var tasks = [];
    try {
      var jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        var parsed = JSON.parse(jsonMatch[0]);
        tasks = parsed.map(function(t) {
          var goal = goalsForAI.find(function(g) { return g.id === t.goalId; });
          return {
            goalId: t.goalId,
            goalTitle: goal ? goal.title : 'Goal',
            task: t.task,
            dismissed: false
          };
        });
      }
    } catch(e) {
      console.warn('[Rhythm AI Tasks] Parse error:', e);
    }

    // Fallback if parsing failed
    if (tasks.length === 0) {
      tasks = goalsForAI.map(function(g) {
        var nextItem = null;
        if (g.items) nextItem = g.items.find(function(it) { return !it.completed; });
        return {
          goalId: g.id,
          goalTitle: g.title,
          task: nextItem ? nextItem.text : 'Work on "' + g.title + '"',
          dismissed: false
        };
      });
    }

    saveCachedGoalTasks(tasks);
    renderGoalTasksSection(tasks);
  }).catch(function(err) {
    console.warn('[Rhythm AI Tasks] API error:', err);
    // Fallback
    var fallbackTasks = goalsForAI.map(function(g) {
      return { goalId: g.id, goalTitle: g.title, task: 'Make progress on "' + g.title + '"', dismissed: false };
    });
    saveCachedGoalTasks(fallbackTasks);
    renderGoalTasksSection(fallbackTasks);
  });
}

function showGoalTasksLoading() {
  var lifeMode = isLifeMode();
  if (lifeMode) {
    var card = document.getElementById('rhythmLifeGoalTasksCard');
    var list = document.getElementById('rhythmLifeGoalTasksList');
    if (card) card.style.display = '';
    if (list) list.innerHTML = '<div class="rhythm-ai-goal-loading"><svg class="ai-sparkle-icon" viewBox="0 0 16 16" width="16" height="16" fill="var(--life-accent, #60a5fa)"><path d="M8 0l1.5 4.5L14 6l-4.5 1.5L8 12l-1.5-4.5L2 6l4.5-1.5L8 0z"/></svg> Generating AI tasks...</div>';
  } else {
    var container = document.getElementById('rhythmBrandGoalTasks');
    if (container) {
      container.style.display = '';
      container.innerHTML = '<div class="rhythm-ai-goals-header"><div class="rhythm-ai-goals-title"><svg class="ai-sparkle-icon" viewBox="0 0 16 16" width="16" height="16" fill="var(--accent)"><path d="M8 0l1.5 4.5L14 6l-4.5 1.5L8 12l-1.5-4.5L2 6l4.5-1.5L8 0z"/><path d="M13 9l.75 2.25L16 12l-2.25.75L13 15l-.75-2.25L10 12l2.25-.75L13 9z" opacity="0.6"/></svg><span>AI Goal Tasks</span></div></div><div class="rhythm-ai-goal-loading">Generating AI tasks...</div>';
    }
  }
}

function hideGoalTasksSection() {
  var brandEl = document.getElementById('rhythmBrandGoalTasks');
  var lifeEl = document.getElementById('rhythmLifeGoalTasksCard');
  if (brandEl) brandEl.style.display = 'none';
  if (lifeEl) lifeEl.style.display = 'none';
}

function renderGoalTasksSection(tasks) {
  var visibleTasks = tasks.filter(function(t) { return !t.dismissed; });
  if (visibleTasks.length === 0) {
    hideGoalTasksSection();
    return;
  }

  var lifeMode = isLifeMode();
  var tasksHtml = visibleTasks.map(function(t) {
    return buildGoalTaskHTML(t, lifeMode);
  }).join('');

  if (lifeMode) {
    var card = document.getElementById('rhythmLifeGoalTasksCard');
    var list = document.getElementById('rhythmLifeGoalTasksList');
    if (card) card.style.display = '';
    if (list) list.innerHTML = tasksHtml;
  } else {
    var container = document.getElementById('rhythmBrandGoalTasks');
    if (container) {
      container.style.display = '';
      container.innerHTML = '<div class="rhythm-ai-goals-header">' +
        '<div class="rhythm-ai-goals-title">' +
          '<svg class="ai-sparkle-icon" viewBox="0 0 16 16" width="16" height="16" fill="var(--accent)"><path d="M8 0l1.5 4.5L14 6l-4.5 1.5L8 12l-1.5-4.5L2 6l4.5-1.5L8 0z"/><path d="M13 9l.75 2.25L16 12l-2.25.75L13 15l-.75-2.25L10 12l2.25-.75L13 9z" opacity="0.6"/></svg>' +
          '<span>AI Goal Tasks</span>' +
        '</div>' +
        '<button class="ai-task-btn" onclick="refreshRhythmGoalTasks()" title="Refresh AI tasks" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:var(--radius-sm);">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
        '</button>' +
      '</div>' + tasksHtml;
    }
  }
}

function buildGoalTaskHTML(task, lifeMode) {
  var sparkleColor = lifeMode ? 'var(--life-accent, #60a5fa)' : 'var(--accent)';
  return '<div class="rhythm-ai-goal-task">' +
    '<div class="ai-task-sparkle"><svg viewBox="0 0 16 16" width="14" height="14" fill="' + sparkleColor + '"><path d="M8 0l1.5 4.5L14 6l-4.5 1.5L8 12l-1.5-4.5L2 6l4.5-1.5L8 0z"/></svg></div>' +
    '<div class="ai-task-content">' +
      '<div class="ai-task-goal-ref">' + escapeHtml(task.goalTitle) + '</div>' +
      '<div class="ai-task-text">' + escapeHtml(task.task) + '</div>' +
    '</div>' +
    '<div class="ai-task-actions">' +
      '<button class="ai-task-btn" onclick="completeGoalTask(\'' + task.goalId + '\')" title="Mark done"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></button>' +
      '<button class="ai-task-btn" onclick="addGoalTaskToRhythm(\'' + task.goalId + '\')" title="Add to calendar"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></button>' +
      '<button class="ai-task-btn" onclick="dismissGoalTask(\'' + task.goalId + '\')" title="Dismiss"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
    '</div>' +
  '</div>';
}

function dismissGoalTask(goalId) {
  var cached = loadCachedGoalTasks();
  if (!cached) return;
  cached.forEach(function(t) { if (t.goalId === goalId) t.dismissed = true; });
  saveCachedGoalTasks(cached);
  renderGoalTasksSection(cached);
}

function completeGoalTask(goalId) {
  var cached = loadCachedGoalTasks();
  if (!cached) return;
  var task = cached.find(function(t) { return t.goalId === goalId; });
  if (task) {
    task.dismissed = true;
    task.completed = true;
    showToast('Task completed!', 'success');
  }
  saveCachedGoalTasks(cached);
  renderGoalTasksSection(cached);
}

function addGoalTaskToRhythm(goalId) {
  var cached = loadCachedGoalTasks();
  if (!cached) return;
  var task = cached.find(function(t) { return t.goalId === goalId; });
  if (!task) return;

  var today = new Date().toISOString().slice(0, 10);
  if (isLifeMode()) {
    // Add to LifeAI calendar as a task
    if (typeof addLifeCalendarItem === 'function') {
      addLifeCalendarItem({ date: today, text: task.task, type: 'task', goalRef: task.goalId });
      showToast('Added to today\'s calendar', 'success');
    }
  } else {
    // Add to BrandAI calendar as a todo
    var calData = JSON.parse(localStorage.getItem('roweos_calendar') || '[]');
    calData.push({
      id: Date.now(),
      date: today,
      title: task.task,
      type: 'todo',
      goalRef: task.goalId,
      completed: false
    });
    localStorage.setItem('roweos_calendar', JSON.stringify(calData));
    if (typeof renderCalendar === 'function') renderCalendar();
    showToast('Added to today\'s calendar', 'success');
  }

  // Mark as dismissed in cache
  task.dismissed = true;
  saveCachedGoalTasks(cached);
  renderGoalTasksSection(cached);
}

function refreshRhythmGoalTasks() {
  generateGoalTasks(true);
}

/**
 * Toggle Life Rhythm add dropdown
 */
function toggleLifeRhythmAddDropdown() {
  var menu = document.getElementById('lifeRhythmAddMenu');
  if (menu) {
    menu.classList.toggle('open');
  }
}

/**
 * v13.9: Open Life Rhythm add form — proper slide-up panel instead of prompt() dialogs
 */
function openLifeRhythmAddForm(type) {
  toggleLifeRhythmAddDropdown();

  // v26.4: Allow inline goal creation instead of redirecting to Pulse

  // Build slide-up form panel
  var old = document.getElementById('rhythmAddFormPanel');
  if (old) old.remove();

  var typeLabels = { routine: 'Routine Item', task: 'Task', habit: 'Habit', goal: 'Goal' };
  var label = typeLabels[type] || 'Item';

  var html = '<div id="rhythmAddFormPanel" style="position:fixed;bottom:0;left:0;right:0;z-index:300;background:var(--bg-primary);border-top:1px solid var(--border-primary);border-radius:16px 16px 0 0;padding:20px 24px 28px;box-shadow:0 -4px 20px rgba(0,0,0,0.3);animation:slideUp 0.3s ease;overscroll-behavior:contain;overflow-y:auto;-webkit-overflow-scrolling:touch;max-height:80vh;">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
  html += '<div style="font-size:16px;font-weight:600;color:var(--text-primary);">Add ' + label + '</div>';
  html += '<button onclick="document.getElementById(\'rhythmAddFormPanel\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:4px 8px;">&times;</button>';
  html += '</div>';

  // Name field (all types)
  html += '<div style="margin-bottom:12px;"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Name</label>';
  html += '<input type="text" id="rhythmAddName" placeholder="' + label + ' name..." style="width:100%;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:10px;color:var(--text-primary);font-size:14px;box-sizing:border-box;"></div>';

  if (type === 'routine') {
    html += '<div style="display:flex;gap:12px;margin-bottom:12px;">';
    html += '<div style="flex:1;"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Time</label>';
    html += '<input type="time" id="rhythmAddTime" value="09:00" style="width:100%;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:10px;color:var(--text-primary);font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="flex:1;"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Duration (min)</label>';
    html += '<input type="number" id="rhythmAddDuration" value="30" min="1" max="480" style="width:100%;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:10px;color:var(--text-primary);font-size:14px;box-sizing:border-box;"></div>';
    html += '</div>';
  }

  if (type === 'task') {
    html += '<div style="margin-bottom:12px;"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Date</label>';
    html += '<input type="date" id="rhythmAddDate" value="' + new Date().toISOString().slice(0, 10) + '" style="width:100%;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:10px;color:var(--text-primary);font-size:14px;box-sizing:border-box;"></div>';
  }

  html += '<input type="hidden" id="rhythmAddType" value="' + type + '">';
  html += '<button onclick="saveLifeRhythmAddForm()" style="width:100%;padding:12px;background:var(--life-accent,var(--accent));color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Add ' + label + '</button>';
  html += '</div>';

  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(function() {
    var nameEl = document.getElementById('rhythmAddName');
    if (nameEl) nameEl.focus();
  }, 100);
}

/**
 * v13.9: Save from new Rhythm add form UI
 */
function saveLifeRhythmAddForm() {
  var nameEl = document.getElementById('rhythmAddName');
  var typeEl = document.getElementById('rhythmAddType');
  if (!nameEl || !nameEl.value.trim()) { showToast('Please enter a name', 'warning'); return; }

  var type = typeEl ? typeEl.value : 'routine';
  var name = nameEl.value.trim();

  if (type === 'routine') {
    var timeEl = document.getElementById('rhythmAddTime');
    var durEl = document.getElementById('rhythmAddDuration');
    lifeRoutines.push({
      id: Date.now(),
      name: name,
      time: timeEl ? timeEl.value : '09:00',
      duration: durEl ? parseInt(durEl.value) || 30 : 30,
      status: 'pending'
    });
    lifeRoutines.sort(function(a, b) { return a.time.localeCompare(b.time); });
    saveLifeRoutines();
    renderLifeRoutineList();
    showToast('Routine added!', 'success');
  } else if (type === 'task') {
    var dateEl = document.getElementById('rhythmAddDate');
    if (typeof todos !== 'undefined') {
      todos.push({
        id: Date.now(),
        text: name,
        date: dateEl ? dateEl.value : new Date().toISOString().slice(0, 10),
        completed: false
      });
      if (typeof saveTodos === 'function') saveTodos();
      // v26.4: saveTodos() handles its own Firestore path -- no duplicate sync needed
      if (typeof renderLifeCalendar === 'function') renderLifeCalendar();
      showToast('Task added!', 'success');
    }
  } else if (type === 'habit') {
    lifeHabits.push({
      id: Date.now(),
      name: name,
      streak: 0,
      completedDates: []
    });
    saveLifeHabits();
    renderLifeHabitsList();
    showToast('Habit added!', 'success');
  } else if (type === 'goal') {
    lifeGoals.push({
      id: Date.now(),
      name: name,
      progress: 0,
      dueDate: null
    });
    saveLifeGoals();
    if (typeof renderLifeGoalsList === 'function') renderLifeGoalsList();
    showToast('Goal added!', 'success');
  }

  var panel = document.getElementById('rhythmAddFormPanel');
  if (panel) panel.remove();
}

/**
 * Render routine list with drag & drop
 */
function renderLifeRoutineList() {
  var container = document.getElementById('lifeRoutineList');
  if (!container) return;

  if (lifeRoutines.length === 0) {
    container.innerHTML = '<div class="life-empty-state">No routine items. Click + to add.</div>';
    return;
  }

  // v15.7: Check for time conflicts
  var conflicts = detectRoutineConflicts();
  var html = '';
  if (conflicts.length > 0) {
    html += '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#ef4444;">';
    html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    conflicts.forEach(function(c) {
      html += escapeHtml(c.item1) + ' overlaps with ' + escapeHtml(c.item2) + ' by ' + c.overlap + 'min. ';
    });
    html += '</div>';
  }

  // v15.7: Routine completion progress bar
  var completedCount = lifeRoutines.filter(function(r) { return r.status === 'completed'; }).length;
  var totalCount = lifeRoutines.length;
  var pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
  html += '<div style="flex:1;height:4px;background:var(--bg-tertiary);border-radius:2px;overflow:hidden;">';
  html += '<div style="height:100%;width:' + pct + '%;background:var(--life-accent,#22c55e);border-radius:2px;transition:width 0.3s ease;"></div>';
  html += '</div>';
  html += '<span style="font-size:11px;color:var(--text-tertiary);min-width:28px;">' + pct + '%</span>';
  html += '</div>';

  lifeRoutines.forEach(function(item, idx) {
    var statusClass = item.status === 'completed' ? 'completed' : (item.status === 'skipped' ? 'skipped' : '');
    html += '<div class="life-routine-item" draggable="true" data-id="' + item.id + '" data-idx="' + idx + '" ondragstart="lifeRoutineDragStart(event)" ondragend="lifeRoutineDragEnd(event)" ondragover="lifeRoutineDragOver(event)" ondrop="lifeRoutineDrop(event)">';
    html += '<div class="life-routine-drag-handle"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></div>';
    html += '<input type="time" class="life-routine-time-input" value="' + item.time + '" onchange="updateLifeRoutineTime(' + item.id + ', this.value)" onclick="event.stopPropagation()" title="Click to change time"/>';
    html += '<div class="life-routine-content" style="flex:1;">';
    html += '<input type="text" class="life-routine-name-input" value="' + escapeHtml(item.name) + '" onchange="updateLifeRoutineName(' + item.id + ', this.value)" onclick="event.stopPropagation()" placeholder="Routine name"/>';
    html += '<input type="number" class="life-routine-duration-input" value="' + item.duration + '" onchange="updateLifeRoutineDuration(' + item.id + ', this.value)" onclick="event.stopPropagation()" min="1" max="480" title="Duration in minutes"/> <span style="color:var(--text-muted);font-size:11px;">min</span>';
    html += '</div>';
    html += '<div class="life-routine-status ' + statusClass + '" onclick="toggleLifeRoutineStatus(' + item.id + ')">';
    if (statusClass === 'completed') {
      html += icon('check', {size: 12, strokeWidth: 3});
    }
    html += '</div>';
    html += '<button class="life-routine-action-btn delete-btn" onclick="deleteLifeRoutineItem(' + item.id + ')" title="Delete"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

// Drag & drop handlers for routine
function lifeRoutineDragStart(e) {
  lifeDragItem = e.target.closest('.life-routine-item');
  if (lifeDragItem) {
    lifeDragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
}

function lifeRoutineDragEnd(e) {
  if (lifeDragItem) {
    lifeDragItem.classList.remove('dragging');
    lifeDragItem = null;
  }
  document.querySelectorAll('.life-routine-item').forEach(function(el) {
    el.classList.remove('drag-over');
  });
}

function lifeRoutineDragOver(e) {
  e.preventDefault();
  var target = e.target.closest('.life-routine-item');
  if (target && target !== lifeDragItem) {
    document.querySelectorAll('.life-routine-item').forEach(function(el) {
      el.classList.remove('drag-over');
    });
    target.classList.add('drag-over');
  }
}

function lifeRoutineDrop(e) {
  e.preventDefault();
  var target = e.target.closest('.life-routine-item');
  if (target && lifeDragItem && target !== lifeDragItem) {
    var fromIdx = parseInt(lifeDragItem.dataset.idx);
    var toIdx = parseInt(target.dataset.idx);
    
    // Reorder array
    var item = lifeRoutines.splice(fromIdx, 1)[0];
    lifeRoutines.splice(toIdx, 0, item);
    
    saveLifeRoutines();
    renderLifeRoutineList();
    showToast('Routine reordered', 'success');
  }
}

// v13.2: Habit drag-drop handlers (same pattern as routine)
var lifeHabitDragItem = null;

function lifeHabitDragStart(e) {
  lifeHabitDragItem = e.target.closest('.life-habit-item');
  if (lifeHabitDragItem) {
    lifeHabitDragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
}

function lifeHabitDragEnd(e) {
  if (lifeHabitDragItem) {
    lifeHabitDragItem.classList.remove('dragging');
    lifeHabitDragItem = null;
  }
  document.querySelectorAll('.life-habit-item').forEach(function(el) {
    el.classList.remove('drag-over');
  });
}

function lifeHabitDragOver(e) {
  e.preventDefault();
  var target = e.target.closest('.life-habit-item');
  if (target && target !== lifeHabitDragItem) {
    document.querySelectorAll('.life-habit-item').forEach(function(el) {
      el.classList.remove('drag-over');
    });
    target.classList.add('drag-over');
  }
}

function lifeHabitDrop(e) {
  e.preventDefault();
  var target = e.target.closest('.life-habit-item');
  if (target && lifeHabitDragItem && target !== lifeHabitDragItem) {
    var fromIdx = parseInt(lifeHabitDragItem.dataset.idx);
    var toIdx = parseInt(target.dataset.idx);

    var item = lifeHabits.splice(fromIdx, 1)[0];
    lifeHabits.splice(toIdx, 0, item);

    saveLifeHabits();
    renderLifeHabitsList();
    showToast('Habits reordered', 'success');
  }
}

/**
 * Toggle routine item status
 */
function toggleLifeRoutineStatus(routineId) {
  var routine = lifeRoutines.find(function(r) { return r.id === routineId; });
  if (!routine) return;
  
  if (routine.status === 'pending') {
    routine.status = 'completed';
    showToast('Completed!', 'success');
  } else if (routine.status === 'completed') {
    routine.status = 'skipped';
    showToast('Skipped', 'warning');
  } else {
    routine.status = 'pending';
    showToast('Reset', 'info');
  }
  
  saveLifeRoutines();
  renderLifeRoutineList();
}

/**
 * v13.9: Add routine item — uses form panel instead of prompt()
 */
function addLifeRoutineItem() {
  openLifeRhythmAddForm('routine');
}

/**
 * v10.5.25: Inline update functions for routine items
 */
function updateLifeRoutineName(id, value) {
  var item = lifeRoutines.find(function(r) { return r.id === id; });
  if (item && value.trim()) {
    item.name = value.trim();
    saveLifeRoutines();
  }
}

function updateLifeRoutineTime(id, value) {
  var item = lifeRoutines.find(function(r) { return r.id === id; });
  if (item && value) {
    item.time = value;
    lifeRoutines.sort(function(a, b) { return a.time.localeCompare(b.time); });
    saveLifeRoutines();
    renderLifeRoutineList(); // Re-render to show new order
  }
}

function updateLifeRoutineDuration(id, value) {
  var item = lifeRoutines.find(function(r) { return r.id === id; });
  if (item) {
    item.duration = parseInt(value) || 15;
    saveLifeRoutines();
  }
}

/**
 * Delete routine item
 */
function deleteLifeRoutineItem(id) {
  if (!confirm('Delete this routine item?')) return;
  lifeRoutines = lifeRoutines.filter(function(r) { return r.id !== id; });
  saveLifeRoutines();
  renderLifeRoutineList();
  showToast('Routine deleted', 'info');
}

// v12.0.0: formatTime12h moved to utils object (alias at top of JS section)

/**
 * Render habits list
 */
// v15.7: Calculate accurate streak from completedDates array
function calculateHabitStreak(completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  var sorted = completedDates.slice().sort().reverse();
  var today = new Date().toISOString().slice(0, 10);
  var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  // Streak must include today or yesterday to be current
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  var streak = 1;
  for (var i = 1; i < sorted.length; i++) {
    var prev = new Date(sorted[i - 1]);
    var curr = new Date(sorted[i]);
    var diff = (prev - curr) / 86400000;
    if (diff === 1) { streak++; } else { break; }
  }
  return streak;
}

// v15.7: Build 30-day mini heatmap HTML for a habit
function buildHabitMiniHeatmap(completedDates) {
  var dates = completedDates || [];
  var html = '<div style="display:flex;gap:1px;align-items:center;" title="Last 30 days">';
  var today = new Date();
  for (var i = 29; i >= 0; i--) {
    var d = new Date(today.getTime() - i * 86400000);
    var dateStr = d.toISOString().slice(0, 10);
    var done = dates.indexOf(dateStr) !== -1;
    var bg = done ? 'var(--life-accent, #22c55e)' : 'var(--bg-tertiary, rgba(255,255,255,0.05))';
    html += '<div style="width:6px;height:6px;border-radius:1px;background:' + bg + ';"></div>';
  }
  html += '</div>';
  return html;
}

function renderLifeHabitsList() {
  var container = document.getElementById('lifeHabitsList');
  if (!container) return;

  var today = new Date().toISOString().slice(0, 10);

  if (lifeHabits.length === 0) {
    container.innerHTML = '<div class="life-empty-state">No habits yet.</div>';
    return;
  }

  var html = '';
  lifeHabits.forEach(function(habit, idx) {
    var isChecked = habit.completedDates && habit.completedDates.indexOf(today) !== -1;
    // v15.7: Calculate accurate streak from completedDates
    var streak = calculateHabitStreak(habit.completedDates);
    habit.streak = streak; // Keep in sync

    html += '<div class="life-habit-item" draggable="true" data-id="' + habit.id + '" data-idx="' + idx + '" ondragstart="lifeHabitDragStart(event)" ondragend="lifeHabitDragEnd(event)" ondragover="lifeHabitDragOver(event)" ondrop="lifeHabitDrop(event)">';
    html += '<div class="life-routine-drag-handle"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></div>';
    html += '<div class="life-habit-check ' + (isChecked ? 'checked' : '') + '" onclick="toggleLifeHabit(' + habit.id + ')">';
    if (isChecked) {
      html += icon('check', {size: 12, strokeWidth: 3});
    }
    html += '</div>';
    html += '<div class="life-habit-info" style="flex:1;cursor:pointer;" onclick="openHabitDetail(' + habit.id + ')">';
    html += '<input type="text" class="life-habit-name-input" value="' + escapeHtml(habit.name) + '" onchange="updateLifeHabitName(' + habit.id + ', this.value)" onclick="event.stopPropagation()" placeholder="Habit name"/>';
    // v15.7: Enhanced streak with fire icon + mini heatmap
    var streakDisplay = streak + ' day streak';
    if (streak >= 7) {
      streakDisplay = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align: -1px;"><path d="M12 2L2 12l3 1L2 22l14-9-3-1 6-9z"/></svg> ' + streakDisplay;
    }
    if (streak >= 30) {
      streakDisplay += ' <span style="color:#f59e0b;font-size:10px;">LEGENDARY</span>';
    }
    html += '<div class="life-habit-streak">' + streakDisplay + '</div>';
    html += buildHabitMiniHeatmap(habit.completedDates);
    html += '</div>';
    html += '<button class="life-routine-action-btn delete-btn" onclick="deleteLifeHabit(' + habit.id + ')" title="Delete"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    html += '</div>';
  });

  container.innerHTML = html;
}

/**
 * v10.5.25: Update habit name inline
 */
function updateLifeHabitName(id, value) {
  var habit = lifeHabits.find(function(h) { return h.id === id; });
  if (habit && value.trim()) {
    habit.name = value.trim();
    saveLifeHabits();
  }
}

/**
 * Delete a habit
 */
function deleteLifeHabit(id) {
  if (!confirm('Delete this habit?')) return;
  lifeHabits = lifeHabits.filter(function(h) { return h.id !== id; });
  saveLifeHabits();
  renderLifeHabitsList();
  showToast('Habit deleted', 'info');
}

/**
 * Toggle habit for today
 */
function toggleLifeHabit(habitId) {
  var habit = lifeHabits.find(function(h) { return h.id === habitId; });
  if (!habit) return;
  
  var today = new Date().toISOString().slice(0, 10);
  if (!habit.completedDates) habit.completedDates = [];
  
  var idx = habit.completedDates.indexOf(today);
  if (idx === -1) {
    habit.completedDates.push(today);
    showToast('Habit completed!', 'success');
  } else {
    habit.completedDates.splice(idx, 1);
    showToast('Habit unmarked', 'info');
  }
  // v15.7: Recalculate streak accurately from completedDates
  habit.streak = calculateHabitStreak(habit.completedDates);
  
  saveLifeHabits();
  renderLifeHabitsList();
}

/**
 * v13.9: Add habit — uses form panel instead of prompt()
 */
function addLifeHabit() {
  openLifeRhythmAddForm('habit');
}

/**
 * v15.7: Open habit detail modal with heatmap and stats
 */
function openHabitDetail(habitId) {
  var habit = lifeHabits.find(function(h) { return h.id === habitId; });
  if (!habit) return;

  var dates = habit.completedDates || [];
  var streak = calculateHabitStreak(dates);
  var totalDays = dates.length;

  // Calculate longest streak
  var sorted = dates.slice().sort();
  var longestStreak = 0;
  var currentRun = 1;
  for (var i = 1; i < sorted.length; i++) {
    var prev = new Date(sorted[i - 1]);
    var curr = new Date(sorted[i]);
    if ((curr - prev) / 86400000 === 1) {
      currentRun++;
    } else {
      if (currentRun > longestStreak) longestStreak = currentRun;
      currentRun = 1;
    }
  }
  if (currentRun > longestStreak) longestStreak = currentRun;

  // 30-day completion rate
  var today = new Date();
  var last30 = 0;
  for (var d = 0; d < 30; d++) {
    var dateStr = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
    if (dates.indexOf(dateStr) !== -1) last30++;
  }
  var rate30 = Math.round((last30 / 30) * 100);

  // Build 30-day heatmap (5 rows x 6 cols)
  var heatmapHtml = '<div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px;margin:12px 0;">';
  for (var i = 29; i >= 0; i--) {
    var dt = new Date(today.getTime() - i * 86400000);
    var ds = dt.toISOString().slice(0, 10);
    var done = dates.indexOf(ds) !== -1;
    var dayLabel = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var bg = done ? 'var(--life-accent, #22c55e)' : 'var(--bg-tertiary, rgba(255,255,255,0.08))';
    heatmapHtml += '<div style="aspect-ratio:1;border-radius:3px;background:' + bg + ';cursor:default;" title="' + dayLabel + (done ? ' - Done' : '') + '"></div>';
  }
  heatmapHtml += '</div>';

  // Modal
  var modal = document.getElementById('habitDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'habitDetailModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:none;justify-content:center;align-items:center;z-index:10000;backdrop-filter:blur(8px);';
    document.body.appendChild(modal);
  }

  modal.innerHTML = '<div style="background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:16px;padding:24px;max-width:380px;width:90%;max-height:80vh;overflow-y:auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
      '<h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text-primary);">' + escapeHtml(habit.name) + '</h3>' +
      '<button onclick="document.getElementById(\'habitDetailModal\').style.display=\'none\'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;line-height:1;">&times;</button>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">' +
      '<div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:10px;">' +
        '<div style="font-size:24px;font-weight:700;color:var(--life-accent,#22c55e);">' + streak + '</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);">Current Streak</div>' +
      '</div>' +
      '<div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:10px;">' +
        '<div style="font-size:24px;font-weight:700;color:var(--text-primary);">' + longestStreak + '</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);">Best Streak</div>' +
      '</div>' +
      '<div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:10px;">' +
        '<div style="font-size:24px;font-weight:700;color:var(--text-primary);">' + totalDays + '</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary);">Total Days</div>' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:12px;">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
        '<span style="font-size:12px;color:var(--text-secondary);">30-Day Rate</span>' +
        '<span style="font-size:12px;font-weight:600;color:var(--life-accent,#22c55e);">' + rate30 + '%</span>' +
      '</div>' +
      '<div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">' +
        '<div style="height:100%;width:' + rate30 + '%;background:var(--life-accent,#22c55e);border-radius:3px;transition:width 0.3s ease;"></div>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Last 30 Days</div>' +
    heatmapHtml +
  '</div>';

  modal.style.display = 'flex';
  modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
}

/**
 * v15.7: Detect time conflicts in routine
 */
function detectRoutineConflicts() {
  if (!lifeRoutines || lifeRoutines.length < 2) return [];
  var conflicts = [];
  var sorted = lifeRoutines.slice().sort(function(a, b) {
    return (a.time || '00:00').localeCompare(b.time || '00:00');
  });
  for (var i = 0; i < sorted.length - 1; i++) {
    var current = sorted[i];
    var next = sorted[i + 1];
    if (!current.time || !next.time || !current.duration) continue;
    var parts = current.time.split(':');
    var startMins = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    var endMins = startMins + (parseInt(current.duration) || 30);
    var nextParts = next.time.split(':');
    var nextStartMins = parseInt(nextParts[0]) * 60 + parseInt(nextParts[1]);
    if (endMins > nextStartMins) {
      conflicts.push({
        item1: current.name,
        item2: next.name,
        overlap: endMins - nextStartMins
      });
    }
  }
  return conflicts;
}

/**
 * Render goals panel
 */
function renderLifeGoalsPanel() {
  var container = document.getElementById('lifeGoalsListPanel');
  if (!container) return;

  // v13.4: Pull from Pulse goals, include all sources relevant to current mode
  var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  var goals = (pulseGoals || []).filter(function(g) {
    if (g.completed || g.archived) return false;
    if (isLifeMode) return !g.source || g.source === 'lifeai';
    return !g.source || g.source === 'brandai' || g.source === 'studio';
  });

  if (goals.length === 0) {
    container.innerHTML = '<div class="life-empty-state">No active goals. Create one in Pulse.</div>';
    return;
  }

  var html = goals.map(function(goal) {
    var allItems = (goal.items || []);
    if (goal.sections) {
      goal.sections.forEach(function(s) { allItems = allItems.concat(s.items || []); });
    }
    var total = allItems.length;
    var done = allItems.filter(function(i) { return i.completed; }).length;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return '<div class="life-goal-item">' +
      '<div class="life-goal-top">' +
        '<div class="life-goal-name" style="flex:1;font-weight:500;color:var(--text-primary);font-size:var(--text-sm);">' + escapeHtml(goal.title) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<span style="font-size:var(--text-sm);color:var(--text-muted);">' + pct + '%</span>' +
          '<button class="life-goal-pulse-link" onclick="showView(\'pulse\')" title="View in Pulse" style="background:none;border:none;color:var(--life-accent,var(--accent));cursor:pointer;padding:2px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="life-goal-bar"><div class="life-goal-fill" style="width:' + pct + '%;"></div></div>' +
    '</div>';
  }).join('');
  container.innerHTML = html;
}

/**
 * Add goal
 */
function addLifeGoal() {
  // v13.2: Redirect to Pulse for goal creation
  showView('pulse');
  setTimeout(function() {
    if (typeof openNewGoalModal === 'function') openNewGoalModal();
  }, 300);
}

/**
 * v10.5.25: Update goal name inline
 */
function updateLifeGoalName(id, value) {
  var goal = lifeGoals.find(function(g) { return g.id === id; });
  if (goal && value.trim()) {
    goal.name = value.trim();
    saveLifeGoals();
  }
}

/**
 * v10.5.25: Update goal progress inline
 */
function updateLifeGoalProgress(id, value) {
  var goal = lifeGoals.find(function(g) { return g.id === id; });
  if (goal) {
    goal.progress = Math.max(0, Math.min(100, parseInt(value) || 0));
    saveLifeGoals();
    // Update the progress bar visually
    renderLifeGoalsPanel();
  }
}

/**
 * v10.5.25: Delete goal
 */
function deleteLifeGoal(id) {
  if (!confirm('Delete this goal?')) return;
  lifeGoals = lifeGoals.filter(function(g) { return g.id !== id; });
  saveLifeGoals();
  renderLifeGoalsPanel();
  showToast('Goal deleted', 'info');
}

/**
 * Render Life Calendar (fed from Focus todos)
 */
function renderLifeCalendar() {
  var c = document.getElementById('lifeCalendar');
  if (!c) return;
  
  var today = new Date();
  var todayStr = today.toISOString().slice(0, 10);
  
  // Month view
  var monthDate = new Date(today.getFullYear(), today.getMonth() + lifeWeekOffset, 1);
  
  var firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  var lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  var startDay = new Date(firstDay);
  startDay.setDate(startDay.getDate() - firstDay.getDay());
  
  var html = '<div class="calendar-month">';
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  days.forEach(function(d) {
    html += '<div style="text-align:center;font-weight:600;padding:8px 4px;color:var(--text-muted);font-size:11px;text-transform:uppercase;">' + d + '</div>';
  });
  
  var current = new Date(startDay);
  for (var i = 0; i < 42; i++) {
    var dateStr = current.toISOString().slice(0, 10);
    var isOther = current.getMonth() !== monthDate.getMonth();
    var isToday = dateStr === todayStr;
    
    html += '<div class="calendar-month-day' + (isOther ? ' other-month' : '') + (isToday ? ' is-today' : '') + '" data-date="' + dateStr + '" onclick="openLifeDayView(\'' + dateStr + '\')">';
    html += '<div class="calendar-month-day-number">' + current.getDate() + '</div>';
    
    // Get tasks from Focus (todos array) for this date
    if (typeof todos !== 'undefined') {
      todos.filter(function(t) { return t.date === dateStr; }).slice(0, 2).forEach(function(task) {
        var taskClass = task.completed ? 'completed' : '';
        html += '<div class="calendar-item task-item ' + taskClass + '">' + escapeHtml((task.text || '').substring(0, 12)) + '</div>';
      });
    }
    
    html += '</div>';
    current.setDate(current.getDate() + 1);
  }
  
  html += '</div>';
  c.innerHTML = html;
}

/**
 * Update week display
 */
function updateLifeWeekDisplay() {
  var display = document.getElementById('lifeWeekDisplay');
  if (!display) return;
  
  var today = new Date();
  var monthDate = new Date(today.getFullYear(), today.getMonth() + lifeWeekOffset, 1);
  display.textContent = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Toggle calendar view
 */
function toggleLifeCalendarView() {
  lifeCalendarView = lifeCalendarView === 'month' ? 'week' : 'month';
  var toggle = document.getElementById('lifeCalViewToggle');
  if (toggle) toggle.textContent = lifeCalendarView === 'month' ? 'Week View' : 'Month View';
  renderLifeCalendar();
}

/**
 * Change week/month
 */
function changeLifeWeek(direction) {
  lifeWeekOffset += direction;
  renderLifeCalendar();
  updateLifeWeekDisplay();
}

// v15.43: Universal close for mobile day panel scrim
function closeMobileDayPanel() {
  // Close whichever day panel is open
  closeLifeRhythmDayPanel();
  closeRhythmDayPanel();
}

/**
 * Open day detail view
 */
function openLifeDayView(dateStr) {
  var panel = document.getElementById('lifeRhythmDayPanel');
  if (!panel) return;

  var date = new Date(dateStr + 'T12:00:00');
  var titleEl = document.getElementById('lifeRhythmDayTitle');
  var subtitleEl = document.getElementById('lifeRhythmDaySubtitle');

  if (titleEl) titleEl.textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  if (subtitleEl) subtitleEl.textContent = date.toLocaleDateString('en-US', { weekday: 'long' });

  // Populate day content
  renderLifeDayTasks(dateStr);
  renderLifeDayRoutine();
  renderLifeDayHabits(dateStr);

  // v15.43: On mobile, use class toggle + scrim instead of inline display
  // v15.47: Also apply fixed positioning via JS to ensure z-index works outside #rhythmView
  if (window.innerWidth <= 768) {
    panel.classList.add('mobile-day-open');
    panel.style.position = 'fixed';
    panel.style.zIndex = '1100';
    panel.style.display = 'block';
    var scrim = document.getElementById('mobileDayScrim');
    if (scrim) scrim.classList.add('show');
    document.body.style.overflow = 'hidden';
  } else {
    panel.style.display = 'block';
  }
  panel.dataset.date = dateStr;
  
  // v10.5.25: Mark this day as selected in calendar
  var allDays = document.querySelectorAll('#lifeCalendar .calendar-month-day');
  allDays.forEach(function(day) {
    day.classList.remove('selected');
    if (day.dataset.date === dateStr) {
      day.classList.add('selected');
    }
  });
}

/**
 * Close day panel
 */
function closeLifeRhythmDayPanel() {
  var panel = document.getElementById('lifeRhythmDayPanel');
  if (panel) {
    panel.style.display = 'none';
    panel.classList.remove('mobile-day-open');
    // v15.47: Clean up inline styles from openLifeDayView
    panel.style.position = '';
    panel.style.zIndex = '';
  }
  // v15.43: Clean up scrim
  var scrim = document.getElementById('mobileDayScrim');
  if (scrim) scrim.classList.remove('show');
  document.body.style.overflow = '';
}

/**
 * Render day tasks
 */
function renderLifeDayTasks(dateStr) {
  var container = document.getElementById('lifeRhythmDayTasks');
  if (!container) return;
  
  var dayTasks = typeof todos !== 'undefined' ? todos.filter(function(t) { return t.date === dateStr; }) : [];
  
  if (dayTasks.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: var(--text-sm); padding: 10px;">No tasks for this day</div>';
    return;
  }
  
  var html = '';
  dayTasks.forEach(function(task) {
    html += '<div class="rhythm-day-item" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-color);">';
    html += '<span style="color:' + (task.completed ? '#4ade80' : '#6ab894') + ';">' + (task.completed ? '☑' : '☐') + '</span>';
    html += '<span style="' + (task.completed ? 'text-decoration:line-through;opacity:0.5;' : '') + '">' + escapeHtml(task.text || '') + '</span>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

/**
 * Render day routine
 */
function renderLifeDayRoutine() {
  var container = document.getElementById('lifeRhythmDayRoutine');
  if (!container) return;
  
  if (lifeRoutines.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: var(--text-sm); padding: 10px;">No routine items</div>';
    return;
  }
  
  var html = '';
  lifeRoutines.forEach(function(item) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-color);">';
    html += '<span style="color:var(--life-accent);font-weight:600;font-size:11px;min-width:50px;">' + formatTime12h(item.time) + '</span>';
    html += '<span>' + escapeHtml(item.name) + '</span>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

/**
 * Render day habits
 */
function renderLifeDayHabits(dateStr) {
  var container = document.getElementById('lifeRhythmDayHabits');
  if (!container) return;
  
  if (lifeHabits.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: var(--text-sm); padding: 10px;">No habits</div>';
    return;
  }
  
  var html = '';
  lifeHabits.forEach(function(habit) {
    var isCompleted = habit.completedDates && habit.completedDates.indexOf(dateStr) !== -1;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-color);">';
    html += '<span style="color:' + (isCompleted ? 'var(--life-accent)' : 'var(--text-muted)') + ';">' + (isCompleted ? '✓' : '○') + '</span>';
    html += '<span>' + escapeHtml(habit.name) + '</span>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

/**
 * Add task (used in day panel)
 */
function addLifeTaskToDay() {
  var panel = document.getElementById('lifeRhythmDayPanel');
  var dateStr = panel ? panel.dataset.date : new Date().toISOString().slice(0, 10);
  
  var text = prompt('Task description:');
  if (!text || !text.trim()) return;
  
  // Add to Focus todos
  if (typeof todos !== 'undefined') {
    todos.push({
      id: Date.now(),
      text: text.trim(),
      date: dateStr,
      completed: false
    });
    if (typeof saveTodos === 'function') saveTodos();
    renderLifeDayTasks(dateStr);
    renderLifeCalendar();
    showToast('Task added!', 'success');
  }
}

/**
 * v13.9: Add task — uses form panel instead of prompt()
 */
function addLifeTask() {
  openLifeRhythmAddForm('task');
}

// Save functions
function saveLifeHabits() {
  localStorage.setItem('roweos_life_habits', JSON.stringify(lifeHabits));
  // v26.4: Sync habits to Firestore
  syncLifeAIToFirestore({ habits: lifeHabits });
}

function saveLifeGoals() {
  localStorage.setItem('roweos_life_goals', JSON.stringify(lifeGoals));
  // v26.4: Sync goals to Firestore
  syncLifeAIToFirestore({ goals: lifeGoals });
}

function saveLifeRoutines() {
  localStorage.setItem('roweos_life_routines', JSON.stringify(lifeRoutines));
  // v26.4: Route through single sync (replaces direct writeDB call)
  syncLifeAIToFirestore({ routines: lifeRoutines });
}

/**
 * Update Rhythm view for current mode
 */
function updateRhythmForMode() {
  var currentMode = localStorage.getItem('roweos_mode') || 'brand';
  var brandContent = document.getElementById('rhythmBrandContent');
  var lifeContent = document.getElementById('rhythmLifeContent');
  
  // Shared elements that should only show in BrandAI mode
  var sharedElements = [
    document.getElementById('rhythmAddFormPanel'),
    document.getElementById('weekDisplay'),
    document.getElementById('calendar'),
    document.getElementById('rhythmDayPanel'),
    document.getElementById('rhythmAutomationsSection'),
    document.getElementById('automationNotificationCenter')
  ];
  
  if (currentMode === 'life') {
    if (brandContent) brandContent.style.display = 'none';
    if (lifeContent) lifeContent.style.display = 'block';
    
    // Hide BrandAI-specific shared elements
    sharedElements.forEach(function(el) {
      if (el) el.style.display = 'none';
    });
    
    initLifeRhythm();
  } else {
    if (brandContent) brandContent.style.display = 'block';
    if (lifeContent) lifeContent.style.display = 'none';
    
    // Show BrandAI-specific shared elements
    sharedElements.forEach(function(el) {
      if (el && el.id !== 'rhythmAddFormPanel' && el.id !== 'rhythmDayPanel') {
        el.style.display = '';
      }
    });
  }
}


// ═══════════════════════════════════════════════════════════════
// PULSE 3.0 - GOALS & CHECKLISTS (v10.6)
// ═══════════════════════════════════════════════════════════════

var pulseGoals = (function() {
  try {
    var _pg = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    // v28.1: v4 stores as { data: [...] } wrapper -- unwrap if needed
    if (_pg && !Array.isArray(_pg) && Array.isArray(_pg.data)) return _pg.data;
    return Array.isArray(_pg) ? _pg : [];
  } catch(e) { return []; }
})();

/**
 * v10.6: Save goals to localStorage and sync
 */
function savePulseGoals() {
  // v25.2: Backfill id and _modifiedAt for merge support
  var now = Date.now();
  pulseGoals.forEach(function(g) {
    if (!g.id) g.id = 'goal_' + now + '_' + Math.random().toString(36).substr(2, 6);
    if (!g._modifiedAt) g._modifiedAt = now;
    // v28.8: Backfill new goal-level fields
    if (typeof g.isDefault === 'undefined') g.isDefault = false;
    if (typeof g.color === 'undefined') g.color = null;
    if (typeof g.icon === 'undefined') g.icon = null;
    if (typeof g.brandIdx === 'undefined') g.brandIdx = null;
    // v28.8: Backfill new item-level fields on flat items
    if (g.items && Array.isArray(g.items)) {
      g.items.forEach(function(item) {
        if (typeof item.date === 'undefined') item.date = null;
        if (typeof item.assignedTo === 'undefined') item.assignedTo = null;
        if (typeof item.notes === 'undefined') item.notes = null;
        if (typeof item.priority === 'undefined') item.priority = null;
        if (!item.createdAt) item.createdAt = new Date(now).toISOString();
        if (!item._modifiedAt) item._modifiedAt = now;
      });
    }
    // v28.8: Backfill new item-level fields on section items
    if (g.sections && Array.isArray(g.sections)) {
      g.sections.forEach(function(sec) {
        if (sec.items && Array.isArray(sec.items)) {
          sec.items.forEach(function(item) {
            if (typeof item.date === 'undefined') item.date = null;
            if (typeof item.assignedTo === 'undefined') item.assignedTo = null;
            if (typeof item.notes === 'undefined') item.notes = null;
            if (typeof item.priority === 'undefined') item.priority = null;
            if (!item.createdAt) item.createdAt = new Date(now).toISOString();
            if (!item._modifiedAt) item._modifiedAt = now;
          });
        }
      });
    }
  });
  // v25.1: Write-through — localStorage + immediate Firestore
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(pulseGoals));
  // Only write the goals field — merge:true preserves journal/insights/entries/reminders
  writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' });
}

// v28.8: Get or create a default "Unassigned" goal for the current mode
function getUnassignedGoal() {
  var lifeMode = (typeof isLifeMode === 'function') ? isLifeMode() : false;
  var source = lifeMode ? 'lifeai' : 'brandai';
  var existing = null;
  for (var i = 0; i < pulseGoals.length; i++) {
    if (pulseGoals[i].isDefault === true && pulseGoals[i].source === source) {
      existing = pulseGoals[i];
      break;
    }
  }
  if (existing) return existing;
  var now = Date.now();
  var goal = {
    id: 'goal_' + now + '_' + Math.random().toString(36).substr(2, 6),
    title: 'Unassigned',
    source: source,
    isDefault: true,
    color: null,
    icon: null,
    brandIdx: null,
    items: [],
    sections: [],
    completed: false,
    archived: false,
    _modifiedAt: now
  };
  pulseGoals.push(goal);
  savePulseGoals();
  return goal;
}

// v28.8: Add an item to a Pulse goal. If goalId is falsy, uses the default Unassigned goal.
function addItemToPulseGoal(goalId, itemData) {
  var goal = null;
  if (goalId) {
    for (var i = 0; i < pulseGoals.length; i++) {
      if (pulseGoals[i].id === goalId) { goal = pulseGoals[i]; break; }
    }
  }
  if (!goal) goal = getUnassignedGoal();
  if (!goal.items) goal.items = [];
  var now = Date.now();
  var item = {
    id: (itemData && itemData.id) ? itemData.id : ('item_' + now + '_' + Math.random().toString(36).substr(2, 6)),
    text: (itemData && itemData.text) ? itemData.text : '',
    completed: (itemData && itemData.completed) ? itemData.completed : false,
    date: (itemData && itemData.date) ? itemData.date : null,
    assignedTo: (itemData && itemData.assignedTo) ? itemData.assignedTo : null,
    notes: (itemData && itemData.notes) ? itemData.notes : null,
    priority: (itemData && itemData.priority) ? itemData.priority : null,
    createdAt: (itemData && itemData.createdAt) ? itemData.createdAt : new Date(now).toISOString(),
    _modifiedAt: now
  };
  goal.items.push(item);
  goal._modifiedAt = now;
  savePulseGoals();
  return item;
}

// v28.8: Remove an item from a Pulse goal (checks both flat items and section items)
function removeItemFromPulseGoal(goalId, itemId) {
  var goal = null;
  for (var i = 0; i < pulseGoals.length; i++) {
    if (pulseGoals[i].id === goalId) { goal = pulseGoals[i]; break; }
  }
  if (!goal) return;
  // Remove from flat items
  if (goal.items && Array.isArray(goal.items)) {
    goal.items = goal.items.filter(function(it) { return it.id !== itemId; });
  }
  // Remove from section items
  if (goal.sections && Array.isArray(goal.sections)) {
    goal.sections.forEach(function(sec) {
      if (sec.items && Array.isArray(sec.items)) {
        sec.items = sec.items.filter(function(it) { return it.id !== itemId; });
      }
    });
  }
  goal._modifiedAt = Date.now();
  savePulseGoals();
}

// v28.8: Move an item from one goal to another
function moveItemBetweenGoals(fromGoalId, toGoalId, itemId) {
  var fromGoal = null;
  var foundItem = null;
  for (var i = 0; i < pulseGoals.length; i++) {
    if (pulseGoals[i].id === fromGoalId) { fromGoal = pulseGoals[i]; break; }
  }
  if (!fromGoal) return null;
  // Search flat items
  if (fromGoal.items && Array.isArray(fromGoal.items)) {
    for (var j = 0; j < fromGoal.items.length; j++) {
      if (fromGoal.items[j].id === itemId) { foundItem = fromGoal.items[j]; break; }
    }
  }
  // Search section items if not found
  if (!foundItem && fromGoal.sections && Array.isArray(fromGoal.sections)) {
    for (var s = 0; s < fromGoal.sections.length; s++) {
      var secItems = fromGoal.sections[s].items;
      if (secItems && Array.isArray(secItems)) {
        for (var k = 0; k < secItems.length; k++) {
          if (secItems[k].id === itemId) { foundItem = secItems[k]; break; }
        }
      }
      if (foundItem) break;
    }
  }
  if (!foundItem) return null;
  // Remove from source goal (no save yet -- addItemToPulseGoal will save)
  removeItemFromPulseGoal(fromGoalId, itemId);
  // Add to target goal
  return addItemToPulseGoal(toGoalId, foundItem);
}

// v28.8: Get all tasks for a specific date (YYYY-MM-DD string)
function getAllTasksForDate(dateStr) {
  var results = [];
  pulseGoals.forEach(function(g) {
    if (g.archived || g.completed) return;
    if (g.items && Array.isArray(g.items)) {
      g.items.forEach(function(item) {
        if (item.date === dateStr && !item.completed) {
          results.push({ goal: g, item: item });
        }
      });
    }
    if (g.sections && Array.isArray(g.sections)) {
      g.sections.forEach(function(sec) {
        if (sec.items && Array.isArray(sec.items)) {
          sec.items.forEach(function(item) {
            if (item.date === dateStr && !item.completed) {
              results.push({ goal: g, item: item });
            }
          });
        }
      });
    }
  });
  return results;
}

// v28.8: Get all tasks assigned to a specific person
function getAllTasksForPerson(personId) {
  var results = [];
  pulseGoals.forEach(function(g) {
    if (g.archived || g.completed) return;
    if (g.items && Array.isArray(g.items)) {
      g.items.forEach(function(item) {
        if (item.assignedTo === personId && !item.completed) {
          results.push({ goal: g, item: item });
        }
      });
    }
    if (g.sections && Array.isArray(g.sections)) {
      g.sections.forEach(function(sec) {
        if (sec.items && Array.isArray(sec.items)) {
          sec.items.forEach(function(item) {
            if (item.assignedTo === personId && !item.completed) {
              results.push({ goal: g, item: item });
            }
          });
        }
      });
    }
  });
  return results;
}

/**
 * v10.6: Initialize Pulse 3.0
 */
function initPulse3() {
  renderPulse3Overview();
  renderPulse3Checklists();
}

// v15.37: Pulse goal mode filter
var pulseShowAllGoals = localStorage.getItem('roweos_pulse_show_all_goals') === 'true';

function togglePulseGoalFilter(showAll) {
  pulseShowAllGoals = showAll;
  localStorage.setItem('roweos_pulse_show_all_goals', showAll ? 'true' : 'false');
  renderPulse3Overview();
  renderPulse3Checklists();
}

/**
 * v10.6: Render overview stats (progress rings)
 */
function renderPulse3Overview() {
  var container = document.getElementById('pulse3Overview');
  if (!container) return;

  var totalItems = 0;
  var completedItems = 0;
  // v15.37: Mode filter
  var modeFilteredGoals = pulseGoals;
  if (!pulseShowAllGoals) {
    var lifeMode = isLifeMode();
    modeFilteredGoals = pulseGoals.filter(function(g) {
      if (lifeMode && g.source !== 'lifeai') return false;
      if (!lifeMode && g.source === 'lifeai') return false;
      return true;
    });
  }
  var activeGoals = modeFilteredGoals.filter(function(g) { return !g.archived; }).length;
  var completedGoals = modeFilteredGoals.filter(function(g) { return g.completed; }).length;

  modeFilteredGoals.forEach(function(goal) {
    // v29.0: Exclude completed goals from progress % (was inflating after Mark as completed)
    if (goal.items && !goal.archived && !goal.completed) {
      totalItems += goal.items.length;
      completedItems += goal.items.filter(function(i) { return i.completed; }).length;
    }
  });
  
  var overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  
  // Get today's completions
  var today = new Date().toISOString().slice(0, 10);
  var todayCompleted = 0;
  modeFilteredGoals.forEach(function(goal) {
    if (goal.items) {
      todayCompleted += goal.items.filter(function(i) {
        return i.completed && i.completedAt && i.completedAt.startsWith(today);
      }).length;
    }
  });
  
  var html = '';
  
  // Overall Progress Ring
  html += createPulseRing(overallProgress, 'Overall Progress', completedItems + '/' + totalItems + ' tasks');
  
  // Active Goals
  html += '<div class="pulse-3-stat-card">' +
    '<div style="font-size: var(--text-5xl); font-weight: 700; color: var(--accent); margin-bottom: var(--space-2);">' + activeGoals + '</div>' +
    '<div class="pulse-3-stat-label">Active Goals</div>' +
    '<div class="pulse-3-stat-meta">' + completedGoals + ' completed</div>' +
  '</div>';
  
  // Today's Completions
  html += '<div class="pulse-3-stat-card">' +
    '<div style="font-size: var(--text-5xl); font-weight: 700; color: var(--accent); margin-bottom: var(--space-2);">' + todayCompleted + '</div>' +
    '<div class="pulse-3-stat-label">Done Today</div>' +
    '<div class="pulse-3-stat-meta">Keep it up!</div>' +
  '</div>';

  // v22.41: Brand Activity Pulse — automations, emails, social posts
  var autoCount = 0;
  var emailCount = 0;
  var socialCount = 0;
  try {
    var autoHist = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]');
    autoCount = autoHist.length;
  } catch(e) {}
  try {
    var mailSentArr = JSON.parse(localStorage.getItem('roweos_mail_sent') || '[]');
    emailCount = mailSentArr.length;
  } catch(e) {}
  try {
    var compAutos = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]');
    socialCount = compAutos.filter(function(a) { return a.type === 'social' || (a.name && a.name.toLowerCase().indexOf('social') !== -1); }).length;
    if (socialCount === 0) {
      // Fallback: count social outbox sent items
      var socOutbox = JSON.parse(localStorage.getItem('roweos_social_outbox') || '[]');
      socialCount = socOutbox.filter(function(s) { return s.status === 'sent'; }).length;
    }
  } catch(e) {}

  html += '<div class="pulse-3-stat-card">' +
    '<div style="display:flex;flex-direction:column;gap:8px;width:100%;">' +
      '<div style="font-size:var(--text-lg);font-weight:600;color:var(--text-primary);margin-bottom:4px;">Brand Activity</div>' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:var(--text-sm);color:var(--text-secondary);">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
        '<span>' + emailCount + ' emails sent</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:var(--text-sm);color:var(--text-secondary);">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<span>' + autoCount + ' automations run</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:var(--text-sm);color:var(--text-secondary);">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        '<span>' + socialCount + ' social posts</span>' +
      '</div>' +
    '</div>' +
  '</div>';

  container.innerHTML = html;

  // v15.37: Restore toggle state
  var toggleCheckbox = document.getElementById('pulseShowAllGoals');
  if (toggleCheckbox) toggleCheckbox.checked = pulseShowAllGoals;
}

/**
 * v10.6: Create progress ring SVG
 */
function createPulseRing(percent, label, meta) {
  var circumference = 2 * Math.PI * 42;
  var offset = circumference - (percent / 100) * circumference;
  
  return '<div class="pulse-3-stat-card">' +
    '<div class="pulse-3-ring">' +
      '<svg viewBox="0 0 100 100">' +
        '<circle class="pulse-3-ring-bg" cx="50" cy="50" r="42"/>' +
        '<circle class="pulse-3-ring-fill" cx="50" cy="50" r="42" ' +
          'stroke-dasharray="' + circumference + '" ' +
          'stroke-dashoffset="' + offset + '"/>' +
      '</svg>' +
      '<div class="pulse-3-ring-value">' + percent + '%</div>' +
    '</div>' +
    '<div class="pulse-3-stat-label">' + label + '</div>' +
    '<div class="pulse-3-stat-meta">' + meta + '</div>' +
  '</div>';
}

/**
 * v10.6: Render active checklists
 */
function renderPulse3Checklists() {
  var container = document.getElementById('pulse3Checklists');
  if (!container) return;

  var activeGoals = pulseGoals.filter(function(g) {
    if (g.archived || g.completed) return false;
    // v15.37: Mode filter
    if (!pulseShowAllGoals) {
      var lifeMode = isLifeMode();
      if (lifeMode && g.source !== 'lifeai') return false;
      if (!lifeMode && g.source === 'lifeai') return false;
    }
    return true;
  });
  
  if (activeGoals.length === 0) {
    container.innerHTML = '<div class="pulse-3-empty">' +
      '<div class="pulse-3-empty-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>' +
      '</div>' +
      '<div class="pulse-3-empty-title">No active goals</div>' +
      '<div class="pulse-3-empty-text">Create a goal or ask AI to make you a checklist!</div>' +
      '<button class="pulse-3-btn pulse-3-btn-primary" onclick="openNewGoalModal()">Create First Goal</button>' +
    '</div>';
    return;
  }
  
  var html = activeGoals.map(function(goal) {
    var allItems = [];
    var completedCount = 0;
    var totalCount = 0;
    
    // Collect items from both flat list and sections
    if (goal.sections && goal.sections.length > 0) {
      goal.sections.forEach(function(s) {
        if (s.items) {
          allItems = allItems.concat(s.items);
        }
      });
    }
    // v15.47: Only add flat items if no sections exist (prevents duplication)
    if ((!goal.sections || goal.sections.length === 0) && goal.items) {
      allItems = allItems.concat(goal.items);
    }

    totalCount = allItems.length;
    completedCount = allItems.filter(function(i) { return i.completed; }).length;
    var progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    // Render sections if they exist
    var itemsHtml = '';
    if (goal.sections && goal.sections.length > 0) {
      itemsHtml = goal.sections.map(function(section, sIdx) {
        var sectionItems = (section.items || []).map(function(item) {
          var categoryPill = item.sourceCategory ? '<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(168,152,120,0.15); color: var(--text-muted); margin-left: 6px;">' + escapeHtml(item.sourceCategory) + '</span>' : '';
          return '<div class="pulse-3-checklist-item">' +
            '<div class="pulse-3-checkbox ' + (item.completed ? 'checked' : '') + '" onclick="togglePulseChecklistItem(\'' + goal.id + '\', \'' + item.id + '\')">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' +
            '</div>' +
            '<div class="pulse-3-item-text ' + (item.completed ? 'completed' : '') + '" onclick="editTaskInline(this, \'' + goal.id + '\', \'' + item.id + '\')" title="Click to edit">' + escapeHtml(item.text) + categoryPill + '</div>' +
            '<button class="pulse-3-item-delete" onclick="deleteGoalItem(\'' + goal.id + '\', \'' + item.id + '\')" title="Delete item">×</button>' +
          '</div>';
        }).join('');

        return '<div class="pulse-3-section ' + (section.collapsed ? 'collapsed' : '') + '">' +
          '<div class="pulse-3-section-header" onclick="toggleGoalSection(\'' + goal.id + '\', ' + sIdx + ')">' +
            '<span class="pulse-3-section-toggle">' + (section.collapsed ? '▶' : '▼') + '</span>' +
            '<span class="pulse-3-section-title">' + escapeHtml(section.name) + '</span>' +
            '<span class="pulse-3-section-count">' + (section.items || []).filter(function(i) { return i.completed; }).length + '/' + (section.items || []).length + '</span>' +
          '</div>' +
          '<div class="pulse-3-section-items">' + sectionItems + '</div>' +
        '</div>';
      }).join('');
    }

    // Render flat items (non-sectioned) — v15.47: skip if sections already rendered these items
    if ((!goal.sections || goal.sections.length === 0) && goal.items && goal.items.length > 0) {
      itemsHtml += (goal.items || []).map(function(item) {
        var categoryPill = item.sourceCategory ? '<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(168,152,120,0.15); color: var(--text-muted); margin-left: 6px;">' + escapeHtml(item.sourceCategory) + '</span>' : '';
        return '<div class="pulse-3-checklist-item">' +
          '<div class="pulse-3-checkbox ' + (item.completed ? 'checked' : '') + '" onclick="togglePulseChecklistItem(\'' + goal.id + '\', \'' + item.id + '\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' +
          '</div>' +
          '<div class="pulse-3-item-text ' + (item.completed ? 'completed' : '') + '" onclick="editTaskInline(this, \'' + goal.id + '\', \'' + item.id + '\')" title="Click to edit">' + escapeHtml(item.text) + categoryPill + '</div>' +
          '<button class="pulse-3-item-delete" onclick="deleteGoalItem(\'' + goal.id + '\', \'' + item.id + '\')" title="Delete item">×</button>' +
        '</div>';
      }).join('');
    }
    
    var sourceLabel = goal.source === 'lifeai' ? 'From LifeAI' : (goal.source === 'brandai' ? 'From BrandAI' : (goal.source === 'studio' ? 'From Studio' : 'Manual'));
    
    return '<div class="pulse-3-checklist-card' + (goal.collapsed ? ' collapsed' : '') + '" data-goal-id="' + goal.id + '">' +
      '<div class="pulse-3-checklist-header">' +
        '<div style="display:flex;align-items:flex-start;gap:var(--space-2);">' +
          '<button class="pulse-3-collapse-toggle" onclick="event.stopPropagation();toggleGoalCollapse(\'' + goal.id + '\')" title="Toggle details">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
          '</button>' +
          '<div>' +
            '<div class="pulse-3-checklist-title" onclick="editGoalTitleInline(this, \'' + goal.id + '\')" title="Click to edit">' + escapeHtml(goal.title) + '</div>' +
            '<div class="pulse-3-checklist-meta">' + sourceLabel + ' &bull; ' + new Date(goal.createdAt).toLocaleDateString() + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pulse-3-checklist-progress">' +
          '<div class="pulse-3-checklist-progress-bar"><div class="pulse-3-checklist-progress-fill" style="width: ' + progress + '%;"></div></div>' +
          '<div class="pulse-3-checklist-progress-text">' + progress + '%</div>' +
        '</div>' +
      '</div>' +
      '<div class="pulse-3-checklist-items">' + itemsHtml + '</div>' +
      '<div class="pulse-3-checklist-actions">' +
        '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="addItemToGoal(\'' + goal.id + '\')">+ Add Item</button>' +
        '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="showTodoImportForGoal(\'' + goal.id + '\')">Import Tasks</button>' +
        '<button class="pulse-3-ai-suggest-btn" onclick="generateAITasksForGoal(\'' + goal.id + '\')" title="AI-generate tasks for this goal"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg> AI Tasks</button>' +
        '<button class="pulse-3-btn pulse-3-btn-danger" onclick="deleteGoal(\'' + goal.id + '\')">Delete</button>' +
        (progress === 100 ? '<button class="pulse-3-btn pulse-3-btn-primary" onclick="completeGoal(\'' + goal.id + '\')">Mark Complete</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

// v15.37: Toggle goal card collapse
function toggleGoalCollapse(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;
  goal.collapsed = !goal.collapsed;
  savePulseGoals();
  var card = document.querySelector('.pulse-3-checklist-card[data-goal-id="' + goalId + '"]');
  if (card) card.classList.toggle('collapsed', goal.collapsed);
}

/**
 * v10.6: Toggle checklist item completion
 */
function togglePulseChecklistItem(goalId, itemId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;
  
  // Check flat items first
  var item = null;
  if (goal.items) {
    item = goal.items.find(function(i) { return i.id === itemId; });
  }
  
  // If not found, check sections
  if (!item && goal.sections) {
    for (var s = 0; s < goal.sections.length; s++) {
      if (goal.sections[s].items) {
        item = goal.sections[s].items.find(function(i) { return i.id === itemId; });
        if (item) break;
      }
    }
  }
  
  if (!item) return;
  
  item.completed = !item.completed;
  item.completedAt = item.completed ? new Date().toISOString() : null;
  goal._modifiedAt = Date.now(); // v25.2: Stamp for merge

  // Pulse-Focus completion sync: mirror state back to Focus task
  if (item.sourceTodoId && typeof todos !== 'undefined') {
    var focusTodo = todos.find(function(t) { return t.id === item.sourceTodoId; });
    if (focusTodo) {
      if (item.completed) {
        focusTodo.completed = true;
        focusTodo.completedAt = new Date().toISOString();
        showToast('Focus task also marked complete', 'success');
      } else {
        focusTodo.completed = false;
        focusTodo.completedAt = null;
        showToast('Focus task also marked incomplete', 'info');
      }
      saveTodos();
    }
  }

  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();
}

/**
 * v11.0.5: Conversational LifeAI Goal Creation
 * Opens a chat-like interface where LifeAI helps create goals with AI-generated tasks
 */
function openNewGoalModal() {
  var modal = document.getElementById('newGoalModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'newGoalModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  
  // Reset conversation state
  window.goalCreationState = {
    step: 'describe',
    userDescription: '',
    aiSummary: '',
    suggestedTasks: [],
    userTasks: []
  };
  
  // v11.0.5: Mode-aware goal planner with proper icons
  var currentModeForGoal = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeGoal = currentModeForGoal === 'life';
  var accentColor = isLifeGoal ? 'var(--lifeai-accent, #5a7a9a)' : 'var(--accent, #a89878)';
  var aiName = isLifeGoal ? 'LifeAI' : 'BrandAI';
  
  // v11.0.5: BrandAI uses star icon, LifeAI uses layers icon
  var headerIcon = isLifeGoal ? 
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' :
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  var aiIcon = isLifeGoal ? 
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' :
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  
  // Store accent for use in send button
  window.goalAccentColor = accentColor;
  window.goalAiIcon = aiIcon;
  
  modal.innerHTML = '<div class="modal-box" style="max-width: 600px; max-height: 85vh; background: var(--bg-secondary); border: 1px solid var(--border-color); display: flex; flex-direction: column;">' +
    // Header
    '<div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">' +
      '<div style="display: flex; align-items: center; gap: 10px;">' +
        '<div style="width: 32px; height: 32px; background: ' + accentColor + '; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">' +
          headerIcon +
        '</div>' +
        '<div>' +
          '<div style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);">' + aiName + ' Goal Assistant</div>' +
          '<div style="font-size: var(--text-sm); color: var(--text-muted);">Let\'s create your goal together</div>' +
        '</div>' +
      '</div>' +
      '<button onclick="closeNewGoalModal()" style="background: none; border: none; font-size: var(--text-3xl); color: var(--text-secondary); cursor: pointer; padding: var(--space-1);">×</button>' +
    '</div>' +
    
    // Chat Container
    '<div id="goalChatContainer" style="flex: 1; overflow-y: auto; padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4);">' +
      // Initial AI message
      '<div class="goal-chat-message goal-chat-ai">' +
        '<div style="display: flex; gap: var(--space-3);">' +
          '<div style="width: 28px; height: 28px; background: ' + accentColor + '; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
            aiIcon +
          '</div>' +
          '<div style="background: var(--bg-tertiary); padding: 14px 16px; border-radius: var(--radius-xl); border-top-left-radius: 4px; max-width: 85%;">' +
            '<div style="font-size: var(--text-base); color: var(--text-primary); line-height: 1.5;">Hi! I\'m here to help you create a meaningful goal. Tell me what you\'d like to achieve. It could be a project, habit, routine, or any objective. Be as detailed as you\'d like!</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    
    // Input Area
    '<div style="padding: 16px 20px; border-top: 1px solid var(--border-color); flex-shrink: 0;">' +
      '<div style="display: flex; gap: 10px;">' +
        '<textarea id="goalChatInput" rows="2" placeholder="Describe your goal..." style="flex: 1; padding: 12px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); color: var(--text-primary); font-size: var(--text-base); resize: none; font-family: inherit;"></textarea>' +
        '<button id="goalChatSendBtn" onclick="sendGoalChatMessage()" style="padding: 12px 20px; background: ' + accentColor + '; border: none; border-radius: var(--radius-lg); color: #fff; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
          'Send' +
        '</button>' +
      '</div>' +
      '<div style="font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-2); text-align: center;">' + aiName + ' will help summarize your goal and suggest actionable tasks</div>' +
    '</div>' +
  '</div>';
  
  modal.classList.add('open');
  
  // Focus input and handle Enter key
  setTimeout(function() {
    var input = document.getElementById('goalChatInput');
    if (input) {
      input.focus();
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendGoalChatMessage();
        }
      });
    }
  }, 100);
}

/**
 * v11.0.5: Close goal creation modal
 */
function closeNewGoalModal() {
  var modal = document.getElementById('newGoalModal');
  if (modal) {
    modal.classList.remove('open');
    modal.classList.remove('show');
    setTimeout(function() {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    }, 300);
  }
  window.goalCreationState = null;
}

/**
 * v10.7.10: Get LifeAI identity context for goal generation
 */
function getLifeIdentityContextForGoals() {
  try {
    var identity = JSON.parse(localStorage.getItem('roweos_life_identity') || '{}');
    var context = [];
    
    if (identity.name) context.push('Name: ' + identity.name);
    if (identity.role) context.push('Role/Occupation: ' + identity.role);
    if (identity.location) context.push('Location: ' + identity.location);
    if (identity.values && identity.values.length) context.push('Core Values: ' + identity.values.join(', '));
    if (identity.goals && identity.goals.length) context.push('Life Goals: ' + identity.goals.join(', '));
    if (identity.interests && identity.interests.length) context.push('Interests: ' + identity.interests.join(', '));

    // v13.2: Add todos summary for richer context
    var todayStr = new Date().toISOString().slice(0, 10);
    var pendingTodos = (todos || []).filter(function(t) { return !t.completed && t.brand === '_life'; });
    var categories = (window.todoCategories || []).map(function(c) { return c.name; });
    if (pendingTodos.length > 0) context.push('Pending Tasks: ' + pendingTodos.length + ' across categories: ' + categories.join(', '));
    var overdue = pendingTodos.filter(function(t) { return t.date && t.date < todayStr; });
    if (overdue.length > 0) context.push('Overdue Tasks: ' + overdue.length);

    // v13.2: Add recent library titles — v16.0: per-profile support
    try {
      var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{}');
      var libFiles = (lifeLib.files || []).slice(-5);
      if (libFiles.length > 0) context.push('Recent Documents: ' + libFiles.map(function(f) { return f.name; }).join(', '));
    } catch(e2) {}

    return context.length > 0 ? '\n\n=== ABOUT THE USER ===\n' + context.join('\n') : '';
  } catch (e) {
    return '';
  }
}

/**
 * v10.7.10: Get brand context for goal generation
 */
function getBrandContextForGoals() {
  try {
    var brands = JSON.parse(localStorage.getItem('roweos_brands') || '[]');
    var selectedBrand = parseInt(localStorage.getItem('selectedBrand') || '0');
    var brand = brands[selectedBrand];
    
    if (!brand) return '';
    
    var context = [];
    if (brand.name) context.push('Brand: ' + brand.name);
    if (brand.industry) context.push('Industry: ' + brand.industry);
    if (brand.mission) context.push('Mission: ' + brand.mission);
    if (brand.targetAudience) context.push('Target Audience: ' + brand.targetAudience);
    if (brand.differentiators) context.push('Key Differentiators: ' + brand.differentiators);

    // v13.2: Add brand-mode todos summary
    var todayStr = new Date().toISOString().slice(0, 10);
    var brandIdx = selectedBrand;
    var pendingTodos = (todos || []).filter(function(t) { return !t.completed && (t.brand === String(brandIdx) || t.brand === brand.name); });
    var categories = (window.todoCategories || []).map(function(c) { return c.name; });
    if (pendingTodos.length > 0) context.push('Pending Tasks: ' + pendingTodos.length + ' across categories: ' + categories.join(', '));
    var overdue = pendingTodos.filter(function(t) { return t.date && t.date < todayStr; });
    if (overdue.length > 0) context.push('Overdue Tasks: ' + overdue.length);

    // v13.2: Add brand library titles
    try {
      var brandLib = JSON.parse(localStorage.getItem('roweos_brand_library_' + brandIdx) || localStorage.getItem('roweos_library') || '{}');
      var libFiles = (brandLib.files || []).slice(-5);
      if (libFiles.length > 0) context.push('Recent Documents: ' + libFiles.map(function(f) { return f.name; }).join(', '));
    } catch(e2) {}

    return context.length > 0 ? '\n\n=== BRAND CONTEXT ===\n' + context.join('\n') : '';
  } catch (e) {
    return '';
  }
}

/**
 * v11.0.5: Send message in goal chat
 * v10.7.10: Mode-aware accent color
 */
function sendGoalChatMessage() {
  var input = document.getElementById('goalChatInput');
  var container = document.getElementById('goalChatContainer');
  var sendBtn = document.getElementById('goalChatSendBtn');
  if (!input || !container) return;
  
  var message = input.value.trim();
  if (!message) return;
  
  var state = window.goalCreationState;
  // v10.7.10: Use stored accent color from modal init
  var accentColor = window.goalAccentColor || 'var(--accent, #a89878)';
  
  // Add user message
  container.innerHTML += '<div class="goal-chat-message goal-chat-user" style="display: flex; justify-content: flex-end;">' +
    '<div style="background: ' + accentColor + '; padding: 14px 16px; border-radius: var(--radius-xl); border-top-right-radius: 4px; max-width: 85%; color: #fff;">' +
      '<div style="font-size: var(--text-base); line-height: 1.5;">' + escapeHtml(message) + '</div>' +
    '</div>' +
  '</div>';
  
  input.value = '';
  container.scrollTop = container.scrollHeight;
  
  // Disable send while processing
  sendBtn.disabled = true;
  sendBtn.style.opacity = '0.6';
  
  if (state.step === 'describe') {
    state.userDescription = message;
    generateGoalSummaryAndTasks(message, container, sendBtn);
  } else if (state.step === 'refine') {
    // User wants to add more or modify
    refineGoalWithAI(message, container, sendBtn);
  }
}

/**
 * v11.0.5: Generate goal summary and tasks with AI
 */
function generateGoalSummaryAndTasks(description, container, sendBtn) {
  var state = window.goalCreationState;
  
  // v11.0.5: Mode-aware colors and context
  var currentModeForGoal = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeGoal = currentModeForGoal === 'life';
  var accentColor = window.goalAccentColor || (isLifeGoal ? 'var(--lifeai-accent, #5a7a9a)' : 'var(--accent, #a89878)');
  var aiName = isLifeGoal ? 'LifeAI' : 'BrandAI';
  var aiIcon = window.goalAiIcon || (isLifeGoal ?
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' :
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>');
  
  // Show typing indicator
  var typingId = 'typing_' + Date.now();
  container.innerHTML += '<div id="' + typingId + '" class="goal-chat-message goal-chat-ai">' +
    '<div style="display: flex; gap: var(--space-3);">' +
      '<div style="width: 28px; height: 28px; background: ' + accentColor + '; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
        aiIcon +
      '</div>' +
      '<div style="background: var(--bg-tertiary); padding: 14px 16px; border-radius: var(--radius-xl); border-top-left-radius: 4px;">' +
        '<div style="display: flex; gap: var(--space-1);">' +
          '<span class="typing-dot" style="width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></span>' +
          '<span class="typing-dot" style="width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></span>' +
          '<span class="typing-dot" style="width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both;"></span>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
  container.scrollTop = container.scrollHeight;
  
  // v11.0.5: Get context based on mode
  var contextInfo = '';
  if (isLifeGoal) {
    if (typeof getLifeIdentityContextForGoals === 'function') {
      contextInfo = getLifeIdentityContextForGoals();
    }
  } else {
    if (typeof getBrandContextForGoals === 'function') {
      contextInfo = getBrandContextForGoals();
    }
  }
  
  // v11.0.5: Mode-aware system prompt
  var systemPrompt = 'You are ' + aiName + ', a helpful ' + (isLifeGoal ? 'personal life assistant' : 'business strategy assistant') + '. ' +
    'The user wants to create a goal. Based on their description' + (contextInfo ? ' and context' : '') + ', provide:\n' +
    '1. A clear, concise goal title (max 50 chars)\n' +
    '2. A brief summary of the goal (1-2 sentences)\n' +
    '3. 5-8 actionable tasks/steps to achieve this goal\n\n' +
    (contextInfo ? 'USER CONTEXT:\n' + contextInfo + '\n\n' : '') +
    'Respond in this exact JSON format:\n' +
    '{"title": "Goal Title", "summary": "Brief summary", "tasks": ["Task 1", "Task 2", "Task 3", ...]}\n\n' +
    'Make tasks specific, actionable, and in a logical order. Personalize based on the context provided.';
  
  var userPrompt = 'Create a goal from this description:\n\n' + description;
  
  // Call AI API
  callLifeAIForGoal(systemPrompt, userPrompt, function(response) {
    // Remove typing indicator
    var typing = document.getElementById(typingId);
    if (typing) typing.remove();
    
    try {
      // Parse JSON response - handle markdown code blocks
      // v13.4: More robust JSON extraction
      var jsonStr = response;
      var parsed = null;
      // Try 1: Parse full response as JSON
      try { parsed = JSON.parse(jsonStr.trim()); } catch(e1) {}
      // Try 2: Extract from markdown code blocks
      if (!parsed && response.indexOf('```') >= 0) {
        var match = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) { try { parsed = JSON.parse(match[1].trim()); } catch(e2) {} }
      }
      // Try 3: Find JSON object with curly braces
      if (!parsed) {
        var braceMatch = response.match(/\{[\s\S]*\}/);
        if (braceMatch) { try { parsed = JSON.parse(braceMatch[0]); } catch(e3) {} }
      }
      // Try 4: Find JSON array with square brackets
      if (!parsed) {
        var bracketMatch = response.match(/\[[\s\S]*\]/);
        if (bracketMatch) {
          try {
            var arr = JSON.parse(bracketMatch[0]);
            parsed = { tasks: arr.map(function(item) { return typeof item === 'string' ? item : (item.text || item.task || item.name || String(item)); }), title: 'My Goal', summary: 'Goal from AI' };
          } catch(e4) {}
        }
      }
      if (!parsed) throw new Error('Could not parse JSON from response');
      state.aiSummary = parsed.summary || 'Goal created from your description';
      state.suggestedTasks = parsed.tasks || [];
      state.goalTitle = parsed.title || 'My Goal';
      state.step = 'refine';
      
      // Show AI response with summary and tasks
      showGoalSuggestions(container, state, accentColor, sendBtn);
    } catch(e) {
      // Fallback: extract tasks from plain text
      console.log('[GoalAI] Parsing fallback:', e, response);
      var lines = response.split('\n').filter(function(l) { return l.trim(); });
      state.goalTitle = description.substring(0, 50);
      state.aiSummary = 'Goal based on your description';
      state.suggestedTasks = lines.slice(0, 8).map(function(l) {
        return l.replace(/^[\d\-\*\•\.]+\s*/, '').trim();
      }).filter(function(t) { return t.length > 3; });
      
      if (state.suggestedTasks.length === 0) {
        state.suggestedTasks = ['Define specific success criteria', 'Break into weekly milestones', 'Schedule first action step', 'Identify resources needed', 'Set review checkpoint'];
      }
      state.step = 'refine';
      showGoalSuggestions(container, state, accentColor, sendBtn);
    }
  }, function(error) {
    // Remove typing indicator
    var typing = document.getElementById(typingId);
    if (typing) typing.remove();
    
    console.error('[GoalAI] API Error:', error);
    
    // v11.0.5: Show error message in chat UI
    var errorMsg = typeof error === 'string' ? error : (error.message || 'Connection failed');
    container.innerHTML += '<div class="goal-chat-message goal-chat-ai">' +
      '<div style="display: flex; gap: var(--space-3);">' +
        '<div style="width: 28px; height: 28px; background: #dc2626; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' +
        '</div>' +
        '<div style="background: var(--bg-tertiary); padding: 14px 16px; border-radius: var(--radius-xl); border-top-left-radius: 4px; max-width: 85%;">' +
          '<div style="font-size: var(--text-base); color: #dc2626; line-height: 1.5; margin-bottom: var(--space-2);"><strong>AI Connection Issue</strong></div>' +
          '<div style="font-size: var(--text-base); color: var(--text-secondary); line-height: 1.5;">' + escapeHtml(errorMsg) + '</div>' +
          '<div style="font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-2);">Using template tasks instead. Check Settings > AI Configuration for API keys.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    container.scrollTop = container.scrollHeight;
    
    // Better fallback with mode-aware tasks
    state.goalTitle = description.substring(0, 50);
    state.aiSummary = description;
    
    if (isLifeGoal) {
      state.suggestedTasks = [
        'Define what success looks like for this goal',
        'Break the goal into weekly milestones',
        'Schedule your first action step',
        'Identify any resources or support needed',
        'Set a checkpoint to review progress'
      ];
    } else {
      state.suggestedTasks = [
        'Define measurable success metrics',
        'Identify key stakeholders and resources',
        'Create a timeline with milestones',
        'Assign ownership for key tasks',
        'Schedule regular progress reviews'
      ];
    }
    state.step = 'refine';
    showGoalSuggestions(container, state, accentColor, sendBtn);
  });
}

/**
 * v11.0.5: Show goal suggestions from AI
 */
function showGoalSuggestions(container, state, lifeAccent, sendBtn) {
  var tasksHtml = state.suggestedTasks.map(function(task, idx) {
    return '<div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0;">' +
      '<input type="checkbox" id="goalTask' + idx + '" checked style="margin-top: 2px; accent-color: ' + lifeAccent + ';">' +
      '<label for="goalTask' + idx + '" style="font-size: var(--text-base); color: var(--text-primary); cursor: pointer;">' + escapeHtml(task) + '</label>' +
    '</div>';
  }).join('');
  
  // v11.0.5: Use stored mode-aware icon
  var aiIcon = window.goalAiIcon || '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  
  container.innerHTML += '<div class="goal-chat-message goal-chat-ai">' +
    '<div style="display: flex; gap: var(--space-3);">' +
      '<div style="width: 28px; height: 28px; background: ' + lifeAccent + '; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
        aiIcon +
      '</div>' +
      '<div style="background: var(--bg-tertiary); padding: var(--space-4); border-radius: var(--radius-xl); border-top-left-radius: 4px; max-width: 90%; width: 100%;">' +
        '<div style="font-size: var(--text-base); color: var(--text-primary); line-height: 1.5; margin-bottom: var(--space-3);">Great! Here\'s what I\'ve created for you:</div>' +
        
        // Goal title
        '<div style="margin-bottom: var(--space-4);">' +
          '<div style="font-size: var(--text-sm); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">Goal</div>' +
          '<input type="text" id="goalTitleEdit" value="' + escapeHtml(state.goalTitle) + '" style="width: 100%; padding: 10px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-lg); font-weight: 600;">' +
        '</div>' +
        
        // Summary
        '<div style="margin-bottom: var(--space-4);">' +
          '<div style="font-size: var(--text-sm); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">Summary</div>' +
          '<div style="font-size: var(--text-base); color: var(--text-secondary); line-height: 1.5;">' + escapeHtml(state.aiSummary) + '</div>' +
        '</div>' +
        
        // Suggested Tasks
        '<div style="margin-bottom: var(--space-4);">' +
          '<div style="font-size: var(--text-sm); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-2);">Suggested Tasks <span style="font-size: var(--text-xs); text-transform: none;">(uncheck to remove)</span></div>' +
          '<div id="goalTasksList" style="background: var(--bg-secondary); border-radius: var(--radius-md); padding: 8px 12px;">' + tasksHtml + '</div>' +
        '</div>' +
        
        // Action Buttons
        '<div style="display: flex; gap: 10px; flex-wrap: wrap;">' +
          '<button onclick="createGoalFromAI()" style="flex: 1; padding: 12px 20px; background: ' + lifeAccent + '; border: none; border-radius: var(--radius-md); color: #fff; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>' +
            'Create Goal' +
          '</button>' +
          '<button onclick="regenerateGoalTasks()" style="padding: 12px 16px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 6px;">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
            'Regenerate' +
          '</button>' +
        '</div>' +
        
        '<div style="font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-3); text-align: center;">You can also type to ask for changes</div>' +
      '</div>' +
    '</div>' +
  '</div>';
  
  container.scrollTop = container.scrollHeight;
  sendBtn.disabled = false;
  sendBtn.style.opacity = '1';
  
  // Update input placeholder
  var input = document.getElementById('goalChatInput');
  if (input) input.placeholder = 'Ask for changes or add more details...';
}

/**
 * v11.0.5: Call LifeAI API for goal generation
 * v13.1: Added optional conversationHistory parameter for multi-turn context
 */
function callLifeAIForGoal(systemPrompt, userPrompt, onSuccess, onError, conversationHistory) {
  var provider = localStorage.getItem('roweos_llm_provider') || 'anthropic';
  var model = localStorage.getItem('roweos_llm_model') || 'claude-sonnet-4-6';

  console.log('[GoalAI] Provider:', provider, 'Model:', model);

  // v13.1: Build messages array with conversation history if available
  var messages = [];
  if (conversationHistory && conversationHistory.length > 0) {
    messages = conversationHistory.slice();
  }
  messages.push({ role: 'user', content: userPrompt });

  // v11.0.5: Use the proper getApiKey() function that works with the rest of the app
  getApiKey(provider).then(function(apiKey) {
    console.log('[GoalAI] API key found:', apiKey ? 'Yes (' + apiKey.substring(0, 8) + '...)' : 'No');

    if (!apiKey) {
      console.error('[GoalAI] No API key - check Settings > AI Configuration');
      onError('No API key configured. Please add your API key in Settings > AI Configuration.');
      return;
    }

    // Call appropriate API
    if (provider === 'anthropic') {
      console.log('[GoalAI] Calling Anthropic API...');
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        console.log('[GoalAI] Anthropic response:', data);
        if (data.content && data.content[0]) {
          onSuccess(data.content[0].text);
        } else {
          onError(data.error ? data.error.message : 'Unknown error');
        }
      })
      .catch(function(err) {
        console.error('[GoalAI] Fetch error:', err);
        onError(err.message || 'Network error');
      });
    } else if (provider === 'openai') {
      console.log('[GoalAI] Calling OpenAI API (Responses API)...');
      fetch('https://api.openai.com/v1/responses', { // v22.18: Responses API
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: model,
          instructions: systemPrompt,
          max_output_tokens: 1024,
          input: messages,
          store: false
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        console.log('[GoalAI] OpenAI response:', data);
        if (data.output_text) { // v22.18: Responses API format
          onSuccess(data.output_text);
        } else {
          onError(data.error ? data.error.message : 'Unknown error');
        }
      })
      .catch(function(err) {
        console.error('[GoalAI] Fetch error:', err);
        onError(err.message || 'Network error');
      });
    } else {
      // Google Gemini
      console.log('[GoalAI] Calling Google Gemini API...');
      fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }]
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        console.log('[GoalAI] Gemini response:', data);
        if (data.candidates && data.candidates[0]) {
          onSuccess(data.candidates[0].content.parts[0].text);
        } else {
          onError('No response from Gemini');
        }
      })
      .catch(function(err) {
        console.error('[GoalAI] Fetch error:', err);
        onError(err.message || 'Network error');
      });
    }
  }).catch(function(err) {
    console.error('[GoalAI] Failed to get API key:', err);
    onError('Failed to retrieve API key');
  });
}

/**
 * v11.0.5: Create goal from AI suggestions
 */
function createGoalFromAI() {
  var state = window.goalCreationState;
  var titleInput = document.getElementById('goalTitleEdit');
  var title = titleInput ? titleInput.value.trim() : state.goalTitle;
  
  // Collect checked tasks
  var tasks = [];
  state.suggestedTasks.forEach(function(task, idx) {
    var checkbox = document.getElementById('goalTask' + idx);
    if (checkbox && checkbox.checked) {
      tasks.push({
        id: 'item_' + Date.now() + '_' + idx,
        text: task,
        completed: false,
        completedAt: null
      });
    }
  });
  
  if (tasks.length === 0) {
    showToast('Please select at least one task', 'warning');
    return;
  }
  
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    description: state.aiSummary,
    items: tasks,
    sections: null,
    createdAt: new Date().toISOString(),
    source: launchMode === 'life' ? 'lifeai' : 'brandai', // v11.0.5: Mode-aware source
    archived: false,
    completed: false
  };
  
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  closeNewGoalModal();
  
  // Refresh views
  if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
  if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
  if (typeof renderFocus2Categories === 'function') renderFocus2Categories();
  
  showToast('Goal "' + title + '" created with ' + tasks.length + ' tasks!', 'success');
}

/**
 * v11.0.5: Regenerate tasks for goal
 */
function regenerateGoalTasks() {
  var state = window.goalCreationState;
  var container = document.getElementById('goalChatContainer');
  var sendBtn = document.getElementById('goalChatSendBtn');
  
  // Remove the suggestion card
  var lastMessage = container.lastElementChild;
  if (lastMessage) lastMessage.remove();
  
  // Re-generate with slightly different prompt
  generateGoalSummaryAndTasks(state.userDescription + ' (please suggest different, more specific tasks)', container, sendBtn);
}

/**
 * v11.0.5: Refine goal with additional user input
 */
function refineGoalWithAI(additionalInput, container, sendBtn) {
  var state = window.goalCreationState;
  // v13.1: Use stored accent color instead of hardcoded value
  var lifeAccent = window.goalAccentColor || 'var(--life-accent, #22c55e)';
  
  // Show typing
  var typingId = 'typing_' + Date.now();
  container.innerHTML += '<div id="' + typingId + '" class="goal-chat-message goal-chat-ai">' +
    '<div style="display: flex; gap: var(--space-3);">' +
      '<div style="width: 28px; height: 28px; background: ' + lifeAccent + '; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
      '</div>' +
      '<div style="background: var(--bg-tertiary); padding: 14px 16px; border-radius: var(--radius-xl); border-top-left-radius: 4px;">' +
        '<div style="display: flex; gap: var(--space-1);">' +
          '<span style="width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></span>' +
          '<span style="width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></span>' +
          '<span style="width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both;"></span>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
  container.scrollTop = container.scrollHeight;
  
  var systemPrompt = 'You are LifeAI. The user has a goal and wants to refine it. Current goal: "' + state.goalTitle + '". Current tasks: ' + JSON.stringify(state.suggestedTasks) + '. ' +
    'Based on their feedback, update the goal. Respond in JSON: {"title": "...", "summary": "...", "tasks": [...]}';

  // v13.1: Pass conversation history for multi-turn context
  var history = state.conversationHistory || [];

  callLifeAIForGoal(systemPrompt, additionalInput, function(response) {
    var typing = document.getElementById(typingId);
    if (typing) typing.remove();

    // v13.1: Track conversation history
    if (!state.conversationHistory) state.conversationHistory = [];
    state.conversationHistory.push({ role: 'user', content: additionalInput });
    state.conversationHistory.push({ role: 'assistant', content: response });

    try {
      // v13.4: More robust JSON extraction for refine response
      var parsed = null;
      try { parsed = JSON.parse(response.trim()); } catch(e1) {}
      if (!parsed && response.indexOf('```') >= 0) {
        var codeMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeMatch) { try { parsed = JSON.parse(codeMatch[1].trim()); } catch(e2) {} }
      }
      if (!parsed) {
        var braceMatch = response.match(/\{[\s\S]*\}/);
        if (braceMatch) { try { parsed = JSON.parse(braceMatch[0]); } catch(e3) {} }
      }
      if (!parsed) throw new Error('Could not parse');
      state.aiSummary = parsed.summary || state.aiSummary;
      state.suggestedTasks = parsed.tasks || state.suggestedTasks;
      state.goalTitle = parsed.title || state.goalTitle;
      showGoalSuggestions(container, state, lifeAccent, sendBtn);
    } catch(e) {
      // Just add the new suggestions
      container.innerHTML += '<div class="goal-chat-message goal-chat-ai">' +
        '<div style="display: flex; gap: var(--space-3);">' +
          '<div style="width: 28px; height: 28px; background: ' + lifeAccent + '; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
          '</div>' +
          '<div style="background: var(--bg-tertiary); padding: 14px 16px; border-radius: var(--radius-xl); border-top-left-radius: 4px; max-width: 85%;">' +
            '<div style="font-size: var(--text-base); color: var(--text-primary); line-height: 1.5;">' + escapeHtml(response) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
    }
  }, function(error) {
    var typing = document.getElementById(typingId);
    if (typing) typing.remove();
    sendBtn.disabled = false;
    sendBtn.style.opacity = '1';
    showToast('Could not process request', 'error');
  });
}

/**
 * v11.0.5: Create new goal with categories support
 */
function createNewGoal() {
  var title = document.getElementById('newGoalTitle').value.trim();
  var itemsText = document.getElementById('newGoalItems').value.trim();
  
  if (!title) {
    showToast('Please enter a goal title', 'warning');
    return;
  }
  
  // Parse items with category support
  var sections = [];
  var currentSection = { name: null, items: [] };
  
  itemsText.split('\n').forEach(function(line) {
    line = line.trim();
    if (!line) return;
    
    // Check if this is a category header (ALL CAPS)
    if (/^[A-Z][A-Z\s&]+$/.test(line) && line.length > 2) {
      // Save previous section if it has items
      if (currentSection.items.length > 0 || currentSection.name) {
        sections.push(currentSection);
      }
      currentSection = { name: line, items: [], collapsed: false };
    } else {
      // Regular item
      currentSection.items.push({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        text: line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^\[[ x]?\]\s*/i, ''),
        completed: false,
        completedAt: null
      });
    }
  });
  
  // Don't forget last section
  if (currentSection.items.length > 0 || currentSection.name) {
    sections.push(currentSection);
  }
  
  // Flatten for backwards compatibility if no categories
  var items = [];
  sections.forEach(function(s) {
    items = items.concat(s.items);
  });
  
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    items: items,
    sections: sections.length > 1 || sections[0].name ? sections : null,
    createdAt: new Date().toISOString(),
    source: 'manual',
    archived: false,
    completed: false
  };
  
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  closeNewGoalModal();
  renderPulse3Overview();
  renderPulse3Checklists();
  showToast('Goal created!', 'success');
}

/**
 * v11.0.5: Delete a goal
 */
function deleteGoal(goalId) {
  if (!confirm('Delete this goal? This cannot be undone.')) return;

  // v25.1: Write-through delete — remove from array, save immediately
  pulseGoals = pulseGoals.filter(function(g) { return g.id !== goalId; });
  savePulseGoals(); // This now writes to both localStorage and Firestore
  renderPulse3Overview();
  renderPulse3Checklists();
  showToast('Goal deleted', 'success');
}

/**
 * v11.0.5: Delete an item from a goal
 */
function deleteGoalItem(goalId, itemId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;
  
  goal.items = goal.items.filter(function(i) { return i.id !== itemId; });
  
  // Also remove from sections if they exist
  if (goal.sections) {
    goal.sections.forEach(function(s) {
      s.items = s.items.filter(function(i) { return i.id !== itemId; });
    });
  }
  goal._modifiedAt = Date.now(); // v25.2: Stamp for merge

  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();
}

/**
 * v11.0.5: Toggle section collapse
 */
function toggleGoalSection(goalId, sectionIdx) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal || !goal.sections || !goal.sections[sectionIdx]) return;
  
  goal.sections[sectionIdx].collapsed = !goal.sections[sectionIdx].collapsed;
  savePulseGoals();
  renderPulse3Checklists();
}

/**
 * v10.6: Add item to existing goal
 * v13.1: Replaced browser prompt() with inline input field
 */
function addItemToGoal(goalId) {
  var card = document.querySelector('.pulse-3-checklist-card[data-goal-id="' + goalId + '"]');
  if (!card) return;

  // Check if inline input already exists
  if (card.querySelector('.pulse-3-add-item-inline')) return;

  var itemsContainer = card.querySelector('.pulse-3-checklist-items');
  if (!itemsContainer) return;

  var inputRow = document.createElement('div');
  inputRow.className = 'pulse-3-add-item-inline';
  inputRow.style.cssText = 'display: flex; gap: 8px; align-items: center; padding: 8px 0; margin-top: 4px;';
  inputRow.innerHTML = '<input type="text" class="pulse-3-add-item-input" placeholder="New item..." style="flex: 1; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); outline: none;">' +
    '<button class="pulse-3-add-item-confirm" style="padding: 8px 12px; background: var(--accent); border: none; border-radius: var(--radius-md); color: #fff; font-weight: 600; cursor: pointer; font-size: var(--text-sm); white-space: nowrap;">Add</button>';

  itemsContainer.appendChild(inputRow);

  var input = inputRow.querySelector('input');
  var confirmBtn = inputRow.querySelector('button');
  input.focus();

  function submitItem() {
    var text = input.value.trim();
    if (!text) {
      inputRow.remove();
      return;
    }

    var goal = pulseGoals.find(function(g) { return g.id === goalId; });
    if (!goal) return;

    if (!goal.items) goal.items = [];
    goal.items.push({
      id: 'item_' + Date.now(),
      text: text,
      completed: false,
      completedAt: null
    });
    goal._modifiedAt = Date.now(); // v25.2: Stamp for merge

    savePulseGoals();
    renderPulse3Checklists();
  }

  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') submitItem();
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') inputRow.remove();
  });
  confirmBtn.addEventListener('click', submitItem);
}

/**
 * v13.2: Show todo import panel for a goal
 */
function showTodoImportForGoal(goalId) {
  var card = document.querySelector('.pulse-3-checklist-card[data-goal-id="' + goalId + '"]');
  if (!card) return;

  // Don't add twice
  if (card.querySelector('.pulse-3-todo-import-panel')) return;

  var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  var pendingTodos = (todos || []).filter(function(t) {
    if (t.completed) return false;
    if (isLifeMode) return t.brand === '_life';
    return t.brand !== '_life';
  });

  // Group by category
  var grouped = {};
  pendingTodos.forEach(function(t) {
    var cat = t.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  var html = '<div class="pulse-3-todo-import-panel" style="margin-top: var(--space-3); padding: var(--space-4); background: var(--bg-tertiary); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">';
  html += '<div style="font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-3); display: flex; justify-content: space-between; align-items: center;">Import Tasks from Focus<button onclick="this.closest(\'.pulse-3-todo-import-panel\').remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer;">x</button></div>';

  if (pendingTodos.length === 0) {
    html += '<div style="color: var(--text-muted); font-size: var(--text-sm);">No pending tasks to import.</div>';
  } else {
    for (var cat in grouped) {
      html += '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); margin: var(--space-2) 0;">' + escapeHtml(cat) + '</div>';
      grouped[cat].forEach(function(t) {
        html += '<label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: var(--text-sm); color: var(--text-primary); cursor: pointer;">';
        html += '<input type="checkbox" class="todo-import-check" data-todo-id="' + t.id + '" style="accent-color: var(--accent);">';
        html += escapeHtml(t.text);
        html += '</label>';
      });
    }
    html += '<button class="pulse-3-btn pulse-3-btn-primary" onclick="importSelectedTodosToGoal(\'' + goalId + '\')" style="margin-top: var(--space-3);">Import Selected</button>';
  }
  html += '</div>';

  var actionsDiv = card.querySelector('.pulse-3-checklist-actions');
  if (actionsDiv) {
    actionsDiv.insertAdjacentHTML('beforebegin', html);
  } else {
    card.insertAdjacentHTML('beforeend', html);
  }
}

/**
 * v13.2: Import selected todos into a goal
 */
function importSelectedTodosToGoal(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;

  var checks = document.querySelectorAll('.todo-import-check:checked');
  if (checks.length === 0) {
    showToast('No tasks selected', 'warning');
    return;
  }

  if (!goal.items) goal.items = [];
  var count = 0;
  checks.forEach(function(cb) {
    var todoId = parseInt(cb.getAttribute('data-todo-id'));
    var todo = todos.find(function(t) { return t.id === todoId; });
    if (todo) {
      var newItem = {
        id: 'item_' + Date.now() + '_' + count,
        text: todo.text,
        completed: false,
        completedAt: null,
        sourceTodoId: todo.id,
        sourceCategory: todo.category || null
      };
      goal.items.push(newItem);
      count++;
    }
  });

  savePulseGoals();
  renderPulse3Checklists();
  showToast('Imported ' + count + ' tasks', 'success');
}

/**
 * v10.7.11: AI-powered custom LifeAI task creation with category detection
 * Uses AI to detect category from task description
 */
function createCustomLifeTask(taskDescription, callback) {
  // Category detection keywords
  var categoryKeywords = {
    'taxes': ['tax', 'irs', 'deduct', 'filing', 'return', 'w2', '1099', 'accountant'],
    'health': ['doctor', 'medical', 'dentist', 'health', 'prescription', 'medicine', 'gym', 'fitness', 'workout', 'exercise', 'wellness', 'therapy'],
    'family': ['family', 'kids', 'children', 'spouse', 'parent', 'mom', 'dad', 'sibling', 'birthday', 'anniversary'],
    'work': ['work', 'job', 'meeting', 'project', 'deadline', 'client', 'boss', 'coworker', 'presentation', 'report'],
    'finance': ['budget', 'save', 'invest', 'bill', 'payment', 'bank', 'money', 'expense', 'insurance'],
    'home': ['house', 'apartment', 'repair', 'clean', 'organize', 'furniture', 'yard', 'garden', 'maintenance'],
    'personal': ['hobby', 'read', 'learn', 'travel', 'vacation', 'self', 'goal', 'habit']
  };
  
  // Simple local category detection
  var detectedCategory = 'personal';
  var lowercaseDesc = taskDescription.toLowerCase();
  
  for (var category in categoryKeywords) {
    var keywords = categoryKeywords[category];
    for (var i = 0; i < keywords.length; i++) {
      if (lowercaseDesc.indexOf(keywords[i]) !== -1) {
        detectedCategory = category;
        break;
      }
    }
    if (detectedCategory !== 'personal') break;
  }
  
  // Try AI-powered detection if API available
  var apiKey = '';
  try {
    var encryptedKeys = localStorage.getItem('roweos_api_keys_encrypted');
    if (encryptedKeys) {
      var keys = JSON.parse(atob(encryptedKeys));
      apiKey = keys.anthropic || keys.openai || '';
    }
  } catch(e) {}
  
  if (apiKey && apiKey.length > 10) {
    // Use AI for better category detection
    var systemPrompt = 'You categorize tasks into one of these categories: taxes, health, family, work, finance, home, personal. Respond with ONLY the category name in lowercase, nothing else.';
    var userPrompt = 'Categorize this task: "' + taskDescription + '"';
    
    // Quick API call for category detection
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 20,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt
      })
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (data.content && data.content[0] && data.content[0].text) {
        var aiCategory = data.content[0].text.trim().toLowerCase();
        if (categoryKeywords[aiCategory]) {
          detectedCategory = aiCategory;
        }
      }
      callback(detectedCategory);
    })
    .catch(function() {
      callback(detectedCategory);
    });
  } else {
    // Use local detection
    callback(detectedCategory);
  }
}

/**
 * v10.7.11: Quick add task to Pulse with AI category detection
 */
function quickAddLifeTask(taskText) {
  if (!taskText || !taskText.trim()) {
    var input = prompt('What do you need to do?');
    if (!input || !input.trim()) return;
    taskText = input.trim();
  }
  
  createCustomLifeTask(taskText, function(category) {
    // Capitalize category
    var displayCategory = category.charAt(0).toUpperCase() + category.slice(1);
    
    // Create new goal with the task
    var goal = {
      id: 'goal_' + Date.now(),
      title: displayCategory + ' Task',
      category: displayCategory,
      progress: 0,
      items: [{
        id: 'item_' + Date.now(),
        text: taskText,
        completed: false
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Find existing goal in this category or create new
    var existingGoal = pulseGoals.find(function(g) { 
      return g.category === displayCategory && !g.completed && !g.archived; 
    });
    
    if (existingGoal) {
      // Add to existing category goal
      if (!existingGoal.items) existingGoal.items = [];
      existingGoal.items.push({
        id: 'item_' + Date.now(),
        text: taskText,
        completed: false
      });
      existingGoal.updatedAt = Date.now();
      existingGoal._modifiedAt = Date.now(); // v25.2: Stamp for merge
    } else {
      // Create new goal
      pulseGoals.push(goal);
    }
    
    savePulseGoals();
    renderPulse3Checklists();
    showToast('Added to ' + displayCategory + ': ' + taskText.substring(0, 30) + (taskText.length > 30 ? '...' : ''), 'success');
  });
}

/**
 * v22.41: Pulse goal dropdown toggle (mirrors Rhythm pattern)
 */
function togglePulseGoalDropdown() {
  var dd = document.getElementById('pulseGoalDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    // Close on outside click
    setTimeout(function() {
      function closeHandler(e) {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          document.removeEventListener('click', closeHandler);
        }
      }
      document.addEventListener('click', closeHandler);
    }, 10);
  }
}
function closePulseGoalDropdown() {
  var dd = document.getElementById('pulseGoalDropdown');
  if (dd) dd.classList.remove('open');
}

/**
 * v22.41: Create inline goal card (Quick Goal — no AI)
 */
function createInlineGoal() {
  var container = document.getElementById('pulse3Checklists');
  if (!container) return;
  // Don't add twice
  if (container.querySelector('.pulse-3-inline-goal')) return;

  var card = document.createElement('div');
  card.className = 'pulse-3-inline-goal';
  card.innerHTML = '<input type="text" class="pulse-3-inline-goal-title" placeholder="Goal title..." autofocus>' +
    '<div class="pulse-3-inline-goal-items" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;"></div>' +
    '<div style="display:flex;gap:8px;margin-top:12px;">' +
      '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="addInlineGoalTask(this.closest(\'.pulse-3-inline-goal\'))">+ Add Task</button>' +
      '<button class="pulse-3-btn pulse-3-btn-primary" onclick="saveInlineGoal(this.closest(\'.pulse-3-inline-goal\'))">Save Goal</button>' +
      '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="this.closest(\'.pulse-3-inline-goal\').remove()">Cancel</button>' +
    '</div>';

  container.insertBefore(card, container.firstChild);
  var titleInput = card.querySelector('.pulse-3-inline-goal-title');
  if (titleInput) {
    titleInput.focus();
    titleInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addInlineGoalTask(card);
      }
    });
  }
}

function addInlineGoalTask(card) {
  if (!card) return;
  var itemsDiv = card.querySelector('.pulse-3-inline-goal-items');
  if (!itemsDiv) return;
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;';
  row.innerHTML = '<div style="width:16px;height:16px;border:1.5px solid var(--border-color);border-radius:4px;flex-shrink:0;"></div>' +
    '<input type="text" placeholder="Task..." style="flex:1;padding:6px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-sm);outline:none;">' +
    '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">x</button>';
  itemsDiv.appendChild(row);
  var inp = row.querySelector('input');
  if (inp) {
    inp.focus();
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addInlineGoalTask(card);
      }
    });
  }
}

function saveInlineGoal(card) {
  if (!card) return;
  var titleInput = card.querySelector('.pulse-3-inline-goal-title');
  var title = titleInput ? titleInput.value.trim() : '';
  if (!title) {
    showToast('Please enter a goal title', 'warning');
    if (titleInput) titleInput.focus();
    return;
  }

  var taskInputs = card.querySelectorAll('.pulse-3-inline-goal-items input');
  var items = [];
  for (var i = 0; i < taskInputs.length; i++) {
    var text = taskInputs[i].value.trim();
    if (text) {
      items.push({
        id: 'item_' + Date.now() + '_' + i,
        text: text,
        completed: false,
        completedAt: null
      });
    }
  }

  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    items: items,
    sections: null,
    createdAt: new Date().toISOString(),
    source: currentMode === 'life' ? 'lifeai' : 'manual',
    archived: false,
    completed: false
  };

  pulseGoals.unshift(newGoal);
  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();
  showToast('Goal created!', 'success');
}

/**
 * v28.4: Create a Pulse goal from automation or AI chat
 * @param {Object} goalData - { title, description, items: string[] }
 * @returns {string} Created goal ID
 */
function createPulseGoalFromAutomation(goalData) {
  if (!goalData || !goalData.title) {
    console.warn('[Pulse] createPulseGoalFromAutomation: no title provided');
    return null;
  }
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var items = [];
  if (goalData.items && Array.isArray(goalData.items)) {
    goalData.items.forEach(function(taskText, idx) {
      if (typeof taskText === 'string' && taskText.trim()) {
        items.push({
          id: 'item_' + Date.now() + '_' + idx,
          text: taskText.trim(),
          completed: false,
          completedAt: null
        });
      }
    });
  }
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: goalData.title.trim(),
    description: goalData.description || '',
    items: items,
    sections: null,
    createdAt: new Date().toISOString(),
    _modifiedAt: Date.now(),
    source: currentMode === 'life' ? 'lifeai' : 'automation',
    archived: false,
    completed: false
  };
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
  if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
  console.log('[Pulse] Goal created from automation:', newGoal.id, newGoal.title);
  return newGoal.id;
}

/**
 * v28.4: Check AI chat response for goal creation blocks
 * Looks for ```pulse_goal JSON blocks in the response and offers to create them.
 * Called from both LifeAI and BrandAI onComplete handlers.
 */
function checkForPulseGoalInResponse(streamContainer, fullText) {
  if (!streamContainer || !fullText) return;
  // Match ```pulse_goal ... ``` blocks
  var goalMatch = fullText.match(/```pulse_goal\s*([\s\S]*?)```/);
  if (!goalMatch) return;
  var goalJson = null;
  try { goalJson = JSON.parse(goalMatch[1].trim()); } catch(e) {
    console.warn('[Pulse] Could not parse pulse_goal JSON:', e.message);
    return;
  }
  if (!goalJson || !goalJson.title) return;
  // Build an action bar similar to checkForSaveToIdentity
  var actionBar = document.createElement('div');
  actionBar.style.cssText = 'margin-top: 12px; padding: 12px 16px; background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; gap: 12px;';
  var itemCount = (goalJson.items && Array.isArray(goalJson.items)) ? goalJson.items.length : 0;
  var infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1;';
  infoDiv.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a89878" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>' +
    '<div style="flex: 1;">' +
      '<div style="font-weight: 500; color: var(--text-primary); font-size: var(--text-sm);">Add goal to Pulse?</div>' +
      '<div style="font-size: var(--text-xs); color: var(--text-muted);">"' + escapeHtml(goalJson.title) + '" with ' + itemCount + ' task(s)</div>' +
    '</div>';
  var btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display: flex; gap: 8px;';
  var dismissBtn = document.createElement('button');
  dismissBtn.style.cssText = 'padding: 6px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; font-size: var(--text-sm);';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.onclick = function() { actionBar.remove(); };
  var addBtn = document.createElement('button');
  addBtn.style.cssText = 'padding: 6px 12px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: var(--accent-text, #fff); cursor: pointer; font-size: var(--text-sm); font-weight: 500;';
  addBtn.textContent = 'Add to Pulse';
  addBtn.onclick = function() {
    var goalId = createPulseGoalFromAutomation(goalJson);
    if (goalId) {
      addBtn.disabled = true;
      addBtn.textContent = 'Added';
      addBtn.style.opacity = '0.6';
      dismissBtn.style.display = 'none';
      showToast('Goal added to Pulse', 'success');
    } else {
      showToast('Failed to create goal', 'error');
    }
  };
  btnGroup.appendChild(dismissBtn);
  btnGroup.appendChild(addBtn);
  actionBar.appendChild(infoDiv);
  actionBar.appendChild(btnGroup);
  // Find the bubble to append to
  var bubble = streamContainer.closest('.conversation-message-bubble');
  if (bubble) {
    bubble.appendChild(actionBar);
  } else {
    streamContainer.appendChild(actionBar);
  }
}

/**
 * v29.0: Add a pending pulse goal from an inline chat card
 * Called from the formatted pulse_goal card buttons rendered by formatMessageContent()
 */
function addPendingPulseGoal(goalId, btn) {
  var goalData = window._pendingPulseGoals && window._pendingPulseGoals[goalId];
  if (!goalData) { showToast('Could not find goal data', 'error'); return; }
  var created = createPulseGoalFromAutomation(goalData);
  if (created) {
    btn.textContent = 'Added';
    btn.style.background = '#22c55e';
    btn.style.borderColor = '#22c55e';
    btn.style.color = '#fff';
    btn.style.pointerEvents = 'none';
    var dismissBtn = btn.nextElementSibling;
    if (dismissBtn) dismissBtn.style.display = 'none';
    showToast('Goal added to Pulse', 'success');
  } else {
    showToast('Failed to create goal', 'error');
  }
}

/**
 * v28.4: Motivate Me - pick an active goal and send a motivational prompt to agent chat
 */
function motivateMe() {
  var activeGoals = pulseGoals.filter(function(g) {
    return !g.archived && !g.completed;
  });

  if (activeGoals.length === 0) {
    showToast('No active goals to motivate you on. Create a goal first!', 'warning');
    return;
  }

  // Build picker modal
  var overlay = document.createElement('div');
  overlay.id = 'motivateMeOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:24px;max-width:480px;width:90%;max-height:70vh;overflow-y:auto;';

  var header = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' +
    '<div>' +
      '<div style="font-weight:600;font-size:var(--text-lg);color:var(--text-primary);">Motivate Me</div>' +
      '<div style="font-size:var(--text-sm);color:var(--text-muted);">Pick a goal to get motivated on</div>' +
    '</div>' +
  '</div>';

  var goalListHtml = activeGoals.map(function(goal) {
    var allItems = [];
    if (goal.sections && goal.sections.length > 0) {
      goal.sections.forEach(function(s) { if (s.items) allItems = allItems.concat(s.items); });
    }
    if ((!goal.sections || goal.sections.length === 0) && goal.items) {
      allItems = allItems.concat(goal.items);
    }
    var total = allItems.length;
    var done = allItems.filter(function(i) { return i.completed; }).length;
    var progress = total > 0 ? Math.round((done / total) * 100) : 0;
    var remaining = total - done;

    return '<div class="motivate-me-goal-item" onclick="selectMotivateGoal(\'' + goal.id + '\')" ' +
      'style="padding:12px 16px;border:1px solid var(--border-color);border-radius:var(--radius-md);cursor:pointer;margin-bottom:8px;transition:background 0.15s,border-color 0.15s;" ' +
      'onmouseover="this.style.background=\'var(--bg-tertiary)\';this.style.borderColor=\'var(--accent)\'" ' +
      'onmouseout="this.style.background=\'transparent\';this.style.borderColor=\'var(--border-color)\'">' +
      '<div style="font-weight:500;color:var(--text-primary);font-size:var(--text-base);margin-bottom:4px;">' + escapeHtml(goal.title) + '</div>' +
      (goal.description ? '<div style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:6px;line-height:1.4;">' + escapeHtml(goal.description).substring(0, 120) + (goal.description.length > 120 ? '...' : '') + '</div>' : '') +
      '<div style="display:flex;align-items:center;gap:8px;font-size:var(--text-xs);color:var(--text-muted);">' +
        '<div style="flex:1;height:4px;background:var(--bg-primary);border-radius:2px;overflow:hidden;">' +
          '<div style="height:100%;width:' + progress + '%;background:var(--accent);border-radius:2px;transition:width 0.3s;"></div>' +
        '</div>' +
        '<span>' + done + '/' + total + '</span>' +
        (remaining > 0 ? '<span style="color:var(--text-secondary);">' + remaining + ' remaining</span>' : '<span style="color:var(--accent);">All done!</span>') +
      '</div>' +
    '</div>';
  }).join('');

  var cancelBtn = '<div style="text-align:right;margin-top:12px;">' +
    '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="document.getElementById(\'motivateMeOverlay\').remove()">Cancel</button>' +
  '</div>';

  modal.innerHTML = header + goalListHtml + cancelBtn;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * v28.4: Handle goal selection from Motivate Me picker
 */
function selectMotivateGoal(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) {
    showToast('Goal not found', 'error');
    return;
  }

  // Close the picker
  var overlay = document.getElementById('motivateMeOverlay');
  if (overlay) overlay.remove();

  // Gather goal details for the prompt
  var allItems = [];
  if (goal.sections && goal.sections.length > 0) {
    goal.sections.forEach(function(s) {
      if (s.items) {
        s.items.forEach(function(item) {
          allItems.push({ text: item.text, completed: item.completed, section: s.name });
        });
      }
    });
  }
  if ((!goal.sections || goal.sections.length === 0) && goal.items) {
    goal.items.forEach(function(item) {
      allItems.push({ text: item.text, completed: item.completed, section: null });
    });
  }

  var completedItems = allItems.filter(function(i) { return i.completed; });
  var remainingItems = allItems.filter(function(i) { return !i.completed; });

  var prompt = 'Help me get started with my goal: ' + goal.title + '.';
  if (goal.description) {
    prompt += '\n\nGoal description: ' + goal.description;
  }
  if (remainingItems.length > 0) {
    prompt += '\n\nRemaining tasks (' + remainingItems.length + '):';
    remainingItems.forEach(function(item) {
      prompt += '\n- ' + item.text + (item.section ? ' (' + item.section + ')' : '');
    });
  }
  if (completedItems.length > 0) {
    prompt += '\n\nAlready completed (' + completedItems.length + '):';
    completedItems.forEach(function(item) {
      prompt += '\n- ' + item.text;
    });
  }
  prompt += '\n\nGive me motivation, a game plan, and actionable first steps to make progress right now.';

  // Navigate to agent chat and auto-send
  showView('agent');
  setTimeout(function() {
    var input = document.getElementById('agentCommand');
    if (input) {
      input.value = prompt;
      // Trigger auto-resize if textarea
      if (input.tagName === 'TEXTAREA') {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
      }
      // Auto-send
      if (typeof runAgent === 'function') {
        runAgent();
      }
    }
  }, 300);
}

/**
 * v22.41: Inline goal title editing — click to edit
 */
function editGoalTitleInline(el, goalId) {
  if (!el || el.contentEditable === 'true') return;
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;

  el.contentEditable = 'true';
  el.focus();
  // Select all text
  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function save() {
    el.contentEditable = 'false';
    var newTitle = el.textContent.trim();
    if (newTitle && newTitle !== goal.title) {
      goal.title = newTitle;
      savePulseGoals();
    } else {
      el.textContent = goal.title;
    }
    el.removeEventListener('blur', save);
    el.removeEventListener('keydown', handleKey);
  }
  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = goal.title; el.blur(); }
  }
  el.addEventListener('blur', save);
  el.addEventListener('keydown', handleKey);
}

/**
 * v22.41: Inline task text editing — click to edit
 */
function editTaskInline(el, goalId, itemId) {
  if (!el || el.contentEditable === 'true') return;
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;

  // Find item in flat items or sections
  var item = null;
  if (goal.items) item = goal.items.find(function(i) { return i.id === itemId; });
  if (!item && goal.sections) {
    for (var s = 0; s < goal.sections.length; s++) {
      if (goal.sections[s].items) {
        item = goal.sections[s].items.find(function(i) { return i.id === itemId; });
        if (item) break;
      }
    }
  }
  if (!item) return;

  el.contentEditable = 'true';
  el.focus();
  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function save() {
    el.contentEditable = 'false';
    var newText = el.textContent.trim();
    if (newText && newText !== item.text) {
      item.text = newText;
      savePulseGoals();
    } else {
      el.textContent = item.text;
    }
    el.removeEventListener('blur', save);
    el.removeEventListener('keydown', handleKey);
  }
  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = item.text; el.blur(); }
  }
  el.addEventListener('blur', save);
  el.addEventListener('keydown', handleKey);
}

/**
 * v22.41: AI-generate recommended tasks for a goal based on its title
 */
function generateAITasksForGoal(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;

  // Find the button and show loading state
  var card = document.querySelector('.pulse-3-checklist-card[data-goal-id="' + goalId + '"]');
  if (!card) return;
  var aiBtn = card.querySelector('.pulse-3-ai-suggest-btn');
  if (aiBtn) {
    aiBtn.disabled = true;
    aiBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Thinking...';
  }

  var existingTasks = (goal.items || []).map(function(i) { return i.text; }).join(', ');
  var isLife = goal.source === 'lifeai';
  var context = isLife ? getLifeIdentityContextForGoals() : getBrandContextForGoals();

  var systemPrompt = 'You are a goal planning assistant. Given a goal title and any existing tasks, suggest 5-8 new actionable tasks that would help complete this goal. Return ONLY a JSON array of strings, no other text. Each task should be concise and actionable. Never use em-dashes.';
  var userPrompt = 'Goal: "' + goal.title + '"';
  if (existingTasks) userPrompt += '\nExisting tasks: ' + existingTasks;
  if (context) userPrompt += context;
  userPrompt += '\n\nReturn a JSON array of 5-8 recommended task strings.';

  callLifeAIForGoal(
    systemPrompt,
    userPrompt,
    function(responseText) {
      // Parse JSON array from response
      var tasks = [];
      try {
        // Try direct parse
        tasks = JSON.parse(responseText);
      } catch(e) {
        // Try extracting JSON from markdown
        var jsonMatch = responseText.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          try { tasks = JSON.parse(jsonMatch[0]); } catch(e2) {}
        }
      }

      if (!Array.isArray(tasks) || tasks.length === 0) {
        showToast('Could not parse AI suggestions', 'warning');
        if (aiBtn) {
          aiBtn.disabled = false;
          aiBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg> AI Tasks';
        }
        return;
      }

      if (!goal.items) goal.items = [];
      var count = 0;
      tasks.forEach(function(taskText, idx) {
        if (typeof taskText === 'string' && taskText.trim()) {
          goal.items.push({
            id: 'item_' + Date.now() + '_' + idx,
            text: taskText.trim(),
            completed: false,
            completedAt: null
          });
          count++;
        }
      });

      savePulseGoals();
      renderPulse3Overview();
      renderPulse3Checklists();
      showToast('Added ' + count + ' AI-generated tasks', 'success');
    },
    function(err) {
      showToast('AI task generation failed: ' + (err || 'Unknown error'), 'error');
      if (aiBtn) {
        aiBtn.disabled = false;
        aiBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg> AI Tasks';
      }
    }
  );
}

/**
 * v10.6: Edit goal (legacy — kept for backward compatibility)
 */
function editGoal(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;

  var newTitle = prompt('Edit goal title:', goal.title);
  if (newTitle && newTitle.trim()) {
    goal.title = newTitle.trim();
    savePulseGoals();
    renderPulse3Checklists();
  }
}

/**
 * v10.6: Complete goal
 */
function completeGoal(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;
  
  goal.completed = true;
  goal.completedAt = new Date().toISOString();
  goal._modifiedAt = Date.now(); // v25.2: Stamp for merge

  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();
  showToast('Goal completed!', 'success');
}

/**
 * v10.6: Import checklist from chat response
 */
function importChecklistFromChat(title, items, source, rawText) {
  // v11.0.5: Parse categories from raw text if provided
  var sections = null;
  var flatItems = [];
  
  if (rawText) {
    // Parse raw text for sections (ALL CAPS headers)
    var result = parseChecklistWithSections(rawText);
    if (result.sections && result.sections.length > 0) {
      sections = result.sections;
      // Flatten items for backwards compatibility
      result.sections.forEach(function(s) {
        flatItems = flatItems.concat(s.items);
      });
    }
  }
  
  // If no sections parsed, use flat items
  if (!sections || sections.length === 0) {
    flatItems = items.map(function(text, idx) {
      return {
        id: 'item_' + Date.now() + '_' + idx,
        text: text.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^\[[ x]?\]\s*/i, ''),
        completed: false,
        completedAt: null
      };
    });
  }
  
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    items: flatItems,
    sections: sections,
    createdAt: new Date().toISOString(),
    source: source || (launchMode === 'life' ? 'lifeai' : 'brandai'), // v11.0.5: Mode-aware default
    archived: false,
    completed: false
  };
  
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  showToast('Checklist added to Pulse!', 'success');
  
  // Refresh if on Pulse view
  if (currentView === 'pulse') {
    renderPulse3Overview();
    renderPulse3Checklists();
  }
}

/**
 * v11.0.5: Parse checklist text with ALL CAPS section headers
 */
function parseChecklistWithSections(text) {
  var sections = [];
  var currentSection = { name: null, items: [], collapsed: false };
  var lines = text.split('\n');
  
  // Patterns for section headers (ALL CAPS, bold markdown, or ## headers)
  var sectionPattern = /^(?:\*\*)?([A-Z][A-Z\s&]+)(?:\*\*)?$/;
  var mdHeaderPattern = /^##?\s+(.+)$/;
  
  // Item patterns
  var itemPatterns = [
    /^\s*[-•*]\s+\[[ x]?\]\s*(.+)$/i,
    /^\s*[-•*]\s+(.+)$/,
    /^\s*\d+\.\s+(.+)$/,
    /^\s*\[[ x]?\]\s+(.+)$/i
  ];
  
  lines.forEach(function(line) {
    line = line.trim();
    if (!line) return;
    
    // Check for section header
    var sectionMatch = line.match(sectionPattern);
    if (sectionMatch && sectionMatch[1].length > 3) {
      // Save previous section if has items
      if (currentSection.items.length > 0 || currentSection.name) {
        sections.push(currentSection);
      }
      currentSection = { 
        name: sectionMatch[1].trim(), 
        items: [], 
        collapsed: false 
      };
      return;
    }
    
    // Check for markdown header
    var mdMatch = line.match(mdHeaderPattern);
    if (mdMatch && /^[A-Z]/.test(mdMatch[1])) {
      if (currentSection.items.length > 0 || currentSection.name) {
        sections.push(currentSection);
      }
      currentSection = { 
        name: mdMatch[1].trim(), 
        items: [], 
        collapsed: false 
      };
      return;
    }
    
    // Check for item
    for (var i = 0; i < itemPatterns.length; i++) {
      var itemMatch = line.match(itemPatterns[i]);
      if (itemMatch && itemMatch[1] && itemMatch[1].trim().length > 0) {
        currentSection.items.push({
          id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          text: itemMatch[1].trim(),
          completed: false,
          completedAt: null
        });
        break;
      }
    }
  });
  
  // Don't forget last section
  if (currentSection.items.length > 0 || currentSection.name) {
    sections.push(currentSection);
  }
  
  // If only one unnamed section, return as flat items
  if (sections.length === 1 && !sections[0].name) {
    return { sections: null, items: sections[0].items };
  }
  
  return { sections: sections.length > 0 ? sections : null };
}

/**
 * v10.6: Import checklist from Studio output
 */
function importChecklistFromStudio() {
  var title = window._pendingChecklistTitle || 'Studio Checklist';
  var items = window._pendingChecklistItems || [];
  var rawText = window._pendingChecklistRawText || null;
  
  if (items.length === 0) {
    showToast('No checklist items found', 'error');
    return;
  }
  
  importChecklistFromChat(title, items, 'studio', rawText);
  
  // Update button
  var btns = document.querySelectorAll('.chat-checklist-import-btn');
  btns.forEach(function(btn) {
    btn.innerHTML = '✓ Added to Pulse';
    btn.disabled = true;
    btn.style.opacity = '0.6';
  });
  
  // Clear pending
  window._pendingChecklistItems = null;
  window._pendingChecklistTitle = null;
  window._pendingChecklistRawText = null;
}

/**
 * v15.22: Show multi-select overlay for Pulse import instead of importing all items
 */
function showPulseImportSelector(items, title, source, rawText) {
  // Remove existing overlay if any
  var existing = document.querySelector('.pulse-import-overlay');
  if (existing) existing.remove();

  // Action-verb detection for smart pre-checking
  var actionVerbs = /^(add|create|set up|schedule|buy|order|contact|call|email|send|write|update|review|check|research|book|reserve|plan|prepare|draft|submit|file|register|sign|clean|organize|arrange|complete|finish|design|build|install|configure|launch|test|measure|track|monitor|follow up|reach out)/i;

  var overlay = document.createElement('div');
  overlay.className = 'pulse-import-overlay';

  var listHtml = '';
  items.forEach(function(item, idx) {
    var cleanItem = item.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^\[[ x]?\]\s*/i, '').trim();
    var isAction = actionVerbs.test(cleanItem);
    listHtml += '<div class="pulse-import-item">' +
      '<input type="checkbox" id="pulseImport_' + idx + '" ' + (isAction ? 'checked' : '') + ' onchange="updatePulseImportCount()">' +
      '<label for="pulseImport_' + idx + '">' + escapeHtml(cleanItem) + '</label>' +
      '</div>';
  });

  var checkedCount = items.filter(function(item) {
    return actionVerbs.test(item.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^\[[ x]?\]\s*/i, '').trim());
  }).length;

  overlay.innerHTML = '<div class="pulse-import-panel">' +
    '<div class="pulse-import-header">' +
      '<h3>Add to Pulse</h3>' +
      '<p>Select which items to import as tasks</p>' +
    '</div>' +
    '<div class="pulse-import-actions">' +
      '<button onclick="toggleAllPulseImportItems(true)">Select All</button>' +
      '<button onclick="toggleAllPulseImportItems(false)">Deselect All</button>' +
    '</div>' +
    '<div class="pulse-import-list">' + listHtml + '</div>' +
    '<div class="pulse-import-footer">' +
      '<span class="pulse-import-count" id="pulseImportCount">' + checkedCount + ' of ' + items.length + ' selected</span>' +
      '<div class="pulse-import-btns">' +
        '<button onclick="this.closest(\'.pulse-import-overlay\').remove()">Cancel</button>' +
        '<button class="primary" onclick="confirmPulseImport(\'' + source + '\')">Add to Pulse</button>' +
      '</div>' +
    '</div>' +
    '</div>';

  // Store data for confirm
  window._pulseImportData = { items: items, title: title, rawText: rawText };

  document.body.appendChild(overlay);

  // Close on overlay background click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

function toggleAllPulseImportItems(checked) {
  var checkboxes = document.querySelectorAll('.pulse-import-item input[type="checkbox"]');
  checkboxes.forEach(function(cb) { cb.checked = checked; });
  updatePulseImportCount();
}

function updatePulseImportCount() {
  var total = document.querySelectorAll('.pulse-import-item input[type="checkbox"]').length;
  var checked = document.querySelectorAll('.pulse-import-item input[type="checkbox"]:checked').length;
  var countEl = document.getElementById('pulseImportCount');
  if (countEl) countEl.textContent = checked + ' of ' + total + ' selected';
}

function confirmPulseImport(source) {
  var data = window._pulseImportData;
  if (!data) return;

  var selectedItems = [];
  var checkboxes = document.querySelectorAll('.pulse-import-item input[type="checkbox"]');
  checkboxes.forEach(function(cb, idx) {
    if (cb.checked && data.items[idx]) {
      selectedItems.push(data.items[idx]);
    }
  });

  if (selectedItems.length === 0) {
    showToast('No items selected', 'info');
    return;
  }

  importChecklistFromChat(data.title, selectedItems, source, data.rawText);

  // Close overlay
  var overlay = document.querySelector('.pulse-import-overlay');
  if (overlay) overlay.remove();
  window._pulseImportData = null;
}

/**
 * v10.6: Detect checklist content in AI response
 */
/**
 * v11.0.5: Smart checklist detection - only triggers for genuinely actionable content
 * Reduced false positives by requiring stronger signals
 */
function detectChecklistInResponse(text) {
  // v11.0.5: First check if we've already shown "Add to Pulse" in this conversation
  // Only show once per conversation unless content is strongly actionable
  var conversationKey = 'roweos_pulse_shown_' + (window.currentActiveRunId || 'chat');
  var alreadyShown = sessionStorage.getItem(conversationKey);
  
  // Strong action-oriented title patterns (required for first-time show)
  var strongPatterns = [
    /here['']?s (?:a |your |the )?(?:checklist|to-do list|action items|action plan|task list)/i,
    /(?:checklist|to-do|action items|action plan|task list|next steps):/i,
    /(?:your |the )?(?:tasks|things to do|action items) (?:for|to|are)/i,
    /let['']?s break (?:this|it) (?:down|into)/i,
    /here are (?:the |your )?(?:steps|tasks|action items)/i
  ];
  
  var hasStrongPattern = false;
  for (var i = 0; i < strongPatterns.length; i++) {
    if (strongPatterns[i].test(text)) {
      hasStrongPattern = true;
      break;
    }
  }
  
  // If already shown in this conversation, require VERY strong pattern
  if (alreadyShown && !hasStrongPattern) {
    return false;
  }
  
  // Count potential action items (bullet points or numbered items)
  var bulletCount = (text.match(/\n\s*[-•*]\s+.+/g) || []).length;
  var numberCount = (text.match(/\n\s*\d+\.\s+.+/g) || []).length;
  var checkboxCount = (text.match(/\[\s*\]\s+.+/g) || []).length;
  var totalItems = Math.max(bulletCount, numberCount) + checkboxCount;
  
  // Require at least 3 items for non-strong patterns
  if (!hasStrongPattern && totalItems < 3) {
    return false;
  }
  
  // Check if items look like actions (verbs at start)
  var actionVerbs = /^\s*[-•*\d.[\]]+\s*(?:set|create|make|write|build|complete|finish|schedule|call|email|send|review|update|check|add|remove|organize|plan|prepare|research|buy|order|contact|follow|submit|apply|book|confirm)/im;
  var hasActionVerbs = actionVerbs.test(text);
  
  // Decision: need strong pattern OR (enough items AND action verbs)
  if (hasStrongPattern || (totalItems >= 3 && hasActionVerbs)) {
    // Mark as shown for this conversation
    sessionStorage.setItem(conversationKey, 'true');
    return true;
  }
  
  return false;
}

/**
 * v11.0.5: Reset pulse shown flag when starting new conversation
 */
function resetPulseShownFlag() {
  // Clear all pulse shown flags from session storage
  Object.keys(sessionStorage).forEach(function(key) {
    if (key.startsWith('roweos_pulse_shown_')) {
      sessionStorage.removeItem(key);
    }
  });
}

/**
 * v10.6: Extract checklist items from text
 */
function extractChecklistItems(text) {
  var items = [];
  var lines = text.split('\n');
  
  // Look for bullet points, numbers, or checkbox format
  var itemPatterns = [
    /^\s*[-•*]\s+(.+)$/,
    /^\s*\d+\.\s+(.+)$/,
    /^\s*\[[ x]?\]\s+(.+)$/i
  ];
  
  lines.forEach(function(line) {
    for (var i = 0; i < itemPatterns.length; i++) {
      var match = line.match(itemPatterns[i]);
      if (match && match[1] && match[1].trim().length > 0) {
        items.push(match[1].trim());
        break;
      }
    }
  });
  
  return items;
}

/**
 * v10.6: Extract checklist title from text
 */
function extractChecklistTitle(text) {
  // Look for title patterns
  var patterns = [
    /(?:here['']?s (?:a |your |the )?)?(?:checklist|to-do list|action items|tasks)[:\s]+["']?([^"'\n]+)["']?/i,
    /^#+\s*(.+)$/m,
    /^\*\*(.+)\*\*$/m
  ];
  
  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }
  
  return 'Imported Checklist';
}

