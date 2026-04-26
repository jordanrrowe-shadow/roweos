// ═══════════════════════════════════════════════════════════════
// LAUNCH SCREEN - v2.0.2
// ═══════════════════════════════════════════════════════════════

function showLaunchScreen() {
  // Hide welcome screen
  hideWelcomeScreen();
  
  // Show launch screen
  var screen = document.getElementById('launchScreen');
  if (screen) {
    screen.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

// Quick launch directly from welcome screen feature cards
function quickLaunch(viewName) {
  console.log('=== Quick launching to view: ' + viewName + ' ===');
  
  // Mark as welcomed
  markWelcomed();
  
  // Hide welcome screen
  hideWelcomeScreen();
  
  // Hide onboarding if showing
  var onboarding = document.getElementById('onboardingView');
  if (onboarding) {
    onboarding.classList.add('hidden');
  }
  
  // Navigate directly to the requested view
  showView(viewName);
}

function hideLaunchScreen() {
  var screen = document.getElementById('launchScreen');
  if (screen) {
    screen.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function launchDashboard() {
  hideLaunchScreen();
  
  // Make sure onboarding is hidden
  var onboarding = document.getElementById('onboardingView');
  if (onboarding) {
    onboarding.classList.add('hidden');
  }
  
  // Show the main dashboard
  showView('pulse'); // v28.8: signal retired, redirect to pulse
}

// ═══════════════════════════════════════════════════════════════════════════
// v10.2: UNIFIED LAUNCH MODE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Current launch mode: 'brand' or 'life'
var launchMode = 'brand';

// Initialize launch mode from localStorage
function initLaunchMode() {
  var savedMode = localStorage.getItem('roweos_launch_mode');
  if (savedMode === 'life' || savedMode === 'brand') {
    launchMode = savedMode;
    // v12.2.4: Sync mode keys so getCurrentMode() returns correct value
    localStorage.setItem('roweos_app_mode', savedMode);
    localStorage.setItem('roweos_mode', savedMode);
  }
  updateLaunchModeUI();
}

// Set launch mode and update UI
function setLaunchMode(mode) {
  if (mode !== 'brand' && mode !== 'life') return;
  
  launchMode = mode;
  localStorage.setItem('roweos_launch_mode', mode);
  updateLaunchModeUI();
  
  // v10.5.25: Sync mode to localStorage (don't overwrite isLifeMode function)
  if (mode === 'life') {
    localStorage.setItem('roweos_life_mode', 'true');
    localStorage.setItem('roweos_app_mode', 'life');
    localStorage.setItem('roweos_mode', 'life');
  } else {
    localStorage.setItem('roweos_life_mode', 'false');
    localStorage.setItem('roweos_app_mode', 'brand');
    localStorage.setItem('roweos_mode', 'brand');
  }
}

// Update all launch screen elements based on mode
function updateLaunchModeUI() {
  var launchScreen = document.getElementById('launchScreen');
  var brandBtn = document.getElementById('brandModeBtn');
  var lifeBtn = document.getElementById('lifeModeBtn');
  var subtitle = document.getElementById('launchSubtitle');
  var description = document.getElementById('launchDescription');
  var chatTitle = document.getElementById('launchOptionChatTitle');
  var chatDesc = document.getElementById('launchOptionChatDesc');
  var focusDesc = document.getElementById('launchOptionFocusDesc');
  var studioDesc = document.getElementById('launchOptionStudioDesc');
  
  if (!launchScreen) return;
  
  if (launchMode === 'life') {
    // Life mode styling
    launchScreen.classList.add('life-mode');
    if (brandBtn) brandBtn.classList.remove('active');
    if (lifeBtn) lifeBtn.classList.add('active');
    
    // Update text content
    if (subtitle) subtitle.textContent = 'LIFE INTELLIGENCE PLATFORM';
    if (description) description.textContent = 'RoweOS connects your personal life with leading AI providers to power intelligent task management, life organization, and personal productivity.';
    if (chatTitle) chatTitle.textContent = 'LifeAI';
    if (chatDesc) chatDesc.textContent = 'Talk with your personal life assistant';
    // v10.5.25: Keep sparkle icon for both modes
    if (focusDesc) focusDesc.textContent = 'Explore your personal intelligence dashboard';
    if (studioDesc) studioDesc.textContent = 'Generate content using specialized life operations';
    
  } else {
    // Brand mode styling
    launchScreen.classList.remove('life-mode');
    if (brandBtn) brandBtn.classList.add('active');
    if (lifeBtn) lifeBtn.classList.remove('active');
    
    // Update text content
    if (subtitle) subtitle.textContent = 'BRAND INTELLIGENCE PLATFORM';
    if (description) description.textContent = 'RoweOS connects your brands with leading AI providers to power intelligent content generation, brand strategy, and operational excellence.';
    if (chatTitle) chatTitle.textContent = 'BrandAI';
    if (chatDesc) chatDesc.textContent = 'Talk with your brand agent';
    // v10.5.25: Keep sparkle icon for both modes
    if (focusDesc) focusDesc.textContent = 'Explore your brand intelligence dashboard';
    if (studioDesc) studioDesc.textContent = 'Generate content using specialized agent operations';
  }
}

function launchToView(viewName) {
  hideLaunchScreen();
  
  // v10.5.25: Sync mode before launching (don't overwrite isLifeMode function)
  if (launchMode === 'life') {
    localStorage.setItem('roweos_life_mode', 'true');
    localStorage.setItem('roweos_app_mode', 'life');
    localStorage.setItem('roweos_mode', 'life');
  } else {
    localStorage.setItem('roweos_life_mode', 'false');
    localStorage.setItem('roweos_app_mode', 'brand');
    localStorage.setItem('roweos_mode', 'brand');
  }
  
  // v10.5.25: Update all UI elements for the selected mode
  if (typeof updateModeUI === 'function') {
    updateModeUI(launchMode);
  }
  
  // Update mobile header mode label if visible
  if (typeof updateMobileModeLabel === 'function') {
    updateMobileModeLabel();
  }
  
  // Make sure onboarding is hidden
  var onboarding = document.getElementById('onboardingView');
  if (onboarding) {
    onboarding.classList.add('hidden');
  }
  
  // Hide onboarding modal
  hideOnboarding();
  
  // Show the requested view
  showView(viewName);
}

// Explore RoweOS - skip onboarding and go straight to chat
function exploreRoweOS() {
  hideLaunchScreen();
  
  // v10.5.25: Sync mode before launching (don't overwrite isLifeMode function)
  if (launchMode === 'life') {
    localStorage.setItem('roweos_life_mode', 'true');
    localStorage.setItem('roweos_app_mode', 'life');
    localStorage.setItem('roweos_mode', 'life');
  } else {
    localStorage.setItem('roweos_life_mode', 'false');
    localStorage.setItem('roweos_app_mode', 'brand');
    localStorage.setItem('roweos_mode', 'brand');
  }
  
  // v10.5.25: Update all UI elements for the selected mode
  if (typeof updateModeUI === 'function') {
    updateModeUI(launchMode);
  }
  
  // Update mobile header mode label if visible
  if (typeof updateMobileModeLabel === 'function') {
    updateMobileModeLabel();
  }
  
  // Hide onboarding if showing
  var onboarding = document.getElementById('onboardingView');
  if (onboarding) {
    onboarding.classList.add('hidden');
  }
  hideOnboarding();
  
  // Go to AI chat view
  showView('agent');
  
  // Show a welcome message based on mode
  if (launchMode === 'life') {
    showToast('Welcome to LifeAI! Your personal life assistant is ready.', 'info');
  } else {
    showToast('Welcome to RoweOS! Configure your brand in Settings to unlock full potential.', 'info');
  }
}

// Go to Settings from launch screen
function goToSettings() {
  hideLaunchScreen();
  
  // Hide onboarding if showing
  var onboarding = document.getElementById('onboardingView');
  if (onboarding) {
    onboarding.classList.add('hidden');
  }
  hideOnboarding();
  
  // Go to Settings view
  showView('settings');
}

function startNewBrand() {
  hideLaunchScreen();
  
  // Reset onboarding data for real brand creation
  onboardingData = {
    brandName: '',
    tagline: '',
    location: '',
    email: '',
    voice: [],
    audienceValues: [],
    audience: '',
    promise: '',
    positioning: '',
    selectedModel: 'claude-sonnet-4-6',
    generatedBrand: null,
    demoMode: false  // Real brand creation - WILL SAVE
  };
  
  // Clear all form fields for fresh start
  clearOnboardingFields();
  
  // Hide demo mode badge (this is real mode)
  var demoBadge = document.getElementById('demoModeBadge');
  if (demoBadge) {
    demoBadge.classList.add('hidden');
  }
  
  var view = document.getElementById('onboardingView');
  if (view) {
    view.classList.remove('hidden');
    showOnboardingStep(1);
  }
}

// Exit onboarding function
// Clear all onboarding form fields
function clearOnboardingFields() {
  console.log('Clearing all onboarding fields...');
  
  // Clear text inputs
  var inputIds = ['onboardingBrandName', 'onboardingTagline', 'onboardingLocation', 'onboardingEmail', 'onboardingAudience', 'onboardingPromise'];
  inputIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.value = '';
      console.log('Cleared input:', id);
    }
  });
  
  // Clear voice attribute selections - FIXED SELECTOR
  var voiceCards = document.querySelectorAll('.onboarding-voice-card');
  voiceCards.forEach(function(card) {
    card.classList.remove('selected');
  });
  console.log('Cleared', voiceCards.length, 'voice cards');
  
  // Clear audience value selections
  var audienceBtns = document.querySelectorAll('.audience-value');
  audienceBtns.forEach(function(btn) {
    btn.classList.remove('selected');
  });
  console.log('Cleared', audienceBtns.length, 'audience values');
  
  // Clear model card selections
  var modelCards = document.querySelectorAll('.onboarding-model-card');
  modelCards.forEach(function(card) {
    card.classList.remove('selected');
  });
  console.log('Cleared', modelCards.length, 'model cards');
  
  // Reset to step 1
  var allSteps = document.querySelectorAll('.onboarding-step');
  allSteps.forEach(function(step) {
    step.classList.add('hidden');
  });
  
  console.log('All fields cleared successfully');
}

function exitOnboarding() {
  var confirmed = confirm('Are you sure you want to exit brand setup? Your progress will not be saved.');
  
  if (confirmed) {
    // Close onboarding view
    document.getElementById('onboardingView').classList.add('hidden');
    
    // Clear any partial onboarding data
    onboardingData = {
      brandName: '',
      tagline: '',
      location: '',
      email: '',
      voice: [],
      audienceValues: [],
      audience: '',
      promise: '',
      positioning: '',
      selectedModel: 'claude-sonnet-4-6',
      generatedBrand: null,
      demoMode: false
    };
    
    // Clear all form fields
    clearOnboardingFields();
    
    // Hide demo mode badge
    var demoBadge = document.getElementById('demoModeBadge');
    if (demoBadge) {
      demoBadge.classList.add('hidden');
    }
    
    // If there are existing brands, go to identity view
    // Otherwise, show launch screen
    if (brands && brands.length > 0) {
      showView('identity');
    } else {
      showLaunchScreen();
    }
    
    showToast('Brand setup cancelled', 'info');
  }
}

function startDemoMode() {
  hideLaunchScreen();
  
  // Reset onboarding data for demo
  onboardingData = {
    brandName: '',
    tagline: '',
    location: '',
    email: '',
    voice: [],
    audienceValues: [],
    audience: '',
    promise: '',
    positioning: '',
    selectedModel: 'claude-sonnet-4-6',
    generatedBrand: null,
    demoMode: true  // Explicitly set demo mode
  };
  
  // Clear all form fields for fresh start
  clearOnboardingFields();
  
  // Show demo mode badge
  var demoBadge = document.getElementById('demoModeBadge');
  if (demoBadge) {
    demoBadge.classList.remove('hidden');
  }
  
  var view = document.getElementById('onboardingView');
  if (view) {
    view.classList.remove('hidden');
    showOnboardingStep(1);
  }
}


// ═══════════════════════════════════════════════════════════════
// MULTI-MODEL SUPPORT - v2.0.3
// ═══════════════════════════════════════════════════════════════

// API Keys storage
var apiKeys = {
  anthropic: localStorage.getItem('anthropicApiKey') || '',
  openai: localStorage.getItem('openaiApiKey') || '',
  google: localStorage.getItem('googleApiKey') || ''
};

// Current provider being configured
var currentConfigProvider = '';

// Get provider from model name
function getProviderForModel(model) {
  if (model === 'auto') return 'roweos';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('gemini-') || model.startsWith('models/')) return 'google';
  return 'anthropic'; // default
}

// Check API key status on Step 6 load
function updateApiKeyStatus() {
  // v14.0: Reload from localStorage to avoid stale state
  try {
    var storedKeys = localStorage.getItem('roweos_api_keys');
    if (storedKeys) {
      apiKeys = JSON.parse(storedKeys);
    }
  } catch (e) {}

  // Check Anthropic
  var claudeStatus = document.getElementById('claudeKeyStatus');
  if (claudeStatus) {
    var textSpan = claudeStatus.querySelector('.key-status-text');
    if (apiKeys.anthropic) {
      claudeStatus.classList.add('connected');
      if (textSpan) textSpan.textContent = 'API Key Attached';
    } else {
      claudeStatus.classList.remove('connected');
      if (textSpan) textSpan.textContent = 'Add API Key';
    }
  }
  
  // Check OpenAI
  var openaiStatus = document.getElementById('openaiKeyStatus');
  if (openaiStatus) {
    var textSpan = openaiStatus.querySelector('.key-status-text');
    if (apiKeys.openai) {
      openaiStatus.classList.add('connected');
      if (textSpan) textSpan.textContent = 'API Key Attached';
    } else {
      openaiStatus.classList.remove('connected');
      if (textSpan) textSpan.textContent = 'Add API Key';
    }
  }
  
  // Check Google
  var googleStatus = document.getElementById('googleKeyStatus');
  if (googleStatus) {
    var textSpan = googleStatus.querySelector('.key-status-text');
    if (apiKeys.google) {
      googleStatus.classList.add('connected');
      if (textSpan) textSpan.textContent = 'API Key Attached';
    } else {
      googleStatus.classList.remove('connected');
      if (textSpan) textSpan.textContent = 'Add API Key';
    }
  }
  
  // Also update settings view API status if it exists
  updateSettingsApiStatus();
}

// v25.3: Update per-provider status rows in AI & Models settings
function updateSettingsApiStatus() {
  updateProviderStatuses();
}

function updateProviderStatuses() {
  // v29.0: Read actual keys from localStorage - don't trust in-memory apiKeys
  var _actualKeys = { anthropic: false, openai: false, google: false };
  try {
    var stored = localStorage.getItem('roweos_api_keys');
    if (stored) {
      var parsed = JSON.parse(stored);
      _actualKeys.anthropic = !!parsed.anthropic;
      _actualKeys.openai = !!parsed.openai;
      _actualKeys.google = !!parsed.google;
    }
  } catch(e) {}

  var providers = ['anthropic', 'openai', 'google'];
  var colors = { anthropic: '#e8956a', openai: '#4ade80', google: '#60a5fa' };

  providers.forEach(function(p) {
    var desc = document.getElementById('providerStatus-' + p);
    var badge = document.getElementById('providerBadge-' + p);
    var connected = _actualKeys[p];

    if (desc) {
      desc.textContent = connected ? 'Connected and ready' : 'Not connected';
    }
    if (badge) {
      if (connected) {
        badge.textContent = 'Connected';
        badge.style.background = colors[p] + '20';
        badge.style.color = colors[p];
      } else {
        // v28.2: Show Disconnected badge instead of hiding it
        badge.textContent = 'Disconnected';
        badge.style.background = 'rgba(239,68,68,0.1)';
        badge.style.color = '#ef4444';
      }
    }
  });

  // Show/hide Gemini feature toggles
  var geminiToggles = document.getElementById('geminiFeatureToggles');
  if (geminiToggles) {
    var hasGoogleKey = !!_actualKeys.google; // v28.3: Use fresh keys, not stale global
    var hasNB = typeof hasNanobananaKeyStored === 'function' && hasNanobananaKeyStored();
    geminiToggles.style.display = (hasGoogleKey || hasNB) ? 'block' : 'none';
  }

  // Update image gen toggle state
  var imgToggle = document.getElementById('geminiToggle-imagegen');
  if (imgToggle) {
    var enabled = typeof isImageGenEnabled === 'function' && isImageGenEnabled();
    imgToggle.textContent = enabled ? 'Enabled' : 'Disabled';
    imgToggle.style.background = enabled ? 'rgba(74,222,128,0.15)' : 'transparent';
    imgToggle.style.color = enabled ? '#4ade80' : 'var(--text-muted)';
    imgToggle.style.borderColor = enabled ? '#4ade80' : 'var(--border-color)';
  }

  // Legacy: update old settingsApiStatus/settingsApiDot if they still exist
  var statusText = document.getElementById('settingsApiStatus');
  var statusDot = document.getElementById('settingsApiDot');
  if (statusText && statusDot) {
    var connectedCount = 0;
    if (_actualKeys.anthropic) connectedCount++; // v28.3: Use fresh keys
    if (_actualKeys.openai) connectedCount++;
    if (_actualKeys.google) connectedCount++;
    if (connectedCount === 0) {
      statusText.innerHTML = 'Not connected';
      statusDot.style.background = '#666';
    } else {
      var labels = [];
      if (_actualKeys.anthropic) labels.push('<span style="color: #e8956a;">Anthropic</span>');
      if (_actualKeys.openai) labels.push('<span style="color: #4ade80;">ChatGPT</span>');
      if (_actualKeys.google) labels.push('<span style="color: #60a5fa;">Gemini</span>');
      statusText.innerHTML = labels.join(' &middot; ');
      statusDot.style.background = 'var(--accent)';
    }
  }
}

// Open API key modal
function configureApiKey(provider) {
  currentConfigProvider = provider;
  var modal = document.getElementById('apiKeyModal');
  var title = document.getElementById('apiKeyModalTitle');
  var desc = document.getElementById('apiKeyModalDesc');
  var input = document.getElementById('apiKeyInput');
  
  // Set provider-specific content
  var providerNames = {
    'anthropic': 'Anthropic (Claude)',
    'openai': 'OpenAI',
    'google': 'Google (Gemini)'
  };
  
  var providerDocs = {
    'anthropic': 'Get your API key from console.anthropic.com',
    'openai': 'Get your API key from platform.openai.com',
    'google': 'Get your API key from makersuite.google.com/app/apikey'
  };
  
  title.textContent = 'Configure ' + providerNames[provider];
  desc.textContent = providerDocs[provider];
  input.value = apiKeys[provider] || '';
  input.focus();
  
  modal.classList.add('show');
}

// v12.0.1: Duplicate closeApiKeyModal removed - see line 75251 for correct implementation

// Save API key
function saveApiKey() {
  var input = document.getElementById('apiKeyInput');
  var key = input.value.trim();
  
  if (key) {
    // Save to memory and localStorage
    apiKeys[currentConfigProvider] = key;
    localStorage.setItem(currentConfigProvider + 'ApiKey', key);
    
    // Update UI
    updateApiKeyStatus();
    
    // Show success toast
    showToast('API key saved successfully!', 'success');
  }
  
  closeApiKeyModal();
}

// Select model function for onboarding (renamed to avoid collision)
function selectOnboardingModel(element, modelId) {
  // Remove selected from all cards
  document.querySelectorAll('.onboarding-model-card').forEach(function(card) {
    card.classList.remove('selected');
  });
  
  // Add selected to clicked card
  element.classList.add('selected');
  
  // Update onboarding data
  onboardingData.selectedModel = modelId;
  
  // Store in localStorage as default
  try {
    localStorage.setItem('roweosDefaultModel', modelId);
  } catch (e) {}
}

// Initialize Step 6 when shown
function initStep6() {
  updateApiKeyStatus();
  
  // Load default model from localStorage if available
  var defaultModel = localStorage.getItem('roweosDefaultModel');
  if (defaultModel && onboardingData.selectedModel !== defaultModel) {
    var card = document.querySelector('[onclick*="' + defaultModel + '"]');
    if (card) {
      selectModel(card, defaultModel);
    }
  }
}

// Update showOnboardingStep to call initStep6
var originalShowOnboardingStep = showOnboardingStep;
showOnboardingStep = function(step) {
  originalShowOnboardingStep(step);
  if (step === 6) {
    initStep6();
  }
};

// ═══════════════════════════════════════════════════════════════
// BRANDAI REVEAL FUNCTIONS - v2.0.3
// ═══════════════════════════════════════════════════════════════

// Populate BrandAI reveal screen

// ═══════════════════════════════════════════════════════════════
// ENHANCED BRANDAI REVEAL - RECOMMENDATIONS & COMPARISONS
// ═══════════════════════════════════════════════════════════════

// Generate personalized recommendations based on brand
function generateRecommendations(brand) {
  var recommendations = [
    {
      title: 'Create Your First Social Post',
      desc: 'Generate an on-brand social media post that captures ' + brand.name + '\'s voice and positioning.',
      prompt: '"Write a social media post announcing our services"'
    },
    {
      title: 'Draft a Welcome Email',
      desc: 'Create a personalized welcome email that introduces new clients to ' + brand.name + ' with your unique tone.',
      prompt: '"Write a welcome email for new clients"'
    },
    {
      title: 'Build Your Content Calendar',
      desc: 'Generate a week of content ideas tailored to ' + brand.name + '\'s audience and brand pillars.',
      prompt: '"Create a content calendar for this week"'
    },
    {
      title: 'Write Your Brand Story',
      desc: 'Craft an authentic brand story that communicates ' + brand.name + '\'s philosophy and values.',
      prompt: '"Write our brand story for the About page"'
    },
    {
      title: 'Create Customer Responses',
      desc: 'Generate response templates for common customer inquiries using ' + brand.name + '\'s voice.',
      prompt: '"Draft responses to frequently asked questions"'
    },
    {
      title: 'Generate Campaign Ideas',
      desc: 'Brainstorm marketing campaign concepts that align with ' + brand.name + '\'s positioning.',
      prompt: '"Brainstorm campaign ideas for next quarter"'
    }
  ];
  
  var html = '';
  recommendations.forEach(function(reco, idx) {
    html += '<div class="recommendation-card">';
    html += '<div class="recommendation-number">' + (idx + 1) + '</div>';
    html += '<div class="recommendation-title">' + reco.title + '</div>';
    html += '<div class="recommendation-desc">' + reco.desc + '</div>';
    html += '<div class="recommendation-prompt">' + reco.prompt + '</div>';
    html += '</div>';
  });
  
  document.getElementById('recommendationsGrid').innerHTML = html;
  document.getElementById('recoBrandName').textContent = brand.name;
}

// Generate side-by-side comparisons showing Generic AI vs BrandAI
function populateRevealScreen() {
  var brand = onboardingData.generatedBrand;
  
  console.log('populateRevealScreen called with brand:', brand ? brand.name : 'null');
  
  if (!brand) {
    console.error('No brand data to populate');
    return;
  }
  
  // Helper function to safely set text content
  function safeSetText(id, value) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = value;
      console.log('✓ Set', id, '=', value);
    } else {
      console.warn('✗ Element not found:', id);
    }
  }
  
  // Header brand name
  safeSetText('headerBrandName', brand.name);
  
  // Brand Profile
  safeSetText('revealBrandName', brand.name);
  safeSetText('revealVoice', brand.voice || 'Not specified');
  safeSetText('revealPositioning', brand.positioning || 'Not specified');
  safeSetText('revealPhilosophy', brand.philosophy || 'Building your unique brand intelligence...');
  
  // Knowledge Items
  safeSetText('revealAudience', brand.audience || 'Not specified');
  safeSetText('revealPromise', brand.promise || 'Not specified');
  
  // Content Pillars
  if (brand.contentPillars && brand.contentPillars.length > 0) {
    safeSetText('revealPillars', brand.contentPillars.join(', '));
  } else {
    safeSetText('revealPillars', 'Not yet defined');
  }
  
  // Voice Detail (for strategy section)
  safeSetText('revealVoiceDetail', brand.tone || brand.voice || 'Not specified');
  
  // AI Model
  var modelNames = {
    'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-opus-4-7': 'Claude Opus 4.7',
    'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
    'gpt-5.5': 'GPT-5.5',
    'gpt-5.5-pro': 'GPT-5.5 Pro',
    'gpt-5.5-thinking': 'GPT-5.5 Thinking',
    'gpt-5-nano': 'GPT-5 Nano',
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
    'gemini-3-flash-preview': 'Gemini 3 Flash'
  };
  var modelName = modelNames[brand.preferredModel] || brand.preferredModel || 'Claude Sonnet 4.6';
  safeSetText('revealModel', modelName);
  
  // Populate brand name in "Get Started" section
  safeSetText('getStartedBrandName', brand.name);
  
  console.log('Generating recommendations...');
  
  // Generate personalized recommendations
  try {
    generateRecommendations(brand);
    console.log('✓ Recommendations generated');
  } catch (e) {
    console.error('✗ Error generating recommendations:', e);
  }
  
  console.log('populateRevealScreen completed successfully');
}

// Test BrandAI function
function testBrandAI() {
  // Complete onboarding first to save the brand
  completeOnboarding();
  
  // Wait a moment for brand to save
  setTimeout(function() {
    // Switch to BrandAI view
    showView('agent');
    
    // Show welcome message in BrandAI
    setTimeout(function() {
      var conversationDiv = document.getElementById('agentConversation');
      if (conversationDiv) {
        conversationDiv.innerHTML = '<div class="agent-message"><div class="agent-avatar" style="color: #a89878;">◆</div><div class="agent-text"><strong>Welcome to your BrandAI!</strong><br><br>I\'m your intelligent brand assistant. I know your voice, your positioning, and your audience. Try asking me to:<br><br>• Write a social post<br>• Draft an email<br>• Create content ideas<br>• Analyze your brand voice<br><br>What would you like to create?</div></div>';
      }
      
      // Focus on input
      var input = document.getElementById('agentInput');
      if (input) {
        input.focus();
      }
    }, 300);
  }, 100);
}

/* ==========================================
   v2.50.0 NEW FUNCTIONS
   ========================================== */

// Modal Management
// v21.0: Atomic cssText assignment - kills CSS animation/transition conflicts on reopen
function openModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) {
    modal.removeAttribute('style');
    void modal.offsetHeight; // Force reflow
    modal.style.cssText = 'display:flex !important;visibility:visible !important;opacity:1 !important;position:fixed !important;top:0 !important;left:0 !important;width:100% !important;height:100% !important;z-index:10000 !important;pointer-events:auto !important;background:rgba(0,0,0,0.8) !important;backdrop-filter:blur(8px) !important;align-items:center !important;justify-content:center !important;animation:none !important;transition:none !important;';
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  try {
    var modal = document.getElementById(modalId);
    if (modal) {
      // v21.0: Nuke all inline styles then set display:none - clean slate for next open
      modal.removeAttribute('style');
      modal.style.cssText = 'display:none !important;';
    }
  } catch (err) {
    console.error('[closeModal] Error:', err);
  }

  // Always restore body scroll
  document.body.style.overflow = '';
  
  // Clear form fields if it's a form modal
  if (modalId === 'addBrandModal') {
    try {
      var nameEl = document.getElementById('newBrandName');
      var taglineEl = document.getElementById('newBrandTagline');
      var philEl = document.getElementById('newBrandPhilosophy');
      if (nameEl) nameEl.value = '';
      if (taglineEl) taglineEl.value = '';
      if (philEl) philEl.value = '';
      // Clear template selection
      var templates = document.querySelectorAll('.template-card');
      templates.forEach(function(t) { t.classList.remove('selected'); });
      selectedTemplate = 'blank';
    } catch (e) {
      console.error('[closeModal] Error clearing form:', e);
    }
  }
}

// Add Brand Modal Choice Functions
function showTemplateChoice() {
  document.getElementById('templateSection').style.display = 'block';
  document.getElementById('createOwnSection').style.display = 'none';
  document.getElementById('chooseTemplateBtn').classList.add('active');
  document.getElementById('createOwnBtn').classList.remove('active');
}

function showCreateOwn() {
  // Close Add Brand modal
  closeModal('addBrandModal');
  
  // Open onboarding at Step 3 (AI Provider - skip the intro and choice screens)
  showOnboarding();
  setTimeout(function() {
    nextOnboardingStep(3);
  }, 100);
}

// Template Selection
var selectedTemplate = 'blank';

function selectTemplate(templateType) {
  selectedTemplate = templateType;
  
  // Update UI
  var templates = document.querySelectorAll('.template-card');
  templates.forEach(function(card) {
    card.classList.remove('selected');
  });
  event.target.closest('.template-card').classList.add('selected');
}

function getBrandTemplate(templateType) {
  var templates = {
    blank: {
      tagline: '',
      philosophy: '',
      voice: '',
      positioning: '',
      audience: ''
    },
    luxury: {
      tagline: 'Elevated Excellence',
      philosophy: 'We believe true luxury is found in meticulous attention to detail, timeless quality, and personalized service.',
      voice: 'refined, sophisticated, warm, exclusive',
      positioning: 'Premium luxury brand delivering exceptional quality and service',
      audience: 'Discerning clientele seeking uncompromising quality and refined experiences'
    },
    tech: {
      tagline: 'Innovation Simplified',
      philosophy: 'Technology should be powerful yet intuitive, enabling people to achieve more with less complexity.',
      voice: 'clear, innovative, confident, forward-thinking',
      positioning: 'Modern technology brand focused on user-centric innovation',
      audience: 'Tech-savvy professionals and organizations seeking cutting-edge solutions'
    },
    wellness: {
      tagline: 'Thrive Naturally',
      philosophy: 'True wellness comes from balance, mindfulness, and nurturing both body and spirit.',
      voice: 'calm, nurturing, authentic, encouraging',
      positioning: 'Holistic wellness brand promoting natural, sustainable health practices',
      audience: 'Health-conscious individuals seeking natural approaches to well-being'
    },
    retail: {
      tagline: 'Curated for You',
      philosophy: 'Every product tells a story. We curate collections that enhance your lifestyle and reflect your values.',
      voice: 'friendly, stylish, knowledgeable, inviting',
      positioning: 'Contemporary retail brand offering thoughtfully curated products',
      audience: 'Style-conscious consumers seeking quality, curated products'
    },
    service: {
      tagline: 'Service, Perfected',
      philosophy: 'Exceptional service is about anticipating needs, delivering consistently, and building lasting relationships.',
      voice: 'professional, responsive, trustworthy, personal',
      positioning: 'Premium service provider focused on excellence and client satisfaction',
      audience: 'Professionals and businesses seeking reliable, high-quality service'
    }
  };
  
  return templates[templateType] || templates.blank;
}

// Brand Management Functions
function createNewBrand() {
  console.log('=== v2.83.0: createNewBrand() ===');
  
  // Get name from either input field (templateSection or createOwnSection)
  var name = document.getElementById('newBrandName').value.trim() || document.getElementById('newBrandName2').value.trim();
  
  if (!name) {
    showToast('Error', 'Please enter a brand name', 'error');
    return;
  }
  
  // Check for duplicate
  var exists = brands.some(function(b) { return b.name.toLowerCase() === name.toLowerCase(); });
  if (exists) {
    showToast('Error', 'A brand with this name already exists', 'error');
    return;
  }
  
  // Get template data
  var template = getBrandTemplate(selectedTemplate);
  
  // Get form values
  var tagline = document.getElementById('newBrandTagline').value.trim() || template.tagline;
  var philosophy = document.getElementById('newBrandPhilosophy').value.trim() || template.philosophy;
  
  // Create new brand object
  var newBrand = {
    id: 'brand_name_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    _modifiedAt: Date.now(),
    _createdAt: Date.now(),
    name: name,
    tagline: tagline,
    philosophy: philosophy,
    voice: template.voice,
    positioning: template.positioning,
    audience: template.audience,
    promise: '',
    cta: 'Learn More',
    tone: '',
    vocabDo: '',
    vocabDont: '',
    constraints: '',
    location: '',
    contacts: ''
  };
  
  // v29.0: Dedup -- check if brand with same ID already exists
  var _dupId = 'brand_name_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  for (var _di = 0; _di < brands.length; _di++) {
    if (brands[_di].id === _dupId) {
      showToast('Brand "' + name + '" already exists', 'warning');
      return;
    }
  }

  // Add to brands array
  brands.push(newBrand);
  
  // Save to storage + trigger Firebase auto-sync
  saveBrands();

  // Update all UI
  syncBrandDropdowns();
  renderMemoryBrandPills();
  renderLibraryView();
  renderGuardrailsUI();

  // Switch to new brand
  selectedBrand = brands.length - 1;
  // v16.5: Update dropdown so onBrandChange reads correct index
  var brandSelect = document.getElementById('brand');
  if (brandSelect) brandSelect.value = selectedBrand;
  onBrandChange();
  
  // Close modal
  closeModal('addBrandModal');
  
  // Show success message
  showToast('Success', 'Brand "' + name + '" created successfully', 'success');
}

function openEditBrandModal() {
  try {
    // v21.0: Close first to ensure clean slate (openModal now handles atomic style reset)
    closeModal('editBrandModal');

    var idx = selectedBrand;
    var brand = brands[idx];

    if (!brand) {
      showToast('No brand selected', 'error');
      return;
    }
    
    // Populate only the relevant fields for the simplified modal
    var indexEl = document.getElementById('editBrandIndex');
    if (indexEl) indexEl.value = idx;
    
    var nameEl = document.getElementById('editBrandName');
    if (nameEl) nameEl.value = brand.name || '';
    
    var shortNameEl = document.getElementById('editBrandShortName');
    if (shortNameEl) shortNameEl.value = brand.shortName || '';
    
    var taglineEl = document.getElementById('editBrandTagline');
    if (taglineEl) taglineEl.value = brand.tagline || '';

    // v13.0: Load brand color
    var colorEl = document.getElementById('editBrandColor');
    if (colorEl) colorEl.value = brand.brandColor || '#a89878';
    renderBrandColorPresets(brand.brandColor || '#a89878');

    // v15.16: Load owner/employee role data
    var roleData = brand.roleData || {};
    var roleType = roleData.type || 'owner';
    var editRoleRadios = document.querySelectorAll('input[name="editBrandRole"]');
    editRoleRadios.forEach(function(radio) { radio.checked = (radio.value === roleType); });
    updateEditBrandRole(roleType);
    var ownerTitleEl = document.getElementById('editRoleOwnerTitle');
    if (ownerTitleEl) ownerTitleEl.value = roleData.ownerTitle || '';
    var roleTitleEl = document.getElementById('editRoleTitle');
    if (roleTitleEl) roleTitleEl.value = roleData.title || '';
    var roleDeptEl = document.getElementById('editRoleDepartment');
    if (roleDeptEl) roleDeptEl.value = roleData.profession || '';

    // v16.5 / v28.5: Primary brand checkbox - resolve by ID
    var primaryCheckbox = document.getElementById('editPrimaryBrand');
    if (primaryCheckbox) {
      var _pId = localStorage.getItem('roweos_primary_brand_id');
      if (_pId && brands[idx] && brands[idx].id) {
        primaryCheckbox.checked = (brands[idx].id === _pId);
      } else {
        var currentPrimary = parseInt(localStorage.getItem('roweos_primary_brand') || '0');
        primaryCheckbox.checked = (idx === currentPrimary);
      }
    }

    // Open modal
    openModal('editBrandModal');

    // Focus the short name input
    setTimeout(function() {
      var shortNameInput = document.getElementById('editBrandShortName');
      if (shortNameInput) shortNameInput.focus();
    }, 100);

  } catch (err) {
    console.error('[openEditBrandModal] Error:', err);
    showToast('Error opening edit modal: ' + err.message, 'error');
  }
}

// v15.16: Update Edit Brand modal role UI
function updateEditBrandRole(role) {
  var ownerFields = document.getElementById('editOwnerRoleFields');
  var employeeFields = document.getElementById('editEmployeeRoleFields');
  var ownerLabel = document.getElementById('editRoleOwnerLabel');
  var employeeLabel = document.getElementById('editRoleEmployeeLabel');

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

  // Save role type immediately
  var brand = brands[selectedBrand];
  if (brand) {
    if (!brand.roleData) brand.roleData = {};
    brand.roleData.type = role;
    saveBrands();
  }
}

// v15.16: Save individual role field from Edit Brand modal
function saveEditBrandRoleField(field, value) {
  var brand = brands[selectedBrand];
  if (!brand) return;
  if (!brand.roleData) brand.roleData = {};
  brand.roleData[field] = value;
  saveBrands();
}

/**
 * v13.0: Save short name + brand color from edit modal
 */
function saveBrandSettings() {
  try {
    var indexEl = document.getElementById('editBrandIndex');
    var idx = parseInt(indexEl ? indexEl.value : '');

    if (isNaN(idx) || idx < 0 || idx >= brands.length) {
      showToast('Invalid brand selection', 'error');
      return;
    }

    var shortNameInput = document.getElementById('editBrandShortName');
    var shortName = shortNameInput ? shortNameInput.value.trim() : '';

    // v13.0: Read brand color
    var colorInput = document.getElementById('editBrandColor');
    var brandColor = colorInput ? colorInput.value : '#a89878';

    // v15.32: Read tagline from edit modal
    var taglineInput = document.getElementById('editBrandTagline');
    var tagline = taglineInput ? taglineInput.value.trim() : (brands[idx].tagline || '');

    // Update the brand
    brands[idx].shortName = shortName;
    brands[idx].brandColor = brandColor;
    brands[idx].tagline = tagline;
    brands[idx]._modifiedAt = Date.now(); // v23.0: Timestamp for conflict resolution

    // v15.37: Read role data back from Edit Brand modal (same pattern as tagline fix v15.32)
    if (!brands[idx].roleData) brands[idx].roleData = {};
    var editRoleRadio = document.querySelector('input[name="editBrandRole"]:checked');
    if (editRoleRadio) brands[idx].roleData.type = editRoleRadio.value;
    var editOwnerTitle = document.getElementById('editRoleOwnerTitle');
    if (editOwnerTitle) brands[idx].roleData.ownerTitle = editOwnerTitle.value;
    var editRoleTitle = document.getElementById('editRoleTitle');
    if (editRoleTitle) brands[idx].roleData.title = editRoleTitle.value;
    var editRoleDept = document.getElementById('editRoleDepartment');
    if (editRoleDept) brands[idx].roleData.profession = editRoleDept.value;

    // Save to storage (v15.9: saveBrands auto-syncs via scheduleAutoSync)
    saveBrands();

    // v15.32: Update timestamp
    saveBrandAIPromptTimestamp(idx);
    refreshIdentityTimestamp();

    // v15.32: Update tagline display in Identity header
    var taglineDisplay = document.getElementById('memoryBrandTagline');
    if (taglineDisplay) taglineDisplay.textContent = brands[idx].tagline || 'Brand Identity';

    // Update all UI elements that show the brand name
    updateBrandName();
    populateSidebarBrandDropdown();
    syncBrandDropdowns();

    // v13.0: Apply brand color if this is the active brand
    if (idx === selectedBrand) {
      applyBrandAccentColor(brandColor);
    }

    // v18.2 / v28.5: Save primary brand with ID (survives reorder)
    var primaryCheckbox = document.getElementById('editPrimaryBrand');
    if (primaryCheckbox && primaryCheckbox.checked) {
      try {
        localStorage.setItem('roweos_primary_brand', String(idx));
        if (brands[idx] && brands[idx].id) localStorage.setItem('roweos_primary_brand_id', brands[idx].id);
        // v29.0: Sync primary brand to Firestore for cross-device consistency
        writeDB('profile/main', { 'settings.primaryBrand': String(idx), 'settings.primaryBrandId': brands[idx] ? brands[idx].id : '' });
      } catch(e) { console.warn('[Primary] Save failed (storage full?):', e); }
    } else if (primaryCheckbox && !primaryCheckbox.checked) {
      var _pId = localStorage.getItem('roweos_primary_brand_id');
      var isPrimary = _pId ? (brands[idx] && brands[idx].id === _pId) : (parseInt(localStorage.getItem('roweos_primary_brand') || '0') === idx);
      if (isPrimary) {
        try {
          localStorage.setItem('roweos_primary_brand', '0');
          if (brands[0] && brands[0].id) localStorage.setItem('roweos_primary_brand_id', brands[0].id);
          // v29.0: Sync primary brand reset to Firestore
          writeDB('profile/main', { 'settings.primaryBrand': '0', 'settings.primaryBrandId': brands[0] ? brands[0].id : '' });
        } catch(e) {}
      }
    }

    closeModal('editBrandModal');

    // v18.8: Re-render identity role badge + digital presence if on Identity view
    if (typeof renderIdentityRoleBadge === 'function') renderIdentityRoleBadge();
    if (typeof renderDigitalPresenceCard === 'function') renderDigitalPresenceCard();
    if (typeof loadBrandRole === 'function') loadBrandRole();
    // v22.40: Re-render guardrails scope rules so PRIMARY BRAND badge syncs
    if (typeof renderScopeRules === 'function') renderScopeRules();
    // v23.17: Re-init brand logo in sidebar after save (fixes logo not appearing)
    if (typeof initBrandLogo === 'function') initBrandLogo();

    if (shortName) {
      showToast('Short name updated to "' + shortName + '"', 'success');
    } else {
      showToast('Brand settings saved', 'success');
    }

  } catch (err) {
    console.error('[saveBrandSettings] Error:', err);
    showToast('Error saving brand settings: ' + err.message, 'error');
  }
}

/**
 * v13.0: Render brand color preset swatches
 */
function renderBrandColorPresets(currentColor) {
  var container = document.getElementById('editBrandColorPresets');
  if (!container) return;
  var presets = ['#a89878', '#b8986a', '#6ab894', '#6a8eb8', '#b86a9e', '#b8a86a', '#e06666', '#8e7cc3', '#76a5af', '#f6b26b'];
  var html = '';
  for (var i = 0; i < presets.length; i++) {
    var selected = presets[i] === currentColor;
    html += '<div onclick="selectBrandColorPreset(\'' + presets[i] + '\')" style="width: 28px; height: 28px; border-radius: 50%; background: ' + presets[i] + '; cursor: pointer; border: 2px solid ' + (selected ? 'var(--text-primary)' : 'transparent') + '; transition: border-color 0.15s;"></div>';
  }
  container.innerHTML = html;
}

/**
 * v13.0: Select a brand color preset
 */
function selectBrandColorPreset(color) {
  var colorInput = document.getElementById('editBrandColor');
  if (colorInput) colorInput.value = color;
  renderBrandColorPresets(color);
}

/**
 * v15.1: Apply brand accent color with full CSS variable system (matches LifeAI)
 */
function applyBrandAccentColor(color) {
  if (!color) return;
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode !== 'brand') return;

  var root = document.documentElement;
  var rgb = typeof hexToRgb === 'function' ? hexToRgb(color) : null;
  if (!rgb) {
    root.style.setProperty('--brand-accent', color);
    return;
  }

  var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  var contrastText = luminance > 0.5 ? '#1a1a1a' : '#ffffff';

  // v15.1: Set --brand-accent-* variables
  root.style.setProperty('--brand-accent', color);
  root.style.setProperty('--brand-accent-dark', typeof darkenColor === 'function' ? darkenColor(color, 20) : color);
  root.style.setProperty('--brand-accent-light', typeof lightenColor === 'function' ? lightenColor(color, 20) : color);
  root.style.setProperty('--brand-accent-text', contrastText);
  root.style.setProperty('--brand-accent-rgb', rgb.r + ', ' + rgb.g + ', ' + rgb.b);
  root.style.setProperty('--brand-accent-10', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.1)');
  root.style.setProperty('--brand-accent-15', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.15)');
  root.style.setProperty('--brand-accent-20', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.2)');
  root.style.setProperty('--brand-accent-25', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.25)');
  root.style.setProperty('--brand-accent-30', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.3)');
  root.style.setProperty('--brand-accent-40', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.4)');
  root.style.setProperty('--brand-accent-50', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.5)');
  root.style.setProperty('--brand-accent-60', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.6)');
  root.style.setProperty('--brand-accent-70', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.7)');

  // v15.1: ALSO override --accent, --accent-hover, --accent-muted, --accent-glow, --accent-gold
  // This makes the ENTIRE BrandAI UI use the brand's chosen color
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-hover', typeof lightenColor === 'function' ? lightenColor(color, 10) : color);
  root.style.setProperty('--accent-muted', typeof darkenColor === 'function' ? darkenColor(color, 10) : color);
  root.style.setProperty('--accent-glow', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.12)');
  root.style.setProperty('--accent-gold', color);
  root.style.setProperty('--accent-text', contrastText);
  root.style.setProperty('--gold', color);

  // v25.1: Add class for dark brand color so light-mode CSS can ensure contrast
  if (luminance < 0.3) {
    root.classList.add('brand-dark-accent');
  } else {
    root.classList.remove('brand-dark-accent');
  }

  console.log('[BrandAI] Applied accent color:', color, 'contrast text:', contrastText);
  // v24.20: Update blob/helix color
  if (typeof updateBlobColor === 'function') updateBlobColor();
  if (typeof updateHelixColors === 'function') updateHelixColors();
}

/**
 * v15.1: Reset accent CSS variables to defaults (used when switching to LifeAI mode)
 */
function resetBrandAccentCSS() {
  var root = document.documentElement;
  // Remove inline overrides so CSS cascade defaults take over
  var props = ['--accent', '--accent-hover', '--accent-muted', '--accent-glow', '--accent-gold', '--accent-text', '--gold',
    '--brand-accent', '--brand-accent-dark', '--brand-accent-light', '--brand-accent-text', '--brand-accent-rgb',
    '--brand-accent-10', '--brand-accent-15', '--brand-accent-20', '--brand-accent-25',
    '--brand-accent-30', '--brand-accent-40', '--brand-accent-50', '--brand-accent-60', '--brand-accent-70'];
  for (var i = 0; i < props.length; i++) {
    root.style.removeProperty(props[i]);
  }
  console.log('[BrandAI] Reset accent CSS to defaults');
}

/**
 * v15.1: Get brand color for current theme mode
 */
function getBrandColorForTheme(brandIdx) {
  var brand = brands[brandIdx];
  if (!brand) return '#a89878';
  var themeMode = typeof getCurrentThemeMode === 'function' ? getCurrentThemeMode() : 'dark';
  if (themeMode === 'light' && brand.brandColorLight) {
    return brand.brandColorLight;
  }
  return brand.brandColor || '#a89878';
}

/**
 * v15.1: Apply brand accent for current brand and theme
 */
function applyCurrentBrandAccent() {
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode !== 'brand') return;
  var brandIdx = selectedBrand || 0;
  var color = getBrandColorForTheme(brandIdx);
  applyBrandAccentColor(color);
}

/**
 * v15.1: Initialize brand accent color on app startup
 */
function initBrandAccentColor() {
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode !== 'brand') return;
  var brandSelect = document.getElementById('brand');
  var brandIdx = brandSelect ? parseInt(brandSelect.value) : (selectedBrand || 0);
  if (isNaN(brandIdx)) brandIdx = 0;
  var color = getBrandColorForTheme(brandIdx);
  applyBrandAccentColor(color);
}

// v15.1: Personalization state
var brandAccentEditing = 'dark';
var persBrandIdx = 0;

var brandAccentPresets = [
  { name: 'Gold', color: '#a89878' },
  { name: 'Rose Gold', color: '#b8986a' },
  { name: 'Sage', color: '#6ab894' },
  { name: 'Slate Blue', color: '#6a8eb8' },
  { name: 'Mauve', color: '#b86a9e' },
  { name: 'Olive', color: '#b8a86a' },
  { name: 'Coral', color: '#e06666' },
  { name: 'Violet', color: '#8e7cc3' },
  { name: 'Teal', color: '#76a5af' },
  { name: 'Amber', color: '#f6b26b' },
  { name: 'Navy', color: '#1e3a5f' },
  { name: 'Graphite', color: '#4a4a4a' }
];

/**
 * v15.1: Get contrast text color for a given accent color
 */
function getBrandAccentText(color) {
  var rgb = typeof hexToRgb === 'function' ? hexToRgb(color) : null;
  if (!rgb) return '#ffffff';
  var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

/**
 * v15.1: Render brand selector chips for personalization
 */
function renderBrandSelectorChips(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var html = '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
  for (var i = 0; i < brands.length; i++) {
    if (!brands[i]) continue;
    var name = brands[i].shortName || brands[i].name;
    var color = brands[i].brandColor || '#a89878';
    var isActive = i === persBrandIdx;
    html += '<button onclick="switchPersonalizationBrand(' + i + ')" style="';
    html += 'padding:6px 14px;border-radius:20px;font-size:13px;font-weight:' + (isActive ? '600' : '500') + ';';
    html += 'cursor:pointer;transition:all 0.2s;border:2px solid ' + (isActive ? color : 'var(--border-color)') + ';';
    html += 'background:' + (isActive ? color : 'transparent') + ';';
    html += 'color:' + (isActive ? getBrandAccentText(color) : 'var(--text-secondary)') + ';';
    html += '">' + (typeof escapeHtml === 'function' ? escapeHtml(name) : name) + '</button>';
  }
  html += '</div>';
  container.innerHTML = html;
}

/**
 * v15.1: Render brand accent color picker (mirrors LifeAI picker)
 */
function renderBrandAccentPicker(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var brand = brands[persBrandIdx];
  if (!brand) return;

  var darkColor = brand.brandColor || '#a89878';
  var lightColor = brand.brandColorLight || darkColor;
  var currentColor = brandAccentEditing === 'light' ? lightColor : darkColor;

  // v24.24: Update mode label + brand name
  var modeLabel = document.getElementById('persAccentModeLabel');
  if (modeLabel) modeLabel.textContent = brandAccentEditing === 'light' ? 'Light mode' : 'Dark mode';
  var modeToggle = document.getElementById('persAccentModeToggle');
  if (modeToggle) modeToggle.textContent = brandAccentEditing === 'light' ? 'Switch to Dark' : 'Switch to Light';
  var brandName = document.getElementById('persAccentBrandName');
  if (brandName) brandName.textContent = brand.shortName || brand.name;

  // v24.24: Preset swatches with current color square inline
  var html = '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">';
  // Current accent color square - clickable color picker, inline with swatches
  html += '<div style="position:relative;width:26px;height:26px;border-radius:6px;background:' + currentColor + ';cursor:pointer;border:2px solid rgba(255,255,255,0.15);flex-shrink:0;" onclick="this.querySelector(\'input\').click();">';
  html += '<input type="color" id="persAccentColorInput" value="' + currentColor + '" onchange="setCustomBrandAccentColor(this.value)" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;">';
  html += '</div>';
  for (var i = 0; i < brandAccentPresets.length; i++) {
    var preset = brandAccentPresets[i];
    var isSelected = preset.color.toLowerCase() === currentColor.toLowerCase();
    html += '<button class="brand-accent-preset' + (isSelected ? ' selected' : '') + '" ';
    html += 'style="background:' + preset.color + ';width:26px;height:26px;border-radius:6px;" ';
    html += 'onclick="selectBrandAccentPresetNew(' + i + ')" ';
    html += 'title="' + preset.name + '"></button>';
  }
  html += '</div>';

  // Hex input row
  html += '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;">';
  html += '<input type="color" id="brandAccentColorInput" value="' + currentColor + '" onchange="setCustomBrandAccentColor(this.value)" style="width:26px;height:26px;border:none;border-radius:6px;cursor:pointer;padding:1px;background:var(--bg-secondary);">';
  html += '<input type="text" id="brandAccentHexInput" value="' + currentColor + '" placeholder="#a89878" onchange="setCustomBrandAccentColor(this.value)" style="width:80px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-family:SF Mono,monospace;font-size:11px;">';
  html += '</div>';

  container.innerHTML = html;
}

/**
 * v15.1: Switch between BrandAI and LifeAI personalization panels
 */
function switchPersonalizationMode(mode) {
  var brandPanel = document.getElementById('personalizationBrandPanel');
  var lifePanel = document.getElementById('personalizationLifePanel');
  var brandTab = document.getElementById('persTabBrand');
  var lifeTab = document.getElementById('persTabLife');

  if (mode === 'life') {
    if (brandPanel) brandPanel.style.display = 'none';
    if (lifePanel) lifePanel.style.display = 'block';
    if (brandTab) brandTab.classList.remove('active');
    if (lifeTab) lifeTab.classList.add('active');
    if (typeof renderLifeAccentPicker === 'function') renderLifeAccentPicker('settingsLifeAccentPicker');
    renderLifeLogoPicker('settingsLifeLogoUploader');
    // v15.15: Also switch platform to LifeAI when selecting LifeAI personalization
    var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
    if (currentMode !== 'life' && typeof switchToLifeMode === 'function') {
      switchToLifeMode();
      showToast('Switched to LifeAI', 'success');
    }
  } else {
    if (brandPanel) brandPanel.style.display = 'block';
    if (lifePanel) lifePanel.style.display = 'none';
    if (brandTab) brandTab.classList.add('active');
    if (lifeTab) lifeTab.classList.remove('active');
    renderBrandSelectorChips('persBrandSelector');
    renderBrandAccentPicker('settingsBrandAccentPicker');
    renderBrandLogoPickerForBrand('settingsBrandLogoUploader', persBrandIdx);
  }
}

/**
 * v15.1: Switch which brand is being customized
 */
function switchPersonalizationBrand(idx) {
  persBrandIdx = idx;
  brandAccentEditing = 'dark';
  renderBrandSelectorChips('persBrandSelector');
  renderBrandAccentPicker('settingsBrandAccentPicker');
  renderBrandLogoPickerForBrand('settingsBrandLogoUploader', idx);
  // v15.4: Also switch the active brand so color changes are visible immediately
  if (typeof selectSidebarBrand === 'function') {
    selectSidebarBrand(idx);
  }
}

/**
 * v15.1: Switch dark/light mode editing for brand accent
 */
function switchBrandAccentEditMode(mode) {
  brandAccentEditing = mode;
  // v23.9: Auto-switch theme to match the mode being edited (matches LifeAI behavior)
  if (mode === 'light' && !document.documentElement.classList.contains('light-mode')) {
    toggleTheme();
  } else if (mode === 'dark' && document.documentElement.classList.contains('light-mode')) {
    toggleTheme();
  }
  renderBrandAccentPicker('settingsBrandAccentPicker');
}

/**
 * v15.1: Select a brand accent preset color
 */
function selectBrandAccentPresetNew(idx) {
  var preset = brandAccentPresets[idx];
  if (!preset) return;
  saveBrandAccentColorForMode(preset.color);
}

/**
 * v15.1: Set custom brand accent color from hex input
 */
function setCustomBrandAccentColor(color) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    if (typeof showToast === 'function') showToast('Please enter a valid hex color (e.g., #a89878)', 'warning');
    return;
  }
  saveBrandAccentColorForMode(color);
}

/**
 * v15.1: Save brand accent color for current editing mode
 */
function saveBrandAccentColorForMode(color) {
  var brand = brands[persBrandIdx];
  if (!brand) return;

  if (brandAccentEditing === 'light') {
    brand.brandColorLight = color;
  } else {
    brand.brandColor = color;
  }

  if (typeof saveBrands === 'function') saveBrands();

  // v15.8: Always apply color for active brand's current theme
  if (persBrandIdx === selectedBrand) {
    var themeMode = typeof getCurrentThemeMode === 'function' ? getCurrentThemeMode() : 'dark';
    if (themeMode === brandAccentEditing) {
      applyBrandAccentColor(color);
    } else {
      // Also apply current theme's color to keep UI consistent
      var currentColor = getBrandColorForTheme(selectedBrand);
      applyBrandAccentColor(currentColor);
    }
  }

  renderBrandAccentPicker('settingsBrandAccentPicker');
  renderBrandSelectorChips('persBrandSelector');
  // v15.9: Auto-sync handled by saveBrands() → scheduleAutoSync()
}

/**
 * v15.1: Render logo picker for a specific brand index
 */
function renderBrandLogoPickerForBrand(containerId, brandIdx) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var logoKey = getCurrentLogoKey(brandIdx);
  var sizeKey = logoKey + '_size';
  var savedLogo = localStorage.getItem(logoKey);
  var savedSize = localStorage.getItem(sizeKey) || '100';
  var hasLogo = !!savedLogo;
  var brandName = (brands[brandIdx] && (brands[brandIdx].shortName || brands[brandIdx].name)) || 'Brand';

  var html = '<div class="brand-logo-picker">';
  html += '<div class="brand-logo-picker-label">' + (typeof escapeHtml === 'function' ? escapeHtml(brandName) : brandName) + ' Logo</div>';
  html += '<div class="brand-logo-picker-sublabel">Upload a logo for ' + (typeof escapeHtml === 'function' ? escapeHtml(brandName) : brandName) + '</div>';

  html += '<div class="brand-logo-preview-container">';
  html += '<div class="brand-logo-preview' + (hasLogo ? ' has-logo' : '') + '">';
  if (hasLogo) {
    html += '<img src="' + savedLogo + '" alt="Logo">';
  } else {
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>';
  }
  html += '</div>';

  html += '<div class="brand-logo-actions">';
  html += '<input type="file" id="persLogoInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml" style="display:none;" onchange="handlePersLogoUpload(this)">';
  html += '<button class="brand-logo-upload-btn" onclick="document.getElementById(\'persLogoInput\').click()">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  html += hasLogo ? ' Change Logo' : ' Upload Logo';
  html += '</button>';
  if (hasLogo) {
    html += '<button class="brand-logo-reset-btn" onclick="resetPersLogo()">Reset to Default</button>';
  }
  html += '</div>';
  html += '</div>';

  if (hasLogo) {
    html += '<div class="brand-logo-size-control">';
    html += '<div class="brand-logo-size-label"><span>Logo Size</span><span class="brand-logo-size-value" id="persLogoSizeValue">' + savedSize + '%</span></div>';
    html += '<input type="range" class="brand-logo-size-slider" id="persLogoSizeSlider" min="30" max="300" value="' + savedSize + '" oninput="handlePersLogoSizeChange(this.value)">';
    html += '</div>';
  }

  html += '<div class="brand-logo-hint">PNG, JPG, WebP, GIF, or SVG. Max 2MB.</div>';
  html += '</div>';
  container.innerHTML = html;
}

/**
 * v15.1: Render LifeAI logo picker
 */
function renderLifeLogoPicker(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  // v15.37: Per-profile logo key only - no shared key fallback
  var logoKey = typeof getCurrentLogoKey === 'function' ? getCurrentLogoKey() : ('roweos_lifeai_logo_profile_' + (parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0')));
  var sizeKey = logoKey + '_size';
  var savedLogo = localStorage.getItem(logoKey);
  var savedSize = localStorage.getItem(sizeKey) || '100';
  var hasLogo = !!savedLogo;

  var html = '<div class="brand-logo-picker">';
  html += '<div class="brand-logo-picker-label">LifeAI Logo</div>';
  html += '<div class="brand-logo-picker-sublabel">Upload a personal logo for LifeAI mode</div>';

  html += '<div class="brand-logo-preview-container">';
  html += '<div class="brand-logo-preview' + (hasLogo ? ' has-logo' : '') + '">';
  if (hasLogo) {
    html += '<img src="' + savedLogo + '" alt="Logo">';
  } else {
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>';
  }
  html += '</div>';

  html += '<div class="brand-logo-actions">';
  html += '<input type="file" id="persLifeLogoInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml" style="display:none;" onchange="handlePersLifeLogoUpload(this)">';
  html += '<button class="brand-logo-upload-btn" onclick="document.getElementById(\'persLifeLogoInput\').click()">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  html += hasLogo ? ' Change Logo' : ' Upload Logo';
  html += '</button>';
  if (hasLogo) {
    html += '<button class="brand-logo-reset-btn" onclick="resetPersLifeLogo()">Reset to Default</button>';
  }
  html += '</div>';
  html += '</div>';

  if (hasLogo) {
    html += '<div class="brand-logo-size-control">';
    html += '<div class="brand-logo-size-label"><span>Logo Size</span><span class="brand-logo-size-value" id="persLifeLogoSizeValue">' + savedSize + '%</span></div>';
    html += '<input type="range" class="brand-logo-size-slider" id="persLifeLogoSizeSlider" min="30" max="300" value="' + savedSize + '" oninput="handlePersLifeLogoSizeChange(this.value)">';
    html += '</div>';
  }

  html += '<div class="brand-logo-hint">PNG, JPG, WebP, GIF, or SVG. Max 2MB.</div>';
  html += '</div>';
  container.innerHTML = html;
}

/**
 * v15.1: Handle logo upload in brand personalization panel
 */
function handlePersLogoUpload(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('Logo must be under 2MB', 'error');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var logoKey = getCurrentLogoKey(persBrandIdx);
    localStorage.setItem(logoKey, e.target.result);
    renderBrandLogoPickerForBrand('settingsBrandLogoUploader', persBrandIdx);
    if (persBrandIdx === selectedBrand && typeof loadCurrentLogo === 'function') loadCurrentLogo();
    // v16.5: Sync logo to Firebase immediately
    syncPersLogoToFirebase(logoKey, e.target.result, 100);
    if (typeof showToast === 'function') showToast('Logo updated', 'success');
  };
  reader.readAsDataURL(file);
}

/**
 * v16.5: Sync any logo to Firebase V2 per-logo subcollection by explicit key
 */
function syncPersLogoToFirebase(logoKey, base64Data, size) {
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebaseUser && firebaseUser.uid) {
      var basePath = 'roweos_users/' + firebaseUser.uid;
      var docId = logoKey.replace(/[\/\.]/g, '_');
      var db = firebase.firestore();
      if (base64Data) {
        db.doc(basePath + '/logos/' + docId).set({
          key: logoKey,
          base64: base64Data,
          size: parseInt(size) || 100
        }).then(function() {
          console.log('[Logo] Synced to Firebase (V2 pers):', logoKey);
        }).catch(function(err) {
          console.warn('[Logo] Firebase sync failed:', err);
        });
        // v28.0: Dual-write logo to v4
        if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
          try { syncEngine.write('logos', docId, { key: logoKey, base64: base64Data, size: parseInt(size) || 100 }); } catch(_e) {}
        }
      } else {
        db.doc(basePath + '/logos/' + docId).delete().catch(function() {});
        // v28.0: Dual-write logo delete to v4
        if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
          try { syncEngine.delete('logos', docId); } catch(_e) {}
        }
      }
    }
  } catch(e) { console.warn('[Logo] Sync error:', e); }
}

/**
 * v15.1: Reset logo in brand personalization panel
 */
function resetPersLogo() {
  var logoKey = getCurrentLogoKey(persBrandIdx);
  var sizeKey = logoKey + '_size';
  localStorage.removeItem(logoKey);
  localStorage.removeItem(sizeKey);
  // v16.5: Delete from Firebase
  syncPersLogoToFirebase(logoKey, null, null);
  renderBrandLogoPickerForBrand('settingsBrandLogoUploader', persBrandIdx);
  if (persBrandIdx === selectedBrand && typeof loadCurrentLogo === 'function') loadCurrentLogo();
  if (typeof showToast === 'function') showToast('Logo reset to default', 'success');
}

/**
 * v15.1: Handle logo size change in brand personalization
 */
function handlePersLogoSizeChange(value) {
  var logoKey = getCurrentLogoKey(persBrandIdx);
  var sizeKey = logoKey + '_size';
  localStorage.setItem(sizeKey, value);
  var sizeValue = document.getElementById('persLogoSizeValue');
  if (sizeValue) sizeValue.textContent = value + '%';
  // v15.15: Always apply logo with new size in real-time
  if (persBrandIdx === selectedBrand) {
    var savedLogo = localStorage.getItem(logoKey);
    if (savedLogo && typeof applyBrandLogo === 'function') {
      applyBrandLogo(savedLogo, value);
    }
  }
}

/**
 * v15.1: Handle LifeAI logo upload in personalization panel
 */
function handlePersLifeLogoUpload(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('Logo must be under 2MB', 'error');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    // v15.37: Per-profile logo storage only - no shared key
    var logoKey = getCurrentLogoKey();
    localStorage.setItem(logoKey, e.target.result);
    // Update profile's logoKey reference
    var pIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    var pfs = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    if (pfs[pIdx]) {
      pfs[pIdx].logoKey = logoKey;
      if (typeof saveLifeProfiles === 'function') saveLifeProfiles(pfs);
    }
    renderLifeLogoPicker('settingsLifeLogoUploader');
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    if (currentMode === 'life' && typeof loadCurrentLogo === 'function') loadCurrentLogo();
    // v16.5: Sync logo to Firebase immediately
    syncPersLogoToFirebase(logoKey, e.target.result, 100);
    if (typeof showToast === 'function') showToast('LifeAI logo updated', 'success');
  };
  reader.readAsDataURL(file);
}

/**
 * v15.1: Reset LifeAI logo
 */
function resetPersLifeLogo() {
  // v15.37: Remove per-profile key only - no shared key
  var logoKey = typeof getCurrentLogoKey === 'function' ? getCurrentLogoKey() : ('roweos_lifeai_logo_profile_' + (parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0')));
  localStorage.removeItem(logoKey);
  localStorage.removeItem(logoKey + '_size');
  // v16.5: Delete from Firebase
  syncPersLogoToFirebase(logoKey, null, null);
  // Clear profile's logoKey reference
  var pIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var pfs = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  if (pfs[pIdx]) {
    delete pfs[pIdx].logoKey;
    if (typeof saveLifeProfiles === 'function') saveLifeProfiles(pfs);
  }
  renderLifeLogoPicker('settingsLifeLogoUploader');
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode === 'life' && typeof loadCurrentLogo === 'function') loadCurrentLogo();
  if (typeof showToast === 'function') showToast('LifeAI logo reset', 'success');
}

/**
 * v15.1: Handle LifeAI logo size change
 */
function handlePersLifeLogoSizeChange(value) {
  // v15.37: Per-profile logo size only - no shared key
  var logoKey = typeof getCurrentLogoKey === 'function' ? getCurrentLogoKey() : ('roweos_lifeai_logo_profile_' + (parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0')));
  localStorage.setItem(logoKey + '_size', value);
  var sizeValue = document.getElementById('persLifeLogoSizeValue');
  if (sizeValue) sizeValue.textContent = value + '%';
  // v15.15: Apply logo with new size in real-time
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode === 'life') {
    var savedLogo = localStorage.getItem(logoKey);
    if (savedLogo && typeof applyBrandLogo === 'function') {
      applyBrandLogo(savedLogo, value);
    }
  }
}

/**
 * v15.1: Initialize personalization UI in settings
 */
function initPersonalizationUI() {
  persBrandIdx = selectedBrand || 0;
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode === 'life') {
    switchPersonalizationMode('life');
  } else {
    switchPersonalizationMode('brand');
  }
}

function saveBrandEdits() {
  try {
    var indexEl = document.getElementById('editBrandIndex');
    var rawValue = indexEl ? indexEl.value : '';
    console.log('[saveBrandEdits] Raw index value:', rawValue);
    
    var idx = parseInt(rawValue);
    console.log('[saveBrandEdits] Parsed index:', idx, 'brands.length:', brands.length);
    
    // v9.1.14: Handle NaN or invalid index
    if (isNaN(idx) || idx < 0 || idx >= brands.length) {
      console.error('[saveBrandEdits] Invalid index:', idx);
      // Try using selectedBrand as fallback
      idx = selectedBrand;
      console.log('[saveBrandEdits] Using selectedBrand fallback:', idx);
    }
    
    var brand = brands[idx];
    
    if (!brand) {
      showToast('Brand not found', 'error');
      return;
    }
    
    var nameEl = document.getElementById('editBrandName');
    var name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      showToast('Brand name cannot be empty', 'error');
      return;
    }
    
    // Check for duplicate name (excluding current brand)
    var duplicate = brands.some(function(b, i) { 
      return i !== idx && b.name.toLowerCase() === name.toLowerCase(); 
    });
    if (duplicate) {
      showToast('Another brand with this name already exists', 'error');
      return;
    }
    
    // Helper function to safely get field value
    function getFieldValue(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }
    
    // Update ALL brand fields
    // Basic Identity
    brand.name = name;
    brand.shortName = getFieldValue('editBrandShortName'); // v11.0.5: Short name for sidebar
    brand.tagline = getFieldValue('editBrandTagline');
    
    // Philosophy & Mission
    brand.philosophy = getFieldValue('editBrandPhilosophy');
    brand.mission = getFieldValue('editBrandMission');
    brand.coreBelief = getFieldValue('editBrandCoreBelief');
    brand.ethos = getFieldValue('editBrandEthos');
    
    // Market Position (note: positioning renamed to products)
    brand.products = getFieldValue('editBrandProducts');
    brand.positioning = brand.products; // Keep for backwards compatibility
    brand.audience = getFieldValue('editBrandAudience');
    brand.promise = getFieldValue('editBrandPromise');
    brand.cta = getFieldValue('editBrandCTA');
    
    // Voice & Tone
    brand.voice = getFieldValue('editBrandVoice');
    brand.tone = getFieldValue('editBrandTone');
    brand.approach = getFieldValue('editBrandApproach');
    
    // Vocabulary
    brand.vocabDo = getFieldValue('editBrandVocabDo');
    brand.vocabDont = getFieldValue('editBrandVocabDont');
    brand.constraints = getFieldValue('editBrandConstraints');
    
    // Operations
    brand.services = getFieldValue('editBrandServices');
    brand.pricing = getFieldValue('editBrandPricing');
    brand.partnerships = getFieldValue('editBrandPartnerships');
    brand.deliverables = getFieldValue('editBrandDeliverables');
    
    // Specialty Fields
    brand.trainingApproach = getFieldValue('editBrandTrainingApproach');
    brand.programs = getFieldValue('editBrandPrograms');
    brand.adaEssentials = getFieldValue('editBrandAdaEssentials');
    brand.experience = getFieldValue('editBrandExperience');
    brand.properties = getFieldValue('editBrandProperties');
    
    // Contact & Location
    brand.location = getFieldValue('editBrandLocation');
    brand.contacts = getFieldValue('editBrandContacts');

    // v16.5 / v28.5: Primary brand setting with ID (survives reorder)
    var primaryCheckbox = document.getElementById('editPrimaryBrand');
    if (primaryCheckbox && primaryCheckbox.checked) {
      try {
        localStorage.setItem('roweos_primary_brand', String(idx));
        if (brands[idx] && brands[idx].id) localStorage.setItem('roweos_primary_brand_id', brands[idx].id);
        // v29.0: Sync primary brand to Firestore for cross-device consistency
        writeDB('profile/main', { 'settings.primaryBrand': String(idx), 'settings.primaryBrandId': brands[idx] ? brands[idx].id : '' });
      } catch(e) { console.warn('[Primary] Save failed:', e); }
    } else if (primaryCheckbox && !primaryCheckbox.checked) {
      // If unchecked and this WAS the primary, reset to 0
      var _pId2 = localStorage.getItem('roweos_primary_brand_id');
      var isPrimary2 = _pId2 ? (brands[idx] && brands[idx].id === _pId2) : (parseInt(localStorage.getItem('roweos_primary_brand') || '0') === idx);
      if (isPrimary2) {
        try {
          localStorage.setItem('roweos_primary_brand', '0');
          if (brands[0] && brands[0].id) localStorage.setItem('roweos_primary_brand_id', brands[0].id);
          // v29.0: Sync primary brand reset to Firestore
          writeDB('profile/main', { 'settings.primaryBrand': '0', 'settings.primaryBrandId': brands[0] ? brands[0].id : '' });
        } catch(e) {}
      }
    }

    // v23.0: Timestamp for conflict resolution
    brand._modifiedAt = Date.now();

    // Save to storage + trigger auto-sync
    saveBrands();

    // Update all UI
    if (typeof syncBrandDropdowns === 'function') syncBrandDropdowns();
    if (typeof renderMemoryBrandPills === 'function') renderMemoryBrandPills();
    if (typeof renderLibraryView === 'function') renderLibraryView();
    if (typeof renderGuardrailsUI === 'function') renderGuardrailsUI();
    if (typeof renderIdentityView === 'function') renderIdentityView();
    if (typeof updateBrandName === 'function') updateBrandName(); // v11.0.5: Update sidebar with shortName
    
    // v30.1: Refresh sidebar logo after brand edit (was missing from this dual path)
    if (typeof initBrandLogo === 'function') initBrandLogo();

    // Close modal
    closeModal('editBrandModal');

    // Show success message
    showToast('Brand updated successfully', 'success');
    
  } catch (err) {
    console.error('[saveBrandEdits] Error:', err);
    showToast('Error saving brand: ' + err.message, 'error');
    // Try to close modal anyway
    closeModal('editBrandModal');
  }
}

function openDeleteBrandModal() {
  var idx = selectedBrand;
  var brand = brands[idx];
  
  if (!brand) {
    showToast('Error', 'No brand selected', 'error');
    return;
  }
  
  // Prevent deleting last brand
  if (brands.length === 1) {
    showToast('Error', 'Cannot delete the last brand', 'error');
    return;
  }
  
  // Populate confirmation dialog
  document.getElementById('deleteBrandIndex').value = idx;
  document.getElementById('deleteBrandName').textContent = brand.name;
  
  // Open modal
  openModal('deleteBrandModal');
}

function confirmDeleteBrand() {
  var idx = parseInt(document.getElementById('deleteBrandIndex').value);
  var brand = brands[idx];

  if (!brand) {
    showToast('Brand not found', 'error');
    closeModal('deleteBrandModal');
    return;
  }

  var brandName = brand.name;

  // v15.47: Move to trash (soft delete) for restoration
  if (typeof window.deletedBrands !== 'undefined') {
    window.deletedBrands.unshift({
      brand: JSON.parse(JSON.stringify(brand)),
      deletedAt: Date.now(),
      deletedBy: 'user'
    });
    if (typeof saveDeletedBrands === 'function') saveDeletedBrands();
  }

  // Remove from array
  brands.splice(idx, 1);

  // Save to storage
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));

  // Clean up brand-specific data
  var brandKey = 'brand_' + idx;
  localStorage.removeItem(brandKey);
  localStorage.removeItem('model_' + idx);
  localStorage.removeItem('files_' + brandKey);

  // v9.1.14: Update selected brand index properly
  if (selectedBrand >= brands.length) {
    selectedBrand = Math.max(0, brands.length - 1);
  }
  selectedBrandIdx = selectedBrand;

  // Save selected brand
  localStorage.setItem(USER_DATA_KEYS.selectedBrand, selectedBrand.toString());

  // Close modal FIRST so UI can refresh
  closeModal('deleteBrandModal');

  // v9.1.14: Refresh all UI
  if (typeof updateBrandSelectors === 'function') updateBrandSelectors();
  if (typeof onBrandChange === 'function') onBrandChange();
  if (typeof loadIdentityData === 'function') loadIdentityData();
  // v15.47: Re-render settings brand list so deleted brand disappears immediately
  if (currentView === 'settings' && typeof showSettings === 'function') showSettings();

  // v25.1: saveBrands() already writes through to Firestore

  // Show success message
  showToast('Brand "' + brandName + '" deleted', 'success');
}

// Import/Export Functions
function exportBrandData() {
  // v22.49: Fix - use global selectedBrand, not undefined selectedBrandIdx
  var brand = brands[selectedBrand];
  if (!brand) {
    showToast('No brand selected', 'error');
    return;
  }

  // Get brand-specific data
  var brandKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(selectedBrand) : 'brand_' + selectedBrand;
  var modelConfig = loadFromLocalStorage('model_' + selectedBrand);
  var brandMemory = loadFromLocalStorage(brandKey);
  var brandFiles = loadFromLocalStorage('files_' + brandKey);
  
  // Create export object
  var exportData = {
    brand: brand,
    memory: brandMemory || {},
    modelConfig: modelConfig || {},
    files: brandFiles || [],
    exportDate: new Date().toISOString(),
    version: 'v2.50.0'
  };
  
  // Convert to JSON
  var jsonStr = JSON.stringify(exportData, null, 2);
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  
  // Download
  var a = document.createElement('a');
  a.href = url;
  a.download = brand.name.replace(/\s+/g, '_') + '_export.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Success', 'Brand data exported', 'success');
}

function exportAllBrands() {
  var allData = {
    brands: brands,
    memory: {},
    modelConfigs: {},
    files: {},
    exportDate: new Date().toISOString(),
    version: 'v2.50.0'
  };
  
  // Gather all brand-specific data
  brands.forEach(function(brand, idx) {
    var brandKey = 'brand_' + idx;
    allData.memory[brandKey] = loadFromLocalStorage(brandKey) || {};
    allData.modelConfigs[idx] = loadFromLocalStorage('model_' + idx) || {};
    allData.files[brandKey] = loadFromLocalStorage('files_' + brandKey) || [];
  });
  
  // Convert to JSON
  var jsonStr = JSON.stringify(allData, null, 2);
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  
  // Download
  var a = document.createElement('a');
  a.href = url;
  a.download = 'RoweOS_All_Brands_' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Success', 'All brands exported', 'success');
}

// v15.47: Export brand modal with format selection (JSON or Rich Text)
function openExportBrandModal() {
  var modal = document.getElementById('exportBrandModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'exportBrandModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  var brandName = brands[selectedBrand] ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'Brand';
  // v22.49: Fix - use .modal class for proper background
  modal.innerHTML = '<div class="modal" style="max-width:420px;" onclick="event.stopPropagation()">' +
    '<div class="modal-header"><h2 class="modal-title">Export Brand</h2>' +
    '<button class="modal-close" onclick="closeModal(\'exportBrandModal\')">' +
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>' +
    '<div class="modal-body">' +
    '<div style="margin-bottom:var(--space-4);">' +
    '<div style="font-weight:600;margin-bottom:var(--space-2);">Scope</div>' +
    '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">' +
    '<input type="radio" name="exportScope" value="current" checked> Current Brand (' + escapeHtml(brandName) + ')</label>' +
    '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">' +
    '<input type="radio" name="exportScope" value="all"> All Brands (' + brands.length + ')</label>' +
    '</div>' +
    '<div style="margin-bottom:var(--space-4);">' +
    '<div style="font-weight:600;margin-bottom:var(--space-2);">Format</div>' +
    '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">' +
    '<input type="radio" name="exportFormat" value="json" checked> JSON (re-importable)</label>' +
    '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">' +
    '<input type="radio" name="exportFormat" value="txt"> Rich Text (.txt)</label>' +
    '</div>' +
    '<button class="btn btn-primary" style="width:100%;" onclick="executeExportBrand()">Export</button>' +
    '</div></div>';
  openModal('exportBrandModal');
}

function executeExportBrand() {
  var scope = document.querySelector('input[name="exportScope"]:checked').value;
  var format = document.querySelector('input[name="exportFormat"]:checked').value;
  closeModal('exportBrandModal');

  if (format === 'json') {
    if (scope === 'all') {
      exportAllBrands();
    } else {
      exportBrandData();
    }
  } else {
    // Rich Text export
    var brandsToExport = scope === 'all' ? brands : [brands[selectedBrand]];
    var text = 'RoweOS Brand Export\n' + '='.repeat(40) + '\n';
    text += 'Exported: ' + new Date().toLocaleString() + '\n\n';
    brandsToExport.forEach(function(brand, i) {
      if (scope === 'all') text += '\n' + '-'.repeat(40) + '\n';
      text += 'BRAND: ' + (brand.name || 'Unnamed') + '\n';
      if (brand.shortName) text += 'Short Name: ' + brand.shortName + '\n';
      if (brand.tagline) text += 'Tagline: ' + brand.tagline + '\n';
      if (brand.description) text += '\nDescription:\n' + brand.description + '\n';
      if (brand.voice) text += '\nVoice & Tone:\n' + brand.voice + '\n';
      if (brand.audience) text += '\nTarget Audience:\n' + brand.audience + '\n';
      if (brand.keywords && brand.keywords.length) text += '\nKeywords: ' + (Array.isArray(brand.keywords) ? brand.keywords.join(', ') : brand.keywords) + '\n';
      // Include memory if available
      var idx = brands.indexOf(brand);
      var mem = null;
      try { mem = JSON.parse(localStorage.getItem('brand_' + idx)); } catch(e) {}
      if (mem && typeof mem === 'object') {
        var memText = typeof mem === 'string' ? mem : JSON.stringify(mem, null, 2);
        if (memText && memText.length > 2) text += '\nMemory:\n' + memText + '\n';
      }
      text += '\n';
    });
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (scope === 'all' ? 'RoweOS_All_Brands' : (brands[selectedBrand].name || 'Brand').replace(/\s+/g, '_')) + '_export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Brand exported as text', 'success');
  }
}

function importBrandData(input) {
  var file = input.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      
      // Validate data structure
      if (!data.brand || !data.brand.name) {
        showToast('Error', 'Invalid brand data file', 'error');
        return;
      }
      
      // Check if brand already exists
      var exists = brands.some(function(b) { 
        return b.name.toLowerCase() === data.brand.name.toLowerCase(); 
      });
      
      if (exists) {
        var confirmImport = confirm('A brand named "' + data.brand.name + '" already exists. Import anyway as a duplicate?');
        if (!confirmImport) {
          input.value = '';
          return;
        }
        
        // Append " (Imported)" to avoid confusion
        data.brand.name += ' (Imported)';
      }
      
      // Add brand
      brands.push(data.brand);
      var newIdx = brands.length - 1;
      
      // Import memory if present
      if (data.memory) {
        var brandKey = 'brand_' + newIdx;
        saveToLocalStorage(brandKey, data.memory);
      }
      
      // Import model config if present
      if (data.modelConfig) {
        saveToLocalStorage('model_' + newIdx, data.modelConfig);
      }
      
      // Import files if present
      if (data.files) {
        saveToLocalStorage('files_brand_' + newIdx, data.files);
      }
      
      // Save brands
      saveToLocalStorage('brands', brands);
      
      // Update UI
      syncBrandDropdowns();
      renderMemoryBrandPills();
      renderLibraryView();
      renderGuardrailsUI();
      
      // Switch to imported brand
      selectedBrandIdx = newIdx;
      onBrandChange();
      
      // Close modal
      closeModal('importExportModal');
      
      // Show success
      showToast('Success', 'Brand "' + data.brand.name + '" imported successfully', 'success');
      
      // Clear input
      input.value = '';
      
    } catch (err) {
      showToast('Error', 'Failed to import brand: ' + err.message, 'error');
      input.value = '';
    }
  };
  
  reader.readAsText(file);
}

// v25.2: Spotlight functions (replace old openSearch/closeSearch/performGlobalSearch)
var _spotlightHighlight = -1;
var _spotlightResults = [];
var _spotlightDebounce = null;

function openSpotlight() {
  var overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(function() {
    var input = document.getElementById('spotlightInput');
    if (input) { input.focus(); input.value = ''; }
    // Show recent searches
    showRecentSearches();
    updateScopeButton();
  }, 50);
  _spotlightHighlight = -1;
  _spotlightResults = [];
}
// Keep backward compat
var openSearch = openSpotlight;

function closeSpotlight() {
  var overlay = document.getElementById('searchOverlay');
  if (overlay) { overlay.style.display = 'none'; document.body.style.overflow = ''; }
}
var closeSearch = closeSpotlight;

function showRecentSearches() {
  var container = document.getElementById('spotlightResults');
  if (!container) return;
  var recent = getRecentSearches();
  if (recent.length === 0) {
    container.innerHTML = '<div class="search-empty">Type to search across all of RoweOS</div>';
    return;
  }
  var html = '<div class="search-result-group">Recent</div>';
  for (var i = 0; i < recent.length; i++) {
    html += '<div class="search-recent-item" onclick="document.getElementById(\'spotlightInput\').value=this.textContent.trim();onSpotlightInput(this.textContent.trim())">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
      + escapeHtml(recent[i]) + '</div>';
  }
  container.innerHTML = html;
}

function updateScopeButton() {
  var btn = document.getElementById('spotlightScopeBtn');
  if (!btn) return;
  var scope = getSearchScope();
  btn.textContent = scope.label;
}

function toggleSearchScope() {
  _searchScope = _searchScope === 'current' ? 'all' : 'current';
  updateScopeButton();
  var input = document.getElementById('spotlightInput');
  if (input && input.value.trim()) onSpotlightInput(input.value);
}

function setSearchMode(mode, btn) {
  _searchMode = mode;
  var btns = document.querySelectorAll('.search-mode-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  var input = document.getElementById('spotlightInput');
  if (input && input.value.trim()) onSpotlightInput(input.value);
}

function onSpotlightInput(value) {
  if (_spotlightDebounce) clearTimeout(_spotlightDebounce);
  _spotlightDebounce = setTimeout(function() {
    if (!value || value.trim().length === 0) { showRecentSearches(); return; }
    executeSearch(value, _searchMode, function(results) {
      renderSpotlightResults(results);
    });
  }, 200);
}

function onSpotlightKeydown(e) {
  if (e.key === 'Escape') { closeSpotlight(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    var modes = ['ai', 'navigate', 'actions'];
    var idx = modes.indexOf(_searchMode);
    var next = modes[(idx + 1) % modes.length];
    var btn = document.querySelector('.search-mode-btn[data-mode="' + next + '"]');
    setSearchMode(next, btn);
    return;
  }
  var items = document.querySelectorAll('#spotlightResults .search-result-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _spotlightHighlight = Math.min(_spotlightHighlight + 1, items.length - 1);
    highlightSpotlightItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _spotlightHighlight = Math.max(_spotlightHighlight - 1, -1);
    highlightSpotlightItem(items);
  } else if (e.key === 'Enter') {
    if (_spotlightHighlight >= 0 && _spotlightHighlight < _spotlightResults.length) {
      var result = _spotlightResults[_spotlightHighlight];
      if (result && typeof result.action === 'function') { result.action(); closeSpotlight(); }
    }
  }
}

function highlightSpotlightItem(items) {
  for (var i = 0; i < items.length; i++) {
    items[i].classList.toggle('highlighted', i === _spotlightHighlight);
  }
}

function renderSpotlightResults(data) {
  var container = document.getElementById('spotlightResults');
  if (!container) return;
  _spotlightResults = [];
  _spotlightHighlight = -1;
  var html = '';

  // AI response
  if (data.ai && data.ai.text) {
    var mode = _bloomSource && _bloomSource.indexOf('life_') === 0 ? 'LifeAI' : 'BrandAI';
    html += '<div class="search-ai-response">'
      + '<div class="search-ai-header">'
      + '<div class="search-ai-avatar">' + mode.charAt(0) + '</div>'
      + '<span class="search-ai-label">' + mode + '</span>'
      + '</div>'
      + '<div class="search-ai-text">' + escapeHtml(data.ai.text).substring(0, 300) + '</div>'
      + '</div>';
  }

  // Navigation results
  var navItems = data.nav || [];
  var actionItems = data.actions || [];
  var allItems = actionItems.concat(navItems);

  if (allItems.length > 0) {
    var groupLabel = actionItems.length > 0 ? 'Actions' : 'Results';
    html += '<div class="search-result-group">' + groupLabel + '</div>';
    for (var i = 0; i < Math.min(allItems.length, 6); i++) {
      var item = allItems[i];
      _spotlightResults.push(item);
      var typeLabel = item.type || 'result';
      html += '<div class="search-result-item" onclick="_spotlightResults[' + (_spotlightResults.length - 1) + '].action();closeSpotlight()">'
        + '<span class="search-result-type">' + typeLabel + '</span>'
        + '<span class="search-result-title">' + escapeHtml(item.title) + '</span>'
        + '<span class="search-result-desc">' + escapeHtml(item.desc || '') + '</span>'
        + '</div>';
    }
  }

  if (!html) html = '<div class="search-empty">No results found</div>';
  container.innerHTML = html;
}

// v25.2: Universal Search Engine
var _searchMode = 'ai'; // 'ai', 'navigate', 'actions'
var _searchScope = 'current'; // 'current' or 'all'
var _searchRecentKey = 'roweos_recent_searches';

function getSearchScope() {
  if (_searchScope === 'all') return { brands: brands, label: 'All Brands' };
  var idx = selectedBrand || 0;
  return { brands: brands[idx] ? [brands[idx]] : brands, brandIdx: idx, label: (brands[idx] || {}).shortName || (brands[idx] || {}).name || 'Current Brand' };
}

function addRecentSearch(query) {
  if (!query || query.trim().length < 2) return;
  var recent = [];
  try { recent = JSON.parse(localStorage.getItem(_searchRecentKey) || '[]'); } catch(e) {}
  recent = recent.filter(function(r) { return r !== query; });
  recent.unshift(query);
  if (recent.length > 10) recent = recent.slice(0, 10);
  localStorage.setItem(_searchRecentKey, JSON.stringify(recent));
}

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(_searchRecentKey) || '[]'); } catch(e) { return []; }
}

function executeSearch(query, mode, callback) {
  if (!query || query.trim().length === 0) { callback([]); return; }
  query = query.trim();
  addRecentSearch(query);
  mode = mode || _searchMode;

  if (mode === 'ai') {
    searchWithAI(query, function(aiResults) {
      // Also include navigation results as fallback
      var navResults = searchNavigate(query);
      callback({ ai: aiResults, nav: navResults.slice(0, 4) });
    });
  } else if (mode === 'actions') {
    var actionResults = searchActions(query);
    var navResults = searchNavigate(query);
    callback({ actions: actionResults, nav: navResults.slice(0, 4) });
  } else {
    var navResults = searchNavigate(query);
    callback({ nav: navResults });
  }
}

function fuzzyMatch(text, query) {
  if (!text || !query) return false;
  text = text.toLowerCase();
  query = query.toLowerCase();
  // Substring match
  if (text.indexOf(query) !== -1) return true;
  // Word-boundary match (each query word appears somewhere)
  var words = query.split(/\s+/);
  var allFound = true;
  for (var w = 0; w < words.length; w++) {
    if (text.indexOf(words[w]) === -1) { allFound = false; break; }
  }
  return allFound;
}

function searchNavigate(query) {
  var results = [];
  var q = query.toLowerCase().trim();
  var scope = getSearchScope();

  // 1. Features/Views
  var views = [
    { name: 'BrandAI', view: 'signal', icon: 'chat', desc: 'AI-powered brand assistant' },
    { name: 'Focus', view: 'signal', section: 'focus', icon: 'focus', desc: 'Tasks, calendar, and daily planning' },
    { name: 'Bloom', view: 'bloom', icon: 'bloom', desc: 'AI content feed' },
    { name: 'Pulse', view: 'pulse', icon: 'pulse', desc: 'Goals and progress tracking' },
    { name: 'Studio', view: 'studio', icon: 'studio', desc: 'Content creation workspace' },
    { name: 'Mail', view: 'mail', icon: 'mail', desc: 'Email composition and management' },
    { name: 'Rhythm', view: 'rhythm', icon: 'rhythm', desc: 'Calendar and scheduling' },
    { name: 'Library', view: 'library', icon: 'library', desc: 'Files and documents' },
    { name: 'Automations', view: 'automations', icon: 'automations', desc: 'Workflows and pipelines' },
    { name: 'Identity', view: 'identity', icon: 'identity', desc: 'Brand voice and identity' },
    { name: 'Clients', view: 'clients', icon: 'clients', desc: 'Contacts and CRM' },
    { name: 'Settings', view: 'settings', icon: 'settings', desc: 'App configuration' },
    { name: 'Sync', view: 'sync', icon: 'sync', desc: 'Cloud sync and backup' },
    { name: 'Analytics', view: 'analytics', icon: 'analytics', desc: 'Usage and performance' }
  ];
  for (var vi = 0; vi < views.length; vi++) {
    if (fuzzyMatch(views[vi].name + ' ' + views[vi].desc, q)) {
      results.push({ type: 'feature', title: views[vi].name, desc: views[vi].desc, action: function(v) { return function() { showView(v.view); if (v.section) showScreen(v.section); }; }(views[vi]) });
    }
  }

  // 2. Brands
  for (var bi = 0; bi < brands.length; bi++) {
    var b = brands[bi];
    var bText = (b.name || '') + ' ' + (b.shortName || '') + ' ' + (b.tagline || '') + ' ' + (b.industry || '');
    if (fuzzyMatch(bText, q)) {
      results.push({ type: 'brand', title: b.shortName || b.name, desc: b.tagline || b.industry || 'Brand', action: function(idx) { return function() { selectedBrand = idx; localStorage.setItem('roweos_selected_brand', String(idx)); if (typeof applyCurrentBrandAccent === 'function') applyCurrentBrandAccent(); showView('pulse'); }; }(bi) }); // v28.8: signal→pulse
    }
  }

  // 3. Clients
  try {
    var clients = JSON.parse(localStorage.getItem('roweos_clients') || '[]');
    for (var ci = 0; ci < clients.length; ci++) {
      var c = clients[ci];
      if (fuzzyMatch((c.name || '') + ' ' + (c.company || '') + ' ' + (c.email || ''), q)) {
        results.push({ type: 'client', title: c.name || 'Client', desc: c.company || c.email || '', action: function() { showView('clients'); } });
      }
    }
  } catch(e) {}

  // 4. Automations
  try {
    var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    for (var ai2 = 0; ai2 < autos.length; ai2++) {
      var a = autos[ai2];
      if (fuzzyMatch(a.name || '', q)) {
        results.push({ type: 'automation', title: a.name, desc: 'Automation', action: function() { showView('automations'); } });
      }
    }
  } catch(e) {}

  // 5. Pulse goals
  try {
    var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    for (var gi = 0; gi < goals.length; gi++) {
      var g = goals[gi];
      if (fuzzyMatch(g.name || '', q)) {
        results.push({ type: 'goal', title: g.name, desc: 'Pulse Goal', action: function() { showView('pulse'); } });
      }
    }
  } catch(e) {}

  // 6. Calendar events
  try {
    var cal = JSON.parse(localStorage.getItem('roweos_calendar') || '[]');
    for (var ei = 0; ei < Math.min(cal.length, 50); ei++) {
      if (fuzzyMatch(cal[ei].title || '', q)) {
        results.push({ type: 'event', title: cal[ei].title, desc: (cal[ei].date || '') + ' ' + (cal[ei].time || ''), action: function() { showView('rhythm'); } });
      }
    }
  } catch(e) {}

  // 7. Library items
  try {
    var lib = JSON.parse(localStorage.getItem('roweosLibrary') || '{}');
    if (lib.files) {
      for (var fi = 0; fi < lib.files.length; fi++) {
        if (fuzzyMatch(lib.files[fi].name || '', q)) {
          results.push({ type: 'file', title: lib.files[fi].name, desc: 'Library', action: function() { showView('library'); } });
        }
      }
    }
  } catch(e) {}

  return results.slice(0, 20);
}

function searchActions(query) {
  var results = [];
  var q = query.toLowerCase().trim();

  // Pattern: "new email to {name}" or "email {name}"
  var emailMatch = q.match(/^(?:new )?(?:email|mail|compose|write)(?: to)? (.+)/i);
  if (emailMatch) {
    var recipient = emailMatch[1].trim();
    results.push({ type: 'action', title: 'Compose email to ' + recipient, desc: 'Opens Mail composer', action: function() { showView('mail'); if (typeof showMailTab === 'function') showMailTab('compose'); } });
  }

  // Pattern: "run {automation}" or "execute {automation}"
  var runMatch = q.match(/^(?:run|execute|start|trigger) (.+)/i);
  if (runMatch) {
    var autoName = runMatch[1].trim();
    try {
      var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
      for (var i = 0; i < autos.length; i++) {
        if (fuzzyMatch(autos[i].name || '', autoName)) {
          results.push({ type: 'action', title: 'Run "' + autos[i].name + '"', desc: 'Execute automation', action: function(auto) { return function() { if (typeof runAutomationNow === 'function') runAutomationNow(auto); }; }(autos[i]) });
        }
      }
    } catch(e) {}
  }

  // Pattern: "add goal {text}" or "new goal {text}"
  var goalMatch = q.match(/^(?:add|new|create) (?:goal|pulse goal) (.+)/i);
  if (goalMatch) {
    var goalText = goalMatch[1].trim();
    results.push({ type: 'action', title: 'Add Pulse goal: "' + goalText + '"', desc: 'Creates a new goal', action: function() { showView('pulse'); } });
  }

  // Pattern: "new task {text}" or "add task {text}"
  var taskMatch = q.match(/^(?:add|new|create) (?:task|todo|focus) (.+)/i);
  if (taskMatch) {
    results.push({ type: 'action', title: 'Add Pulse task: "' + taskMatch[1].trim() + '"', desc: 'Creates a new task', action: function() { showView('pulse'); } }); // v28.8: signal→pulse
  }

  // Pattern: "open {feature}"
  var openMatch = q.match(/^(?:open|go to|show|switch to) (.+)/i);
  if (openMatch) {
    var navResults = searchNavigate(openMatch[1]);
    for (var ni = 0; ni < Math.min(navResults.length, 3); ni++) {
      navResults[ni].type = 'action';
      navResults[ni].title = 'Open ' + navResults[ni].title;
      results.push(navResults[ni]);
    }
  }

  // Pattern: "new automation" or "create automation"
  if (/^(?:new|create|add) automation/i.test(q)) {
    results.push({ type: 'action', title: 'Create new automation', desc: 'Opens automation builder', action: function() { showView('automations'); } });
  }

  return results;
}

function searchWithAI(query, callback) {
  var scope = getSearchScope();
  var brandName = scope.brands[0] ? (scope.brands[0].shortName || scope.brands[0].name) : 'RoweOS';

  // Build context summary for AI
  var context = 'You are a search assistant for RoweOS, a brand intelligence platform. ';
  context += 'Current brand: ' + brandName + '. ';

  // Add data summaries
  try {
    var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    if (goals.length > 0) context += 'Pulse goals: ' + goals.map(function(g) { return g.name; }).join(', ') + '. ';
  } catch(e) {}
  try {
    var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    if (autos.length > 0) context += 'Automations: ' + autos.map(function(a) { return a.name; }).join(', ') + '. ';
  } catch(e) {}
  try {
    var clients = JSON.parse(localStorage.getItem('roweos_clients') || '[]');
    if (clients.length > 0) context += 'Clients: ' + clients.slice(0, 10).map(function(c) { return c.name + (c.company ? ' (' + c.company + ')' : ''); }).join(', ') + '. ';
  } catch(e) {}
  try {
    var sent = JSON.parse(localStorage.getItem('roweos_mail_sent') || '[]');
    if (sent.length > 0) context += 'Recent sent emails: ' + sent.slice(0, 5).map(function(m) { return '"' + (m.subject || 'No subject') + '" to ' + (m.to || 'unknown'); }).join(', ') + '. ';
  } catch(e) {}

  var systemPrompt = context + 'Answer the user\'s search query concisely. If they ask about their data (goals, emails, clients, automations), reference the specific items. Keep responses under 150 words. Never use em-dashes. Use plain language.';

  // Get API settings
  var brandIdx = selectedBrand || 0;
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6';
  var apiKey = '';
  try {
    var bSettings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    provider = bSettings.provider || 'anthropic';
    model = bSettings.model || 'claude-sonnet-4-6';
    apiKey = getApiKey(provider);
    if (provider === 'roweos' && typeof resolveRoweOSAI === 'function') {
      var resolved = resolveRoweOSAI({ userMessage: query, systemPrompt: systemPrompt });
      provider = resolved.provider;
      model = resolved.model;
      apiKey = resolved.apiKey || getApiKey(resolved.provider);
    }
  } catch(e) {}

  if (!apiKey) {
    callback({ text: 'No API key configured. Switch to Navigate mode for local search.', results: [] });
    return;
  }

  var messages = [{ role: 'user', content: query }];

  if (typeof callAnthropicChat === 'function' && provider === 'anthropic') {
    callAnthropicChat(model, apiKey, messages, systemPrompt, function(response) {
      callback({ text: response, results: [] });
    }, function(err) {
      callback({ text: 'Search failed. Try Navigate mode.', results: [] });
    });
  } else if (typeof callOpenAIChat === 'function' && provider === 'openai') {
    callOpenAIChat(model, apiKey, messages, systemPrompt, function(response) {
      callback({ text: response, results: [] });
    }, function(err) {
      callback({ text: 'Search failed. Try Navigate mode.', results: [] });
    });
  } else {
    // Fallback to navigate
    callback({ text: null, results: searchNavigate(query) });
  }
}

// Keep backward compat
function performGlobalSearch(q) { onSpotlightInput(q); }

// v25.2: Search Side Panel
function openSearchPanel(tab) {
  var panel = document.getElementById('searchSidePanel');
  var scrim = document.getElementById('searchSideScrim');
  if (panel) panel.classList.add('open');
  if (scrim) scrim.classList.add('open');
  if (tab === 'notifications') {
    switchSidePanelTab('notifications', document.querySelector('.search-side-tab[data-tab="notifications"]'));
  } else {
    switchSidePanelTab('search', document.querySelector('.search-side-tab[data-tab="search"]'));
    setTimeout(function() {
      var input = document.getElementById('sidePanelSearchInput');
      if (input) input.focus();
    }, 100);
  }
}

function closeSearchPanel() {
  var panel = document.getElementById('searchSidePanel');
  var scrim = document.getElementById('searchSideScrim');
  if (panel) panel.classList.remove('open');
  if (scrim) scrim.classList.remove('open');
}

function switchSidePanelTab(tab, btn) {
  var tabs = document.querySelectorAll('.search-side-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  var searchView = document.getElementById('sidePanelSearchView');
  var notiView = document.getElementById('sidePanelNotificationsView');
  if (tab === 'search') {
    if (searchView) searchView.style.display = '';
    if (notiView) notiView.style.display = 'none';
  } else {
    if (searchView) searchView.style.display = 'none';
    if (notiView) { notiView.style.display = ''; notiView.style.flex = '1'; }
    renderSidePanelNotifications();
  }
}

var _sidePanelDebounce = null;
function onSidePanelSearch(value) {
  if (_sidePanelDebounce) clearTimeout(_sidePanelDebounce);
  _sidePanelDebounce = setTimeout(function() {
    if (!value || value.trim().length === 0) {
      var container = document.getElementById('sidePanelResults');
      if (container) container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">Search across all of RoweOS</div>';
      return;
    }
    // Try AI first, fall back to navigate
    executeSearch(value, 'ai', function(results) {
      if ((!results.ai || !results.ai.text) && (!results.nav || results.nav.length === 0)) {
        // AI returned nothing, try navigate mode
        var navResults = searchNavigate(value);
        renderSidePanelResults({ nav: navResults });
      } else {
        renderSidePanelResults(results);
      }
    });
  }, 300);
}

function renderSidePanelResults(data) {
  var container = document.getElementById('sidePanelResults');
  if (!container) return;
  window._sidePanelActions = [];
  var html = '';

  if (data.ai && data.ai.text) {
    var mode = typeof _lifeMode !== 'undefined' && _lifeMode ? 'LifeAI' : 'BrandAI';
    html += '<div style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">'
      + '<div style="width:20px;height:20px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;font-weight:700;">' + mode.charAt(0) + '</div>'
      + '<span style="font-size:11px;color:var(--accent);font-weight:600;">' + mode + '</span></div>'
      + '<div style="font-size:13px;color:var(--text-secondary);line-height:1.7;">' + escapeHtml(data.ai.text) + '</div>'
      + '</div>';
  }

  var navItems = data.nav || [];
  var actionItems = data.actions || [];
  var allItems = actionItems.concat(navItems);
  if (allItems.length > 0) {
    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];
      window._sidePanelActions.push(item.action);
      html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px;margin-bottom:6px;cursor:pointer;" onclick="closeSearchPanel();if(window._sidePanelActions[' + i + '])window._sidePanelActions[' + i + ']()">'
        + '<div style="font-size:12px;color:var(--text-primary);">' + escapeHtml(item.title) + '</div>'
        + '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;">' + escapeHtml(item.desc || '') + '</div>'
        + '</div>';
    }
  }

  if (!html) html = '<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">No results found</div>';
  container.innerHTML = html;
}

function renderSidePanelNotifications() {
  var container = document.getElementById('sidePanelNotificationsView');
  if (!container) return;
  // Reuse existing notification panel content
  var ncPanel = document.getElementById('notificationCenterPanel');
  if (ncPanel) {
    container.innerHTML = ncPanel.innerHTML;
  } else {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">No notifications</div>';
  }
}

function _performGlobalSearch_legacy(query) {
  var resultsContainer = document.getElementById('searchResults');

  if (!query || query.trim().length === 0) {
    if (resultsContainer) resultsContainer.innerHTML = '<div class="search-empty">Type to search across all brands, memory, files, and conversations</div>';
    return;
  }
  
  query = query.toLowerCase().trim();
  var results = [];
  
  // Search views/features
  var views = [
    {name: 'BrandAI', view: 'signal', desc: 'AI-powered brand assistant'},
    {name: 'Focus', view: 'signal', desc: 'Signal processing and brand insights'},
    {name: 'Pulse', view: 'pulse', desc: 'Brand health dashboard'},
    {name: 'Studio', view: 'studio', desc: 'Content creation workspace'},
    {name: 'Rhythm', view: 'rhythm', desc: 'Calendar and scheduling'},
    {name: 'Library', view: 'library', desc: 'File management'},
    {name: 'Intelligence', view: 'identity', desc: 'Brand configuration'},
    {name: 'Tuning', view: 'tuning', desc: 'System configuration'},
    {name: 'Memory', view: 'memory', desc: 'Brand memory and context'},
    {name: 'Export', view: 'export', desc: 'Export brand data'},
    {name: 'Guardrails', view: 'guardrails', desc: 'Content guidelines'}
  ];
  
  views.forEach(function(v) {
    if (v.name.toLowerCase().includes(query) || v.desc.toLowerCase().includes(query)) {
      results.push({
        title: v.name,
        path: 'View / ' + v.desc,
        action: function() {
          showView(v.view);
          closeSearch();
        }
      });
    }
  });
  
  // Search brands
  brands.forEach(function(brand, idx) {
    if (brand.name.toLowerCase().includes(query)) {
      results.push({
        title: brand.name,
        path: 'Brand / Identity',
        action: function() { 
          selectedBrandIdx = idx; 
          onBrandChange(); 
          showView('identity'); 
          closeSearch(); 
        }
      });
    }
    
    if (brand.tagline && brand.tagline.toLowerCase().includes(query)) {
      results.push({
        title: brand.tagline,
        path: 'Brand / ' + brand.name + ' / Tagline',
        action: function() { 
          selectedBrandIdx = idx; 
          onBrandChange(); 
          showView('identity'); 
          closeSearch(); 
        }
      });
    }
  });
  
  // Search memory
  Object.keys(localStorage).forEach(function(key) {
    if (key.startsWith('brand_')) {
      try {
        var data = JSON.parse(localStorage.getItem(key));
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(function(field) {
            var value = data[field];
            if (value && typeof value === 'string' && value.toLowerCase().includes(query)) {
              var brandIdx = parseInt(key.split('_')[1]);
              var brandName = brands[brandIdx] ? brands[brandIdx].name : 'Unknown';
              results.push({
                title: field.charAt(0).toUpperCase() + field.slice(1),
                path: 'Memory / ' + brandName,
                action: function() { 
                  selectedBrandIdx = brandIdx; 
                  selectBrandPill(null, key); 
                  showView('memory'); 
                  closeSearch(); 
                }
              });
            }
          });
        }
      } catch (e) {}
    }
  });
  
  // v24.27: Search conversations
  try {
    var convos = JSON.parse(localStorage.getItem('roweos_conversations') || '[]');
    for (var ci = 0; ci < convos.length && results.length < 30; ci++) {
      var c = convos[ci];
      var cTitle = c.title || '';
      var cFirst = (c.conversation && c.conversation[0]) ? (c.conversation[0].displayContent || (typeof c.conversation[0].content === 'string' ? c.conversation[0].content : '')) : '';
      if ((cTitle.toLowerCase().indexOf(query) !== -1) || (cFirst.toLowerCase().indexOf(query) !== -1)) {
        results.push({ title: cTitle || cFirst.substring(0, 60), path: 'Chat History', action: (function(idx) { return function() { closeSearch(); showView('agent'); if (typeof loadConversation === 'function') loadConversation(idx); }; })(ci) });
      }
    }
  } catch(e) {}

  // v24.27: Search library
  try {
    var lib = JSON.parse(localStorage.getItem('roweos_library') || '[]');
    for (var li = 0; li < lib.length && results.length < 30; li++) {
      var item = lib[li];
      if ((item.title && item.title.toLowerCase().indexOf(query) !== -1) || (item.content && item.content.toLowerCase().indexOf(query) !== -1)) {
        results.push({ title: item.title || 'Library Item', path: 'Library' + (item.folder ? ' / ' + item.folder : ''), action: (function(id) { return function() { closeSearch(); showView('library'); }; })(item.id) });
      }
    }
  } catch(e) {}

  // v24.27: Search automations
  try {
    var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    for (var ai = 0; ai < autos.length && results.length < 30; ai++) {
      var a = autos[ai];
      if ((a.name && a.name.toLowerCase().indexOf(query) !== -1) || (a.description && a.description.toLowerCase().indexOf(query) !== -1)) {
        results.push({ title: a.name || 'Automation', path: 'Automations' + (a.enabled ? '' : ' (disabled)'), action: function() { closeSearch(); showView('automations'); } });
      }
    }
  } catch(e) {}

  // v24.27: Search clients
  try {
    var clients = JSON.parse(localStorage.getItem('roweos_clients') || '[]');
    for (var cli = 0; cli < clients.length && results.length < 30; cli++) {
      var cl = clients[cli];
      if ((cl.name && cl.name.toLowerCase().indexOf(query) !== -1) || (cl.company && cl.company.toLowerCase().indexOf(query) !== -1) || (cl.email && cl.email.toLowerCase().indexOf(query) !== -1)) {
        results.push({ title: cl.name || cl.company || 'Client', path: 'Clients' + (cl.company ? ' / ' + cl.company : ''), action: function() { closeSearch(); showView('clients'); } });
      }
    }
  } catch(e) {}

  // Store results globally for click handlers
  window.currentSearchResults = results;
  
  // Display results
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-empty">No results found for "' + query + '"</div>';
  } else {
    var html = '';
    results.slice(0, 20).forEach(function(result, idx) {
      html += '<div class="search-result-item" onclick="executeSearchResult(' + idx + ')" style="cursor: pointer;">';
      html += '<div class="search-result-title">' + result.title + '</div>';
      html += '<div class="search-result-path">' + result.path + '</div>';
      html += '</div>';
    });
    resultsContainer.innerHTML = html;
  }
}

// Execute search result action
function executeSearchResult(idx) {
  console.log('=== v2.81.0: executeSearchResult(' + idx + ') ===');
  
  if (window.currentSearchResults && window.currentSearchResults[idx]) {
    var result = window.currentSearchResults[idx];
    console.log('Executing action for:', result.title);
    
    if (result.action && typeof result.action === 'function') {
      result.action();
      // Show success toast
      showToast(result.title, 'Navigated', 'success');
    } else {
      console.error('No action function found for result');
    }
  } else {
    console.error('Search result not found at index:', idx);
  }
}

// Keyboard Shortcuts
function openShortcuts() {
  var panel = document.getElementById('shortcutsPanel');
  if (panel) {
    panel.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeShortcuts() {
  var panel = document.getElementById('shortcutsPanel');
  if (panel) {
    panel.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Enhanced Toast Notifications (handles both 2-param and 3-param calls)
function showToast(arg1, arg2, arg3) {
  // Detect call pattern: showToast(message, type) or showToast(title, message, type)
  var title, message, type;
  var validTypes = ['success', 'error', 'warning', 'info'];
  
  if (validTypes.indexOf(arg2) >= 0 && !arg3) {
    // 2-param call: showToast(message, type)
    title = null;
    message = arg1;
    type = arg2;
  } else {
    // 3-param call: showToast(title, message, type)
    title = arg1;
    message = arg2;
    type = arg3 || 'info';
  }
  
  type = type || 'info';

  // v23.5: ADHD - make error messages user-friendly
  if (type === 'error' && message && typeof friendlyError === 'function') {
    message = friendlyError(message);
  }

  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Icon based on type
  var icon = '';
  if (type === 'success') {
    icon = '<svg class="toast-icon" style="color: var(--success);" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
  } else if (type === 'error') {
    icon = '<svg class="toast-icon" style="color: var(--error);" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
  } else if (type === 'warning') {
    icon = '<svg class="toast-icon" style="color: var(--warning);" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
  } else {
    icon = '<svg class="toast-icon" style="color: var(--accent);" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
  }
  
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  
  // Build HTML based on whether we have a title
  if (title) {
    toast.innerHTML = icon + '<div class="toast-content"><div class="toast-title">' + title + '</div><div class="toast-message">' + message + '</div></div>';
  } else {
    toast.innerHTML = icon + '<div class="toast-content"><div class="toast-message">' + message + '</div></div>';
  }
  
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(function() {
    toast.classList.add('show');
  });
  
  // Auto remove after 3.5 seconds (v9.1.14 - reduced from 7s)
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3500);
}

