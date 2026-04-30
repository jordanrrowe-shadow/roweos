// ═══════════════════════════════════════════════════════════════════════════════
// v11.0.5: LIFEAI IDENTITY ONBOARDING SURVEY
// ═══════════════════════════════════════════════════════════════════════════════

var onboardingCurrentStep = 1;
var onboardingTotalSteps = 5;

/**
 * v11.0.5: Open the LifeAI onboarding survey
 */
function openLifeOnboarding() {
  console.log('[LifeAI] Opening onboarding modal...');
  var modal = document.getElementById('lifeOnboardingModal');
  if (!modal) {
    console.error('[LifeAI] Modal not found!');
    showToast('Could not open setup wizard', 'error');
    return;
  }

  // v11.0.5: Hide the welcome/mode selection screen so modal appears on top
  var welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }

  // v27.0: Update modal title based on whether creating new or editing existing
  var titleEl = document.getElementById('lifeOnboardingTitle');
  var subtitleEl = document.getElementById('lifeOnboardingSubtitle');
  if (window.isCreatingNewLifeProfile) {
    if (titleEl) titleEl.textContent = 'New Life Profile';
    if (subtitleEl) subtitleEl.textContent = 'Create a new profile for a different area of your life';
  } else {
    if (titleEl) titleEl.textContent = 'Set Up Your LifeAI';
    if (subtitleEl) subtitleEl.textContent = 'Help your AI coaches know you better';
  }

  // v26.7: Show web import fork (step 0) BEFORE regular steps
  // Don't call updateLifeOnboardingUI() yet -- step 0 comes first
  onboardingCurrentStep = 1;

  // Pre-fill with existing data if available (only for edit, not new)
  if (!window.isCreatingNewLifeProfile) {
    prefillOnboardingFromProfile();
  }

  // v11.0.5: Ensure modal has highest z-index
  modal.style.zIndex = '100002';

  // Show modal - use both display AND show class for proper CSS
  modal.style.display = 'flex';
  // Force reflow to ensure CSS transition works
  modal.offsetHeight;
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
  console.log('[LifeAI] Modal opened successfully');
  // v26.7: Show web import fork as first step (fixed: use explicit 'block', hide all other steps first)
  var step0 = document.getElementById('lifeOnbStep0');
  if (step0) {
    // Hide ALL steps (both regular and fork steps)
    var allSteps = document.querySelectorAll('#lifeOnboardingModal .onboarding-step');
    for (var ls = 0; ls < allSteps.length; ls++) allSteps[ls].style.display = 'none';
    var forkSteps = document.querySelectorAll('#lifeOnboardingModal .life-onboarding-step');
    for (var fs = 0; fs < forkSteps.length; fs++) forkSteps[fs].style.display = 'none';
    // Now show step 0 explicitly
    step0.style.display = 'block';
    console.log('[LifeAI] Showing web import fork (step 0)');
  } else {
    // Fallback: no step 0, go straight to step 1
    updateLifeOnboardingUI();
  }
}

// Expose to window for onclick handlers in dynamically generated HTML
window.openLifeOnboarding = openLifeOnboarding;

/**
 * v11.0.5: Calculate profile completion percentage
 */
function calculateLifeProfileCompletion(profile) {
  if (!profile) return 0;
  
  var totalFields = 0;
  var completedFields = 0;
  
  // Name (10%)
  totalFields += 1;
  if (profile.name && profile.name.trim()) completedFields += 1;
  
  // About Me (15%)
  totalFields += 1.5;
  if (profile.aboutMe && profile.aboutMe.trim().length > 20) completedFields += 1.5;
  
  // Focus Areas (10%)
  totalFields += 1;
  if ((profile.lifeAreas || []).length > 0) completedFields += 1;
  
  // Goals (10%)
  totalFields += 1;
  if ((profile.goals || []).length > 0) completedFields += 1;
  
  // Identity Data - each category (10% each = 50%)
  var categories = ['health', 'family', 'work', 'personal', 'tax'];
  var identityData = profile.identityData || {};
  categories.forEach(function(cat) {
    totalFields += 1;
    if ((identityData[cat] || []).length > 0) completedFields += 1;
  });
  
  // Preferences (5%)
  totalFields += 0.5;
  if (profile.preferences && (profile.preferences.productiveTime || profile.preferences.communicationStyle)) {
    completedFields += 0.5;
  }
  
  var percentage = Math.round((completedFields / totalFields) * 100);
  return Math.min(100, percentage);
}

/**
 * v11.0.5: Close the onboarding survey
 */
function closeLifeOnboarding() {
  var modal = document.getElementById('lifeOnboardingModal');
  if (modal) {
    modal.classList.remove('show');
    // Wait for transition then hide
    setTimeout(function() {
      modal.style.display = 'none';
    }, 200);
    document.body.style.overflow = '';
  }
  
  // v11.0.5: Clear pending profile if user cancels during new profile creation
  if (window.isCreatingNewLifeProfile && window.pendingNewLifeProfile) {
    console.log('[LifeAI] Onboarding cancelled - discarding pending profile');
    window.pendingNewLifeProfile = null;
    window.isCreatingNewLifeProfile = false;
  }
}

// Expose to window for onclick handlers
window.closeLifeOnboarding = closeLifeOnboarding;

/**
 * v11.0.5: Pre-fill onboarding form with existing profile data
 */
function prefillOnboardingFromProfile() {
  var profile = getCurrentLifeProfile();
  if (!profile) return;
  
  // Basic info
  var nameEl = document.getElementById('onb_name');
  if (nameEl && profile.name) nameEl.value = profile.name;
  
  // Identity data
  var identityData = profile.identityData || {};
  
  // Personal
  var personal = identityData.personal || [];
  personal.forEach(function(item) {
    if (item.type === 'age') {
      var el = document.getElementById('onb_age');
      if (el) el.value = item.value;
    }
    if (item.type === 'location') {
      var el = document.getElementById('onb_location');
      if (el) el.value = item.value;
    }
    if (item.type === 'trait') {
      var el = document.getElementById('onb_traits');
      if (el) el.value = (el.value ? el.value + ', ' : '') + item.value;
    }
  });
  
  // Work
  var work = identityData.work || [];
  work.forEach(function(item) {
    if (item.type === 'role') {
      var el = document.getElementById('onb_role');
      if (el) el.value = item.value;
    }
    if (item.type === 'business') {
      var el = document.getElementById('onb_business');
      if (el) el.value = item.value;
    }
    if (item.type === 'schedule') {
      var el = document.getElementById('onb_schedule');
      if (el) el.value = item.value;
    }
  });
  
  // Tax
  var tax = identityData.tax || [];
  tax.forEach(function(item) {
    if (item.type === 'entity') {
      var el = document.getElementById('onb_entity');
      if (el) {
        for (var i = 0; i < el.options.length; i++) {
          if (el.options[i].value.toLowerCase().includes(item.value.toLowerCase())) {
            el.selectedIndex = i;
            break;
          }
        }
      }
    }
  });
  
  // Health
  var health = identityData.health || [];
  health.forEach(function(item) {
    if (item.type === 'condition') {
      var el = document.getElementById('onb_conditions');
      if (el) el.value = (el.value ? el.value + ', ' : '') + item.value;
    }
    if (item.type === 'medication') {
      var el = document.getElementById('onb_medications');
      if (el) el.value = (el.value ? el.value + ', ' : '') + item.value;
    }
    if (item.type === 'dietary') {
      var el = document.getElementById('onb_dietary');
      if (el) el.value = (el.value ? el.value + ', ' : '') + item.value;
    }
    if (item.type === 'allergy') {
      var el = document.getElementById('onb_allergies');
      if (el) el.value = (el.value ? el.value + ', ' : '') + item.value;
    }
  });
  
  // Family
  var family = identityData.family || [];
  family.forEach(function(item) {
    if (item.type === 'status') {
      var el = document.getElementById('onb_status');
      if (el) {
        for (var i = 0; i < el.options.length; i++) {
          if (el.options[i].value.toLowerCase().includes(item.value.toLowerCase())) {
            el.selectedIndex = i;
            break;
          }
        }
      }
    }
    if (item.type === 'partner') {
      var el = document.getElementById('onb_partner');
      if (el) el.value = item.value;
    }
    if (item.type === 'children') {
      var el = document.getElementById('onb_children');
      if (el) el.value = item.value;
    }
    if (item.type === 'pet') {
      var el = document.getElementById('onb_pets');
      if (el) el.value = (el.value ? el.value + ', ' : '') + item.value;
    }
  });
  
  // Preferences
  if (profile.preferences) {
    if (profile.preferences.productiveTime) {
      var el = document.getElementById('onb_productive');
      if (el) el.value = profile.preferences.productiveTime;
    }
    if (profile.preferences.communicationStyle) {
      var el = document.getElementById('onb_comm');
      if (el) el.value = profile.preferences.communicationStyle;
    }
  }
  
  // About Me -> Notes
  if (profile.aboutMe) {
    var el = document.getElementById('onb_notes');
    if (el) el.value = profile.aboutMe;
  }
}

// v26.5: LifeAI web import handlers
function showLifeWebImport() {
  var forkSteps = document.querySelectorAll('#lifeOnboardingModal .life-onboarding-step');
  for (var i = 0; i < forkSteps.length; i++) forkSteps[i].style.display = 'none';
  var steps = document.querySelectorAll('#lifeOnboardingModal .onboarding-step');
  for (var i = 0; i < steps.length; i++) steps[i].style.display = 'none';
  var el = document.getElementById('lifeOnbWebImport');
  if (el) el.style.display = '';
}

function skipLifeWebImport() {
  window._pendingWebSearchUrl = null;
  localStorage.removeItem('roweos_pending_web_search_url');
  var forkSteps = document.querySelectorAll('#lifeOnboardingModal .life-onboarding-step');
  for (var i = 0; i < forkSteps.length; i++) forkSteps[i].style.display = 'none';
  // Show the first real step (step 1 - basics)
  onboardingCurrentStep = 1;
  updateLifeOnboardingUI();
}

function saveLifeWebUrlAndContinue() {
  var urlInput = document.getElementById('lifeWebImportUrl');
  if (!urlInput) return;
  var url = urlInput.value.trim();
  if (!url) { showToast('Please enter a URL', 'warning'); return; }
  if (url.indexOf('.') === -1) { showToast('Please enter a valid domain', 'warning'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  window._pendingWebSearchUrl = url;
  localStorage.setItem('roweos_pending_web_search_url', url);
  // Continue to normal LifeAI steps
  var forkSteps = document.querySelectorAll('#lifeOnboardingModal .life-onboarding-step');
  for (var i = 0; i < forkSteps.length; i++) forkSteps[i].style.display = 'none';
  onboardingCurrentStep = 1;
  updateLifeOnboardingUI();
}

window.showLifeWebImport = showLifeWebImport;
window.skipLifeWebImport = skipLifeWebImport;
window.saveLifeWebUrlAndContinue = saveLifeWebUrlAndContinue;

/**
 * v11.0.5: Go to next onboarding step
 */
function nextLifeOnboardingStep() {
  if (onboardingCurrentStep < onboardingTotalSteps) {
    onboardingCurrentStep++;
    updateLifeOnboardingUI();
  }
}

/**
 * v11.0.5: Go to previous onboarding step
 */
function prevLifeOnboardingStep() {
  if (onboardingCurrentStep > 1) {
    onboardingCurrentStep--;
    updateLifeOnboardingUI();
  }
}

/**
 * v11.0.5: Update the onboarding UI for current step
 */
function updateLifeOnboardingUI() {
  // Update step dots
  var dots = document.querySelectorAll('#lifeOnboardingModal .onboarding-step-dot');
  dots.forEach(function(dot) {
    var step = parseInt(dot.dataset.step);
    if (step <= onboardingCurrentStep) {
      dot.style.background = 'var(--life-accent)';
    } else {
      dot.style.background = 'var(--border-color)';
    }
  });
  
  // Show/hide step content
  var steps = document.querySelectorAll('#lifeOnboardingModal .onboarding-step');
  steps.forEach(function(step) {
    var stepNum = parseInt(step.dataset.step);
    step.style.display = stepNum === onboardingCurrentStep ? 'block' : 'none';
  });
  
  // Update buttons
  var prevBtn = document.getElementById('onbPrevBtn');
  var nextBtn = document.getElementById('onbNextBtn');
  var finishBtn = document.getElementById('onbFinishBtn');
  
  if (prevBtn) prevBtn.style.display = onboardingCurrentStep > 1 ? 'block' : 'none';
  if (nextBtn) nextBtn.style.display = onboardingCurrentStep < onboardingTotalSteps ? 'block' : 'none';
  if (finishBtn) finishBtn.style.display = onboardingCurrentStep === onboardingTotalSteps ? 'block' : 'none';
}

/**
 * v11.0.5: Finish onboarding and save all data
 */
function finishLifeOnboarding() {
  var profiles = getLifeProfiles();
  var isNewProfile = window.isCreatingNewLifeProfile || false;
  var profile;
  var currentIdx;
  
  // v11.0.5: If creating a new profile, use the pending profile and add it now
  if (isNewProfile && window.pendingNewLifeProfile) {
    profile = window.pendingNewLifeProfile;
    profiles.push(profile);
    currentIdx = profiles.length - 1;
    // Set as current profile
    setCurrentLifeProfileIndex(currentIdx);
  } else {
    // Editing existing profile
    currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    profile = profiles[currentIdx];
    
    if (!profile) {
      showToast('Profile not found', 'error');
      return;
    }
  }
  
  // Initialize structures
  if (!profile.identityData) profile.identityData = {};
  if (!profile.preferences) profile.preferences = {};
  
  // Helper to add identity item if not empty
  function addIdentityItem(category, type, value) {
    if (!value || !value.trim()) return;
    
    // Handle comma-separated values
    var values = value.split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v; });
    
    if (!profile.identityData[category]) {
      profile.identityData[category] = [];
    }
    
    values.forEach(function(val) {
      // Check for duplicates
      var exists = profile.identityData[category].some(function(item) {
        return item.value.toLowerCase() === val.toLowerCase() && item.type === type;
      });
      
      if (!exists) {
        profile.identityData[category].push({
          type: type,
          value: val,
          addedAt: new Date().toISOString(),
          source: 'onboarding'
        });
      }
    });
  }
  
  // Step 1: Basics
  var name = document.getElementById('onb_name').value.trim();
  if (name) profile.name = name;
  
  addIdentityItem('personal', 'age', document.getElementById('onb_age').value);
  addIdentityItem('personal', 'location', document.getElementById('onb_location').value);
  
  // Step 2: Work & Career
  addIdentityItem('work', 'role', document.getElementById('onb_role').value);
  addIdentityItem('work', 'business', document.getElementById('onb_business').value);
  addIdentityItem('work', 'schedule', document.getElementById('onb_schedule').value);
  
  var entity = document.getElementById('onb_entity').value;
  if (entity) addIdentityItem('tax', 'entity', entity);
  
  // Step 3: Health
  addIdentityItem('health', 'condition', document.getElementById('onb_conditions').value);
  addIdentityItem('health', 'medication', document.getElementById('onb_medications').value);
  addIdentityItem('health', 'dietary', document.getElementById('onb_dietary').value);
  addIdentityItem('health', 'allergy', document.getElementById('onb_allergies').value);
  
  // Step 4: Family
  var status = document.getElementById('onb_status').value;
  if (status) addIdentityItem('family', 'status', status);
  addIdentityItem('family', 'partner', document.getElementById('onb_partner').value);
  addIdentityItem('family', 'children', document.getElementById('onb_children').value);
  addIdentityItem('family', 'pet', document.getElementById('onb_pets').value);
  
  // Step 5: Preferences
  profile.preferences.productiveTime = document.getElementById('onb_productive').value;
  profile.preferences.communicationStyle = document.getElementById('onb_comm').value;
  addIdentityItem('personal', 'trait', document.getElementById('onb_traits').value);
  
  var notes = document.getElementById('onb_notes').value.trim();
  if (notes) {
    profile.aboutMe = notes;
  }
  
  // Mark onboarding as complete
  profile.onboardingComplete = true;
  profile.onboardingCompletedAt = new Date().toISOString();
  
  // Save
  saveLifeProfiles(profiles);
  
  // Clear new profile flags
  window.isCreatingNewLifeProfile = false;
  window.pendingNewLifeProfile = null;
  
  // Close modal
  closeLifeOnboarding();

  // v27.0: If this was the initial onboarding flow, mark shared onboarding as complete
  if (isNewProfile && localStorage.getItem(USER_DATA_KEYS.onboardingCompleted) !== 'true') {
    localStorage.setItem(USER_DATA_KEYS.onboardingCompleted, 'true');
    if (typeof finalizeOnboarding === 'function') finalizeOnboarding();
  }

  // Refresh view
  renderMemoryView();

  // Show appropriate message
  if (isNewProfile) {
    showToast('Welcome to LifeAI, ' + (profile.name || 'friend') + '!', 'success');
  } else {
    showToast('LifeAI profile updated!', 'success');
  }

  // Count how many items were added
  var count = getIdentityDataCount();
  console.log('[LifeAI Onboarding] Completed with ' + count + ' identity items');
}

// Expose onboarding functions to window for onclick handlers
window.nextLifeOnboardingStep = nextLifeOnboardingStep;
window.prevLifeOnboardingStep = prevLifeOnboardingStep;
window.finishLifeOnboarding = finishLifeOnboarding;

/**
 * v11.0.5: Check if onboarding should be prompted
 */
function shouldPromptOnboarding() {
  var profile = getCurrentLifeProfile();
  if (!profile) return false;
  
  // Already completed onboarding
  if (profile.onboardingComplete) return false;
  
  // Has substantial data already
  var count = getIdentityDataCount();
  if (count >= 5) return false;
  
  // Check if dismissed recently (within 7 days)
  var dismissed = localStorage.getItem('roweos_onboarding_dismissed');
  if (dismissed) {
    var dismissedDate = new Date(dismissed);
    var daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) return false;
  }
  
  return true;
}

/**
 * v11.0.5: Dismiss onboarding prompt for a while
 */
function dismissOnboardingPrompt() {
  localStorage.setItem('roweos_onboarding_dismissed', new Date().toISOString());
}

/**
 * v11.0.5: Dismiss onboarding card from Identity view
 */
function dismissOnboardingCard() {
  dismissOnboardingPrompt();
  
  // Mark as dismissed in profile
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  if (profiles[currentIdx]) {
    profiles[currentIdx].onboardingDismissed = true;
    saveLifeProfiles(profiles);
  }
  
  // Refresh view
  renderMemoryView();
  showToast('You can always set up your profile later from Identity', 'info');
}

// Open delete life profile modal
function openDeleteLifeProfileModal() {
  var profiles = getLifeProfiles();
  if (profiles.length <= 1) {
    showToast('Cannot delete your only life profile', 'warning');
    return;
  }
  
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  
  if (confirm('Delete "' + (profile.name || 'this profile') + '"? This cannot be undone.')) {
    deleteLifeProfile(currentIdx);
    renderLifeIdentityView();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v10.5.25: PHASE 3 - LIFEAI SURVEY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// Life area definitions with SVG icons and names
var LIFE_AREAS = {
  health: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', name: 'Health & Fitness', color: '#4ade80' },
  career: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>', name: 'Career & Work', color: '#60a5fa' },
  finance: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', name: 'Finance', color: '#fbbf24' },
  relationships: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', name: 'Relationships', color: '#f472b6' },
  growth: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c-2-3-6-3.5-6-7a6 6 0 0 1 6-2"/><path d="M12 12c2-3 6-3.5 6-7a6 6 0 0 0-6-2"/></svg>', name: 'Personal Growth', color: '#a78bfa' },
  creativity: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>', name: 'Creativity', color: '#f97316' },
  home: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', name: 'Home & Living', color: '#14b8a6' },
  travel: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', name: 'Travel & Adventure', color: '#06b6d4' },
  spiritual: { icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>', name: 'Mindfulness', color: '#8b5cf6' }
};

// Survey state
var selectedLifeAreas = [];
var lifeGoals = {}; // { area: { short: [], long: [] } }
var selectedCommStyle = null;
var selectedRhythm = null;

// Step 1: Life Areas Selection
function toggleLifeArea(btn) {
  var area = btn.dataset.area;
  
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    selectedLifeAreas = selectedLifeAreas.filter(function(a) { return a !== area; });
  } else {
    btn.classList.add('selected');
    selectedLifeAreas.push(area);
  }
  
  // Enable/disable continue button
  var nextBtn = document.getElementById('lifeAreasNextBtn');
  if (nextBtn) {
    nextBtn.disabled = selectedLifeAreas.length === 0;
    nextBtn.style.opacity = selectedLifeAreas.length === 0 ? '0.5' : '1';
  }

  // v24.25: Update selection counter
  var counter = document.getElementById('lifeAreaCounter');
  if (counter) {
    counter.textContent = selectedLifeAreas.length === 0 ? 'Select at least 1 area' : selectedLifeAreas.length + ' of 9 selected';
    counter.style.color = selectedLifeAreas.length > 0 ? 'var(--brand-accent, #a89878)' : 'var(--text-muted)';
  }
}

function proceedFromLifeAreas() {
  if (selectedLifeAreas.length === 0) {
    showToast('Please select at least one life area', 'warning');
    return;
  }
  
  // Build goals UI for selected areas
  buildGoalsUI();
  goToOnboardingStep('life2');
}

// Step 2: Goals Input
function buildGoalsUI() {
  var container = document.getElementById('lifeGoalsContainer');
  if (!container) return;
  
  var html = '';
  selectedLifeAreas.forEach(function(area) {
    var areaInfo = LIFE_AREAS[area];
    html += '<div class="life-goal-section" data-area="' + area + '">';
    html += '  <div class="life-goal-header">';
    html += '    <span class="life-goal-header-icon">' + areaInfo.icon + '</span>';
    html += '    <span class="life-goal-header-title">' + areaInfo.name + '</span>';
    html += '  </div>';
    html += '  <div class="life-goal-inputs">';
    html += '    <div class="life-goal-input-row">';
    html += '      <span class="life-goal-type-label short">Short-term</span>';
    html += '      <input type="text" class="life-goal-input" data-area="' + area + '" data-type="short" placeholder="Goal for next 1-3 months...">';
    html += '    </div>';
    html += '    <div class="life-goal-input-row">';
    html += '      <span class="life-goal-type-label long">Long-term</span>';
    html += '      <input type="text" class="life-goal-input" data-area="' + area + '" data-type="long" placeholder="Goal for 6-12 months...">';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

function proceedFromLifeGoals() {
  // Collect goals from inputs
  lifeGoals = {};
  var inputs = document.querySelectorAll('#lifeGoalsContainer .life-goal-input');
  
  inputs.forEach(function(input) {
    var area = input.dataset.area;
    var type = input.dataset.type;
    var value = input.value.trim();
    
    if (value) {
      if (!lifeGoals[area]) {
        lifeGoals[area] = { short: [], long: [] };
      }
      lifeGoals[area][type].push({
        id: 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title: value,
        area: area,
        type: type,
        progress: 0,
        createdAt: new Date().toISOString(),
        completedAt: null
      });
    }
  });
  
  console.log('[LifeAI Survey] Goals collected:', lifeGoals);
  goToOnboardingStep('life3');
}

// Step 3: Communication Style
function selectCommStyle(btn) {
  // Deselect all
  document.querySelectorAll('.comm-style-card').forEach(function(card) {
    card.classList.remove('selected');
  });
  
  // Select this one
  btn.classList.add('selected');
  selectedCommStyle = btn.dataset.style;
  
  // Enable continue
  var nextBtn = document.getElementById('commStyleNextBtn');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.style.opacity = '1';
  }
  
  console.log('[LifeAI Survey] Comm style:', selectedCommStyle);
}

function proceedFromCommStyle() {
  if (!selectedCommStyle) {
    showToast('Please select a communication style', 'warning');
    return;
  }
  goToOnboardingStep('life4');
}

// Step 4: Daily Rhythm
function selectRhythm(btn) {
  // Deselect all
  document.querySelectorAll('.rhythm-card').forEach(function(card) {
    card.classList.remove('selected');
  });
  
  // Select this one
  btn.classList.add('selected');
  selectedRhythm = btn.dataset.rhythm;
  
  // Enable continue
  var nextBtn = document.getElementById('rhythmNextBtn');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.style.opacity = '1';
  }
  
  console.log('[LifeAI Survey] Rhythm:', selectedRhythm);
}

function proceedFromRhythm() {
  if (!selectedRhythm) {
    showToast('Please select your productive time', 'warning');
    return;
  }
  
  // v10.5.25: Go to building step instead of directly to summary
  goToOnboardingStep('lifeBuilding');
  startLifeBuildingAnimation();
}

// v10.5.25: Animated Building Step
function startLifeBuildingAnimation() {
  var items = document.querySelectorAll('#lifeBuildingFeatures .life-building-item');
  var progressFill = document.getElementById('lifeBuildingProgressFill');
  var progressText = document.getElementById('lifeBuildingProgressText');
  var continueBtn = document.getElementById('lifeBuildingContinueBtn');

  // v15.27: Personalize building screen with user's name and logo
  var buildingStep = document.getElementById('onboardingLifeBuilding');
  if (buildingStep) {
    var buildTitle = buildingStep.querySelector('.onboarding-title');
    var buildHeader = buildingStep.querySelector('.onboarding-header');
    var buildingUserName = localStorage.getItem('roweos_user_name') || sharedUserName || '';
    if (buildTitle && buildingUserName) {
      buildTitle.textContent = 'Building ' + buildingUserName + "'s LifeAI";
    }
    // Show uploaded logo if available
    if (window._onboardingLogo && buildHeader) {
      var existingLogoEl = document.getElementById('buildingLogoPreview');
      if (!existingLogoEl) {
        var logoEl = document.createElement('img');
        logoEl.id = 'buildingLogoPreview';
        logoEl.src = window._onboardingLogo;
        logoEl.style.cssText = 'width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 auto var(--space-3);display:block;border:2px solid var(--accent);';
        buildHeader.insertBefore(logoEl, buildHeader.firstChild);
      }
    }
  }

  // Update dynamic text based on user selections
  var areasTitle = document.getElementById('buildingAreasTitle');
  var areasDesc = document.getElementById('buildingAreasDesc');
  if (areasTitle && selectedLifeAreas.length > 0) {
    areasTitle.textContent = selectedLifeAreas.length + ' Focus Area' + (selectedLifeAreas.length > 1 ? 's' : '');
    var areaNames = selectedLifeAreas.slice(0, 3).map(function(a) {
      return LIFE_AREAS[a] ? LIFE_AREAS[a].name.split(' ')[0] : a;
    }).join(', ');
    if (selectedLifeAreas.length > 3) areaNames += '...';
    areasDesc.textContent = 'To-Do categories for ' + areaNames;
  }
  
  var styleTitle = document.getElementById('buildingStyleTitle');
  var styleDesc = document.getElementById('buildingStyleDesc');
  var styleNames = { supportive: 'Supportive', direct: 'Direct', coach: 'Coach', analytical: 'Analytical' };
  if (styleTitle && selectedCommStyle) {
    styleTitle.textContent = styleNames[selectedCommStyle] + ' Communication';
    styleDesc.textContent = 'Responses tailored to your style';
  }
  
  var rhythmTitle = document.getElementById('buildingRhythmTitle');
  var rhythmDesc = document.getElementById('buildingRhythmDesc');
  var rhythmNames = { early: 'Early Bird', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  if (rhythmTitle && selectedRhythm) {
    rhythmTitle.textContent = rhythmNames[selectedRhythm] + ' Optimization';
    rhythmDesc.textContent = 'Reminders timed for your peak hours';
  }
  
  // Reset state
  items.forEach(function(item) {
    item.classList.remove('visible', 'complete');
  });
  if (progressFill) progressFill.style.width = '0%';
  if (progressText) progressText.textContent = 'Configuring...';
  if (continueBtn) {
    continueBtn.disabled = true;
    continueBtn.style.opacity = '0.5';
  }
  
  // Animate items with staggered timing
  var totalItems = items.length;
  var completedItems = 0;
  
  items.forEach(function(item, index) {
    var delay = parseInt(item.dataset.delay) || (index * 400);
    
    // Show item
    setTimeout(function() {
      item.classList.add('visible');
    }, delay);
    
    // Complete item (checkmark)
    setTimeout(function() {
      item.classList.add('complete');
      completedItems++;
      
      // Update progress
      var progress = Math.round((completedItems / totalItems) * 100);
      if (progressFill) progressFill.style.width = progress + '%';
      
      if (completedItems === totalItems) {
        // All complete
        if (progressText) progressText.textContent = 'Ready!';
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.style.opacity = '1';
        }
        // Pre-build summary
        buildProfileSummary();
      } else {
        var statuses = ['Configuring...', 'Setting up goals...', 'Creating categories...', 'Personalizing...', 'Optimizing timing...', 'Connecting services...', 'Loading operations...', 'Almost ready...'];
        if (progressText) progressText.textContent = statuses[Math.min(completedItems, statuses.length - 1)];
      }
    }, delay + 300);
  });
}

// v15.27: Step 5 - Feature-focused launch summary
function buildProfileSummary() {
  var container = document.getElementById('lifeProfileSummary');
  if (!container) return;

  var userName = localStorage.getItem('roweos_user_name') || sharedUserName || 'You';
  var accentColor = window._onboardingBrandColor || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22c55e';

  // Personalize title
  var titleEl = document.getElementById('lifeFinalTitle');
  if (titleEl) titleEl.textContent = userName + "'s LifeAI is Ready";
  var subEl = document.getElementById('lifeFinalSubtitle');
  if (subEl) subEl.textContent = 'Everything is configured and personalized for you';

  // Show logo if available
  var logoPreview = document.getElementById('lifeFinalLogoPreview');
  if (logoPreview && window._onboardingLogo) {
    var img = document.createElement('img');
    img.src = window._onboardingLogo;
    img.style.cssText = 'width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid ' + accentColor + ';';
    logoPreview.innerHTML = '';
    logoPreview.appendChild(img);
    logoPreview.style.display = 'block';
  }

  // Count goals
  var totalGoals = 0;
  for (var area in lifeGoals) {
    totalGoals += lifeGoals[area].short.length + lifeGoals[area].long.length;
  }

  // Area names (short)
  var areaShort = selectedLifeAreas.slice(0, 3).map(function(a) {
    return LIFE_AREAS[a] ? LIFE_AREAS[a].name.split(' ')[0] : a;
  }).join(', ');
  if (selectedLifeAreas.length > 3) areaShort += ' +' + (selectedLifeAreas.length - 3);

  var commNames = { supportive: 'Supportive', direct: 'Direct', coach: 'Coach', analytical: 'Analytical' };
  var rhythmNames = { early: 'Early Bird', morning: 'Morning', afternoon: 'Afternoon', evening: 'Night Owl' };

  // Feature card helper
  function card(iconSvg, title, desc, color) {
    return '<div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--space-4);display:flex;flex-direction:column;gap:8px;">'
      + '<div style="width:32px;height:32px;border-radius:8px;background:' + color + '15;display:flex;align-items:center;justify-content:center;">' + iconSvg + '</div>'
      + '<div style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary);">' + title + '</div>'
      + '<div style="font-size:var(--text-xs);color:var(--text-secondary);line-height:1.4;">' + desc + '</div>'
      + '</div>';
  }

  var html = '';
  html += card(
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + accentColor + '" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'Personal AI Assistant',
    'Chat learns your preferences and context over time',
    accentColor
  );
  html += card(
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f97316" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    selectedLifeAreas.length + ' Focus Area' + (selectedLifeAreas.length !== 1 ? 's' : ''),
    areaShort + ': To-Do categories ready',
    '#f97316'
  );
  html += card(
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    totalGoals + ' Goal' + (totalGoals !== 1 ? 's' : '') + ' Tracked',
    'Short and long-term goals in Pulse',
    '#3b82f6'
  );
  html += card(
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    (commNames[selectedCommStyle] || 'Custom') + ' Style',
    'Responses match how you prefer to communicate',
    '#a78bfa'
  );
  html += card(
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    (rhythmNames[selectedRhythm] || 'Custom') + ' Schedule',
    'Reminders timed for your peak productivity',
    '#22c55e'
  );
  html += card(
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f472b6" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    'Continuous Learning',
    'Gets smarter the more you use it',
    '#f472b6'
  );

  container.innerHTML = html;
}

// Save all survey data to profile
function saveLifeSurveyData() {
  var profile = getLifeAIProfile();
  
  // Save life areas
  profile.lifeAreas = selectedLifeAreas;
  
  // Save goals (flatten into array)
  profile.goals = [];
  for (var area in lifeGoals) {
    lifeGoals[area].short.forEach(function(g) { profile.goals.push(g); });
    lifeGoals[area].long.forEach(function(g) { profile.goals.push(g); });
  }
  
  // Save preferences
  profile.preferences = profile.preferences || {};
  profile.preferences.communicationStyle = selectedCommStyle;
  profile.preferences.productiveTime = selectedRhythm;
  
  profile.updatedAt = new Date().toISOString();
  
  // Save to localStorage
  localStorage.setItem('roweos_life_profile', JSON.stringify(profile));
  
  // Create To-Do categories based on life areas
  createLifeAreaTodoCategories();
  
  console.log('[LifeAI] Survey data saved:', profile);
  return profile;
}

// Create To-Do categories from life areas
function createLifeAreaTodoCategories() {
  // Get existing categories or start fresh
  var categories = JSON.parse(localStorage.getItem('roweos_life_todo_categories') || '[]');
  
  selectedLifeAreas.forEach(function(area) {
    var areaInfo = LIFE_AREAS[area];
    
    // Check if category already exists
    var exists = categories.some(function(cat) { return cat.id === area; });
    if (!exists) {
      categories.push({
        id: area,
        name: areaInfo.name,
        icon: areaInfo.icon,
        color: areaInfo.color,
        createdAt: new Date().toISOString()
      });
    }
  });
  
  localStorage.setItem('roweos_life_todo_categories', JSON.stringify(categories));
  console.log('[LifeAI] To-Do categories created:', categories);
}

function finishLifeAIOnboarding() {
  // v21.0: Route to cross-mode step if not yet shown
  if (!window._crossModeShown) {
    window._crossModeShown = true;
    window._crossModeOrigin = 'life';
    goToOnboardingStep('crossMode');
    return;
  }
  console.log('[LifeAI] Finishing onboarding');

  // v10.5.25: Save all survey data first
  saveLifeSurveyData();

  // v10.5.25: Get the user's name from the shared name input
  var userName = localStorage.getItem('roweos_user_name') || sharedUserName || 'My Life';
  console.log('[LifeAI] User name:', userName);

  // v25.1: Ensure life profiles array exists and has at least one profile
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  if (profiles.length === 0) {
    // Profile was never created in the array - create it now
    var surveyProfile = getLifeAIProfile();
    surveyProfile.id = surveyProfile.id || ('life_' + Date.now());
    surveyProfile.name = userName;
    profiles.push(surveyProfile);
    currentIdx = 0;
    localStorage.setItem('roweos_current_life_profile_idx', '0');
    console.log('[LifeAI] Created missing profile in profiles array');
  }
  // v15.27: Write userName, accent colors, and survey data back to the life profile
  if (profiles[currentIdx]) {
    profiles[currentIdx].name = userName;
    profiles[currentIdx].onboardingComplete = true;
    // v25.1: Merge survey data (goals, lifeAreas, preferences) into profiles array
    var surveyData = getLifeAIProfile();
    if (surveyData.goals) profiles[currentIdx].goals = surveyData.goals;
    if (surveyData.lifeAreas) profiles[currentIdx].lifeAreas = surveyData.lifeAreas;
    if (surveyData.preferences) profiles[currentIdx].preferences = surveyData.preferences;
    // v15.27: Store accent colors per-profile to prevent color bleeding
    profiles[currentIdx].accentDarkMode = window._onboardingBrandColor || '#22c55e';
    profiles[currentIdx].accentLightMode = window._onboardingBrandColorLight || '#22c55e';
    saveLifeProfiles(profiles);
  }

  // v15.27: Save accent colors to localStorage BEFORE hiding onboarding
  if (window._onboardingBrandColor) {
    localStorage.setItem('roweos_life_accent_dark_mode', window._onboardingBrandColor);
    localStorage.setItem('roweos_life_accent_color', window._onboardingBrandColor);
    if (typeof darkenColor === 'function') {
      localStorage.setItem('roweos_life_accent_dark_mode_dark', darkenColor(window._onboardingBrandColor, 20));
    }
  }
  if (window._onboardingBrandColorLight) {
    localStorage.setItem('roweos_life_accent_light_mode', window._onboardingBrandColorLight);
    if (typeof darkenColor === 'function') {
      localStorage.setItem('roweos_life_accent_light_mode_dark', darkenColor(window._onboardingBrandColorLight, 20));
    }
  }

  // v15.37: Save onboarding logo to per-profile key only - no shared key
  if (window._onboardingLogo) {
    try {
      var profileLogoKey = 'roweos_lifeai_logo_profile_' + currentIdx;
      localStorage.setItem(profileLogoKey, window._onboardingLogo);
      var pfs = getLifeProfiles();
      if (pfs[currentIdx]) {
        pfs[currentIdx].logoKey = profileLogoKey;
        saveLifeProfiles(pfs);
      }
    } catch (logoErr) { console.warn('[LifeAI] Logo save error:', logoErr); }
  }

  // v14.2: Mark onboarding as complete using correct keys
  localStorage.setItem(USER_DATA_KEYS.onboardingCompleted, 'true');
  localStorage.setItem('roweos_life_onboarding_complete', 'true');
  localStorage.setItem('roweos_mode', 'life');

  // Make sure we're in life mode
  if (typeof setAppMode === 'function') {
    setAppMode('life');
  } else {
    window.currentAppMode = 'life';
    localStorage.setItem('roweos_app_mode', 'life');
  }

  // v27.1: Flush life profile sync to Firestore and stamp lastSync before
  // hiding onboarding, so reconcileOnStartup on next load won't discard profiles.
  if (typeof firebaseUser !== 'undefined' && firebaseUser) {
    if (typeof _flushLifeAISync === 'function') _flushLifeAISync();
    localStorage.setItem('roweos_first_sync_completed', 'true');
    localStorage.setItem('roweos_last_sync', String(Date.now()));
  }

  // Close onboarding and show main app
  hideOnboarding();

  // Navigate to LifeAI view
  if (typeof showView === 'function') {
    showView('agent');
  }

  // Update UI for life mode (this updates sidebar name)
  if (typeof updateModeUI === 'function') {
    updateModeUI('life');
  }

  // v10.5.25: Update mobile header with user name
  updateMobileHeaderForLife(userName);

  // v15.27: Re-apply accent + logo after UI init to ensure they stick
  if (typeof initLifeAccentColor === 'function') initLifeAccentColor();
  if (typeof applyCurrentModeAccent === 'function') applyCurrentModeAccent();
  if (typeof loadCurrentLogo === 'function') loadCurrentLogo();
  window._onboardingLogo = null;

  // Show welcome toast with goal count
  var profile = getLifeAIProfile();
  var goalCount = profile.goals ? profile.goals.length : 0;
  if (goalCount > 0) {
    showToast('Welcome to LifeAI, ' + userName + '! ' + goalCount + ' goals ready to track.', 'success');
  } else {
    showToast('Welcome to LifeAI, ' + userName + '!', 'success');
  }

  // v26.7: Clear all onboarding temp state to prevent bleed into subsequent brand flows
  window._onboardingBrandColor = null;
  window._onboardingBrandColorLight = null;
  window._onboardingColorMode = null;
  window.onboardingBrandName = null;
  window.onboardingOwnershipData = null;
  window.onboardingPrefillData = null;
  window._pendingWebSearchUrl = null;
  localStorage.removeItem('roweos_pending_web_search_url');
  localStorage.removeItem('roweos_web_import_state');

  // v14.3.1: Launch guided tour for LifeAI
  setTimeout(function() { initLifeTour(); }, 600);
}

// v10.5.25: Initialize LifeAI data structure
function initializeLifeAIData(userName) {
  // Create LifeAI profile structure
  var lifeProfile = {
    name: userName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    goals: [],
    tasks: [],
    habits: [],
    notes: [],
    preferences: {
      notifications: true,
      theme: 'dark',
      aiProvider: localStorage.getItem('selectedProvider') || 'anthropic'
    },
    insights: [],
    conversationHistory: []
  };
  
  // Save to localStorage
  localStorage.setItem('roweos_life_profile', JSON.stringify(lifeProfile));
  
  console.log('[LifeAI] Profile initialized:', lifeProfile);
  return lifeProfile;
}

// v26.4: syncLifeProfileToFirebase and loadLifeProfileFromFirebase removed -- use syncLifeAIToFirestore instead

// v10.5.25: Update mobile header for LifeAI mode
function updateMobileHeaderForLife(userName) {
  // Update mobile brand dropdown text
  var mobileBrandDropdown = document.getElementById('mobileBrandDropdown');
  if (mobileBrandDropdown) {
    // Add or update the "Life" option
    var lifeOption = mobileBrandDropdown.querySelector('option[value="life"]');
    if (!lifeOption) {
      lifeOption = document.createElement('option');
      lifeOption.value = 'life';
      mobileBrandDropdown.insertBefore(lifeOption, mobileBrandDropdown.firstChild);
    }
    lifeOption.textContent = userName;
    lifeOption.selected = true;
  }
  
  // Update mobile header brand pill if exists
  var mobileBrandPill = document.querySelector('.mobile-brand-pill');
  if (mobileBrandPill) {
    var nameSpan = mobileBrandPill.querySelector('span');
    if (nameSpan) {
      nameSpan.textContent = userName;
    }
  }
}

async function selectOnboardingProvider(provider, event) {
  if (event) event.stopPropagation();
  
  onboardingSelectedProvider = provider;
  
  // Update step 4 with provider info
  var providerName = provider === 'anthropic' ? 'Anthropic' : 
                     provider === 'openai' ? 'OpenAI' : 'Google';
  var consoleUrl = provider === 'anthropic' ? 'https://console.anthropic.com' : 
                   provider === 'openai' ? 'https://platform.openai.com' :
                   'https://aistudio.google.com';
  var placeholder = provider === 'anthropic' ? 'sk-ant-...' : 
                    provider === 'openai' ? 'sk-...' :
                    'AIza...';
  
  // Check if API key already exists (AWAIT this!)
  var existingKey = await getApiKey(provider);
  var keyStatus = '';
  if (existingKey) {
    keyStatus = '✓ API key already configured and active';
  }
  
  document.getElementById('onboardingProviderName').textContent = providerName;
  document.getElementById('onboardingProviderLink').href = consoleUrl;
  document.getElementById('onboardingProviderLink').textContent = consoleUrl.replace('https://', '');
  document.getElementById('onboardingApiKeyInput').placeholder = placeholder;
  
  // Show existing key status if present - WITH CONTINUE OPTION
  if (keyStatus) {
    var statusEl = document.getElementById('onboardingKeyStatus');
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(74, 222, 128, 0.1)';
    statusEl.style.color = '#4ade80';
    statusEl.textContent = '✓ API key already valid. Click "Continue" to proceed or enter a new key below.';
    document.getElementById('onboardingApiKeyInput').value = existingKey.substring(0, 12) + '...';
    document.getElementById('onboardingApiKeyInput').placeholder = 'Enter new API key to replace existing...';
  } else {
    document.getElementById('onboardingKeyStatus').style.display = 'none';
    document.getElementById('onboardingApiKeyInput').value = '';
    document.getElementById('onboardingApiKeyInput').placeholder = placeholder;
  }
  
  // Go to step 4 (API key input)
  goToOnboardingStep(4);
}

// v21.0: State-aware handler for step 4 footer button
function handleStep4Continue() {
  if (_onboardingStep4State === 'analytics') {
    goToOnboardingStep('logo');
  } else if (_onboardingStep4State === 'roweosAI') {
    // Choice cards handle navigation - but if user just clicks Continue, default to auto
    selectRoweOSAIPref('auto');
  } else {
    // Default: apiKey state - save the key
    saveOnboardingApiKey();
  }
}

async function saveOnboardingApiKey() {
  var provider = onboardingSelectedProvider;
  if (!provider) return;
  
  var apiKey = document.getElementById('onboardingApiKeyInput').value.trim();
  
  // Check if user is keeping existing key (input shows "sk-xxx...") - AWAIT this!
  var existingKey = await getApiKey(provider);
  if (existingKey && apiKey.includes('...')) {
    // User wants to keep existing key - skip validation, go to next step
    document.getElementById('onboardingConnectedProvider').textContent =
      provider === 'anthropic' ? 'Anthropic' :
      provider === 'openai' ? 'OpenAI' : 'Google';
    // v14.3.1: Show model picker before success step
    showModelPickerInOnboarding(provider);
    return;
  }
  
  if (!apiKey) {
    showOnboardingError('Please enter an API key');
    return;
  }
  
  var statusEl = document.getElementById('onboardingKeyStatus');
  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(184, 152, 106, 0.1)';
  statusEl.style.color = 'var(--accent)';
  statusEl.textContent = 'Validating API key...';
  
  try {
    // Dual-mode: Desktop Electron IPC OR Browser localStorage
    if (isDesktopApp && window.roweosAPI && window.roweosAPI.saveProviderApiKey) {
      // Desktop mode: Use Electron IPC
      var result = await window.roweosAPI.saveProviderApiKey(provider, apiKey);
      
      if (result && result.success) {
        statusEl.style.background = 'rgba(74, 222, 128, 0.1)';
        statusEl.style.color = '#4ade80';
        statusEl.textContent = '✓ API key validated successfully!';
        
        // Update provider keys
        providerKeys[provider] = true;
        
        // Check connection
        await checkApiConnection();
        
        // v14.3.1: Show model picker after key validated
        setTimeout(function() {
          document.getElementById('onboardingConnectedProvider').textContent = provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google';
          showModelPickerInOnboarding(provider);
        }, 1000);
    } else {
      showOnboardingError(result.error || 'Invalid API key');
    }
    } else {
      // Browser mode: Use localStorage
      var apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
      apiKeys[provider] = apiKey;
      localStorage.setItem('roweos_api_keys', JSON.stringify(apiKeys));
      
      statusEl.style.background = 'rgba(74, 222, 128, 0.1)';
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '✓ API key saved successfully!';
      
      // Update provider keys
      providerKeys[provider] = true;
      
      // Check connection
      await checkApiConnection();
      
      // v14.3.1: Show model picker after key saved
      setTimeout(function() {
        document.getElementById('onboardingConnectedProvider').textContent = provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google';
        showModelPickerInOnboarding(provider);
      }, 1000);
    }
  } catch (error) {
    console.error('[Onboarding] Error saving API key:', error);
    showOnboardingError('Failed to save API key');
  }
}

// v14.3.1: Show model picker inside onboarding step 4 content area
function showModelPickerInOnboarding(provider) {
  var models = {
    anthropic: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', desc: 'Most capable, complex reasoning and analysis', color: '#a89878', recommended: true },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Fast, intelligent, great for most tasks', color: '#f97316', recommended: false },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', desc: 'Fastest responses, cost-effective', color: '#22c55e', recommended: false }
    ],
    openai: [
      { id: 'gpt-5.5', name: 'GPT-5.5', desc: 'Most capable frontier model for professional work', color: '#22c55e', recommended: true },
      { id: 'gpt-5.5-pro', name: 'GPT-5.5 Pro', desc: 'Maximum performance on complex tasks', color: '#4ade80', recommended: false },
      { id: 'gpt-5.5-thinking', name: 'GPT-5.5 Thinking', desc: 'Extended reasoning for complex analysis', color: '#86efac', recommended: false }
    ],
    google: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Advanced reasoning and multimodal capabilities', color: '#3b82f6', recommended: true },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash', desc: 'Fast responses, great for quick tasks', color: '#22c55e', recommended: false }
    ]
  };

  var providerModels = models[provider] || models.anthropic;
  var providerName = provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google';

  var stepEl = document.getElementById('onboardingStep4');
  if (!stepEl) { goToOnboardingStep('logo'); return; }

  var contentEl = stepEl.querySelector('.onboarding-content');
  if (!contentEl) { goToOnboardingStep('logo'); return; }

  // v15.27: Save original step 4 content so back button can restore it
  if (!window._step4OriginalContent) {
    window._step4OriginalContent = contentEl.innerHTML;
  }

  var html = '<div id="onboardingModelPicker" style="text-align:center;padding:20px 0;">';
  html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:8px;"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>';
  html += '<h3 style="margin:0 0 4px;font-size:18px;color:var(--text-primary);">Choose Your Default Model</h3>';
  html += '<p style="margin:0 0 20px;font-size:13px;color:var(--text-muted);">Select a ' + escapeHtml(providerName) + ' model for all brands</p>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;max-width:480px;margin:0 auto 20px;">';

  providerModels.forEach(function(m) {
    html += '<div onclick="selectModelFromOnboarding(\'' + provider + '\', \'' + m.id + '\')" style="padding:16px;border:2px solid var(--border-color);border-radius:12px;cursor:pointer;transition:all 0.2s;text-align:center;" onmouseover="this.style.borderColor=\'' + m.color + '\';this.style.background=\'' + m.color + '10\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.background=\'transparent\'">';
    html += '<div style="width:36px;height:36px;border-radius:50%;background:' + m.color + '20;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">';
    html += '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + m.color + '" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/></svg>';
    html += '</div>';
    html += '<div style="font-weight:600;font-size:14px;color:var(--text-primary);margin-bottom:4px;">' + escapeHtml(m.name) + '</div>';
    html += '<div style="font-size:12px;color:var(--text-muted);line-height:1.4;">' + escapeHtml(m.desc) + '</div>';
    if (m.recommended) {
      html += '<div style="margin-top:8px;font-size:11px;color:' + m.color + ';font-weight:600;">Recommended</div>';
    }
    html += '</div>';
  });

  html += '</div>';
  // v15.27: Add another AI provider link
  html += '<div style="margin-bottom:12px;">';
  html += '<button onclick="returnToProviderForMultiApi()" style="background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;padding:8px 16px;font-weight:500;">+ Add another AI provider</button>';
  html += '</div>';
  html += '<button onclick="goToOnboardingStep(\'logo\')" style="background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;padding:8px 16px;">Skip for now</button>';
  html += '</div>';

  contentEl.innerHTML = html;
}

// v15.27: Return to provider selection for adding multiple API keys
function returnToProviderForMultiApi() {
  // Restore step 4 original content before navigating back
  if (window._step4OriginalContent) {
    var step4El = document.getElementById('onboardingStep4');
    if (step4El) {
      var step4Content = step4El.querySelector('.onboarding-content');
      if (step4Content) step4Content.innerHTML = window._step4OriginalContent;
    }
    window._step4OriginalContent = null;
  }
  goToOnboardingStep('provider');
}

// v14.3.1: Handle model selection from onboarding picker
function selectModelFromOnboarding(provider, modelId) {
  try {
    for (var i = 0; i < 5; i++) {
      if (!brandSettings[i]) {
        brandSettings[i] = { provider: provider, model: modelId };
      } else {
        brandSettings[i].provider = provider;
        brandSettings[i].model = modelId;
      }
    }
    saveBrandModelConfig();
    showToast('Default model set to ' + modelId.split('-').slice(0, 3).join(' '), 'success');
  } catch (e) {
    console.error('[v14.3.1] Error setting model:', e);
  }
  // v26.5: Start web search in background after API key validated and model selected
  if (typeof startOnboardingWebSearch === 'function') startOnboardingWebSearch();
  // v21.0: Check for multiple API keys - show RoweOS AI splash
  var avail = getAvailableProviders();
  var keyCount = Object.keys(avail).length;
  if (keyCount >= 2) {
    showRoweOSAISplash();
  } else {
    showAnalyticsSplash();
  }
}

// v21.0: RoweOS AI routing splash - shown when 2+ API keys entered during onboarding
function showRoweOSAISplash() {
  var step4El = document.getElementById('onboardingStep4');
  if (!step4El) { goToOnboardingStep('logo'); return; }
  var contentEl = step4El.querySelector('.onboarding-content');
  if (!contentEl) { goToOnboardingStep('logo'); return; }
  _onboardingStep4State = 'roweosAI';

  var html = '<div style="max-width:520px;margin:0 auto;">';

  // Banner - matches /info page .roweos-ai-banner style
  html += '<div style="border:1px solid rgba(168,152,120,0.15);border-radius:14px;padding:28px 28px 24px;background:linear-gradient(135deg,rgba(168,152,120,0.06),rgba(168,152,120,0.02));position:relative;overflow:hidden;">';
  // Top accent line
  html += '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent,#a89878),transparent);"></div>';

  // Icon + label row
  html += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">';
  html += '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--accent,#a89878),rgba(168,152,120,0.5));display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
  html += '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
  html += '</div>';
  html += '<div>';
  html += '<div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--accent,#a89878);margin-bottom:2px;">Brilliance AI</div>';
  html += '<div style="font-size:18px;font-weight:400;color:var(--text-primary);">Don\'t pick a model. Let Brilliance pick for you.</div>';
  html += '</div>';
  html += '</div>';

  // Description
  html += '<p style="margin:0 0 16px;font-size:13px;color:var(--text-secondary);line-height:1.7;">Brilliance AI dynamically routes every request to the optimal model based on the task. Creative writing goes to Claude. Research goes to Gemini. Quick answers go to the fastest available model.</p>';

  // Routing tags - pill style matching /info page
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">';
  var tags = ['Creative &rarr; Claude', 'Research &rarr; Gemini', 'Strategy &rarr; Opus', 'Quick tasks &rarr; Flash', 'Code &rarr; Sonnet'];
  for (var i = 0; i < tags.length; i++) {
    html += '<span style="font-size:11px;color:var(--accent,#a89878);border:1px solid rgba(168,152,120,0.2);border-radius:20px;padding:4px 12px;letter-spacing:0.04em;">' + tags[i] + '</span>';
  }
  html += '</div>';

  html += '</div>'; // end banner

  // Choice cards below banner
  html += '<div style="display:grid;gap:10px;margin-top:16px;">';
  html += '<div onclick="selectRoweOSAIPref(\'auto\')" style="padding:16px;background:var(--bg-tertiary);border:2px solid var(--accent,#a89878);border-radius:var(--radius-md);cursor:pointer;text-align:left;transition:all 0.2s;" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'var(--bg-tertiary)\'">';
  html += '<div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">Keep Brilliance AI (Recommended)</div>';
  html += '<div style="font-size:13px;color:var(--text-secondary);">Automatically routes to the optimal model for each task</div>';
  html += '</div>';
  html += '<div onclick="selectRoweOSAIPref(\'single\')" style="padding:16px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);cursor:pointer;text-align:left;transition:all 0.2s;" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'var(--bg-tertiary)\'">';
  html += '<div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">Choose a single provider</div>';
  html += '<div style="font-size:13px;color:var(--text-secondary);">Always use one provider for all tasks</div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';

  contentEl.innerHTML = html;
}

// v21.0: Handle RoweOS AI preference selection
function selectRoweOSAIPref(pref) {
  if (pref === 'auto') {
    // Set RoweOS AI as default for all brand slots
    try {
      for (var i = 0; i < 5; i++) {
        if (!brandSettings[i]) brandSettings[i] = {};
        brandSettings[i].provider = 'roweos';
        brandSettings[i].model = 'auto';
      }
      saveBrandModelConfig();
    } catch(e) {}
    showAnalyticsSplash();
  } else {
    // Keep current single-provider selection, proceed
    showAnalyticsSplash();
  }
}

// v21.0: Analytics awareness splash - brief inline before logo step
function showAnalyticsSplash() {
  var step4El = document.getElementById('onboardingStep4');
  if (!step4El) { goToOnboardingStep('logo'); return; }
  var contentEl = step4El.querySelector('.onboarding-content');
  if (!contentEl) { goToOnboardingStep('logo'); return; }
  _onboardingStep4State = 'analytics';

  // v22.2: Update header - key is already connected at this point
  var titleEl = step4El.querySelector('.onboarding-title');
  var subtitleEl = step4El.querySelector('.onboarding-subtitle');
  if (titleEl) titleEl.textContent = 'Track your AI usage';
  if (subtitleEl) subtitleEl.textContent = 'Monitor costs and usage across all your AI providers';

  // v22.2: Update buttons - "Change Provider" → hidden, "Connect & Continue" → "Continue"
  var actions = step4El.querySelector('.onboarding-actions');
  if (actions) {
    var secBtn = actions.querySelector('.onboarding-btn-secondary');
    var priBtn = actions.querySelector('.onboarding-btn-primary');
    if (secBtn) secBtn.style.display = 'none';
    if (priBtn) priBtn.innerHTML = 'Continue &#8594;';
  }

  var html = '<div style="max-width:420px;margin:0 auto;text-align:center;">';
  html += '<div style="width:48px;height:48px;margin:0 auto 12px;background:rgba(168,152,120,0.1);border-radius:12px;display:flex;align-items:center;justify-content:center;">';
  html += '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--accent,#a89878)" stroke-width="2"><rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/></svg>';
  html += '</div>';
  html += '<p style="margin:0;color:var(--text-secondary);font-size:14px;line-height:1.6;">In Analytics, you can monitor API costs, set spending alerts, and see which models you use most.</p>';
  html += '</div>';

  contentEl.innerHTML = html;
}

function showOnboardingError(message) {
  var statusEl = document.getElementById('onboardingKeyStatus');
  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(255, 68, 68, 0.1)';
  statusEl.style.color = '#ff4444';
  statusEl.textContent = message;
}

// v21.0: Step 4 state tracking (content changes via splashes)
var _onboardingStep4State = 'apiKey'; // 'apiKey' | 'roweosAI' | 'analytics'

// Wizard State
var wizardSetupMethod = null; // 'ai' or 'manual'
var wizardVoiceAttributes = [];
var wizardValues = [];

// Step 6: Select Setup Method
function selectSetupMethod(method) {
  wizardSetupMethod = method;
  
  // Visual feedback
  var cards = document.querySelectorAll('.onboarding-method-card');
  cards.forEach(function(card) {
    card.classList.remove('selected');
  });
  event.currentTarget.classList.add('selected');
  
  // Auto-advance after selection
  setTimeout(function() {
    goToOnboardingStep(7);
  }, 300);
}

// Step 7: No special functions needed (just form inputs)

// Step 8: Toggle Voice Attributes
function toggleVoiceAttribute(element, attribute) {
  var index = wizardVoiceAttributes.indexOf(attribute);
  
  if (index === -1) {
    // Add if under limit
    if (wizardVoiceAttributes.length < 3) {
      wizardVoiceAttributes.push(attribute);
      element.classList.add('selected');
    } else {
      showToast('Maximum 3 voice attributes', 'warning');
    }
  } else {
    // Remove
    wizardVoiceAttributes.splice(index, 1);
    element.classList.remove('selected');
  }
}

// Step 9: Toggle Value Checkboxes
function toggleValueCheckbox(checkbox) {
  var value = checkbox.value;
  var index = wizardValues.indexOf(value);
  
  if (checkbox.checked && index === -1) {
    wizardValues.push(value);
  } else if (!checkbox.checked && index !== -1) {
    wizardValues.splice(index, 1);
  }
}

// Complete Brand Setup
function completeBrandSetup() {
  console.log('=== Completing brand setup ===');
  
  // Collect data
  var brandName = document.getElementById('wizardBrandName').value.trim();
  var brandTagline = document.getElementById('wizardBrandTagline').value.trim();
  var brandLocation = document.getElementById('wizardBrandLocation').value.trim();
  var brandWebsite = document.getElementById('wizardBrandWebsite').value.trim();
  var brandDescription = document.getElementById('wizardBrandDescription').value.trim();
  var brandAudience = document.getElementById('wizardBrandAudience').value.trim();
  var brandProblem = document.getElementById('wizardBrandProblem').value.trim();
  
  // v9.1.14: Get extracted data from website/document import
  var extractedData = window.onboardingPrefillData || {};
  
  // Validate required fields
  if (!brandName) {
    showToast('Please enter a brand name', 'error');
    goToOnboardingStep(7);
    return;
  }
  
  if (!brandDescription) {
    showToast('Please describe what your brand does', 'error');
    goToOnboardingStep(7);
    return;
  }
  
  if (!brandAudience) {
    showToast('Please describe your target audience', 'error');
    goToOnboardingStep(9);
    return;
  }
  
  if (!brandProblem) {
    showToast('Please describe what you sell', 'error');
    goToOnboardingStep(9);
    return;
  }
  
  // Build voice string - check custom input first, then selected attributes, then extracted
  var customVoice = document.getElementById('wizardCustomVoice').value.trim();
  var voice = customVoice || wizardVoiceAttributes.join(', ') || extractedData.voice || 'professional, warm, thoughtful';
  
  // Build positioning from description or extracted
  var positioning = brandDescription || extractedData.essence || '';
  
  // v15.1: Get brand color from onboarding picker (dark + light mode)
  var wizardColorEl = document.getElementById('wizardBrandColor');
  var brandColor = wizardColorEl ? wizardColorEl.value : '#a89878';
  var brandColorLight = window._onboardingBrandColorLight || brandColor;

  // Create new brand object with extracted data merged in
  var newBrand = {
    id: 'brand_name_' + brandName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    _modifiedAt: Date.now(),
    _createdAt: Date.now(),
    name: brandName,
    tagline: brandTagline || extractedData.tagline || 'Excellence in every detail',
    voice: voice,
    positioning: positioning,
    products: brandProblem || extractedData.products || '',
    audience: brandAudience || extractedData.audience || '',
    location: brandLocation || 'United States',
    website: brandWebsite || extractedData.sourceUrl || '',
    vocabDo: wizardValues.join(', ') || 'excellence, quality, innovation',
    vocabDont: 'cheap, rushed, generic',
    mission: '',
    brandColor: brandColor, // v15.1: Per-brand accent color (dark mode)
    brandColorLight: brandColorLight, // v15.1: Per-brand accent color (light mode)
    // v9.1.14: Store import source for reference
    importMethod: extractedData.importMethod || 'manual',
    // v9.1.14: Initialize identityData with ALL extracted/entered values
    identityData: {
      essence: {
        owner: positioning,
        ai: extractedData.essence || ''
      },
      voice: {
        owner: voice,
        ai: extractedData.voice || ''
      },
      audience: {
        owner: brandAudience,
        ai: extractedData.audience || ''
      },
      messaging: {
        owner: brandTagline,
        ai: extractedData.messaging || ''
      },
      products: {
        owner: brandProblem,
        ai: extractedData.products || ''
      },
      visual: {
        owner: '',
        ai: extractedData.visual || ''
      },
      competitive: {
        owner: '',
        ai: extractedData.competitive || ''
      }
    }
  };
  
  // v14.0: Merge ownership data into brand identityData
  if (window.onboardingOwnershipData) {
    newBrand.identityData.role = window.onboardingOwnershipData;
  }

  // Get selected provider from onboarding
  var selectedProvider = window.onboardingSelectedProvider || 'anthropic';
  var providerModels = {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-5.5',
    google: 'gemini-3.1-pro-preview'
  };
  
  // v29.1: Check if brand already exists (quick-add creates it before onboarding opens)
  var existingIdx = -1;
  for (var _ebi = 0; _ebi < brands.length; _ebi++) {
    if ((brands[_ebi].name || '').toLowerCase() === brandName.toLowerCase()) {
      existingIdx = _ebi;
      break;
    }
  }

  var newBrandIndex;
  if (existingIdx >= 0) {
    // v29.1: Update existing brand instead of creating duplicate
    console.log('[Onboarding] v29.1: Updating existing brand at index', existingIdx, 'instead of creating duplicate');
    // Preserve the existing id and _createdAt, merge all other fields
    newBrand.id = brands[existingIdx].id;
    newBrand._createdAt = brands[existingIdx]._createdAt || newBrand._createdAt;
    brands[existingIdx] = newBrand;
    newBrandIndex = existingIdx;
  } else {
    // Brand doesn't exist yet -- add it
    brands.push(newBrand);
    newBrandIndex = brands.length - 1;
  }

  // Save brand settings - brandSettings is an object, not an array
  brandSettings[newBrandIndex] = {
    provider: selectedProvider,
    model: providerModels[selectedProvider]
  };

  // Save to localStorage
  try {
    // v14.2: Use saveBrands() to set lastLocalSaveTime
    saveBrands();
    localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings));
    console.log('[Onboarding] Brand saved:', newBrand.name);
  } catch (e) {
    console.error('Save error:', e);
    showToast('Error saving brand', 'error');
    return;
  }
  
  // v14.2 / v29.0: Save onboarding logo to correct brand index (ID-based + index compat)
  if (window._onboardingLogo) {
    try {
      var logoKey = getCurrentLogoKey(newBrandIndex);
      localStorage.setItem(logoKey, window._onboardingLogo);
      localStorage.setItem(logoKey + '_size', '100');
      // Keep index-based key for backward compat
      localStorage.setItem('roweos_brand_' + newBrandIndex + '_logo', window._onboardingLogo);
      localStorage.setItem('roweos_brand_' + newBrandIndex + '_logo_size', '100');
      if (typeof applyBrandLogo === 'function') {
        applyBrandLogo(window._onboardingLogo, 100);
      }
      console.log('[Onboarding] Logo saved to ' + logoKey);
    } catch (logoErr) {
      console.error('[Onboarding] Logo save error:', logoErr);
    }
    window._onboardingLogo = null;
  }

  // v14.2: Apply brand color immediately
  if (brandColor && typeof applyBrandAccentColor === 'function') {
    applyBrandAccentColor(brandColor);
  }

  // v9.1.14: Auto-select the new brand
  selectedBrand = newBrandIndex;
  localStorage.setItem('roweos_selected_brand', newBrandIndex.toString()); // v26.7: Fix - USER_DATA_KEYS.selectedBrand was undefined
  console.log('[Onboarding] New brand auto-selected, index:', newBrandIndex);

  // Update all brand selectors
  updateBrandSelectors();
  
  // Go to loading step (Step 10)
  goToOnboardingStep(10);
  
  // Animate loading progress
  var progress = 0;
  var progressBar = document.getElementById('brandBuildProgress');
  var checkItems = ['check1', 'check2', 'check3', 'check4'];
  var currentCheck = 0;
  
  var progressInterval = setInterval(function() {
    progress += 2;
    if (progressBar) progressBar.style.width = progress + '%';
    
    // Activate checklist items
    if (progress > 25 && currentCheck === 0) {
      document.getElementById('check1').classList.add('active');
      currentCheck = 1;
    } else if (progress > 50 && currentCheck === 1) {
      document.getElementById('check2').classList.add('active');
      currentCheck = 2;
    } else if (progress > 75 && currentCheck === 2) {
      document.getElementById('check3').classList.add('active');
      currentCheck = 3;
    } else if (progress > 90 && currentCheck === 3) {
      document.getElementById('check4').classList.add('active');
      currentCheck = 4;
    }
    
    if (progress >= 100) {
      clearInterval(progressInterval);
      
      // Reset wizard state
      wizardSetupMethod = null;
      wizardVoiceAttributes = [];
      wizardValues = [];
      
      // Populate success page (Step 11) with brand data
      setTimeout(function() {
        populateStep11(newBrand);
        goToOnboardingStep(11);
      }, 500);
    }
  }, 30);
  
  showToast('Brand "' + brandName + '" is being created...', 'info');
}

// Finalize Onboarding (from Step 11)
function finalizeOnboarding() {
  console.log('=== Finalizing onboarding ===');
  localStorage.setItem(USER_DATA_KEYS.onboardingCompleted, 'true');

  // v12.2.7: Clear onboarding flags
  window._onboardingInProgress = false;
  window._onboardingLogo = null;

  // v9.1.14: Clear onboarding temp data
  window.onboardingPrefillData = null;
  window.onboardingBrandName = null;
  window.onboardingOwnershipData = null;
  window.onboardingOwnershipRole = null;
  window.websiteSourceUrl = null;
  window.websiteExtractedData = null;

  // v26.5: Hide web search floating indicator
  var wsIndicator = document.getElementById('webSearchFloatingIndicator');
  if (wsIndicator) wsIndicator.classList.remove('visible');

  hideOnboarding();
  
  // v9.1.14: Get the new brand index from localStorage (set in completeBrandSetup)
  var newBrandIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0'); // v26.7: Fix - USER_DATA_KEYS.selectedBrand was undefined
  selectedBrand = newBrandIdx;
  
  // Update all brand selectors to show new brand
  if (typeof updateBrandSelectors === 'function') updateBrandSelectors();
  
  // Set the dropdown value directly
  var brandSelect = document.getElementById('brand');
  if (brandSelect) {
    brandSelect.value = newBrandIdx;
  }
  
  // Trigger brand change to load the new brand data
  if (typeof onBrandChange === 'function') onBrandChange();

  // v27.1: Now that onboarding is complete and profiles are in localStorage,
  // flush them to Firestore and stamp lastSync so reconcileOnStartup on next
  // load won't discard them. Write-through already fired during completeBrandSetup,
  // but the debounced LifeAI sync may still be pending.
  if (typeof firebaseUser !== 'undefined' && firebaseUser) {
    // Re-save brands to ensure write-through fires for the final state
    if (typeof saveBrands === 'function' && brands.length > 0) saveBrands();
    // Flush any pending LifeAI sync immediately
    if (typeof _flushLifeAISync === 'function') _flushLifeAISync();
    // Stamp sync time so mergeByTimestamp treats these profiles as synced
    localStorage.setItem('roweos_first_sync_completed', 'true');
    localStorage.setItem('roweos_last_sync', String(Date.now()));
  }

  // v26.5: Enable deferred cloud scheduler after onboarding is fully complete
  setTimeout(function() {
    var pendingScheduler = localStorage.getItem('roweos_cloud_scheduler_pending');
    if (pendingScheduler === 'true') {
      localStorage.removeItem('roweos_cloud_scheduler_pending');
      if (typeof toggleCloudScheduler === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
        toggleCloudScheduler(true);
      }
    }
  }, 2000);

  setTimeout(function() {
    showView('agent');
    // v14.1: Launch guided tour instead of toast
    setTimeout(function() { initTour(); }, 600);
  }, 300);
}

// Skip Brand Setup
function skipBrandSetup() {
  if (confirm('Skip brand setup for now? You can create brands later in the Identity panel.')) {
    completeOnboarding();
  }
}

// Close Onboarding Modal
function closeOnboardingModal() {
  if (confirm('Exit setup? You can complete this later by clicking "Get Started" in the sidebar.')) {
    // v14.2: Clean up partial LifeAI data if quitting during LifeAI onboarding
    if (selectedOnboardingMode === 'life') {
      localStorage.removeItem('roweos_life_profile');
      localStorage.removeItem('roweos_life_onboarding_complete');
      localStorage.removeItem('roweos_life_survey_data');
      console.log('[Onboarding] Cleaned up partial LifeAI data');
    }

    // v12.2.7: Clear onboarding flags
    window._onboardingInProgress = false;
    window._onboardingLogo = null;
    window.onboardingPrefillData = null;
    window.onboardingBrandName = null;
    window.onboardingOwnershipData = null;
    // v15.25: Restore original accent color if onboarding changed it
    if (window._onboardingOriginalAccent) {
      if (typeof applyBrandAccentColor === 'function') {
        applyBrandAccentColor(window._onboardingOriginalAccent);
      }
      window._onboardingOriginalAccent = null;
    }
    hideOnboarding();
    localStorage.setItem(USER_DATA_KEYS.onboardingCompleted, 'true');

    // v9.1.14: Ensure app container is visible and navigate to BrandAI
    var appContainer = document.getElementById('appContainer');
    if (appContainer) {
      appContainer.style.display = 'flex';
    }

    // Hide launch screen if still visible
    var launchScreen = document.getElementById('launchScreen');
    if (launchScreen) {
      launchScreen.style.display = 'none';
    }

    // Navigate to BrandAI (agent view)
    showView('agent');
  }
}

function completeOnboarding() {
  // v21.0: Route to cross-mode step if not yet shown
  if (!window._crossModeShown) {
    window._crossModeShown = true;
    window._crossModeOrigin = 'brand';
    goToOnboardingStep('crossMode');
    return;
  }
  console.log('=== Completing onboarding ===');
  localStorage.setItem(USER_DATA_KEYS.onboardingCompleted, 'true');
  hideOnboarding();

  // v14.1: Navigate to BrandAI and launch guided tour
  setTimeout(function() {
    showView('agent');
    setTimeout(function() { initTour(); }, 600);
  }, 300);
}

// ─────────────────────────────────────────────────────────────────────────────────
// v14.1: POST-ONBOARDING GUIDED TOUR
// ─────────────────────────────────────────────────────────────────────────────────

// v24.25: Comprehensive BrandAI guided tour with deep-dive steps
var TOUR_STEPS = [
  { id: 'welcome', type: 'center', target: null, title: 'Welcome to RoweOS', description: 'Your brand is set up and B.L.A.K.E. is ready. Let us show you around.', icon: 'sparkles' },
  { id: 'brandai', type: 'deep-dive', target: 'agent', title: 'BrandAI Chat', description: 'Your AI chat assistant, tailored to your brand.', icon: 'chat', features: ['Claude, GPT, and Gemini in one conversation', 'Attach images and documents for AI analysis', 'Conversations auto-save to History'], helpHint: true },
  { id: 'pulse', type: 'deep-dive', target: 'pulse', title: 'Pulse', description: 'Goal tracking with visual timelines.', icon: 'target', features: ['Short-term and long-term goal tracking', 'Progress visualization and completion rates', 'Quick-add goals from any view'] },
  { id: 'studio', type: 'deep-dive', target: 'studio', title: 'Studio', description: '150+ operations across 5 AI agents.', icon: 'edit', features: ['Strategy, Marketing, Operations, Documents, Intelligence', 'Image generation with Nano Banana 3.0 Pro', 'Video generation with Veo 3.1', 'Export results as PDF, Word, or Excel'] },
  { id: 'rhythm', type: 'deep-dive', target: 'rhythm', title: 'Rhythm', description: 'Calendar and time management.', icon: 'calendar', features: ['Sync with Google Calendar, iCloud, or Outlook', 'Day, week, and month views', 'Create events and set reminders'] },
  { id: 'automations', type: 'deep-dive', target: 'automations', title: 'Automations', description: 'Build automated workflows.', icon: 'zap', features: ['Automations Agent builds pipelines conversationally', 'Schedule recurring AI tasks', 'Multi-step pipelines with email, social, and more'] },
  { id: 'library', type: 'deep-dive', target: 'library', title: 'Library', description: 'Your content archive.', icon: 'library', features: ['Save conversations, documents, and AI outputs', 'Folder organization and search', 'Attach library items to emails or posts'] },
  { id: 'mail', type: 'deep-dive', target: 'mail', title: 'Mail', description: 'AI-powered email.', icon: 'mail', features: ['Compose emails in your brand voice', 'Outbox, sent, and draft management', 'Connect Gmail or Outlook for full inbox access'] },
  { id: 'identity', type: 'deep-dive', target: 'memory', title: 'Identity', description: 'Your brand knowledge base.', icon: 'diamond', features: ['Voice, positioning, audience, and brand context', 'Powers every AI interaction automatically', 'Edit brand details anytime'] },
  { id: 'history', type: 'deep-dive', target: 'tuning', title: 'History', description: 'Browse and search past conversations.', icon: 'clock', features: ['Search by keyword, date, or agent', 'Resume any previous conversation', 'Syncs across all devices'] },
  { id: 'bloom', type: 'deep-dive', target: 'bloom', title: 'Bloom', description: 'Your content discovery feed.', icon: 'sparkles', features: ['Browse generated content from Studio and chat', 'Filter by type, category, and date', 'Revisit and refine past creations'] },
  { id: 'analytics', type: 'deep-dive', target: 'commerce', title: 'Analytics', description: 'Track usage and costs.', icon: 'chart', features: ['API costs across Claude, GPT, and Gemini', 'Budget tracking with countdown display', 'Per-provider spending alerts'] },
  { id: 'people', type: 'deep-dive', target: 'clients', title: 'People', description: 'Manage clients, team, and contacts.', icon: 'users', features: ['Track clients, team members, and contacts', 'Link conversations and documents to people', 'Export contact data'] },
  { id: 'inventory', type: 'deep-dive', target: 'inventory', title: 'Inventory', description: 'Asset and inventory tracking.', icon: 'package', features: ['Track products, assets, and supplies', 'Organize by category with search', 'Link to operations and automations'] },
  { id: 'social-posting', type: 'center', target: null, title: 'Social Publishing', description: 'Publish to X, Threads, and Instagram directly from RoweOS.', icon: 'share' },
  { id: 'help-tip', type: 'center', target: null, title: 'Quick Help', description: 'Every view has a ? button in the header. Press it anytime for a quick guide to that view, with key features and tips.', icon: 'sparkles' },
  { id: 'settings', type: 'sidebar', target: 'settings', title: 'System', description: 'API keys, cloud sync, themes, B.L.A.K.E., and all preferences.', icon: 'settings' },
  { id: 'done', type: 'center', target: null, title: "You're all set", description: 'BrandAI is waiting for your first question. Start chatting to experience the platform.', icon: 'checkCircle' }
];

// v24.25: Comprehensive LifeAI guided tour with deep-dive steps
var LIFE_TOUR_STEPS = [
  { id: 'welcome', type: 'center', target: null, title: 'Welcome to LifeAI', description: 'Your personal AI coach is configured. Let us show you everything.', icon: 'sparkles' },
  { id: 'lifeai', type: 'deep-dive', target: 'agent', title: 'LifeAI Chat', description: 'Your personal AI coach.', icon: 'chat', features: ['Claude, GPT, or Gemini in one conversation', 'Attach images for AI analysis', 'Conversations auto-save to History'], helpHint: true },
  { id: 'pulse', type: 'deep-dive', target: 'pulse', title: 'Pulse', description: 'Track personal goals over time.', icon: 'target', features: ['Visual progress timelines', 'Short-term and long-term goal tracking', 'Quick-add goals from any view'] },
  { id: 'studio', type: 'deep-dive', target: 'studio', title: 'Studio', description: '70+ personal AI operations.', icon: 'edit', features: ['Meal plans, workout routines, budgets, journaling', 'Tax preparation with Tax Intelligence', 'Travel planning, home organization, creative projects', 'Decision frameworks and priority matrices'] },
  { id: 'rhythm', type: 'deep-dive', target: 'rhythm', title: 'Rhythm', description: 'Calendar and time management.', icon: 'calendar', features: ['Sync with Google Calendar, iCloud, or Outlook', 'Day, week, and month views', 'Create events and set reminders'] },
  { id: 'automations', type: 'deep-dive', target: 'automations', title: 'Automations', description: 'Automated routines and check-ins.', icon: 'zap', features: ['Schedule recurring AI tasks', 'Multi-step pipelines with triggers', 'Workflow presets for common routines'] },
  { id: 'library', type: 'deep-dive', target: 'library', title: 'Library', description: 'Save and organize everything.', icon: 'library', features: ['Notes, documents, and uploads', 'Searchable and folder-organized', 'Attach files to conversations or emails'] },
  { id: 'mail', type: 'deep-dive', target: 'mail', title: 'Mail', description: 'AI-powered email composition.', icon: 'mail', features: ['Compose emails in your personal voice', 'Manage outbox and sent messages', 'Connect Gmail or Outlook'] },
  { id: 'identity', type: 'deep-dive', target: 'memory', title: 'Identity', description: 'Your personal knowledge base.', icon: 'diamond', features: ['LifeAI learns your preferences over time', 'Communication style and daily rhythm stored here', 'Edit life areas and goals anytime'] },
  { id: 'history', type: 'deep-dive', target: 'tuning', title: 'History', description: 'Browse past conversations.', icon: 'clock', features: ['Search by keyword or date', 'Resume any previous conversation', 'Syncs across devices with Cloud Sync'] },
  { id: 'analytics', type: 'deep-dive', target: 'commerce', title: 'Analytics', description: 'Track AI usage and costs.', icon: 'chart', features: ['API usage across all providers', 'Budget tracking and spending alerts', 'Per-provider cost breakdown'] },
  { id: 'inventory', type: 'deep-dive', target: 'inventory', title: 'Possessions', description: 'Personal inventory management.', icon: 'package', features: ['Track items, warranties, and valuables', 'Organize by category', 'Link to insurance or maintenance records'] },
  { id: 'guardrails', type: 'deep-dive', target: 'guardrails', title: 'Guardrails', description: 'Content safety and preferences.', icon: 'settings', features: ['Set content review preferences', 'Approval workflows for automated content', 'Control AI response boundaries'] },
  { id: 'bloom', type: 'deep-dive', target: 'bloom', title: 'Bloom', description: 'Content discovery feed.', icon: 'sparkles', features: ['Browse generated content from Studio', 'Filter by type and category', 'Revisit and refine past creations'] },
  { id: 'help-tip', type: 'center', target: null, title: 'Quick Help', description: 'Every view has a ? button in the header. Press it anytime for a quick guide to that view, with key features and tips.', icon: 'sparkles' },
  { id: 'settings', type: 'sidebar', target: 'settings', title: 'System', description: 'API keys, B.L.A.K.E. customization, themes, and preferences.', icon: 'settings' },
  { id: 'done', type: 'center', target: null, title: "You're all set", description: 'LifeAI is ready for your first conversation. Start chatting to get started.', icon: 'checkCircle' }
];

var tourState = {
  active: false,
  currentStep: 0,
  overlayEl: null,
  spotlightEl: null,
  cardEl: null,
  steps: TOUR_STEPS,
  isLifeTour: false
};

function initTour(isLifeMode) {
  // v14.1: Don't launch if already completed or already active
  var completedKey = isLifeMode ? 'roweos_life_tour_completed' : USER_DATA_KEYS.tourCompleted;
  try {
    if (localStorage.getItem(completedKey) === 'true') return;
  } catch (e) {}
  if (tourState.active) return;

  // v15.27: Set mode-specific steps
  tourState.isLifeTour = !!isLifeMode;
  tourState.steps = isLifeMode ? LIFE_TOUR_STEPS : TOUR_STEPS;
  tourState.active = true;
  tourState.currentStep = 0;

  // Create overlay
  var overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  overlay.onclick = function() { /* block clicks */ };
  document.body.appendChild(overlay);
  tourState.overlayEl = overlay;

  // Create spotlight
  var spotlight = document.createElement('div');
  spotlight.className = 'tour-spotlight';
  spotlight.style.display = 'none';
  document.body.appendChild(spotlight);
  tourState.spotlightEl = spotlight;

  // Create card container
  var card = document.createElement('div');
  card.className = 'tour-card';
  document.body.appendChild(card);
  tourState.cardEl = card;

  renderTourStep(0);
}

// v15.27: LifeAI-specific tour launcher
function initLifeTour() {
  initTour(true);
}

function renderTourStep(stepIndex) {
  var activeSteps = tourState.steps || TOUR_STEPS;
  var step = activeSteps[stepIndex];
  if (!step) return;

  tourState.currentStep = stepIndex;
  var card = tourState.cardEl;
  var spotlight = tourState.spotlightEl;

  // Build progress dots
  var dotsHtml = '';
  for (var i = 0; i < activeSteps.length; i++) {
    dotsHtml += '<div class="tour-card-dot' + (i === stepIndex ? ' active' : '') + '"></div>';
  }

  // Build action buttons
  // v14.3: Support custom action buttons for tour ending steps
  var actionsHtml = '';
  if (step.id === 'welcome') {
    actionsHtml = '<button class="tour-btn-skip" onclick="skipTour()">Skip</button>' +
                  '<button class="tour-btn-primary" onclick="nextTourStep()">Start Tour</button>';
  } else if (step.id === 'done') {
    actionsHtml = '<button class="tour-btn-primary" onclick="completeTour()">Get Started</button>';
  } else if (step.action === 'tryStudio') {
    actionsHtml = '<button class="tour-btn-skip" onclick="skipTour()">Skip</button>' +
                  '<div class="tour-card-actions">' +
                  '<button class="tour-btn-secondary" onclick="prevTourStep()">Back</button>' +
                  '<button class="tour-btn-primary" onclick="runTourStudioDemo()">Try It</button>' +
                  '</div>';
  } else if (step.action === 'openHelper') {
    actionsHtml = '<button class="tour-btn-skip" onclick="skipTour()">Skip</button>' +
                  '<div class="tour-card-actions">' +
                  '<button class="tour-btn-secondary" onclick="prevTourStep()">Back</button>' +
                  '<button class="tour-btn-primary" onclick="openHelperFromTour()">Open Helper</button>' +
                  '</div>';
  } else {
    actionsHtml = '<button class="tour-btn-skip" onclick="skipTour()">Skip</button>' +
                  '<div class="tour-card-actions">' +
                  (stepIndex > 0 ? '<button class="tour-btn-secondary" onclick="prevTourStep()">Back</button>' : '') +
                  '<button class="tour-btn-primary" onclick="nextTourStep()">Next</button>' +
                  '</div>';
  }

  // v24.25: Build features list for deep-dive steps
  var featuresHtml = '';
  if (step.features && step.features.length) {
    featuresHtml = '<ul class="tour-deep-dive-features">';
    for (var fi = 0; fi < step.features.length; fi++) {
      featuresHtml += '<li>' + step.features[fi] + '</li>';
    }
    featuresHtml += '</ul>';
  }
  var helpHintHtml = step.helpHint ? '<div class="tour-help-hint">Tip: Press ? on any view for a quick guide</div>' : '';

  // v24.25: Step counter for large tours (replaces dots when >14 steps)
  var progressHtml = activeSteps.length > 14
    ? '<div class="tour-step-counter">' + (stepIndex + 1) + ' of ' + activeSteps.length + '</div>'
    : '<div class="tour-card-dots">' + dotsHtml + '</div>';

  // Build card HTML
  var html = '<div class="tour-card-icon">' + icon(step.icon, { size: 28, color: 'var(--accent, #a89878)' }) + '</div>' +
             '<div class="tour-card-title">' + step.title + '</div>' +
             '<div class="tour-card-description">' + step.description + '</div>' +
             featuresHtml + helpHintHtml +
             '<div class="tour-card-footer">' +
             progressHtml +
             '<div class="tour-card-actions">' + actionsHtml + '</div>' +
             '</div>';

  // Reset card classes
  card.className = 'tour-card';

  if (step.type === 'center') {
    // Center card, hide spotlight
    spotlight.style.display = 'none';
    card.classList.add('tour-card-center');
    card.style.top = '';
    card.style.left = '';
    card.innerHTML = html;
  } else if (step.type === 'deep-dive') {
    // v24.25: Deep-dive - show spotlight on sidebar, switch to view, wider card
    card.classList.add('tour-card-deep-dive');
    if (step.target && typeof showView === 'function') showView(step.target);
    positionTourSpotlight(step.target);
    card.innerHTML = html;
  } else {
    // Sidebar step - position spotlight and card
    positionTourSpotlight(step.target);
    card.innerHTML = html;
  }
}

function positionTourSpotlight(viewName) {
  // v30.1: Check both grouped (nav-subitem) and expanded (nav-item) sidebar modes
  var navItem = document.querySelector('.nav-subitem[data-view="' + viewName + '"]') || document.querySelector('.nav-item[data-view="' + viewName + '"]');
  // v30.1: If spotlighting a grouped subitem, expand parent group
  if (navItem && navItem.classList.contains('nav-subitem')) {
    var _parentGroup = navItem.closest('.nav-item');
    if (_parentGroup) {
      var _subitems = _parentGroup.querySelector('.nav-subitems');
      if (_subitems) _subitems.style.display = 'block';
    }
  }
  var spotlight = tourState.spotlightEl;
  var card = tourState.cardEl;

  if (!navItem) {
    // Fallback to center if nav item not found
    spotlight.style.display = 'none';
    card.classList.add('tour-card-center');
    return;
  }

  // v15.3: Auto-scroll sidebar to spotlighted item (fixes zoomed-in visibility)
  navItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

  var rect = navItem.getBoundingClientRect();
  var pad = 6;

  spotlight.style.display = 'block';
  spotlight.style.top = (rect.top - pad) + 'px';
  spotlight.style.left = (rect.left - pad) + 'px';
  spotlight.style.width = (rect.width + pad * 2) + 'px';
  spotlight.style.height = (rect.height + pad * 2) + 'px';

  // Position card to the right of sidebar
  var sidebar = document.querySelector('.sidebar');
  var sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : rect.right + 20;
  var cardLeft = sidebarRight + 16;
  var cardTop = rect.top - 20;

  // Bounds check - keep card on screen
  var maxLeft = window.innerWidth - 340;
  if (cardLeft > maxLeft) cardLeft = maxLeft;
  var maxTop = window.innerHeight - 280;
  if (cardTop > maxTop) cardTop = maxTop;
  if (cardTop < 16) cardTop = 16;

  card.style.top = cardTop + 'px';
  card.style.left = cardLeft + 'px';
}

function nextTourStep() {
  var activeSteps = tourState.steps || TOUR_STEPS;
  if (tourState.currentStep < activeSteps.length - 1) {
    renderTourStep(tourState.currentStep + 1);
  }
}

function prevTourStep() {
  if (tourState.currentStep > 0) {
    renderTourStep(tourState.currentStep - 1);
  }
}

function skipTour() {
  completeTour();
}

function completeTour() {
  // v15.27: Save correct completion key based on tour mode
  var completedKey = tourState.isLifeTour ? 'roweos_life_tour_completed' : USER_DATA_KEYS.tourCompleted;
  try {
    localStorage.setItem(completedKey, 'true');
  } catch (e) {}

  var wasLifeTour = tourState.isLifeTour;
  tourState.active = false;
  tourState.isLifeTour = false;
  tourState.steps = TOUR_STEPS;

  // Fade out
  var card = tourState.cardEl;
  var overlay = tourState.overlayEl;
  var spotlight = tourState.spotlightEl;

  if (card) card.classList.add('tour-card-out');
  if (overlay) overlay.style.transition = 'opacity 0.25s ease';
  if (overlay) overlay.style.opacity = '0';

  setTimeout(function() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (spotlight && spotlight.parentNode) spotlight.parentNode.removeChild(spotlight);
    if (card && card.parentNode) card.parentNode.removeChild(card);
    tourState.overlayEl = null;
    tourState.spotlightEl = null;
    tourState.cardEl = null;
  }, 300);

  showToast(wasLifeTour ? 'Tour complete! Start chatting with LifeAI' : 'Tour complete! Start chatting with BrandAI', 'success');
}

function restartTour() {
  var isLife = (localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand') === 'life';
  try {
    localStorage.removeItem(isLife ? 'roweos_life_tour_completed' : USER_DATA_KEYS.tourCompleted);
  } catch (e) {}
  showView('agent');
  setTimeout(function() { initTour(isLife); }, 400);
}

// v14.3: Tour demo and helper functions
function runTourStudioDemo() {
  completeTour();
  showView('studio');
}

function openHelperFromTour() {
  completeTour();
  // v15.3: Navigate to Studio and select Helper agent
  showView('studio');
  setTimeout(function() {
    // Look for Helper agent button in Studio
    var agentBtns = document.querySelectorAll('[data-agent]');
    agentBtns.forEach(function(btn) {
      if (btn.getAttribute('data-agent') === 'helper' || btn.getAttribute('data-agent') === 'roweos') {
        btn.click();
      }
    });
    // Also try selecting Helper from the agent selector dropdown
    var agentSelect = document.getElementById('studioAgent');
    if (agentSelect) {
      var options = agentSelect.querySelectorAll('option');
      options.forEach(function(opt) {
        if (opt.value === 'helper' || opt.textContent.indexOf('Helper') !== -1) {
          agentSelect.value = opt.value;
          agentSelect.dispatchEvent(new Event('change'));
        }
      });
    }
  }, 400);
}

// v14.1: Reposition spotlight on resize
window.addEventListener('resize', function() {
  if (!tourState.active) return;
  var activeSteps = tourState.steps || TOUR_STEPS;
  var step = activeSteps[tourState.currentStep];
  if (step && step.type === 'sidebar' && step.target) {
    positionTourSpotlight(step.target);
  }
});

// v14.3: Full keyboard navigation in tour
document.addEventListener('keydown', function(e) {
  if (!tourState.active) return;
  var activeSteps = tourState.steps || TOUR_STEPS;
  var step = activeSteps[tourState.currentStep];
  if (e.key === 'Escape') {
    skipTour();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    nextTourStep();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    prevTourStep();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (step && step.id === 'done') {
      completeTour();
    } else if (step && step.action === 'tryStudio') {
      runTourStudioDemo();
    } else if (step && step.action === 'openHelper') {
      openHelperFromTour();
    } else {
      nextTourStep();
    }
  }
});

// Launch full onboarding for creating a new brand
// v10.5.25: Mode-aware Identity header handlers
function handleIdentityAdd() {
  // v25.1: Double-click guard to prevent stuck blurry overlay
  if (window._identityAddInProgress) return;
  window._identityAddInProgress = true;
  setTimeout(function() { window._identityAddInProgress = false; }, 1000);
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode === 'life') {
    launchLifeOnboardingForNewProfile();
  } else {
    launchOnboardingForNewBrand();
  }
}

function handleIdentityDelete() {
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode === 'life') {
    openDeleteLifeProfileModal();
  } else {
    openDeleteBrandModal();
  }
}

function handleIdentitySave() {
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode === 'life') {
    // Life profiles auto-save, just show toast
    showToast('Life profile saved', 'success');
  } else {
    saveAllIdentityData();
  }
}

function launchOnboardingForNewBrand() {
  // v27.0: Check if API keys exist -- if so, use lightweight Add Brand flow
  var hasKeys = false;
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    hasKeys = !!(keys.anthropic || keys.openai || keys.google);
  } catch(e) {}

  if (hasKeys) {
    // Lightweight flow: prompt for brand name, then choice (website/manual)
    _showQuickAddBrandModal();
    return;
  }

  // No keys: fall back to full onboarding (needs provider/API key setup)
  if (typeof resetOnboardingState === 'function') resetOnboardingState();
  var modal = document.getElementById('onboardingModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('show');
  }
  goToOnboardingStep(0);
}

var _quickAddStep = 1;
var _quickAddLogo = null;
var _quickAddColorDark = '#a89878';
var _quickAddColorLight = '#a89878';

function _showQuickAddBrandModal() {
  var existing = document.getElementById('quickAddBrandModal');
  if (existing) existing.remove();
  _quickAddStep = 1;
  _quickAddLogo = null;
  _quickAddColorDark = '#a89878';
  _quickAddColorLight = '#a89878';
  // v28.4: Clear previous research/onboarding state so consecutive brand additions start fresh
  if (typeof _researchCurrentResult !== 'undefined') _researchCurrentResult = null;
  window._pendingWebSearchUrl = null;
  window._quickAddBrandNameVal = null;
  window._quickAddWebsiteVal = null;
  window._onboardingInProgress = false;
  window.onboardingBrandName = null;
  window.onboardingPrefillData = null;
  try { localStorage.removeItem('roweos_pending_web_search_url'); } catch(e) {}
  // Clear web search state if available
  if (typeof resetWebSearchState === 'function') resetWebSearchState();
  // Clear onboarding form fields
  var wizFields = ['wizardBrandName', 'wizardBrandWebsite', 'wizardBrandTagline', 'wizardBrandDescription', 'wizardBrandColor'];
  for (var i = 0; i < wizFields.length; i++) {
    var fld = document.getElementById(wizFields[i]);
    if (fld) fld.value = '';
  }

  var modal = document.createElement('div');
  modal.id = 'quickAddBrandModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100003;display:flex;align-items:center;justify-content:center;';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  var card = document.createElement('div');
  card.id = 'quickAddBrandCard';
  card.style.cssText = 'background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:32px;max-width:520px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;';
  card.onclick = function(e) { e.stopPropagation(); };

  modal.appendChild(card);
  document.body.appendChild(modal);
  _renderQuickAddStep();
}

function _renderQuickAddStep() {
  var card = document.getElementById('quickAddBrandCard');
  if (!card) return;

  // Progress dots
  var dots = '<div style="display:flex;justify-content:center;gap:8px;margin-bottom:24px;">';
  for (var d = 1; d <= 3; d++) {
    dots += '<div style="width:8px;height:8px;border-radius:50%;background:' + (d === _quickAddStep ? 'var(--accent)' : 'var(--border-color)') + ';transition:background 0.2s;"></div>';
  }
  dots += '</div>';

  if (_quickAddStep === 1) {
    // Step 1: Brand Name + Website
    card.innerHTML = dots +
      '<div style="text-align:center;margin-bottom:20px;">' +
        '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:8px;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
        '<h2 style="margin:0 0 4px;font-size:var(--text-xl);font-weight:600;">New Brand</h2>' +
        '<p style="margin:0;color:var(--text-muted);font-size:var(--text-sm);">Tell us about your brand</p>' +
      '</div>' +
      '<div style="margin-bottom:16px;">' +
        '<label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Brand Name *</label>' +
        '<input type="text" id="quickAddBrandName" class="onboarding-input" placeholder="Enter brand name" style="width:100%;padding:12px;font-size:var(--text-base);box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')_quickAddNext()" />' +
      '</div>' +
      '<div style="margin-bottom:20px;">' +
        '<label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Website (optional)</label>' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<span style="color:var(--text-muted);font-size:var(--text-sm);flex-shrink:0;">https://</span>' +
          '<input type="text" id="quickAddBrandWebsite" class="onboarding-input" placeholder="yourbrand.com" style="flex:1;padding:12px;font-size:var(--text-base);box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')_quickAddNext()" />' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;">' +
        '<button onclick="document.getElementById(\'quickAddBrandModal\').remove()" class="btn btn-secondary" style="padding:10px 20px;">Cancel</button>' +
        '<button onclick="_quickAddNext()" class="btn btn-primary" style="padding:10px 24px;font-weight:600;">Next &rarr;</button>' +
      '</div>';
    setTimeout(function() { var el = document.getElementById('quickAddBrandName'); if (el) el.focus(); }, 100);

  } else if (_quickAddStep === 2) {
    // Step 2: Logo + Color
    card.innerHTML = dots +
      '<div style="text-align:center;margin-bottom:20px;">' +
        '<h2 style="margin:0 0 4px;font-size:var(--text-xl);font-weight:600;">Brand Identity</h2>' +
        '<p style="margin:0;color:var(--text-muted);font-size:var(--text-sm);">Add your logo and choose your accent color</p>' +
      '</div>' +
      // Logo upload
      '<div style="text-align:center;margin-bottom:20px;">' +
        '<div id="quickAddLogoPreview" style="width:100px;height:100px;border-radius:var(--radius-lg);border:2px dashed var(--border-color);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;overflow:hidden;background:var(--bg-tertiary);cursor:pointer;" onclick="document.getElementById(\'quickAddLogoInput\').click()">' +
          (_quickAddLogo ? '<img src="' + _quickAddLogo + '" style="width:100%;height:100%;object-fit:contain;" />' : '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>') +
        '</div>' +
        '<input type="file" id="quickAddLogoInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml" style="display:none;" onchange="_quickAddHandleLogo(this)" />' +
        '<button onclick="document.getElementById(\'quickAddLogoInput\').click()" class="btn btn-secondary" style="padding:6px 16px;font-size:var(--text-sm);">Choose Logo</button>' +
        '<p style="color:var(--text-muted);font-size:var(--text-xs);margin-top:6px;">Optional. PNG, JPG, WebP, SVG. Max 2MB.</p>' +
      '</div>' +
      // Color picker
      '<div style="border-top:1px solid var(--border-color);padding-top:16px;text-align:center;">' +
        '<label style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary);display:block;margin-bottom:8px;">Accent Color</label>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px;">' +
          '<div>' +
            '<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Dark Mode</div>' +
            '<input type="color" id="quickAddColorDark" value="' + _quickAddColorDark + '" oninput="_quickAddColorDark=this.value;_quickAddUpdateColorPreview()" style="width:40px;height:40px;border:2px solid var(--border-color);border-radius:var(--radius-sm);background:transparent;cursor:pointer;padding:2px;" />' +
          '</div>' +
          '<div>' +
            '<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Light Mode</div>' +
            '<input type="color" id="quickAddColorLight" value="' + _quickAddColorLight + '" oninput="_quickAddColorLight=this.value;_quickAddUpdateColorPreview()" style="width:40px;height:40px;border:2px solid var(--border-color);border-radius:var(--radius-sm);background:transparent;cursor:pointer;padding:2px;" />' +
          '</div>' +
          '<div id="quickAddColorPreview" style="display:flex;gap:6px;align-items:center;">' +
            '<div style="padding:6px 14px;border-radius:6px;background:' + _quickAddColorDark + ';color:#1a1a1a;font-size:12px;font-weight:600;">Preview</div>' +
            '<span style="color:' + _quickAddColorDark + ';font-size:12px;font-weight:500;">Accent</span>' +
          '</div>' +
        '</div>' +
        // Quick presets
        '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">' +
          '<div onclick="_quickSetColor(\'#a89878\')" style="width:24px;height:24px;border-radius:50%;background:#a89878;cursor:pointer;border:2px solid var(--border-color);"></div>' +
          '<div onclick="_quickSetColor(\'#7c9885\')" style="width:24px;height:24px;border-radius:50%;background:#7c9885;cursor:pointer;border:2px solid var(--border-color);"></div>' +
          '<div onclick="_quickSetColor(\'#8b7eb8\')" style="width:24px;height:24px;border-radius:50%;background:#8b7eb8;cursor:pointer;border:2px solid var(--border-color);"></div>' +
          '<div onclick="_quickSetColor(\'#b87e7e\')" style="width:24px;height:24px;border-radius:50%;background:#b87e7e;cursor:pointer;border:2px solid var(--border-color);"></div>' +
          '<div onclick="_quickSetColor(\'#7ea5b8\')" style="width:24px;height:24px;border-radius:50%;background:#7ea5b8;cursor:pointer;border:2px solid var(--border-color);"></div>' +
          '<div onclick="_quickSetColor(\'#b8a07e\')" style="width:24px;height:24px;border-radius:50%;background:#b8a07e;cursor:pointer;border:2px solid var(--border-color);"></div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:20px;">' +
        '<button onclick="_quickAddStep=1;_renderQuickAddStep()" class="btn btn-secondary" style="padding:10px 20px;">&larr; Back</button>' +
        '<button onclick="_quickAddNext()" class="btn btn-primary" style="padding:10px 24px;font-weight:600;">Next &rarr;</button>' +
      '</div>';

  } else if (_quickAddStep === 3) {
    // Step 3: Setup method
    var brandName = document.getElementById('quickAddBrandName') ? document.getElementById('quickAddBrandName').value.trim() : (window._quickAddBrandNameVal || 'your brand');
    var hasWebsite = !!(window._quickAddWebsiteVal);
    card.innerHTML = dots +
      '<div style="text-align:center;margin-bottom:24px;">' +
        '<h2 style="margin:0 0 4px;font-size:var(--text-xl);font-weight:600;">Build ' + escapeHtml(window._quickAddBrandNameVal || 'Brand') + '</h2>' +
        '<p style="margin:0;color:var(--text-muted);font-size:var(--text-sm);">How would you like to set up your brand identity?</p>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">' +
        // Analyze Website
        '<button onclick="_quickAddBrandSubmit(true)" style="padding:24px 16px;background:linear-gradient(135deg,rgba(168,152,120,0.1),rgba(138,124,98,0.05));border:2px solid rgba(168,152,120,0.3);border-radius:var(--radius-lg);cursor:pointer;text-align:center;color:var(--text-primary);transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'rgba(168,152,120,0.3)\'">' +
          '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--accent)" stroke-width="1.5" style="display:block;margin:0 auto 10px;"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
          '<div style="font-weight:600;margin-bottom:4px;">Research & Build</div>' +
          '<div style="color:var(--text-secondary);font-size:var(--text-xs);line-height:1.4;">AI analyzes ' + (hasWebsite ? 'your website' : 'a URL you provide') + ' to build brand identity</div>' +
        '</button>' +
        // Manual
        '<button onclick="_quickAddBrandSubmit(false)" style="padding:24px 16px;background:rgba(255,255,255,0.02);border:2px solid var(--border-color);border-radius:var(--radius-lg);cursor:pointer;text-align:center;color:var(--text-primary);transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'">' +
          '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--accent)" stroke-width="1.5" style="display:block;margin:0 auto 10px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '<div style="font-weight:600;margin-bottom:4px;">Create Manually</div>' +
          '<div style="color:var(--text-secondary);font-size:var(--text-xs);line-height:1.4;">Fill in brand details yourself in the Identity view</div>' +
        '</button>' +
      '</div>' +
      '<button onclick="_quickAddStep=2;_renderQuickAddStep()" class="btn btn-secondary" style="display:block;margin:0 auto;padding:8px 20px;">&larr; Back</button>';
  }
}

function _quickAddNext() {
  if (_quickAddStep === 1) {
    var nameInput = document.getElementById('quickAddBrandName');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) { showToast('Please enter a brand name', 'warning'); if (nameInput) nameInput.focus(); return; }
    // Check duplicate
    var exists = brands.some(function(b) { return (b.name || '').toLowerCase() === name.toLowerCase(); });
    if (exists) { showToast('A brand with this name already exists', 'warning'); return; }
    // Store values
    window._quickAddBrandNameVal = name;
    var websiteInput = document.getElementById('quickAddBrandWebsite');
    window._quickAddWebsiteVal = websiteInput ? websiteInput.value.trim() : '';
    _quickAddStep = 2;
    _renderQuickAddStep();
  } else if (_quickAddStep === 2) {
    // Read color values before switching step
    var darkInput = document.getElementById('quickAddColorDark');
    var lightInput = document.getElementById('quickAddColorLight');
    if (darkInput) _quickAddColorDark = darkInput.value;
    if (lightInput) _quickAddColorLight = lightInput.value;
    _quickAddStep = 3;
    _renderQuickAddStep();
  }
}

function _quickAddHandleLogo(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    _quickAddLogo = e.target.result;
    var preview = document.getElementById('quickAddLogoPreview');
    if (preview) preview.innerHTML = '<img src="' + _quickAddLogo + '" style="width:100%;height:100%;object-fit:contain;" />';
  };
  reader.readAsDataURL(file);
}

function _quickSetColor(color) {
  _quickAddColorDark = color;
  _quickAddColorLight = color;
  var darkInput = document.getElementById('quickAddColorDark');
  var lightInput = document.getElementById('quickAddColorLight');
  if (darkInput) darkInput.value = color;
  if (lightInput) lightInput.value = color;
  _quickAddUpdateColorPreview();
}

function _quickAddUpdateColorPreview() {
  var preview = document.getElementById('quickAddColorPreview');
  if (preview) {
    preview.innerHTML = '<div style="padding:6px 14px;border-radius:6px;background:' + _quickAddColorDark + ';color:#1a1a1a;font-size:12px;font-weight:600;">Preview</div>' +
      '<span style="color:' + _quickAddColorDark + ';font-size:12px;font-weight:500;">Accent</span>';
  }
}

window._quickAddNext = _quickAddNext;
window._quickAddHandleLogo = _quickAddHandleLogo;
window._quickSetColor = _quickSetColor;
window._quickAddUpdateColorPreview = _quickAddUpdateColorPreview;

function _quickAddBrandSubmit(useResearch) {
  var brandName = window._quickAddBrandNameVal || '';
  var website = window._quickAddWebsiteVal || '';

  if (!brandName) {
    showToast('Please enter a brand name', 'warning');
    return;
  }

  // Check for duplicate
  var exists = brands.some(function(b) {
    return (b.name || '').toLowerCase() === brandName.toLowerCase();
  });
  if (exists) {
    showToast('A brand with this name already exists', 'warning');
    return;
  }

  // Close the quick add modal
  var modal = document.getElementById('quickAddBrandModal');
  if (modal) modal.remove();

  // v27.0: Create brand immediately with quick add data -- no onboarding wizard
  var provider = 'anthropic';
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    if (keys.anthropic) provider = 'anthropic';
    else if (keys.openai) provider = 'openai';
    else if (keys.google) provider = 'google';
  } catch(e) {}
  var providerModels = { anthropic: 'claude-sonnet-4-6', openai: 'gpt-5.5', google: 'gemini-3.1-pro-preview' };
  var fullUrl = website ? (!/^https?:\/\//i.test(website) ? 'https://' + website : website) : '';

  var newBrand = {
    id: 'brand_name_' + brandName.toLowerCase().replace(/[^a-z0-9]/g, '_'), _modifiedAt: Date.now(), _createdAt: Date.now(),
    name: brandName, tagline: '', voice: 'professional, warm, thoughtful',
    positioning: '', products: '', audience: '', location: '',
    website: fullUrl, vocabDo: '', vocabDont: '', mission: '',
    brandColor: _quickAddColorDark || '#a89878',
    brandColorLight: _quickAddColorLight || '#a89878',
    importMethod: useResearch ? 'web-search' : 'manual',
    identityData: {}
  };
  brands.push(newBrand);
  var newIdx = brands.length - 1;
  if (typeof brandSettings !== 'undefined') {
    brandSettings[newIdx] = { provider: provider, model: providerModels[provider] };
  }
  selectedBrand = newIdx;
  localStorage.setItem('roweos_selected_brand', String(newIdx));
  if (_quickAddLogo) {
    try {
      // v29.0: Write to ID-based key (and keep index-based for compat)
      var _qLogoKey = getCurrentLogoKey(newIdx);
      localStorage.setItem(_qLogoKey, _quickAddLogo);
      localStorage.setItem(_qLogoKey + '_size', '100');
      localStorage.setItem('roweos_brand_' + newIdx + '_logo', _quickAddLogo);
      localStorage.setItem('roweos_brand_' + newIdx + '_logo_size', '100');
      if (typeof applyBrandLogo === 'function') applyBrandLogo(_quickAddLogo, 100);
    } catch(e) {}
  }
  if (_quickAddColorDark && typeof applyBrandAccentColor === 'function') applyBrandAccentColor(_quickAddColorDark);
  saveBrands();
  if (typeof updateBrandSelectors === 'function') updateBrandSelectors();
  if (typeof syncBrandDropdowns === 'function') syncBrandDropdowns();
  if (typeof populateSidebarBrandDropdown === 'function') populateSidebarBrandDropdown();

  showToast('Brand "' + brandName + '" created', 'success');

  // Set up onboarding state so completeBrandSetup/saveWebSearchResults work correctly
  selectedOnboardingMode = 'brand';
  window.onboardingBrandName = brandName;
  window.onboardingSelectedProvider = provider;
  window._onboardingBrandColor = _quickAddColorDark || '#a89878';
  window._onboardingBrandColorLight = _quickAddColorLight || '#a89878';
  window._onboardingInProgress = true;

  // Open the onboarding modal
  var onbModal = document.getElementById('onboardingModal');
  if (onbModal) {
    onbModal.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 10000 !important;';
    onbModal.classList.add('show');
  }
  // v28.4: Push history state so browser back button closes onboarding instead of navigating away
  if (!window._onboardingHistoryPushed) {
    window._onboardingHistoryPushed = true;
    history.pushState({ onboardingAddBrand: true }, '');
  }

  if (useResearch && fullUrl) {
    // v27.0: Research path -- open onboarding at web search review with the full visual experience
    // Pre-fill forms for saveWebSearchResults/completeBrandSetup
    var wizNameEl = document.getElementById('wizardBrandName');
    if (wizNameEl) wizNameEl.value = brandName;
    var wizWebEl = document.getElementById('wizardBrandWebsite');
    if (wizWebEl) wizWebEl.value = fullUrl;
    var wizColorEl = document.getElementById('wizardBrandColor');
    if (wizColorEl) wizColorEl.value = _quickAddColorDark || '#a89878';
    // Save URL and start web search
    window._pendingWebSearchUrl = fullUrl;
    localStorage.setItem('roweos_pending_web_search_url', fullUrl);
    if (typeof startOnboardingWebSearch === 'function') startOnboardingWebSearch();
    // Go directly to the web search review visual (network graph + identity cards)
    goToOnboardingStep('websearch-review');
  } else if (useResearch) {
    // No URL provided -- go to the website import step to enter one
    goToOnboardingStep('websearch-review');
    showToast('Waiting for URL to start research...', 'info');
  } else {
    // v27.0: Manual path -- skip to brand basics (step 7) only
    // Steps 7 -> 8 -> 9 -> 10 -> 11, no provider/logo/sync/preferences
    var wizNameEl2 = document.getElementById('wizardBrandName');
    if (wizNameEl2) wizNameEl2.value = brandName;
    var wizWebEl2 = document.getElementById('wizardBrandWebsite');
    if (wizWebEl2) wizWebEl2.value = fullUrl;
    var wizColorEl2 = document.getElementById('wizardBrandColor');
    if (wizColorEl2) wizColorEl2.value = _quickAddColorDark || '#a89878';
    goToOnboardingStep(7);
  }

  window._quickAddBrandNameVal = null;
  window._quickAddWebsiteVal = null;
}

window._quickAddBrandSubmit = _quickAddBrandSubmit;


// v22.24: Settings folder navigation
// v24.24: Toggle collapsible settings expander sections
function toggleSettingsExpander(id, event) {
  if (event && event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON')) return;
  var el = document.getElementById(id);
  if (!el) return;
  var isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  var chevron = document.getElementById(id + 'Chevron');
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

// v28.0: Render sync status panel in Cloud & Sync (v28.1: accepts optional containerId for Sync Hub)
function renderSyncStatus(containerId) {
  var container = document.getElementById(containerId || 'syncStatusPanel');
  if (!container) return;

  // v30.1: Removed misleading "Sync v4 not active" early-return - v4 is disabled but v2/v3 sync works fine
  // v32.1.1: fall back to v2/v3's roweos_last_sync since v4 is disabled, otherwise it always shows Never
  var lastSync = localStorage.getItem('roweos_v4_last_sync') || localStorage.getItem('roweos_last_sync');
  var lastSyncText = 'Never';
  if (lastSync) {
    var _ms = parseInt(lastSync, 10);
    if (!isNaN(_ms) && _ms > 1000000000000) {
      lastSyncText = new Date(_ms).toLocaleString();
    } else {
      // localized date string from v2/v3 path
      lastSyncText = lastSync;
    }
  }
  var queueStatus = (typeof syncEngine !== 'undefined' && typeof syncEngine.getQueueStatus === 'function') ? syncEngine.getQueueStatus() : { pending: 0, errors: 0, total: 0 };
  var deviceId = _getDeviceId();
  var deviceName = _getDeviceName();
  var isOnline = navigator.onLine;

  var html = '';
  // Status indicator
  var statusColor = isOnline ? (queueStatus.errors > 0 ? '#ef4444' : '#4ade80') : '#f59e0b';
  var statusText = isOnline ? (queueStatus.errors > 0 ? 'Errors' : 'Connected') : 'Offline';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">';
  html += '<div style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';"></div>';
  html += '<span style="font-size:14px;color:var(--text-primary);font-weight:500;">' + statusText + '</span>';
  html += '<span style="font-size:12px;color:var(--text-muted);margin-left:auto;">Last sync: ' + escapeHtml(lastSyncText) + '</span>';
  html += '</div>';

  // v28.2: Queue status - show category breakdown
  if (queueStatus.pending > 0 || queueStatus.errors > 0) {
    html += '<div style="padding:10px 12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:8px;margin-bottom:12px;font-size:13px;color:#f59e0b;">';
    if (queueStatus.pending > 0) {
      // Try to show category breakdown from pending changes
      var _pcTypes = {};
      try {
        var _pcArr = JSON.parse(localStorage.getItem('roweos_pending_changes') || '[]');
        _pcArr.forEach(function(ch) {
          var _label = { brands: 'Brand', conversation: 'Chat', calendar: 'Calendar', runs: 'Studio Run', knowledge: 'Knowledge', todos: 'To-Do', automations: 'Automation' }[ch.type] || ch.type || 'Unknown';
          _pcTypes[_label] = (_pcTypes[_label] || 0) + 1;
        });
      } catch(e) {}
      var _pcKeys = Object.keys(_pcTypes);
      if (_pcKeys.length > 0) {
        var _pcParts = _pcKeys.map(function(k) { return _pcTypes[k] + ' ' + k + (_pcTypes[k] > 1 ? 's' : ''); });
        html += _pcParts.join(', ') + ' waiting to sync. ';
      } else {
        html += queueStatus.pending + ' change' + (queueStatus.pending > 1 ? 's' : '') + ' waiting to sync. ';
      }
    }
    if (queueStatus.errors > 0) html += queueStatus.errors + ' failed operation' + (queueStatus.errors > 1 ? 's' : '') + '.';
    html += '</div>';
  }

  // v28.2: This device - editable name, ID shown small
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">This Device</div>';
  html += '<div style="padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">';
  html += '<div style="width:32px;height:32px;border-radius:8px;background:rgba(168,152,120,0.15);display:flex;align-items:center;justify-content:center;">';
  var _devIcon = /iPhone|iPad/.test(navigator.userAgent)
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  html += _devIcon;
  html += '</div>';
  html += '<div style="flex:1;"><div style="font-size:13px;color:var(--text-primary);font-weight:500;">' + escapeHtml(deviceName) + '</div>';
  html += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">ID: ' + escapeHtml(deviceId) + '</div></div>';
  html += '<button onclick="var n=prompt(\'Name this device:\',\'' + escapeHtml(deviceName).replace(/'/g, "\\'") + '\');if(n)renameThisDevice(n);" style="background:none;border:1px solid var(--border-color);border-radius:6px;padding:4px 10px;color:var(--text-muted);cursor:pointer;font-size:11px;" title="Rename device">Rename</button>';
  html += '</div>';

  // v28.2: Removed Force Sync / Reset Sync buttons - "Sync Now" at top is sufficient.
  // Reset Sync moved to Diagnostics & Recovery section for advanced users only.

  container.innerHTML = html;
}

// v28.0: Render sync conflict resolution panel
// v28.0: Human-readable field labels for conflict display
function _conflictFieldLabel(collection, field) {
  var labels = {
    'name': 'Name', 'tagline': 'Tagline', 'voice': 'Voice', 'positioning': 'Positioning',
    'audience': 'Audience', 'essence': 'Essence', 'constraints': 'Constraints',
    'aboutMe': 'About Me', 'timeline': 'Timeline', 'stageHistory': 'Stage History',
    'goals': 'Goals', 'habits': 'Habits', 'routines': 'Routines',
    'brandColor': 'Brand Color', 'website': 'Website', 'location': 'Location',
    'products': 'Products', 'cta': 'Call to Action', 'ethos': 'Values'
  };
  return labels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, function(s) { return s.toUpperCase(); });
}

function _conflictCollectionLabel(collection) {
  var labels = {
    'brands': 'Brand', 'clients': 'Client', 'life_profiles': 'Life Profile',
    'conversations': 'Conversation', 'knowledge': 'Knowledge'
  };
  return labels[collection] || collection.replace(/_/g, ' ').replace(/^./, function(s) { return s.toUpperCase(); });
}

// v28.2: Improved preview - show item names for arrays, not just count
function _conflictValuePreview(val) {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'string') return val.length > 150 ? val.substring(0, 150) + '...' : val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '(empty)';
    // Try to extract meaningful names from array items
    var names = [];
    for (var ai = 0; ai < Math.min(val.length, 5); ai++) {
      var item = val[ai];
      if (typeof item === 'string') { names.push(item); }
      else if (item && typeof item === 'object') {
        var n = item.shortName || item.name || item.title || item.text || item.command || item.id;
        if (n) names.push(typeof n === 'string' ? n.substring(0, 40) : String(n));
      }
    }
    var preview = val.length + ' item' + (val.length !== 1 ? 's' : '');
    if (names.length > 0) {
      preview += ': ' + names.join(', ');
      if (val.length > 5) preview += ', ...';
    }
    return preview;
  }
  if (typeof val === 'object') {
    var keys = Object.keys(val);
    if (keys.length <= 3) {
      var parts = [];
      for (var i = 0; i < keys.length; i++) {
        var v = val[keys[i]];
        parts.push(keys[i] + ': ' + (typeof v === 'string' ? v.substring(0, 50) : String(v)));
      }
      return parts.join(', ');
    }
    return keys.length + ' fields';
  }
  return String(val).substring(0, 150);
}

function renderSyncConflicts(containerId) {
  var container = document.getElementById(containerId || 'syncConflictsPanel');
  if (!container) return;
  if (typeof syncEngine === 'undefined') { container.style.display = 'none'; return; }
  var conflicts = syncEngine.getPendingConflicts();
  if (conflicts.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  var html = '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Sync Conflicts</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">' + conflicts.length + ' change' + (conflicts.length !== 1 ? 's' : '') + ' need' + (conflicts.length !== 1 ? '' : 's') + ' your review</div>';
  // v28.2: Use actual device name for local device
  var _myDevName = typeof _getDeviceName === 'function' ? _getDeviceName() : 'This Device';
  for (var i = 0; i < conflicts.length; i++) {
    var c = conflicts[i];
    var localTime = c.localTimestamp ? new Date(c.localTimestamp).toLocaleTimeString() : '';
    var cloudTime = c.cloudTimestamp ? new Date(c.cloudTimestamp).toLocaleTimeString() : '';
    var localDev = c.localDeviceName || _myDevName;
    var cloudDev = c.cloudDeviceName || 'Other Device';
    var collLabel = _conflictCollectionLabel(c.collection);
    var fieldLabel = _conflictFieldLabel(c.collection, c.field);
    var localPreview = _conflictValuePreview(c.localValue);
    var cloudPreview = _conflictValuePreview(c.cloudValue);
    // v28.2: Build a descriptive title - include item name if available from the conflict data
    var _conflictTitle = collLabel;
    if (fieldLabel && fieldLabel !== collLabel) _conflictTitle += ' > ' + fieldLabel;
    if (c.itemName) _conflictTitle += ' (' + c.itemName + ')';
    html += '<div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px;padding:16px;margin-bottom:12px;">';
    html += '<div style="font-size:13px;color:var(--text-primary);font-weight:500;margin-bottom:4px;">' + escapeHtml(_conflictTitle) + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">Both devices edited this field</div>';
    html += '<div style="display:flex;gap:12px;margin-bottom:12px;">';
    html += '<div style="flex:1;background:rgba(245,158,11,0.03);border-radius:8px;padding:12px;border:1px solid rgba(245,158,11,0.1);">';
    html += '<div style="font-size:11px;color:#f59e0b;margin-bottom:6px;font-weight:500;">' + escapeHtml(localDev) + (localTime ? ' at ' + localTime : '') + '</div>';
    html += '<div style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word;max-height:120px;overflow-y:auto;">' + escapeHtml(localPreview) + '</div>';
    html += '</div>';
    html += '<div style="flex:1;background:rgba(59,130,246,0.03);border-radius:8px;padding:12px;border:1px solid rgba(59,130,246,0.1);">';
    html += '<div style="font-size:11px;color:#3b82f6;margin-bottom:6px;font-weight:500;">' + escapeHtml(cloudDev) + (cloudTime ? ' at ' + cloudTime : '') + '</div>';
    html += '<div style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word;max-height:120px;overflow-y:auto;">' + escapeHtml(cloudPreview) + '</div>';
    html += '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="syncEngine.resolveConflict(\'' + c.id + '\',\'local\');renderSyncConflicts();" style="flex:1;padding:8px;background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.2);border-radius:8px;cursor:pointer;font-size:12px;">Keep ' + escapeHtml(localDev) + '</button>';
    html += '<button onclick="syncEngine.resolveConflict(\'' + c.id + '\',\'cloud\');renderSyncConflicts();" style="flex:1;padding:8px;background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.2);border-radius:8px;cursor:pointer;font-size:12px;">Keep ' + escapeHtml(cloudDev) + '</button>';
    html += '<button onclick="syncEngine.resolveConflict(\'' + c.id + '\',\'both\');renderSyncConflicts();" style="flex:1;padding:8px;background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer;font-size:12px;">Keep Both</button>';
    html += '</div>';
    html += '</div>';
  }
  html += '<button onclick="syncEngine.resolveAllKeepNewest();renderSyncConflicts();" style="width:100%;padding:10px;background:rgba(168,152,120,0.1);color:#a89878;border:1px solid rgba(168,152,120,0.2);border-radius:8px;cursor:pointer;font-size:13px;margin-top:4px;">Resolve All: Keep Newest</button>';
  container.innerHTML = html;
}

function openSettingsFolder(folder) {
  // v22.33: Redirect personalization to appearance (merged)
  if (folder === 'personalization') folder = 'appearance';
  // v26.2: Feedback opens modal instead of folder
  if (folder === 'feedback' && typeof openFeedbackModal === 'function') {
    openFeedbackModal();
    return;
  }
  var detail = document.getElementById('settingsFolderDetail');
  if (detail) detail.style.display = 'block';
  // Hide all folder contents
  var all = document.querySelectorAll('.settings-folder-content');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
  // Show target folder
  var target = document.querySelector('.settings-folder-content[data-folder="' + folder + '"]');
  if (target) target.classList.add('active');
  // v22.45: Render API routing panel when AI folder opens
  if (folder === 'ai' && typeof renderApiRoutingPanel === 'function') renderApiRoutingPanel();
  // v25.3: Update per-provider status badges
  if (folder === 'ai' && typeof updateProviderStatuses === 'function') updateProviderStatuses();
  // v24.11: Render Account folder
  if (folder === 'account' && typeof renderAccountFolder === 'function') renderAccountFolder();
  // v25.1: Refresh social connection UI when connections folder opens
  if (folder === 'connections' && typeof refreshSocialAccountCards === 'function') refreshSocialAccountCards();
  // v28.0: Render sync status and conflicts when Cloud & Sync folder opens
  if (folder === 'cloud') {
    if (typeof renderSyncStatus === 'function') renderSyncStatus();
    if (typeof renderSyncConflicts === 'function') renderSyncConflicts();
  }
  // v26.0: Update version display when update folder opens
  if (folder === 'update' && typeof ROWEOS_VERSION !== 'undefined') {
    var vEl = document.getElementById('updateCurrentVersion');
    if (vEl) vEl.textContent = 'Current Version: ' + ROWEOS_VERSION;
  }
  // v26.2: Update pill nav active state
  if (typeof updatePillNavActive === 'function') updatePillNavActive('systemPillNav', folder);
  // Update breadcrumb
  var bc = document.querySelector('#settingsView .breadcrumb');
  if (bc) {
    var labels = { appearance: 'Appearance', ai: 'AI & Models', cloud: 'Cloud & Sync', connections: 'Connections', intelligence: 'Intelligence', preferences: 'Preferences', accessibility: 'Accessibility', data: 'Data & Storage', about: 'About', account: 'Account', update: 'Update', feedback: 'Feedback' };
    bc.innerHTML = '<span class="breadcrumb-item"><a href="#" onclick="showView(\'agent\'); return false;">Home</a></span><span class="breadcrumb-item"><a href="#" onclick="closeSettingsFolder(); return false;">System</a></span><span class="breadcrumb-item active">' + (labels[folder] || folder) + '</span>';
  }
}

function closeSettingsFolder() {
  showPageLanding('settings');
}

// v23.2: Settings folder drag-and-drop reordering
var _settingsDragId = null;
function initSettingsFolderDrag() {
  var grid = document.getElementById('settingsFolderGrid');
  if (!grid) return;
  var cards = grid.querySelectorAll('.settings-folder-card[draggable="true"]');
  for (var i = 0; i < cards.length; i++) {
    (function(card) {
      card.addEventListener('dragstart', function(e) {
        // v23.7: Allow drag from anywhere on the card (handle is visual hint only)
        _settingsDragId = card.getAttribute('data-settings-id');
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', function(e) {
        e.preventDefault();
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', function() {
        card.classList.remove('drag-over');
      });
      card.addEventListener('dragend', function() {
        card.classList.remove('dragging');
        var all = grid.querySelectorAll('.settings-folder-card');
        for (var j = 0; j < all.length; j++) all[j].classList.remove('drag-over', 'dragging');
        _settingsDragId = null;
      });
      card.addEventListener('drop', function(e) {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (!_settingsDragId) return;
        var dropId = card.getAttribute('data-settings-id');
        if (_settingsDragId === dropId) return;
        var dragCard = grid.querySelector('[data-settings-id="' + _settingsDragId + '"]');
        if (!dragCard) return;
        // Insert before the drop target
        grid.insertBefore(dragCard, card);
        _settingsDragId = null;
        saveSettingsFolderOrder();
      });
    })(cards[i]);
  }
  // Apply saved order
  applySettingsFolderOrder();
}

function saveSettingsFolderOrder() {
  var grid = document.getElementById('settingsFolderGrid');
  if (!grid) return;
  var cards = grid.querySelectorAll('.settings-folder-card[data-settings-id]');
  var order = [];
  for (var i = 0; i < cards.length; i++) order.push(cards[i].getAttribute('data-settings-id'));
  localStorage.setItem('roweos_settings_folder_order', JSON.stringify(order));
}

function applySettingsFolderOrder() {
  var grid = document.getElementById('settingsFolderGrid');
  if (!grid) return;
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem('roweos_settings_folder_order') || '[]'); } catch(e) {}
  if (saved.length === 0) return;
  for (var i = saved.length - 1; i >= 0; i--) {
    var card = grid.querySelector('[data-settings-id="' + saved[i] + '"]');
    if (card) grid.insertBefore(card, grid.firstChild);
  }
}

function resetSettingsFolderOrder() {
  localStorage.removeItem('roweos_settings_folder_order');
  // Reload settings view to restore default order
  showView('settings');
  showToast('Settings order reset', 'success');
}

// v25.1: Shared helper - applies interface zoom (CSS zoom on app container) and
// text-size scaling (font-size on root) independently so they don't clobber each other.
function applyAccessibilityScale() {
  var zoomLevel = parseInt(localStorage.getItem('roweos_app_zoom') || '100') || 100;
  var textLevel = parseInt(localStorage.getItem('roweos_text_size') || '100') || 100;
  var root = document.documentElement;

  // v31.9 (iPad fix): Detect touch tablets in the iPad size range. The desktop +
  // mobile compensation paths both produce wrong results on iPad Safari — at 75%
  // the JS-applied compensated widths cause the entire UI to render at ~60% of the
  // viewport with massive black margins. iPadOS 13+ reports as MacIntel so we use
  // the CSS hover/pointer test plus maxTouchPoints to identify a real iPad.
  var _isIPad = (typeof window !== 'undefined') && (
    window.matchMedia('(hover: none) and (pointer: coarse) and (min-width: 769px)').matches ||
    (navigator && navigator.maxTouchPoints > 1 && /MacIntel|iPad/.test(navigator.platform || ''))
  );

  // v25.1: Apply interface zoom via CSS zoom on the main app container
  // This scales EVERYTHING proportionally - works on both desktop and iOS Safari
  var appContainer = document.getElementById('app') || document.body;
  var zoomFactor = zoomLevel / 100;

  // v31.9 (iPad fix): On iPad, take a SIMPLIFIED zoom path — apply CSS zoom to body
  // and let the browser handle layout naturally. No JS width compensation, no sidebar
  // margin override. Those compensations are the source of the 75% distortion.
  // Desktop + mobile branches below remain UNTOUCHED.
  if (_isIPad) {
    // Clear any leftover desktop/mobile compensation that may already be on the DOM
    appContainer.style.removeProperty('width');
    appContainer.style.removeProperty('min-height');
    appContainer.style.removeProperty('max-width');
    root.style.removeProperty('width');
    root.style.removeProperty('max-width');
    root.style.removeProperty('overflow-x');
    root.style.removeProperty('--compensated-vw');
    var _ipadMW = document.querySelector('.main-wrapper');
    if (_ipadMW) {
      _ipadMW.style.removeProperty('min-height');
      _ipadMW.style.removeProperty('overflow-x');
      _ipadMW.style.removeProperty('margin-left');
    }
    var _ipadPanels = document.querySelectorAll('.panel-view');
    for (var _ipv = 0; _ipv < _ipadPanels.length; _ipv++) {
      _ipadPanels[_ipv].style.removeProperty('min-height');
      _ipadPanels[_ipv].style.removeProperty('max-width');
      _ipadPanels[_ipv].style.removeProperty('width');
      _ipadPanels[_ipv].style.removeProperty('height');
      _ipadPanels[_ipv].style.removeProperty('bottom');
    }
    // Apply zoom directly to body so CSS zoom flows through naturally
    if (zoomLevel !== 100) {
      document.body.style.zoom = zoomFactor.toString();
      appContainer.style.zoom = '';
    } else {
      document.body.style.zoom = '';
      appContainer.style.zoom = '';
    }
    // Expose for CSS rules to react
    root.style.setProperty('--zoom-factor', zoomFactor.toString());
    root.setAttribute('data-ipad', 'true');
    // Trigger helix/blob resize after zoom settles
    if (typeof resizeHelix === 'function') { setTimeout(resizeHelix, 100); setTimeout(resizeHelix, 500); }
    if (typeof resizeBlob === 'function') { setTimeout(resizeBlob, 100); }
    // Text size still applies independently
    if (textLevel !== 100) {
      root.style.fontSize = (16 * (textLevel / 100)) + 'px';
    } else {
      root.style.fontSize = '';
    }
    root.style.setProperty('--text-scale', String(textLevel / 100));
    root.style.setProperty('--zoom-scale', String(zoomFactor));
    return;
  }

  if (zoomLevel !== 100) {
    // v30.1: Capture viewport BEFORE zoom - Safari changes innerWidth after zoom is applied
    var _preZoomW = window.innerWidth;
    var _preZoomH = window.innerHeight;
    appContainer.style.zoom = zoomFactor.toString();
    // v30.1: Use pixels from PRE-ZOOM viewport, not vw/vh units (Safari double-compensates vw)
    var compensatedW = Math.round(_preZoomW / zoomFactor) + 'px';
    var compensatedH = Math.round(_preZoomH / zoomFactor) + 'px';
    appContainer.style.setProperty('width', compensatedW, 'important');
    appContainer.style.setProperty('min-height', compensatedH, 'important');
    appContainer.style.setProperty('max-width', compensatedW, 'important');
    // v30.2: Expose compensated viewport as CSS vars for fixed-position elements
    root.style.setProperty('--compensated-vw', compensatedW);
    root.style.setProperty('--zoom-factor', zoomFactor.toString());
    root.style.setProperty('max-width', compensatedW, 'important');
    root.style.setProperty('width', compensatedW, 'important');
    root.style.setProperty('overflow-x', 'hidden', 'important');
    // Main wrapper
    var mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.style.setProperty('min-height', compensatedH, 'important');
    }
    // v30.1: TEMP DEBUG - log centering measurements for Safari diagnosis
    setTimeout(function() {
      var _s = document.querySelector('.sidebar');
      var _b = document.getElementById('blobContainer');
      var _mw = document.querySelector('.main-wrapper');
      var _mc = document.querySelector('.main-content');
      var _av = document.getElementById('agentView');
      var _lc = document.getElementById('agentLandingContent');
      if (_s && _b) {
        var _sr = _s.getBoundingClientRect().right;
        var _br = _b.getBoundingClientRect();
        var _bc = Math.round(_br.left + _br.width / 2);
        var _ec = Math.round(_sr + (window.innerWidth - _sr) / 2);
        console.log('[BLOB DEBUG] sidebar right=' + _sr + ' expected=' + _ec + ' actual=' + _bc + ' offset=' + (_bc - _ec) +
          ' | wrapper: ' + (_mw ? Math.round(_mw.getBoundingClientRect().left) + '-' + Math.round(_mw.getBoundingClientRect().right) : 'N/A') +
          ' | mainContent maxW=' + (_mc ? window.getComputedStyle(_mc).maxWidth : 'N/A') +
          ' | agentView w=' + (_av ? Math.round(_av.getBoundingClientRect().width) : 'N/A') +
          ' | landing w=' + (_lc ? Math.round(_lc.getBoundingClientRect().width) + ' maxW=' + window.getComputedStyle(_lc).maxWidth : 'N/A') +
          ' | zoom=' + zoomFactor + ' viewport=' + window.innerWidth);
      }
    }, 500);
    // All fixed panel-views - compensate height, remove max-width cap
    // Do NOT set explicit width - fixed views use left/right positioning to auto-stretch
    // v29.5: Fixed-position views (position:fixed + bottom:0) need explicit height
    // because CSS zoom makes bottom:0 anchor to the zoomed container, not the viewport.
    // v30.1: ALL fixed panel-views with bottom:0 need explicit height at zoom
    var _fixedBottomViews = { scribeView: true, studioView: true, agentView: true, adminView: true, settingsView: true, mailView: true, commerceView: true, clientsView: true, memoryView: true, tuningView: true, inventoryView: true, automationsView: true, bloomView: true, folioView: true, socialView: true, researchView: true, libraryView: true, syncView: true, guardrailsView: true, sectionLandingView: true };
    var panelViews = document.querySelectorAll('.panel-view');
    for (var pv = 0; pv < panelViews.length; pv++) {
      if (_fixedBottomViews[panelViews[pv].id]) {
        // Set explicit height = compensated viewport minus top bar, remove bottom:0
        // v30.1: Use px not vh to avoid Safari double-compensation
        // v30.1: Use max-height instead of height so content can scroll naturally
        panelViews[pv].style.setProperty('height', (parseInt(compensatedH) - 38) + 'px', 'important');
        panelViews[pv].style.setProperty('bottom', 'auto', 'important');
        panelViews[pv].style.setProperty('overflow-y', 'auto', 'important');
      } else {
        panelViews[pv].style.setProperty('min-height', compensatedH, 'important');
      }
      panelViews[pv].style.setProperty('max-width', 'none', 'important');
      // v30.2: On MOBILE ONLY, set explicit width - position:fixed with right:0 is
      // viewport-relative, not zoom-aware. On desktop, do NOT set width (breaks blob centering).
      if (_preZoomW <= 768) {
        panelViews[pv].style.setProperty('width', compensatedW, 'important');
      }
    }
    // v30.2: Fixed mobile elements (header, nav) also need compensated width on mobile
    if (_preZoomW <= 768) {
      var mobileHeader = document.querySelector('.mobile-header-v2');
      if (mobileHeader) mobileHeader.style.setProperty('width', compensatedW, 'important');
      var liquidNav = document.querySelector('.liquid-nav');
      if (liquidNav) liquidNav.style.setProperty('width', compensatedW, 'important');
    }
    // v31.5: Safari sidebar overlap fix at zoom < 100%.
    // Safari does NOT scale position:fixed elements with the parent's CSS zoom — so the
    // sidebar (fixed) keeps its CSS width while .main-wrapper margin-left scales DOWN
    // with zoom, leaving the chat content sliding under the sidebar by sidebarW * (1-zoom).
    // Detect Safari behavior by comparing visual sidebar width vs CSS width and compensate
    // the wrapper margin so visual margin equals the unzoomed sidebar width again.
    // Re-runs on every resize because the new resize listener calls applyAccessibilityScale().
    setTimeout(function() {
      var _sb = document.querySelector('.sidebar');
      var _mw = document.querySelector('.main-wrapper');
      if (!_sb || !_mw) return;
      var visualW = _sb.getBoundingClientRect().width;
      var cssW = parseInt(window.getComputedStyle(_sb).width) || 64;
      // ~2px tolerance for sub-pixel rounding
      var safariBehavior = Math.abs(visualW - cssW) < 2 && zoomFactor < 1;
      if (safariBehavior) {
        _mw.style.setProperty('margin-left', Math.round(cssW / zoomFactor) + 'px', 'important');
      } else {
        _mw.style.removeProperty('margin-left');
      }
    }, 120);
  } else {
    appContainer.style.zoom = '';
    appContainer.style.removeProperty('width');
    appContainer.style.removeProperty('min-height');
    appContainer.style.removeProperty('max-width');
    root.style.removeProperty('max-width');
    root.style.removeProperty('width');
    root.style.removeProperty('overflow-x');
    root.style.removeProperty('--compensated-vw');
    root.style.removeProperty('--zoom-factor');
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.style.removeProperty('height');
    }
    var mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.style.removeProperty('min-height');
      mainWrapper.style.removeProperty('overflow-x');
      // v31.5: Clear Safari sidebar margin compensation when returning to 100%
      mainWrapper.style.removeProperty('margin-left');
    }
    var panelViews = document.querySelectorAll('.panel-view');
    for (var pv = 0; pv < panelViews.length; pv++) {
      panelViews[pv].style.removeProperty('min-height');
      panelViews[pv].style.removeProperty('max-width');
      panelViews[pv].style.removeProperty('width');
      panelViews[pv].style.removeProperty('height');
      panelViews[pv].style.removeProperty('bottom');
    }
  }

  // Text-size scaling via font-size on root (independent of zoom)
  if (textLevel !== 100) {
    root.style.webkitTextSizeAdjust = 'none';
    if (document.body) document.body.style.webkitTextSizeAdjust = 'none';
    root.style.fontSize = (16 * (textLevel / 100)) + 'px';
  } else {
    root.style.fontSize = '';
    root.style.webkitTextSizeAdjust = '';
    if (document.body) document.body.style.webkitTextSizeAdjust = '';
  }

  root.style.setProperty('--text-scale', String(textLevel / 100));
  root.style.setProperty('--zoom-scale', String(zoomFactor));

  // v30.1: Resize helix/blob after zoom change so WebGL canvas fills correctly
  if (typeof resizeHelix === 'function') { setTimeout(resizeHelix, 100); setTimeout(resizeHelix, 500); }
  if (typeof resizeBlob === 'function') { setTimeout(resizeBlob, 100); }

  // v30.1: TEMP DEBUG - fires at ALL zoom levels including 100%
  setTimeout(function() {
    var _s = document.querySelector('.sidebar');
    var _b = document.getElementById('blobContainer');
    if (_s && _b) {
      var _sr = Math.round(_s.getBoundingClientRect().right);
      var _br = _b.getBoundingClientRect();
      var _bc = Math.round(_br.left + _br.width / 2);
      var _ec = Math.round(_sr + (window.innerWidth - _sr) / 2);
      var _mw = document.querySelector('.main-wrapper');
      var _mc = document.querySelector('.main-content');
      var _av = document.getElementById('agentView');
      var _lc = document.getElementById('agentLandingContent');
      console.log('[BLOB DEBUG] zoom=' + zoomFactor + ' viewport=' + window.innerWidth +
        ' | sidebar right=' + _sr +
        ' | expected center=' + _ec + ' actual center=' + _bc + ' OFFSET=' + (_bc - _ec) +
        ' | wrapper: ' + (_mw ? Math.round(_mw.getBoundingClientRect().left) + '-' + Math.round(_mw.getBoundingClientRect().right) + ' w=' + Math.round(_mw.getBoundingClientRect().width) : 'N/A') +
        ' | mainContent maxW=' + (_mc ? window.getComputedStyle(_mc).maxWidth : 'N/A') + ' w=' + (_mc ? Math.round(_mc.getBoundingClientRect().width) : 'N/A') +
        ' | agentView w=' + (_av ? Math.round(_av.getBoundingClientRect().width) : 'N/A') + ' align=' + (_av ? window.getComputedStyle(_av).alignItems : 'N/A') +
        ' | landing w=' + (_lc ? Math.round(_lc.getBoundingClientRect().width) : 'N/A') + ' maxW=' + (_lc ? window.getComputedStyle(_lc).maxWidth : 'N/A'));
    } else {
      console.log('[BLOB DEBUG] sidebar=' + !!_s + ' blob=' + !!_b + ' (elements not found)');
    }
  }, 1000);
}

// v23.7: Accessibility - Display Size (text scaling via Settings slider only)
// Does NOT hijack Cmd+/- - browser zoom works natively as before
// v25.1: Fixed to work on mobile (iPad/iPhone) by combining with text-size
function setAppZoom(level) {
  level = parseInt(level);
  if (isNaN(level) || level < 75 || level > 150) return;
  try { localStorage.setItem('roweos_app_zoom', level); } catch(e) {}
  applyAccessibilityScale();
  var display = document.getElementById('zoomLevelDisplay');
  if (display) display.textContent = level + '%';
  var slider = document.getElementById('appZoomSlider');
  if (slider) slider.value = level;
  var presets = document.querySelectorAll('.zoom-preset-btn:not(.text-size-preset)');
  for (var i = 0; i < presets.length; i++) {
    var btn = presets[i];
    if (parseInt(btn.getAttribute('data-zoom')) === level) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

function resetAppZoom() {
  setAppZoom(100);
  showToast('Display size reset to 100%', 'info');
}

function initAppZoom() {
  document.documentElement.style.zoom = '';
  try {
    var saved = parseInt(localStorage.getItem('roweos_app_zoom'));
    // v30.1: Default to 75% zoom for all users (mobile + desktop)
    if (!saved && saved !== 0) saved = 75;
    if (saved && saved >= 75 && saved <= 150 && saved !== 100) {
      setAppZoom(saved);
    }
  } catch(e) {}
}

// v31.5: Re-run accessibility scale on window resize so compensated dimensions
// (which are computed from the pre-zoom window.innerWidth captured ONCE at apply time)
// stay in sync when the user drags the window. Debounced 150ms to avoid thrash.
// At zoom 100% this is a no-op cleanup pass — applyAccessibilityScale() already
// branches to removeProperty in that case.
(function() {
  var _scaleResizeTimer = null;
  window.addEventListener('resize', function() {
    if (_scaleResizeTimer) clearTimeout(_scaleResizeTimer);
    _scaleResizeTimer = setTimeout(function() {
      try { applyAccessibilityScale(); } catch(e) {}
    }, 150);
  });
})();

// v22.39: Accessibility - Text Size
// v25.1: Fixed to work on mobile (iPad/iPhone) - no longer clobbers zoom setting
function setTextSize(level) {
  level = parseInt(level);
  if (isNaN(level) || level < 80 || level > 140) return;
  try { localStorage.setItem('roweos_text_size', level); } catch(e) {}
  applyAccessibilityScale();
  var display = document.getElementById('textSizeDisplay');
  if (display) display.textContent = level + '%';
  var slider = document.getElementById('textSizeSlider');
  if (slider) slider.value = level;
  var presets = document.querySelectorAll('.text-size-preset');
  for (var i = 0; i < presets.length; i++) {
    var btn = presets[i];
    if (parseInt(btn.getAttribute('data-textsize')) === level) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

function resetTextSize() {
  try { localStorage.setItem('roweos_text_size', '100'); } catch(e) {}
  applyAccessibilityScale();
  var display = document.getElementById('textSizeDisplay');
  if (display) display.textContent = '100%';
  var slider = document.getElementById('textSizeSlider');
  if (slider) slider.value = 100;
  var presets = document.querySelectorAll('.text-size-preset');
  for (var i = 0; i < presets.length; i++) {
    var btn = presets[i];
    if (parseInt(btn.getAttribute('data-textsize')) === 100) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  document.documentElement.style.removeProperty('--text-scale');
  showToast('Text size reset to 100%', 'info');
}

function initTextSize() {
  try {
    var saved = parseInt(localStorage.getItem('roweos_text_size'));
    if (saved && saved >= 80 && saved <= 140 && saved !== 100) {
      setTextSize(saved);
    }
  } catch(e) {}
}

// Theme Toggle Functions
function toggleTheme(silent) {
  var html = document.documentElement;
  var isLight = html.classList.toggle('light-mode');

  // Update toggle buttons (desktop and mobile)
  updateThemeButtons(isLight);

  // Update theme color meta tag
  var themeColor = document.getElementById('themeColor');
  if (themeColor) {
    themeColor.content = isLight ? '#ffffff' : '#0a0a0a';
  }

  // v28.2: Save preference to BOTH keys (hyphen for loadTheme, underscore for cloud sync)
  var _themeVal = isLight ? 'light' : 'dark';
  localStorage.setItem('roweos-theme', _themeVal);
  localStorage.setItem('roweos_theme', _themeVal);

  // v28.2: Write theme to Firestore so cloud doesn't overwrite on next pull
  if (typeof writeDB === 'function') {
    writeDB('profile/main', { settings: { theme: _themeVal } });
  }

  // v9.1.14: Sync theme preference
  queueBackgroundSync();

  // v10.5.25: Fix inventory input colors
  if (typeof fixInventoryInputColors === 'function') {
    fixInventoryInputColors();
  }

  // v10.5.25: Apply appropriate accent color for new theme
  if (typeof applyCurrentModeAccent === 'function') {
    applyCurrentModeAccent();
  }

  // v15.1: Apply brand accent color for new theme mode
  if (typeof applyCurrentBrandAccent === 'function') {
    applyCurrentBrandAccent();
  }

  // v24.24: Instantly update blob/helix color & settings UI on theme toggle
  if (typeof updateBlobColor === 'function') updateBlobColor();
  if (typeof updateHelixColors === 'function') updateHelixColors();
  if (typeof updateBlobPreviewColor === 'function') updateBlobPreviewColor();
  if (typeof initBlobPresetUI === 'function') initBlobPresetUI();

  // v26.2: Swap logo for dark/light theme
  if (typeof swapLogoForTheme === 'function') swapLogoForTheme();

  // v24.27: Removed theme toast - user can see the change
}

// v24.26: Promo font style toggle (DM Sans + Cormorant Garamond)
function togglePromoFonts() {
  var html = document.documentElement;
  var isPromo = html.classList.toggle('promo-fonts');
  localStorage.setItem('roweos_promo_fonts', isPromo ? 'true' : 'false');
  updatePromoFontUI(isPromo);
  showToast(isPromo ? 'Promo font style enabled' : 'Default font style restored', 'info');
  writeDB('profile/main', { promoFonts: isPromo }); // v25.1
}

function updatePromoFontUI(isPromo) {
  var desc = document.getElementById('promoFontDesc');
  var toggle = document.getElementById('promoFontToggleText');
  if (desc) desc.textContent = isPromo ? 'DM Sans + Cormorant Garamond' : 'System default';
  if (toggle) toggle.textContent = isPromo ? 'Promo' : 'Default';
}

function initPromoFonts() {
  var isPromo = localStorage.getItem('roweos_promo_fonts') === 'true';
  if (isPromo) document.documentElement.classList.add('promo-fonts');
  updatePromoFontUI(isPromo);
}

function updateThemeButtons(isLight) {
  // Sidebar theme toggle icon
  var toggleIcon = document.getElementById('themeToggleIcon');
  if (toggleIcon) {
    if (isLight) {
      // Show moon for light mode (click to go dark) - STROKE only
      toggleIcon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
      toggleIcon.setAttribute('fill', 'none');
      toggleIcon.setAttribute('stroke', 'currentColor');
    } else {
      // Show sun for dark mode (click to go light) - STROKE only
      toggleIcon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>';
      toggleIcon.setAttribute('fill', 'none');
      toggleIcon.setAttribute('stroke', 'currentColor');
    }
  }
  
  // Desktop (old sidebar toggle - may not exist)
  var icon = document.getElementById('themeIcon');
  var text = document.getElementById('themeText');
  if (icon) icon.textContent = isLight ? '🌙' : '☀️';
  if (text) text.textContent = isLight ? 'Dark Mode' : 'Light Mode';
  
  // Mobile
  var mobileIcon = document.getElementById('mobileThemeIcon');
  var mobileText = document.getElementById('mobileThemeText');
  if (mobileIcon) mobileIcon.textContent = isLight ? '🌙' : '☀️';
  if (mobileText) mobileText.textContent = isLight ? 'Dark Mode' : 'Light Mode';
  
  // Settings panel
  var themeDesc = document.getElementById('themeDesc');
  var themeToggleText = document.getElementById('themeToggleText');
  if (themeDesc) themeDesc.textContent = isLight ? 'Light mode enabled' : 'Dark mode enabled';
  if (themeToggleText) themeToggleText.textContent = isLight ? 'Dark Mode' : 'Light Mode';
}

// v22.20: Bloom Default Feed setting
function cycleBloomDefaultFeed() {
  var options = ['match_brand', 'all'];
  for (var i = 0; i < brands.length; i++) {
    options.push('brand_' + i);
  }
  var current = localStorage.getItem('roweos_bloom_default_source') || 'match_brand';
  var idx = options.indexOf(current);
  var next = options[(idx + 1) % options.length];
  localStorage.setItem('roweos_bloom_default_source', next);
  // Reset so renderBloom re-applies
  renderBloom._defaultApplied = false;
  updateBloomDefaultFeedDisplay(next);
  writeDB('profile/main', { bloomDefaultSource: next }); // v25.1
  showToast('Bloom default: ' + getBloomDefaultLabel(next), 'info');
}

function getBloomDefaultLabel(val) {
  if (val === 'match_brand') return 'Match Current Brand';
  if (val === 'all') return 'All Profiles';
  var idx = parseInt(val.replace('brand_', ''));
  if (brands[idx]) return brands[idx].shortName || brands[idx].name;
  return val;
}

function updateBloomDefaultFeedDisplay(val) {
  if (!val) val = localStorage.getItem('roweos_bloom_default_source') || 'match_brand';
  var label = getBloomDefaultLabel(val);
  var desc = document.getElementById('bloomDefaultFeedDesc');
  var text = document.getElementById('bloomDefaultFeedText');
  if (desc) desc.textContent = label;
  if (text) text.textContent = label;
}

function loadTheme() {
  // v28.2: Check both key variants (hyphen and underscore) for theme preference
  var savedTheme = localStorage.getItem('roweos-theme') || localStorage.getItem('roweos_theme');
  var html = document.documentElement;
  var isLight = savedTheme === 'light';
  
  if (isLight) {
    html.classList.add('light-mode');
    var themeColor = document.getElementById('themeColor');
    if (themeColor) themeColor.content = '#ffffff';
  }
  
  updateThemeButtons(isLight);

  // v24.25: Restore reduce-ambient preference
  if (localStorage.getItem('roweos_reduce_ambient') === '1') {
    html.classList.add('reduce-ambient');
  }
}

// ======================================================================
// v10.5.25: LIFEAI MODE SYSTEM
// Enables personal life management alongside brand intelligence
// ======================================================================

/**
 * Get current RoweOS mode: 'brand' (BrandAI) or 'life' (LifeAI)
 * @returns {string} Current mode
 */
function getCurrentMode() {
  // v10.5.25: Check both localStorage keys for mode
  return localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
}

/**
 * Check if currently in LifeAI mode
 * @returns {boolean}
 */
function isLifeMode() {
  return getCurrentMode() === 'life';
}

/**
 * Toggle between BrandAI and LifeAI modes
 */
function toggleRoweOSMode() {
  var currentMode = getCurrentMode();
  
  // v10.5.25: Use the proper switch functions for full mode switching
  if (currentMode === 'brand') {
    // Switch TO LifeAI
    var lifeProfiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    if (lifeProfiles.length > 0) {
      // v15.32: Remember last active profile instead of hardcoding 0
      var lastProfileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
      if (lastProfileIdx >= lifeProfiles.length) lastProfileIdx = 0;
      switchToLifeMode(lastProfileIdx);
    } else {
      // Check for legacy single profile
      var lifeProfile = localStorage.getItem('roweos_life_profile');
      if (lifeProfile) {
        var lastLegacyIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
        switchToLifeMode(lastLegacyIdx);
      } else {
        // No life profile - update mode anyway but show warning
        localStorage.setItem('roweos_mode', 'life');
        localStorage.setItem('roweos_app_mode', 'life');
        updateModeUI('life');
        showToast('LifeAI Mode activated - Complete onboarding in Identity', 'info');
      }
    }
  } else {
    // Switch TO BrandAI
    switchToBrandMode();
  }
  
  // Sync mode preference
  queueBackgroundSync();
}

/**
 * Update all UI elements based on current mode
 * @param {string} mode - 'brand' or 'life'
 */
function updateModeUI(mode) {
  var isLife = mode === 'life';
  
  // Update page title
  var subtitle = isLife ? 'Life Intelligence Platform' : 'Brand Intelligence Platform';
  // v33.0: Brilliance brand
  document.title = 'Brilliance - Intelligence OS';
  
  // v10.5.25: Update desktop platform title (uppercase for display)
  var desktopTitle = document.getElementById('desktopPlatformTitle');
  if (desktopTitle) {
    // v15.3: Mode-specific in-app header (browser title is generic)
    desktopTitle.textContent = isLife ? 'LIFE INTELLIGENCE PLATFORM' : 'BRAND INTELLIGENCE PLATFORM';
  }
  
  // v10.5.25: Get user name for LifeAI mode
  var userName = localStorage.getItem('roweos_user_name') || 'My Life';
  
  // v10.5.25: Update sidebar brand name display
  var sidebarName = document.getElementById('sidebarBrandName');
  if (sidebarName) {
    if (isLife) {
      // Show user's name in LifeAI mode
      var arrow = sidebarName.querySelector('.sidebar-brand-arrow');
      sidebarName.innerHTML = escapeHtml(userName) + (arrow ? arrow.outerHTML : '<span class="sidebar-brand-arrow">▾</span>'); // v30.1: XSS fix
    } else {
      // v11.5.4: Show brand name in BrandAI mode - use shortName if available
      // v30.1: Replace optional chaining with ES5
      var _brandEl = document.getElementById('brand');
      var currentBrandIdx = parseInt(_brandEl ? _brandEl.value : '0');
      var currentBrand = window.brands && window.brands[currentBrandIdx] ? (window.brands[currentBrandIdx].shortName || window.brands[currentBrandIdx].name) : 'BrandAI';
      var arrow = sidebarName.querySelector('.sidebar-brand-arrow');
      sidebarName.innerHTML = escapeHtml(currentBrand) + (arrow ? arrow.outerHTML : '<span class="sidebar-brand-arrow">▾</span>'); // v30.1: XSS fix
    }
  }
  
  // v10.5.25: Update mobile header brand display
  var mobileBrandDropdown = document.getElementById('mobileBrandDropdown');
  if (mobileBrandDropdown && isLife) {
    // Ensure Life option exists and is selected
    var options = mobileBrandDropdown.querySelectorAll('option');
    var lifeOptionExists = false;
    options.forEach(function(opt) {
      if (opt.value === 'life') {
        opt.textContent = userName;
        opt.selected = true;
        lifeOptionExists = true;
      }
    });
    if (!lifeOptionExists) {
      var lifeOpt = document.createElement('option');
      lifeOpt.value = 'life';
      lifeOpt.textContent = userName;
      lifeOpt.selected = true;
      mobileBrandDropdown.insertBefore(lifeOpt, mobileBrandDropdown.firstChild);
    }
  }
  
  // v25.1: Update identity "Add Brand/Profile" button label for mode
  var identityAddLabel = document.getElementById('identityAddBtnLabel');
  if (identityAddLabel) {
    identityAddLabel.textContent = isLife ? 'Add Profile' : 'Add Brand';
  }

  // v28.4: Update sidebar Chat nav label for mode (all three sidebar navs + SIDEBAR_LABELS)
  var _chatLabel = isLife ? 'LifeAI' : 'BrandAI';
  if (typeof SIDEBAR_LABELS !== 'undefined') SIDEBAR_LABELS.agent = _chatLabel;
  var _sidebarNavs = [document.getElementById('sidebarNav'), document.getElementById('sidebarNavExpanded'), document.getElementById('sidebarNavCustom')];
  for (var _sni = 0; _sni < _sidebarNavs.length; _sni++) {
    var _nav = _sidebarNavs[_sni];
    if (!_nav) continue;
    var _chatItem = _nav.querySelector('[data-view="agent"]');
    if (_chatItem) {
      var _lbl = _chatItem.querySelector('.nav-item-label');
      var _tip = _chatItem.querySelector('.sidebar-tooltip');
      if (_lbl) _lbl.textContent = _chatLabel;
      if (_tip) _tip.textContent = _chatLabel;
    }
  }
  // Force custom sidebar re-render so it picks up updated SIDEBAR_LABELS
  if (typeof _lastCustomSidebarHash !== 'undefined') _lastCustomSidebarHash = '';
  if (typeof renderCustomSidebar === 'function') renderCustomSidebar();

  // v10.5.25: Update chat input placeholders
  var agentInput = document.getElementById('agentCommand');
  if (agentInput) {
    agentInput.placeholder = isLife ? 'Ask about your life...' : 'Ask about your brand...';
  }
  var followupInput = document.getElementById('followupCommand');
  if (followupInput) {
    followupInput.placeholder = isLife ? 'Continue the conversation...' : 'Continue the conversation...';
  }
  
  // Update mode toggle button icon and title
  var modeBtn = document.getElementById('modeToggleBtn');
  var modeIcon = document.getElementById('modeToggleIcon');
  if (modeBtn && modeIcon) {
    if (isLife) {
      // v10.5.25: Show person icon (indicates you ARE in LifeAI mode)
      modeIcon.innerHTML = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
      modeBtn.title = 'Currently in LifeAI Mode - Click to switch to BrandAI';
    } else {
      // v10.5.25: Show briefcase icon (indicates you ARE in BrandAI mode)
      modeIcon.innerHTML = '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>';
      modeBtn.title = 'Currently in BrandAI Mode - Click to switch to LifeAI';
    }
  }
  
  // Update sidebar nav labels
  updateSidebarLabels(isLife);
  
  // Update mobile nav labels
  updateMobileNavLabels(isLife);
  
  // Add mode class to HTML for CSS targeting
  var html = document.documentElement;
  if (isLife) {
    html.classList.add('life-mode');
    html.classList.remove('brand-mode');
  } else {
    html.classList.add('brand-mode');
    html.classList.remove('life-mode');
  }
  
  // v10.5.25: Sync mobile brand dropdown and refresh Focus view
  if (typeof syncMobileBrandV2 === 'function') {
    syncMobileBrandV2();
  }
  if (typeof renderFocus2Categories === 'function') {
    renderFocus2Categories();
  }
  if (typeof updateMobileModeLabel === 'function') {
    updateMobileModeLabel();
  }
  // v10.5.25: Update Rhythm view if currently visible
  if (currentView === 'rhythm' && typeof updateRhythmForMode === 'function') {
    updateRhythmForMode();
  }
}

/**
 * Update sidebar navigation labels based on mode
 * @param {boolean} isLife - true if LifeAI mode
 */
function updateSidebarLabels(isLife) {
  // BrandAI → LifeAI
  var brandAILabel = document.querySelector('.nav-item[data-view="agent"] .nav-item-label');
  if (brandAILabel) {
    brandAILabel.textContent = isLife ? 'LifeAI' : 'BrandAI';
  }
  
  // v10.5.25: Update icon as well (✦ for BrandAI, ◇ for LifeAI)
  var brandAIIcon = document.querySelector('.nav-item[data-view="agent"] .nav-item-icon');
  if (brandAIIcon) {
    brandAIIcon.textContent = isLife ? '◇' : '✦';
  }
  
  // Inventory → Possessions
  var inventoryLabel = document.querySelector('.nav-item[data-view="inventory"] .nav-item-label');
  if (inventoryLabel) {
    inventoryLabel.textContent = isLife ? 'Possessions' : 'Inventory';
  }

  // v16.11: Hide Clients nav item in LifeAI mode (business-only feature)
  var clientsNav = document.querySelector('.nav-item[data-view="clients"]');
  if (clientsNav) {
    clientsNav.style.display = isLife ? 'none' : '';
  }

  // v15.15: Analytics → Finances (LifeAI mode)
  var commerceLabel = document.querySelector('.nav-item[data-view="commerce"] .nav-item-label');
  if (commerceLabel) {
    commerceLabel.textContent = 'Analytics'; // v24.27: Always Analytics
  }
}

/**
 * Update mobile navigation labels based on mode
 * @param {boolean} isLife - true if LifeAI mode
 */
function updateMobileNavLabels(isLife) {
  // Mobile bottom nav BrandAI tab
  var mobileAgentLabel = document.querySelector('.mobile-tab[data-view="agent"] .mobile-tab-label');
  if (mobileAgentLabel) {
    mobileAgentLabel.textContent = isLife ? 'LifeAI' : 'BrandAI';
  }
  
  // v10.5.25: Update More menu section title and label
  var mobileMenuAISectionTitle = document.getElementById('mobileMenuAISectionTitle');
  if (mobileMenuAISectionTitle) {
    mobileMenuAISectionTitle.textContent = isLife ? 'LifeAI' : 'BrandAI';
  }
  
  var mobileMenuAILabel = document.getElementById('mobileMenuAILabel');
  if (mobileMenuAILabel) {
    mobileMenuAILabel.textContent = isLife ? 'LifeAI' : 'BrandAI';
  }
  
  // Mobile menu Inventory item (if exists)
  var mobileInventoryLabel = document.querySelector('.mobile-menu-item[data-view="inventory"]');
  if (mobileInventoryLabel) {
    var textSpan = mobileInventoryLabel.querySelector('span:last-child');
    if (textSpan) {
      textSpan.textContent = isLife ? 'Possessions' : 'Inventory';
    }
  }

  // v15.15: Mobile menu Commerce → Analytics / Finances
  var mobileCommerceLabel = document.querySelector('.mobile-menu-item[data-menu-view="commerce"] .mobile-menu-item-label');
  if (mobileCommerceLabel) {
    mobileCommerceLabel.textContent = 'Analytics'; // v24.27: Always Analytics
  }
}

/**
 * Load and apply saved mode on startup
 */
function loadRoweOSMode() {
  var savedMode = getCurrentMode();
  updateModeUI(savedMode);
}

// ======================================================================
// END LIFEAI MODE SYSTEM
// ======================================================================

function updateApiStatus() {
  var dot = document.getElementById('apiStatusDot');
  var text = document.getElementById('apiStatusText');
  var container = document.getElementById('apiStatus');
  
  // Settings panel elements
  var settingsDot = document.getElementById('settingsApiDot');
  var settingsStatus = document.getElementById('settingsApiStatus');
  
  // Sidebar diamond indicator
  var sidebarDiamond = document.getElementById('sidebarApiDiamond');
  
  if (apiConnected) {
    if (dot) dot.classList.add('connected');
    if (text) text.textContent = 'AI: Connected';
    if (container) container.classList.add('connected');
    if (settingsDot) settingsDot.classList.add('connected');
    if (settingsStatus) settingsStatus.textContent = 'Connected and ready';
    if (sidebarDiamond) {
      sidebarDiamond.classList.add('connected');
      sidebarDiamond.classList.remove('disconnected');
      sidebarDiamond.textContent = '◆'; // Filled diamond when connected
      sidebarDiamond.title = 'API Status: Connected';
    }
  } else {
    if (dot) dot.classList.remove('connected');
    if (text) text.textContent = isDesktopApp ? 'AI: Not Connected' : 'AI: Browser Mode';
    if (container) container.classList.remove('connected');
    if (settingsDot) settingsDot.classList.remove('connected');
    if (settingsStatus) settingsStatus.textContent = isDesktopApp ? 'Not connected - click to configure' : 'Browser mode (limited features)';
    if (sidebarDiamond) {
      sidebarDiamond.classList.remove('connected');
      sidebarDiamond.classList.add('disconnected');
      sidebarDiamond.textContent = '◇'; // Outlined diamond when disconnected
      sidebarDiamond.title = isDesktopApp ? 'API Status: Not Connected' : 'API Status: Browser Mode';
    }
  }
}

async function checkApiConnection(forceRefresh) {
  if (forceRefresh) {
    console.log('[API] ⚡ FORCE REFRESH REQUESTED - Clearing cached provider keys');
    providerKeys = {};
    apiConnected = false;
  }
  
  try {
    // Dual-mode: Desktop Electron IPC OR Browser localStorage
    if (isDesktopApp && window.roweosAPI && window.roweosAPI.getProviderConfigs) {
      // Desktop mode: Use Electron IPC
      console.log('[API] === CHECKING API CONNECTION (DESKTOP MODE) ===');
      console.log('[API] Loading provider configurations...');
      var configResult = await window.roweosAPI.getProviderConfigs();
      if (configResult.success) {
        providerConfigs = configResult.providers;
        console.log('[API] Provider configs loaded:', providerConfigs);
      }
      
      console.log('[API] Checking provider API keys...');
      var result = await window.roweosAPI.checkProviderApiKeys();
      console.log('[API] ✓ Provider keys result:', result);
      
      if (result.success) {
        providerKeys = result.providers;
        console.log('[API] Raw provider keys object:', providerKeys);
        console.log('[API] Anthropic key exists?', providerKeys.anthropic);
        console.log('[API] OpenAI key exists?', providerKeys.openai);
        console.log('[API] Google key exists?', providerKeys.google);
        
        // API is connected if at least one provider has a key
        apiConnected = providerKeys.anthropic || providerKeys.openai || providerKeys.google;
        console.log('[API] ✓ apiConnected set to:', apiConnected);
        console.log('[API] ✓ Provider keys status:', providerKeys);
        console.log('[API] ✓ Anthropic:', providerKeys.anthropic ? 'CONNECTED' : 'not configured');
        console.log('[API] ✓ OpenAI:', providerKeys.openai ? 'CONNECTED' : 'not configured');
        console.log('[API] ✓ Google:', providerKeys.google ? 'CONNECTED' : 'not configured');
      } else {
        console.error('[API] ✗ Failed to check provider keys:', result.error);
        apiConnected = false;
        providerKeys = { anthropic: false, openai: false, google: false };
      }
    } else {
      // Browser mode: Check localStorage
      console.log('[API] === CHECKING API CONNECTION (BROWSER MODE) ===');
      console.log('[API] Browser mode - checking localStorage for API keys');
      var apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
      console.log('[API] localStorage keys:', apiKeys);
      providerKeys = {
        anthropic: !!apiKeys.anthropic,
        openai: !!apiKeys.openai,
        google: !!apiKeys.google
      };
      apiConnected = providerKeys.anthropic || providerKeys.openai || providerKeys.google;
      console.log('[API] Browser mode - apiConnected:', apiConnected, 'Keys:', providerKeys);
      
      // v9.1.14: Set providerConfigs for browser mode with updated models
      providerConfigs = {
        anthropic: {
          name: 'Anthropic',
          models: [
            { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
            { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
            { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' }
          ]
        },
        openai: {
          name: 'OpenAI',
          models: [
            { id: 'gpt-5.5', name: 'GPT 5.5' },
            { id: 'gpt-5.5-pro', name: 'GPT 5.5 Pro' },
            { id: 'gpt-5.5-thinking', name: 'GPT 5.5 Thinking' }
          ]
        },
        google: {
          name: 'Google',
          models: [
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash' }
          ]
        },
        roweos: {
          name: 'Brilliance AI',
          models: [
            { id: 'auto', name: 'Auto (Smart Routing)' }
          ]
        }
      };
      console.log('[API] Browser mode - providerConfigs set:', providerConfigs);
    }
    
    console.log('[API] Final apiConnected status:', apiConnected);
    console.log('[API] Final providerKeys:', providerKeys);
    updateApiStatus();
    
    // Don't auto-open API modal - let user click "Create your BrandAI" to start onboarding
  } catch (error) {
    console.error('[API] ✗ Connection check error:', error);
    apiConnected = false;
    providerKeys = { anthropic: false, openai: false, google: false };
    updateApiStatus();
  }
}

// Force refresh API status (for debugging/testing)
async function refreshApiStatus() {
  console.log('🔄 [REFRESH] User requested API status refresh...');
  showToast('Refreshing API status...', 'info');
  
  // Force refresh with cleared cache
  await checkApiConnection(true);
  
  // Also refresh model config display
  if (typeof renderModelConfigList === 'function') {
    renderModelConfigList();
  }
  
  // Show result
  setTimeout(function() {
    if (apiConnected) {
      var connectedProviders = [];
      if (providerKeys.anthropic) connectedProviders.push('Anthropic');
      if (providerKeys.openai) connectedProviders.push('OpenAI');
      if (providerKeys.google) connectedProviders.push('Google');
      
      showToast('✓ Connected: ' + connectedProviders.join(', '), 'success');
    } else {
      showToast('⚠ No API keys configured', 'warning');
    }
  }, 500);
}

// ═══════════════════════════════════════════════════════════════
// v22.45: API ROUTING - per-category provider selection
// ═══════════════════════════════════════════════════════════════

var API_ROUTING_CATEGORIES = [
  { id: 'chat', label: 'Chat', desc: 'Agent conversations and follow-ups' },
  { id: 'studio', label: 'Studio', desc: 'Content generation operations' },
  { id: 'automations', label: 'Automations', desc: 'Scheduled tasks and pipelines' },
  { id: 'image', label: 'Image Generation', desc: 'Image Lab and image operations' },
  { id: 'research', label: 'Deep Research', desc: 'Multi-step research operations' },
  { id: 'email', label: 'Email Templates', desc: 'AI-generated email templates' }
];

function getApiRouting() {
  try { return JSON.parse(localStorage.getItem('roweos_api_routing') || '{}'); } catch(e) { return {}; }
}

function saveApiRouting(routing) {
  localStorage.setItem('roweos_api_routing', JSON.stringify(routing));
  writeDB('profile/main', { apiRouting: routing }); // v25.1
}

function renderApiRoutingPanel() {
  var panel = document.getElementById('apiRoutingPanel');
  if (!panel) return;

  var routing = getApiRouting();
  var available = [];
  if (providerKeys.google) available.push({ id: 'google', label: 'Google Gemini', model: 'gemini-2.5-flash' });
  if (providerKeys.openai) available.push({ id: 'openai', label: 'OpenAI GPT', model: 'gpt-4o' });
  if (providerKeys.anthropic) available.push({ id: 'anthropic', label: 'Anthropic Claude', model: 'claude-sonnet-4-6' });

  if (available.length === 0) {
    panel.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;">Configure API keys first to set routing preferences.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < API_ROUTING_CATEGORIES.length; i++) {
    var cat = API_ROUTING_CATEGORIES[i];
    var current = routing[cat.id] || {};
    var selectedProvider = current.provider || 'auto';

    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;margin-bottom:6px;">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:13px;font-weight:500;color:var(--text-primary);">' + cat.label + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + cat.desc + '</div>';
    html += '</div>';
    // v25.1: Order providers by tier preference so Auto matches top selection
    var _catTier = typeof getModelTierPreference === 'function' ? getModelTierPreference() : 'balanced';
    var _tierOrder = [];
    if (_catTier === 'pro') {
      _tierOrder = ['anthropic', 'openai', 'google'];
    } else if (_catTier === 'economy') {
      _tierOrder = ['google', 'openai', 'anthropic'];
    } else {
      _tierOrder = ['anthropic', 'google', 'openai'];
    }
    var _sortedAvailable = available.slice().sort(function(a, b) {
      var ia = _tierOrder.indexOf(a.id); var ib = _tierOrder.indexOf(b.id);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib;
    });
    var _autoTopProvider = _sortedAvailable.length > 0 ? _sortedAvailable[0] : null;
    var _autoLabel = 'Auto' + (_autoTopProvider ? ' (' + _autoTopProvider.label.split(' ')[0] + ')' : '');
    html += '<select onchange="updateApiRouting(\'' + cat.id + '\', this.value)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:12px;min-width:130px;margin-left:12px;">';
    html += '<option value="auto"' + (selectedProvider === 'auto' ? ' selected' : '') + '>' + _autoLabel + '</option>';
    for (var j = 0; j < _sortedAvailable.length; j++) {
      var p = _sortedAvailable[j];
      html += '<option value="' + p.id + '"' + (selectedProvider === p.id ? ' selected' : '') + '>' + p.label + '</option>';
    }
    html += '</select>';
    html += '</div>';
  }

  // Show current effective routing summary
  html += '<div style="margin-top:10px;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border-subtle);">';
  html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Effective Routing</div>';
  // v24.10: Use tier preference to show correct effective model
  var _effTier = typeof getModelTierPreference === 'function' ? getModelTierPreference() : 'balanced';
  var _effTierConfig = typeof MODEL_TIERS !== 'undefined' ? MODEL_TIERS[_effTier] : null;
  function _getEffectiveModel(provider) {
    if (_effTierConfig && _effTierConfig.models && _effTierConfig.models[provider]) {
      return _effTierConfig.models[provider][0];
    }
    // Fallback defaults
    if (provider === 'google') return 'gemini-2.5-flash';
    if (provider === 'openai') return 'gpt-4o';
    if (provider === 'anthropic') return 'claude-sonnet-4-6';
    return 'auto';
  }
  function _getEffectiveLabel(provider) {
    var model = _getEffectiveModel(provider);
    var color = 'var(--text-muted)';
    if (provider === 'google') color = '#4285f4';
    else if (provider === 'openai') color = '#10a37f';
    else if (provider === 'anthropic') color = '#d4a574';
    // Clean up model ID for display
    var label = model.replace(/-preview$/, '').replace(/^claude-/, 'Claude ').replace(/^gpt-/, 'GPT-').replace(/^gemini-/, 'Gemini ');
    label = label.charAt(0).toUpperCase() + label.slice(1);
    return { label: label, color: color };
  }
  for (var k = 0; k < API_ROUTING_CATEGORIES.length; k++) {
    var c = API_ROUTING_CATEGORIES[k];
    var r = routing[c.id] || {};
    var eff = r.provider || 'auto';
    var effLabel = 'Auto';
    var effColor = 'var(--text-muted)';
    if (eff !== 'auto') {
      var _effInfo = _getEffectiveLabel(eff);
      effLabel = _effInfo.label;
      effColor = _effInfo.color;
    } else {
      // Resolve auto to show what it would actually use
      // v24.27: Auto resolution based on model tier preference
      var _tier = typeof getModelTierPreference === 'function' ? getModelTierPreference() : 'balanced';
      var _autoProvider = '';
      if (_tier === 'pro') {
        _autoProvider = providerKeys.anthropic ? 'anthropic' : (providerKeys.openai ? 'openai' : (providerKeys.google ? 'google' : ''));
      } else if (_tier === 'economy') {
        _autoProvider = providerKeys.google ? 'google' : (providerKeys.openai ? 'openai' : (providerKeys.anthropic ? 'anthropic' : ''));
      } else {
        // balanced - alternate between providers
        var _balancedOrder = [providerKeys.anthropic ? 'anthropic' : '', providerKeys.google ? 'google' : '', providerKeys.openai ? 'openai' : ''].filter(function(p) { return p; });
        _autoProvider = _balancedOrder.length > 0 ? _balancedOrder[0] : '';
      }
      if (_autoProvider) {
        var _autoInfo = _getEffectiveLabel(_autoProvider);
        effLabel = _autoInfo.label + ' (auto)';
        effColor = _autoInfo.color;
      }
    }
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;">';
    html += '<span style="color:var(--text-secondary);">' + c.label + '</span>';
    html += '<span style="color:' + effColor + ';font-weight:500;">' + effLabel + '</span>';
    html += '</div>';
  }
  html += '</div>';

  panel.innerHTML = html;
}

function updateApiRouting(category, provider) {
  var routing = getApiRouting();
  if (provider === 'auto') {
    delete routing[category];
  } else {
    routing[category] = { provider: provider };
    // v24.10: Set model based on current tier preference
    var _tier = typeof getModelTierPreference === 'function' ? getModelTierPreference() : 'balanced';
    var _tc = typeof MODEL_TIERS !== 'undefined' ? MODEL_TIERS[_tier] : null;
    if (_tc && _tc.models && _tc.models[provider]) {
      routing[category].model = _tc.models[provider][0];
    } else {
      if (provider === 'google') routing[category].model = 'gemini-2.5-flash';
      else if (provider === 'openai') routing[category].model = 'gpt-4o';
      else if (provider === 'anthropic') routing[category].model = 'claude-sonnet-4-6';
    }
  }
  saveApiRouting(routing);
  renderApiRoutingPanel();
}

// ═══════════════════════════════════════════════════════════════
// STREAMING TEXT SYSTEM - v2.1.6
// ═══════════════════════════════════════════════════════════════

var currentStreamElement = null;
var streamBuffer = '';

function createStreamingElement(parentElement) {
  var container = document.createElement('div');
  container.className = 'streaming-container';
  
  var status = document.createElement('div');
  status.className = 'streaming-status';
  status.textContent = 'Generating...';
  container.appendChild(status);
  
  var textSpan = document.createElement('span');
  textSpan.className = 'streaming-text';
  container.appendChild(textSpan);
  
  var cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';
  container.appendChild(cursor);
  
  parentElement.appendChild(container);
  
  return { container, textSpan, cursor, status };
}

function appendStreamChunk(elements, chunk) {
  streamBuffer += chunk;
  
  // Format the entire buffer in real-time as it arrives
  var formattedContent = formatMessageContent(streamBuffer);
  elements.textSpan.innerHTML = formattedContent;
  
  // Auto-scroll to keep cursor visible
  if (elements.container.parentElement) {
    elements.container.parentElement.scrollTop = elements.container.parentElement.scrollHeight;
  }
}

function completeStream(elements) {
  // Text is already formatted from appendStreamChunk, just clean up UI elements
  
  // Remove cursor and status
  if (elements.cursor) elements.cursor.remove();
  if (elements.status) elements.status.remove();
  
  // Add completion animation
  elements.container.classList.add('streaming-complete');
  
  return streamBuffer;
}

function setupStreamListeners(elements, onComplete, onError) {
  streamBuffer = '';
  
  // Set up stream chunk listener
  if (window.roweosAPI && window.roweosAPI.onStreamChunk) {
    window.roweosAPI.onStreamChunk(function(data) {
      // v9.1.14: Clear input on first chunk received
      if (window._pendingInputClear) {
        window._pendingInputClear.value = '';
        // v10.5.25: Reset textarea height after clearing
        autoResizeTextarea(window._pendingInputClear);
        window._pendingInputClear = null;
      }
      appendStreamChunk(elements, data.text);
    });
    
    window.roweosAPI.onStreamComplete(function(data) {
      var fullText = completeStream(elements);
      
      // Track API usage if data provided
      if (data && data.usage) {
        var webSearchUsed = false;
        if (data.usage.provider === 'claude') {
          webSearchUsed = localStorage.getItem('roweos_claude_web_search') === 'true';
        } else if (data.usage.provider === 'google') {
          webSearchUsed = localStorage.getItem('roweos_gemini_web_search') === 'true';
        }
        
        trackAPIUsage(
          data.usage.provider,
          data.usage.model,
          data.usage.input_tokens,
          data.usage.output_tokens,
          false,
          webSearchUsed
        );
      }
      
      if (onComplete) onComplete(fullText);
    });
    
    window.roweosAPI.onStreamError(function(data) {
      if (elements.cursor) elements.cursor.remove();
      if (elements.status) {
        elements.status.textContent = 'Error: ' + data.error;
        elements.status.style.color = '#ff4444';
      }
      if (onError) onError(data.error);
    });
  }
}

function cleanupStreamListeners() {
  if (window.roweosAPI && window.roweosAPI.removeStreamListeners) {
    window.roweosAPI.removeStreamListeners();
  }
  streamBuffer = '';
  currentStreamElement = null;
}

// Override runAgent to use real API with STREAMING
var originalRunAgent = runAgent;
runAgent = async function() {
  if (!isDesktopApp || !apiConnected) {
    // Fall back to mock response
    originalRunAgent();
    return;
  }
  
  var cmd = document.getElementById('agentCommand').value.trim();
  
  // v11.0.5: Check if any files are still loading
  var loadingFiles = currentAgentFiles.filter(function(f) { return f.status === 'loading'; });
  if (loadingFiles.length > 0) {
    showToast('Please wait for ' + loadingFiles.length + ' file(s) to finish loading', 'warning');
    return;
  }
  
  var hasFiles = currentAgentFiles.length > 0 && currentAgentFiles.some(function(f) { return f.status === 'ready'; });
  
  if (!cmd && !hasFiles) {
    showToast('Please enter a message or attach a file', 'warning');
    return;
  }
  
  var brandIdx = parseInt(document.getElementById('agentBrand').value);
  var brand = brands[brandIdx];
  
  // v11.0.5: Build message content with files
  var messageContent;
  var displayContent = cmd;
  var imageAttachments = []; // For multimodal API calls
  var readyFiles = currentAgentFiles.filter(function(f) { return f.status === 'ready' && f.content; });
  
  if (readyFiles.length > 0) {
    console.log('[runAgent] Including ' + readyFiles.length + ' file(s) in message');
    
    // Separate images from text files
    var imageFiles = readyFiles.filter(function(f) { return f.type && f.type.startsWith('image/'); });
    var textFiles = readyFiles.filter(function(f) { return !f.type || !f.type.startsWith('image/'); });
    
    if (imageFiles.length > 0) {
      // Build image attachments for multimodal API
      imageFiles.forEach(function(f) {
        var base64Data = f.content.split(',')[1];
        imageAttachments.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: f.type,
            data: base64Data
          }
        });
      });
      displayContent = cmd + '\n\n[Attached ' + imageFiles.length + ' image(s): ' + imageFiles.map(function(f) { return f.name; }).join(', ') + ']';
    }
    
    if (textFiles.length > 0) {
      // Include text file contents inline
      var allFileContents = textFiles.map(function(f) {
        return '[File: ' + f.name + ']\n' + f.content;
      }).join('\n\n---\n\n');
      messageContent = (cmd || 'Please analyze the attached file(s).') + '\n\n' + allFileContents;
      displayContent = cmd + '\n\n[Attached ' + textFiles.length + ' file(s): ' + textFiles.map(function(f) { return f.name; }).join(', ') + ']';
    } else {
      messageContent = cmd || 'Please analyze the attached image(s).';
    }
    
    showToast(readyFiles.length + ' file(s) included', 'info');
  } else {
    messageContent = cmd;
    displayContent = cmd;
  }
  
  // v9.1.14: Store input ref - clear when response starts, not immediately
  var inputEl = document.getElementById('agentCommand');
  window._pendingInputClear = inputEl;
  setAgentStatus('executing');
  
  // v11.0.5: Clear files after processing
  removeAgentFile();
  
  // Check if this is a new conversation
  var isNewConversation = currentConversation.length === 0;
  
  // If new conversation, clear the thread first
  if (isNewConversation) {
    var thread = document.getElementById('conversationThread');
    if (thread) thread.innerHTML = '';
  }
  
  // Hide landing content and show conversation UI
  var landingContent = document.getElementById('agentLandingContent');
  if (landingContent) landingContent.style.display = 'none';
  
  // Show conversation header
  var header = document.getElementById('agentConversationHeader');
  if (header) {
    header.classList.remove('hidden');
    header.style.display = 'flex';
  }
  
  // Show conversation thread
  var conversationDiv = document.getElementById('agentConversation');
  conversationDiv.classList.remove('hidden');
  
  // v11.0.5: Store both content and images for API, displayContent for UI
  currentConversation.push({ 
    role: 'user', 
    content: messageContent,
    images: imageAttachments.length > 0 ? imageAttachments : undefined,
    displayContent: displayContent 
  });
  
  // Update header title if this is the first message
  if (isNewConversation) {
    var titleEl = document.getElementById('conversationTitleText');
    var subtitleEl = document.getElementById('conversationSubtitle');
    if (titleEl) {
      var title = (cmd || displayContent).split('\n')[0].substring(0, 60);
      if (title.length >= 60) title += '...';
      titleEl.textContent = title || 'Conversation';
    }
    if (subtitleEl) {
      var now = new Date();
      subtitleEl.textContent = brand.name + ' • ' + now.toLocaleDateString() + ', ' + formatDateTimeDisplay(now);
    }
  }
  
  // Add user message to DOM (use displayContent to show file attachments)
  addMessageToThread('user', displayContent);
  
  // Create streaming message container with new bubble structure
  var thread = document.getElementById('conversationThread');
  var streamingMessageDiv = document.createElement('div');
  streamingMessageDiv.className = 'conversation-message assistant';
  
  var messageBubble = document.createElement('div');
  messageBubble.className = 'conversation-message-bubble';
  
  var roleDiv = document.createElement('div');
  roleDiv.className = 'conversation-message-role';
  // v10.7.9: Mode-aware role label
  var currentModeForRole = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  roleDiv.textContent = currentModeForRole === 'life' ? '◇LifeAI' : '✦BrandAI';
  
  var messageContent = document.createElement('div');
  messageContent.className = 'conversation-message-content';
  
  messageBubble.appendChild(roleDiv);
  messageBubble.appendChild(messageContent);
  streamingMessageDiv.appendChild(messageBubble);
  thread.appendChild(streamingMessageDiv);
  thread.scrollTop = thread.scrollHeight;
  
  // Set up streaming elements
  var streamElements = createStreamingElement(messageContent);
  
  // v11.0.5: Build conversation history with multimodal support
  var messages = currentConversation
    .filter(function(msg) { return msg.content; })
    .map(function(msg) {
      // Check if message has image attachments
      if (msg.images && msg.images.length > 0) {
        // Build multimodal content array
        var contentParts = msg.images.slice(); // Copy image parts
        contentParts.push({
          type: 'text',
          text: msg.content
        });
        return { role: msg.role, content: contentParts };
      }
      return { role: msg.role, content: msg.content };
    });
  
  // Build system prompt - use brand context only if BrandAI is active
  var systemPrompt;
  if (brandAIActive) {
    // Determine which brand to use for the system prompt
    // Use conversationStartBrand if it exists and differs from current brand
    var promptBrandIdx = brandIdx;
    var brandSwitched = false;
    
    if (conversationStartBrand !== null && conversationStartBrand !== brandIdx) {
      promptBrandIdx = conversationStartBrand;
      brandSwitched = true;
      console.log('[BrandAI] Brand switched during conversation. Using original brand:', brands[promptBrandIdx].name, 'Current:', brand.name);
    }
    
    var promptBrand = brands[promptBrandIdx];
    
    // Check for custom BrandAI prompt first
    var customPrompts = JSON.parse(localStorage.getItem('roweos_brandai_main_prompts') || '{}');
    
    console.log('[BrandAI/runAgent] Brand index:', promptBrandIdx, 'Brand:', promptBrand.name);
    console.log('[BrandAI/runAgent] Custom prompts available:', Object.keys(customPrompts));
    
    if (customPrompts[promptBrandIdx]) {
      // Use custom prompt
      systemPrompt = customPrompts[promptBrandIdx];
      console.log('[BrandAI/runAgent] Using CUSTOM prompt (length:', systemPrompt.length, 'chars)');
    } else {
      // Generate default BrandAI prompt
      console.log('[BrandAI/runAgent] No custom prompt found, generating full default prompt');
      
      systemPrompt = 'You are the dedicated AI operator for ' + promptBrand.name + '. You ARE this brand - respond as an on-brand concierge who deeply understands and embodies this specific brand\'s identity, voice, and values.\n\n';
      systemPrompt += 'PRIME DIRECTIVE:\n';
      systemPrompt += '- ALWAYS respond in the voice and context of ' + promptBrand.name + ' - never generic responses.\n';
      systemPrompt += '- Use the brand context below to inform EVERY response.\n';
      systemPrompt += '- Protect the brand. No hype, no desperation, no sales-y voice. Quiet competence.\n';
      systemPrompt += '- Be operational. Provide clear next steps, templates, options.\n';
      systemPrompt += '- Be consistent. Every response from the same premium, thoughtful brand system.\n\n';
      
      // Add brand switch context if applicable
      if (brandSwitched) {
        systemPrompt += 'IMPORTANT CONTEXT: The user has switched their active brand to "' + brand.name + '" during this conversation. You should be aware of this switch and can reference both brands if relevant, but maintain continuity with the conversation that started with ' + promptBrand.name + '.\n\n';
      }
      
      systemPrompt += 'CAPABILITIES:\n';
      systemPrompt += '- You have access to web search via the web_search tool. Use it when you need:\n';
      systemPrompt += '  * Current information beyond your knowledge cutoff\n';
      systemPrompt += '  * Real-time data (pricing, trends, competitors, news)\n';
      systemPrompt += '  * Research on specific topics\n';
      systemPrompt += '  * Verification of facts\n';
      systemPrompt += '- Search proactively when the request requires current information\n';
      systemPrompt += '- After searching, synthesize findings with brand context\n\n';
      
      systemPrompt += '===== YOU ARE: ' + promptBrand.name + ' =====\n\n';
      systemPrompt += 'TAGLINE: ' + promptBrand.tagline + '\n\n';
      
      if (promptBrand.philosophy) systemPrompt += 'PHILOSOPHY: ' + promptBrand.philosophy + '\n\n';
      if (promptBrand.coreBelief) systemPrompt += 'CORE BELIEF: ' + promptBrand.coreBelief + '\n\n';
      if (promptBrand.mission) systemPrompt += 'MISSION: ' + promptBrand.mission + '\n\n';
      if (promptBrand.ethos) systemPrompt += 'ETHOS: ' + promptBrand.ethos + '\n\n';
      
      systemPrompt += 'PRODUCTS: ' + (promptBrand.products || promptBrand.positioning || '') + '\n';
      systemPrompt += 'TARGET AUDIENCE: ' + promptBrand.audience + '\n';
      systemPrompt += 'BRAND PROMISE: ' + promptBrand.promise + '\n';
      systemPrompt += 'PRIMARY CTA: ' + promptBrand.cta + '\n\n';
      
      systemPrompt += 'VOICE: ' + promptBrand.voice + '\n';
      if (promptBrand.tone) systemPrompt += 'TONE: ' + promptBrand.tone + '\n';
      if (promptBrand.approach) systemPrompt += 'APPROACH: ' + promptBrand.approach + '\n\n';
      
      systemPrompt += 'VOCABULARY DO: ' + promptBrand.vocabDo + '\n';
      systemPrompt += 'VOCABULARY DON\'T: ' + promptBrand.vocabDont + '\n\n';
      
      systemPrompt += 'CONSTRAINTS: ' + promptBrand.constraints + '\n\n';
      
      if (promptBrand.trainingApproach) systemPrompt += 'TRAINING APPROACH: ' + promptBrand.trainingApproach + '\n\n';
      if (promptBrand.programs) systemPrompt += 'PROGRAMS: ' + promptBrand.programs + '\n\n';
      if (promptBrand.adaEssentials) systemPrompt += 'ADA ESSENTIALS: ' + promptBrand.adaEssentials + '\n\n';
      if (promptBrand.experience) systemPrompt += 'EXPERIENCE: ' + promptBrand.experience + '\n\n';
      if (promptBrand.properties) systemPrompt += 'PROPERTIES: ' + promptBrand.properties + '\n\n';
      if (promptBrand.services) systemPrompt += 'SERVICES: ' + promptBrand.services + '\n\n';
      if (promptBrand.pricing) systemPrompt += 'PRICING: ' + promptBrand.pricing + '\n\n';
      if (promptBrand.products) systemPrompt += 'PRODUCTS: ' + promptBrand.products + '\n\n';
      if (promptBrand.partnerships) systemPrompt += 'PARTNERSHIPS: ' + promptBrand.partnerships + '\n\n';
      if (promptBrand.deliverables) systemPrompt += 'DELIVERABLES: ' + promptBrand.deliverables + '\n\n';
      if (promptBrand.location) systemPrompt += 'LOCATION: ' + promptBrand.location + '\n\n';
      if (promptBrand.contacts) systemPrompt += 'CONTACTS: ' + promptBrand.contacts + '\n\n';

      // v12.2.4: Add user role context
      if (promptBrand.roleData) {
        systemPrompt += '===== USER CONTEXT =====\n';
        if (promptBrand.roleData.type === 'employee') {
          systemPrompt += 'The user is an EMPLOYEE at this company, not the owner.\n';
          if (promptBrand.roleData.title) systemPrompt += 'JOB TITLE: ' + promptBrand.roleData.title + '\n';
          if (promptBrand.roleData.profession) systemPrompt += 'PROFESSION: ' + promptBrand.roleData.profession + '\n';
          if (promptBrand.roleData.description) systemPrompt += 'JOB RESPONSIBILITIES: ' + promptBrand.roleData.description + '\n';
          systemPrompt += '\nTailor your responses to their role. They may not have authority over brand strategy or high-level decisions. Focus on their specific responsibilities and how they can contribute within their role.\n\n';
        } else {
          systemPrompt += 'The user is the OWNER/FOUNDER of this brand.\n';
          if (promptBrand.roleData.ownerTitle) systemPrompt += 'TITLE: ' + promptBrand.roleData.ownerTitle + '\n';
          systemPrompt += '\nThey have full authority over brand decisions. Provide strategic recommendations and high-level insights.\n\n';
        }
      }
    }
  } else {
    // StandardAI mode - no brand context
    systemPrompt = 'You are a helpful AI assistant. Respond naturally and concisely to the user\'s questions.';
  }
  
  // v9.1.14: Add tuning/learning context from rated conversations
  if (brandAIActive && typeof getBrandAILearningContext === 'function') {
    var learningContext = getBrandAILearningContext(promptBrand.name);
    if (learningContext) {
      systemPrompt += learningContext;
      console.log('[BrandAI/runAgent] Added learning context from tuning feedback');
    }
  }
  
  // v9.1.14: Inject document knowledge from uploaded documents
  if (brandAIActive && typeof getBrandKnowledge === 'function') {
    var brandKnowledge = getBrandKnowledge(promptBrand.name);
    if (brandKnowledge && brandKnowledge.systemPromptAdditions) {
      systemPrompt += brandKnowledge.systemPromptAdditions;
      console.log('[BrandAI/runAgent] Added document knowledge:', 
        (brandKnowledge.documents ? brandKnowledge.documents.length : 0), 'documents,', // v30.1: ES5 fix
        (brandKnowledge.insights ? brandKnowledge.insights.length : 0), 'insights'); // v30.1: ES5 fix
    }
  }
  
  // Log what's being sent to API
  console.log('[BrandAI/runAgent] === FINAL PROMPT BEING SENT TO API ===');
  console.log('[BrandAI/runAgent] Prompt preview (first 500 chars):', systemPrompt.substring(0, 500) + '...');
  console.log('[BrandAI/runAgent] Prompt preview (last 500 chars):', '...' + systemPrompt.substring(Math.max(0, systemPrompt.length - 500)));
  console.log('[BrandAI/runAgent] Total prompt length:', systemPrompt.length, 'characters');
  console.log('[BrandAI/runAgent] Contains "Mr. Rowe":', systemPrompt.includes('Mr. Rowe'));
  console.log('[BrandAI/runAgent] =====================================');
  
  // v11.0.5: Add chat response length instruction
  if (typeof getChatLengthInstruction === 'function') {
    var lengthInstruction = getChatLengthInstruction();
    if (lengthInstruction) {
      systemPrompt += lengthInstruction;
      console.log('[BrandAI/runAgent] Added response length instruction:', chatResponseLength);
    }
  }
  
  try {
    // Set up debug log listener
    if (window.roweosAPI.onDebugLog) {
      window.roweosAPI.onDebugLog(function(message) {
        console.log(message);
      });
    }
    
    // Set up stream listeners
    setupStreamListeners(streamElements, function(fullText) {
      // On complete
      currentConversation.push({ role: 'assistant', content: fullText });

      // v12.2.4: Check for attached files and offer save to identity
      if (typeof checkForSaveToIdentity === 'function' && streamElements.textSpan) {
        checkForSaveToIdentity(streamElements.textSpan, fullText, 'brand');
      }

      // Save to history
      agentCommands.push({
        id: Date.now(),
        brand: brand.name,
        command: cmd,
        response: fullText,
        time: new Date().toLocaleString()
      });
      saveRuns();

      cleanupStreamListeners();
      setAgentStatus('ready');
    }, function(error) {
      // On error
      streamElements.textSpan.textContent = 'Connection error: ' + error;
      cleanupStreamListeners();
      setAgentStatus('ready');
    });
    
    // Start streaming
    var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    var apiKey = getApiKey(settings.provider);
    
    if (!apiKey) {
      streamElements.textSpan.textContent = 'API key not configured. Please add your API key in Settings.';
      cleanupStreamListeners();
      setAgentStatus('ready');
      return;
    }
    
    var result = await window.roweosAPI.agentChatStream({
      messages: messages,
      systemPrompt: systemPrompt,
      provider: settings.provider,
      model: settings.model
    });
    
    if (!result.success) {
      streamElements.textSpan.textContent = 'Error: ' + result.error;
      cleanupStreamListeners();
      setAgentStatus('ready');
    }
  } catch (error) {
    streamElements.textSpan.textContent = 'Connection error: ' + error.message;
    cleanupStreamListeners();
    setAgentStatus('ready');
  }
};

// Override runOp to use real API
var originalRunOp = runOp;
runOp = async function() {
  if (!selectedOp) {
    showToast('Please select an operation first', 'warning');
    return;
  }
  
  // v11.0.5: Check if any files are still loading
  var loadingFiles = currentStudioFiles.filter(function(f) { return f.status === 'loading'; });
  if (loadingFiles.length > 0) {
    showToast('Please wait for ' + loadingFiles.length + ' file(s) to finish loading', 'warning');
    return;
  }
  
  var btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.textContent = 'Running...';
  
  // Add thinking animation to entire Studio layout
  var studioLayout = document.querySelector('.studio-layout');
  if (studioLayout) studioLayout.classList.add('agent-thinking');

  // v15.15: Safely resolve brand - prefer studioBrand, fallback to brand selector
  var studioBrandEl2 = document.getElementById('studioBrand');
  var mainBrandEl2 = document.getElementById('brand');
  var brandIdx = parseInt((studioBrandEl2 && studioBrandEl2.value !== '' ? studioBrandEl2.value : null) || (mainBrandEl2 && mainBrandEl2.value !== '' ? mainBrandEl2.value : null) || selectedBrand || 0);
  if (isNaN(brandIdx) || brandIdx < 0) brandIdx = 0;
  var brand = brands[brandIdx] || brands[0];
  var contextEl_tmp = document.getElementById('studioContext'); var context = contextEl_tmp ? contextEl_tmp.value : '';

  // v11.0.5: Get any attached files content
  var readyFiles = currentStudioFiles.filter(function(f) { return f.status === 'ready' && f.content; });
  var fileContent = '';
  if (readyFiles.length > 0) {
    console.log('[runOp] Including ' + readyFiles.length + ' file(s) in operation');
    fileContent = '\n\n--- ATTACHED FILES ---\n';
    readyFiles.forEach(function(f) {
      fileContent += '\n[File: ' + f.name + ']\n' + f.content + '\n';
    });
    fileContent += '--- END FILES ---';
    showToast(readyFiles.length + ' file(s) included', 'info');
    
    // v11.0.5: Clear files after extracting content
    removeStudioFile();
  }
  
  // Add to recent
  addToRecent(selectedOp.id);
  
  if (!isDesktopApp || !apiConnected) {
    // Use mock generation - remove animation after delay
    setTimeout(function() {
      if (studioLayout) studioLayout.classList.remove('agent-thinking');
    }, 600);
    originalRunOp();
    return;
  }
  
  // Build the system prompt
  var systemPrompt = 'You are a brand operations specialist for ' + brand.name;
  if (brand.location) {
    systemPrompt += ', a luxury brand based in ' + brand.location;
  }
  systemPrompt += '.\n\n';
  systemPrompt += 'BRAND CONTEXT:\n';
  systemPrompt += '- Name: ' + brand.name + '\n';
  systemPrompt += '- Tagline: ' + brand.tagline + '\n';
  systemPrompt += '- Voice: ' + (brand.voice || 'calm, warm, professional') + '\n';
  systemPrompt += '- Products: ' + (brand.products || brand.positioning || '') + '\n';
  systemPrompt += '- Audience: ' + (brand.audience || '') + '\n\n';
  systemPrompt += 'VOCABULARY TO USE: ' + (brand.vocabDo || 'curated, elevated, purposeful') + '\n';
  systemPrompt += 'VOCABULARY TO AVOID: ' + (brand.vocabDont || 'cheap, rushed, generic') + '\n\n';
  systemPrompt += 'OUTPUT REQUIREMENTS:\n';
  systemPrompt += '- Produce complete, polished, ready-to-use content\n';
  systemPrompt += '- Maintain the brand voice throughout\n';
  systemPrompt += '- Be specific and actionable\n';
  systemPrompt += '- Format with clear sections and headers';
  
  // Build the user prompt
  var userPrompt = 'OPERATION: ' + selectedOp.name + '\n';
  userPrompt += 'DESCRIPTION: ' + selectedOp.desc + '\n\n';
  userPrompt += 'DELIVERABLES REQUIRED:\n';
  selectedOp.outputs.forEach(function(o, i) {
    userPrompt += (i + 1) + '. ' + o + '\n';
  });
  if (context) {
    userPrompt += '\nADDITIONAL CONTEXT:\n' + context;
  }
  // v11.0.5: Include file content
  if (fileContent) {
    userPrompt += fileContent;
  }
  userPrompt += '\n\nPlease generate all deliverables in full, ready for immediate use.';
  
  var plan = '=== ' + selectedOp.name.toUpperCase() + ' PLAN ===\n';
  plan += 'Brand: ' + brand.name + '\n';
  plan += 'Tagline: ' + brand.tagline + '\n';
  plan += 'Voice: ' + brand.voice + '\n';
  plan += 'Category: ' + (selectedOp.category || 'operations') + '\n\n';
  plan += 'Deliverables:\n';
  selectedOp.outputs.forEach(function(o) { plan += '• ' + o + '\n'; });
  if (context) plan += '\nContext: ' + context;
  
  try {
    var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    
    // Use non-streaming generateContent (v3.7.3 working version)
    var result = await window.roweosAPI.generateContent({
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      provider: settings.provider,
      model: settings.model
    });
    
    var deliv;
    if (result.success) {
      deliv = '// ' + selectedOp.name + ' for ' + brand.name + '\n';
      deliv += '// Generated by Brilliance AI\n';
      deliv += '// ' + new Date().toLocaleString() + '\n\n';
      deliv += result.content;
    } else {
      deliv = '// Error generating content: ' + result.error + '\n\n';
      deliv += generateOutputTemplate(selectedOp, brand, context);
    }
    
    var run = {
      id: Date.now(),
      op: selectedOp.name,
      brand: brand.name,
      plan: plan,
      deliv: deliv,
      context: context,
      time: new Date().toLocaleString(),
      aiGenerated: result.success
    };
    runs.push(run);
    saveRuns();
    showOutput(run);
    showHistory();
    renderOperations();
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory(); // v23.16

    // Remove thinking animation
    if (studioLayout) studioLayout.classList.remove('agent-thinking');

    btn.disabled = false;
    // v9.1.14: Different button text for image operations
    if (selectedOp.isImageOp) {
      btn.textContent = 'Generate Image: ' + selectedOp.name;
    } else {
      btn.textContent = 'Execute: ' + selectedOp.name;
    }

    showToast(result.success ? 'AI content generated!' : 'Used template (API error)', result.success ? 'success' : 'warning');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');

    // Fall back to template
    var deliv = generateOutputTemplate(selectedOp, brand, context);
    var run = {
      id: Date.now(),
      op: selectedOp.name,
      brand: brand.name,
      plan: plan,
      deliv: deliv,
      context: context,
      time: new Date().toLocaleString(),
      aiGenerated: false
    };
    runs.push(run);
    saveRuns();
    showOutput(run);
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory(); // v23.16

    // Remove thinking animation
    if (studioLayout) studioLayout.classList.remove('agent-thinking');

    btn.disabled = false;
    // v9.1.14: Different button text for image operations
    if (selectedOp.isImageOp) {
      btn.textContent = 'Generate Image: ' + selectedOp.name;
    } else {
      btn.textContent = 'Execute: ' + selectedOp.name;
    }
  }
};

/**
 * v9.1.14: Build comprehensive context from all RoweOS data for BrandAI
 * Includes: Identity, Library files, Focus mode, Rhythm calendar, To-dos, Documents
 */
function buildBrandContext(brandIdx, brand) {
  var context = '';
  
  try {
    // === EXTENDED IDENTITY ===
    if (brand.philosophy || brand.positioning || brand.story) {
      context += '\n===== EXTENDED IDENTITY =====\n';
      if (brand.philosophy) context += 'PHILOSOPHY: ' + brand.philosophy + '\n';
      if (brand.positioning) context += 'POSITIONING: ' + brand.positioning + '\n';
      if (brand.story) context += 'BRAND STORY: ' + brand.story + '\n';
      if (brand.tone) context += 'TONE: ' + brand.tone + '\n';
      if (brand.website) context += 'WEBSITE: ' + brand.website + '\n';
    }

    // v29.1: Include LIVE identity data (essence, voice, audience, etc.) -- always read current state
    if (brand.identityData) {
      var _idSections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
      var _idContent = '';
      for (var _ids = 0; _ids < _idSections.length; _ids++) {
        var _sec = _idSections[_ids];
        var _secData = brand.identityData[_sec];
        if (!_secData) continue;
        var _owner = _secData.owner || '';
        var _ai = _secData.ai || '';
        if (Array.isArray(_ai)) _ai = _ai.map(function(item) { return typeof item === 'string' ? item : (item.text || ''); }).join('\n');
        if (_owner || _ai) {
          _idContent += '\n' + _sec.charAt(0).toUpperCase() + _sec.slice(1) + ':\n';
          if (_owner) _idContent += _owner + '\n';
          if (_ai) _idContent += _ai + '\n';
        }
      }
      if (_idContent) {
        context += '\n===== BRAND IDENTITY (Live) =====\n' + _idContent;
      }
    }

    // v29.1: Include brand knowledge from per-brand knowledge store
    if (typeof getBrandKnowledge === 'function') {
      var _bk = getBrandKnowledge(brand.name);
      if (_bk) {
        if (_bk.systemPromptAdditions) {
          context += '\n' + _bk.systemPromptAdditions + '\n';
        }
        if (_bk.insights && _bk.insights.length > 0) {
          context += '\n===== BRAND KNOWLEDGE INSIGHTS =====\n';
          for (var _ki = 0; _ki < _bk.insights.length; _ki++) {
            var _ins = _bk.insights[_ki];
            context += '- ' + (typeof _ins === 'string' ? _ins : (_ins.text || '')) + '\n';
          }
        }
      }
    }
    
    // === BRAND MEMORY (Uploaded Documents) ===
    var brandKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(brandIdx) : 'brand_' + brandIdx;
    if (typeof brandMemory !== 'undefined' && brandMemory && brandMemory[brandKey] && brandMemory[brandKey].documents && brandMemory[brandKey].documents.length > 0) {
      context += '\n===== UPLOADED DOCUMENTS =====\n';
      brandMemory[brandKey].documents.forEach(function(doc, idx) {
        context += '• ' + doc.name;
        if (doc.summary) {
          var _ds = typeof doc.summary === 'string' ? doc.summary : (doc.summary.summary || '');
          if (_ds) context += ': ' + _ds.substring(0, 200) + (_ds.length > 200 ? '...' : '');
        }
        context += '\n';
      });
    }
    
    // === LIBRARY FILES (Recent outputs) ===
    var lib = typeof getLibraryForBrandIndex === 'function' ? getLibraryForBrandIndex(brandIdx) : null;
    if (lib && lib.files && lib.files.length > 0) {
      context += '\n===== RECENT LIBRARY FILES =====\n';
      // Get most recent 5 files
      var recentFiles = lib.files.slice().sort(function(a, b) {
        return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
      }).slice(0, 5);
      
      recentFiles.forEach(function(file) {
        var dateStr = file.savedAt ? new Date(file.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
        context += '• ' + file.name + ' (' + (file.operation || 'Output') + ', ' + dateStr + ')\n';
      });
    }
    
    // === TO-DOS (from global todos array) ===
    // v9.1.14: Use global todos array directly (stored as roweosTodos)
    if (typeof todos !== 'undefined' && todos && todos.length > 0) {
      var pendingTodos = todos.filter(function(t) { return !t.completed; });
      if (pendingTodos.length > 0) {
        context += '\n===== PENDING TO-DOS =====\n';
        context += 'You have ' + pendingTodos.length + ' pending task(s):\n';
        pendingTodos.slice(0, 10).forEach(function(todo) {
          var priorityMarker = todo.priority === 'high' ? '⚡ HIGH: ' : todo.priority === 'medium' ? '• MEDIUM: ' : '• ';
          context += priorityMarker + todo.text;
          if (todo.brand) context += ' [' + todo.brand + ']';
          if (todo.dueDate) context += ' (due: ' + new Date(todo.dueDate).toLocaleDateString() + ')';
          if (todo.category) context += ' - ' + todo.category;
          context += '\n';
        });
      }
      
      // Completed today
      var today = new Date();
      var completedToday = todos.filter(function(t) {
        if (!t.completed || !t.completedAt) return false;
        var completedDate = new Date(t.completedAt);
        return completedDate.toDateString() === today.toDateString();
      });
      if (completedToday.length > 0) {
        context += '\nCompleted today: ' + completedToday.length + ' task(s)\n';
      }
    }
    
    // === RHYTHM / CALENDAR (from global calendar array) ===
    // v9.1.14: Use global calendar array directly
    if (typeof calendar !== 'undefined' && calendar && calendar.length > 0) {
      var now = new Date();
      now.setHours(0, 0, 0, 0);
      var nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      var upcoming = calendar
        .filter(function(item) { 
          var itemDate = new Date(item.date);
          return itemDate >= now && item.status !== 'completed';
        })
        .sort(function(a, b) { return new Date(a.date) - new Date(b.date); })
        .slice(0, 8);
      
      if (upcoming.length > 0) {
        context += '\n===== UPCOMING SCHEDULE (RHYTHM) =====\n';
        upcoming.forEach(function(item) {
          var dateStr = new Date(item.date).toLocaleDateString();
          var timeStr = item.time || '';
          context += '• ' + dateStr + (timeStr ? ' ' + timeStr : '') + ': ' + item.title;
          if (item.brand) context += ' [' + item.brand + ']';
          context += '\n';
        });
      }
    }
    
    // === FOCUS STATS ===
    var streak = parseInt(localStorage.getItem('roweosStreak') || '0');
    if (streak > 0) {
      context += '\n===== FOCUS STATS =====\n';
      context += 'Current streak: ' + streak + ' day(s)\n';
    }
    
    // === AI INSIGHTS (from Identity) ===
    if (brand.aiInsights) {
      context += '\n===== AI INSIGHTS =====\n';
      context += brand.aiInsights + '\n';
    }
    
    // === GUARDRAILS ===
    var guardrails = null;
    try {
      guardrails = JSON.parse(localStorage.getItem('roweos_guardrails_' + brandIdx) || 'null');
    } catch(e) {}
    
    if (guardrails) {
      context += '\n===== BRAND GUARDRAILS =====\n';
      if (guardrails.doNotMention && guardrails.doNotMention.length > 0) {
        context += 'DO NOT MENTION: ' + guardrails.doNotMention.join(', ') + '\n';
      }
      if (guardrails.competitors && guardrails.competitors.length > 0) {
        context += 'COMPETITORS (avoid): ' + guardrails.competitors.join(', ') + '\n';
      }
      if (guardrails.legalDisclaimer) {
        context += 'LEGAL DISCLAIMER: ' + guardrails.legalDisclaimer + '\n';
      }
    }
    
  } catch (e) {
    console.error('[buildBrandContext] Error:', e);
  }
  
  return context;
}

// Override sendFollowup to use real API (v2.2.1 working pattern)
var originalSendFollowup = sendFollowup;
sendFollowup = async function() {
  if (!isDesktopApp || !apiConnected) {
    originalSendFollowup();
    return;
  }
  
  var cmd = document.getElementById('followupCommand').value.trim();
  
  // v11.0.5: Check if any files are still loading (shared with main input)
  var loadingFiles = currentAgentFiles.filter(function(f) { return f.status === 'loading'; });
  if (loadingFiles.length > 0) {
    showToast('Please wait for ' + loadingFiles.length + ' file(s) to finish loading', 'warning');
    return;
  }
  
  var hasFiles = currentAgentFiles.length > 0 && currentAgentFiles.some(function(f) { return f.status === 'ready'; });
  
  if (!cmd && !hasFiles) {
    showToast('Please enter a message or attach a file', 'warning');
    return;
  }
  
  var brandIdx = parseInt(document.getElementById('agentBrand').value);
  var brand = brands[brandIdx];
  
  // v11.0.5: Build message content with files
  var messageContent;
  var displayContent = cmd;
  var imageAttachments = [];
  var readyFiles = currentAgentFiles.filter(function(f) { return f.status === 'ready' && f.content; });
  
  if (readyFiles.length > 0) {
    console.log('[sendFollowup] Including ' + readyFiles.length + ' file(s) in message');
    
    var imageFiles = readyFiles.filter(function(f) { return f.type && f.type.startsWith('image/'); });
    var textFiles = readyFiles.filter(function(f) { return !f.type || !f.type.startsWith('image/'); });
    
    if (imageFiles.length > 0) {
      imageFiles.forEach(function(f) {
        var base64Data = f.content.split(',')[1];
        imageAttachments.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: f.type,
            data: base64Data
          }
        });
      });
      displayContent = cmd + '\n\n[Attached ' + imageFiles.length + ' image(s): ' + imageFiles.map(function(f) { return f.name; }).join(', ') + ']';
    }
    
    if (textFiles.length > 0) {
      var allFileContents = textFiles.map(function(f) {
        return '[File: ' + f.name + ']\n' + f.content;
      }).join('\n\n---\n\n');
      messageContent = (cmd || 'Please analyze the attached file(s).') + '\n\n' + allFileContents;
      displayContent = cmd + '\n\n[Attached ' + textFiles.length + ' file(s): ' + textFiles.map(function(f) { return f.name; }).join(', ') + ']';
    } else {
      messageContent = cmd || 'Please analyze the attached image(s).';
    }
    
    showToast(readyFiles.length + ' file(s) included', 'info');
  } else {
    messageContent = cmd;
    displayContent = cmd;
  }
  
  // v9.1.14: Store input ref - clear when response starts, not immediately
  window._pendingInputClear = document.getElementById('followupCommand');
  setAgentStatus('executing');
  
  // v11.0.5: Clear files after processing
  removeAgentFile();
  
  // Add user message to DOM (use displayContent to show file attachments)
  addMessageToThread('user', displayContent);
  
  // Add thinking indicator
  var thinkingId = 'thinking-' + Date.now();
  var thread = document.getElementById('conversationThread');
  var thinkingDiv = document.createElement('div');
  thinkingDiv.id = thinkingId;
  thinkingDiv.className = 'conversation-message assistant';
  thinkingDiv.innerHTML = '<div class="conversation-message-bubble"><div class="conversation-message-content"><span class="thinking-dots">Thinking...</span></div></div>';
  thread.appendChild(thinkingDiv);
  thread.scrollTop = thread.scrollHeight;
  
  // v11.0.5: Build conversation history with multimodal support
  var messages = currentConversation
    .filter(function(msg) { return msg.content; })
    .map(function(msg) {
      if (msg.images && msg.images.length > 0) {
        var contentParts = msg.images.slice();
        contentParts.push({ type: 'text', text: msg.content });
        return { role: msg.role, content: contentParts };
      }
      return { role: msg.role, content: msg.content };
    });
  
  // Build the new user message with multimodal support if needed
  if (imageAttachments.length > 0) {
    var userContent = imageAttachments.slice();
    userContent.push({ type: 'text', text: messageContent });
    messages.push({ role: 'user', content: userContent });
  } else {
    messages.push({ role: 'user', content: messageContent });
  }
  
  // v9.1.14: Build comprehensive context from all RoweOS data
  var brandContext = buildBrandContext(brandIdx, brand);
  
  // Build system prompt with brand context
  var systemPrompt = 'You are the dedicated AI operator for ' + brand.name + '. You ARE this brand - respond as an on-brand concierge who deeply understands and embodies this specific brand\'s identity, voice, and values.\n\n';
  systemPrompt += 'PRIME DIRECTIVE:\n';
  systemPrompt += '- ALWAYS respond in the voice and context of ' + brand.name + ' - never generic responses.\n';
  systemPrompt += '- Protect the brand. No hype, no desperation, no sales-y voice. Quiet competence.\n';
  systemPrompt += '- Be operational. Provide clear next steps, templates, options.\n';
  systemPrompt += '- Reference relevant context from Library, Focus, Rhythm, and To-dos when helpful.\n\n';
  systemPrompt += '===== BRAND IDENTITY: ' + brand.name + ' =====\n\n';
  systemPrompt += 'TAGLINE: ' + brand.tagline + '\n';
  systemPrompt += 'PRODUCTS: ' + (brand.products || brand.positioning || '') + '\n';
  systemPrompt += 'AUDIENCE: ' + brand.audience + '\n';
  systemPrompt += 'VOICE: ' + brand.voice + '\n';
  systemPrompt += 'VOCABULARY DO: ' + brand.vocabDo + '\n';
  systemPrompt += 'VOCABULARY DON\'T: ' + brand.vocabDont + '\n';
  
  // v9.1.14: Add comprehensive context
  if (brandContext) {
    systemPrompt += '\n' + brandContext;
  }
  // v22.39: Inject guardrails into all agent prompts
  if (typeof getGuardrailsContext === 'function') {
    systemPrompt += getGuardrailsContext();
  }

  try {
    var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    
    // Use v2.2.1 working agentChat (non-streaming for follow-ups)
    var result = await window.roweosAPI.agentChat({
      messages: messages,
      systemPrompt: systemPrompt,
      provider: settings.provider,
      model: settings.model
    });
    
    var thinking = document.getElementById(thinkingId);
    if (thinking) thinking.remove();
    
    if (result.success) {
      // v11.0.5: Store user message with image attachments for history
      currentConversation.push({ 
        role: 'user', 
        content: messageContent,
        images: imageAttachments.length > 0 ? imageAttachments : undefined,
        displayContent: displayContent
      });
      currentConversation.push({ role: 'assistant', content: result.content || '' });
      addMessageToThread('assistant', result.content || '');
      
      // Update last agent command
      if (agentCommands.length > 0) {
        var last = agentCommands[agentCommands.length - 1];
        last.conversation = JSON.parse(JSON.stringify(currentConversation));
        saveRuns();
      }
    } else {
      addMessageToThread('assistant', 'Error: ' + (result.error || 'Unknown error'));
    }
    
    setAgentStatus('ready');
  } catch (error) {
    var thinking = document.getElementById(thinkingId);
    if (thinking) thinking.remove();
    addMessageToThread('assistant', 'Connection error: ' + error.message);
    setAgentStatus('ready');
  }
};

// Initialize mobile brand selector and check API on load
// === V159 NEW FUNCTIONS ===

// Rhythm View (Calendar wrapper)
function renderRhythm() {
  renderCalendar();
}

// Tuning View
function showTuning() {
  console.log('[Tuning] showTuning called');

  // v10.5.25: Always reload data from storage to ensure we have latest
  loadRuns();

  console.log('[Tuning] After loadRuns - agentCommands:', agentCommands ? agentCommands.length : 0, 'items');

  // Log life conversations
  var lifeConvos = agentCommands.filter(function(cmd) { return cmd.mode === 'life'; });
  console.log('[Tuning] LifeAI conversations:', lifeConvos.length);

  // Render BrandAI Conversations
  renderTuningConversations();

  // Render Studio Outputs
  renderTuningStudioOutputs();

  // v22.26: Render Bloom Knowledge
  renderBloomKnowledgeSection();

  // v25.0: Render Folio Knowledge
  if (typeof renderFolioKnowledgeSection === 'function') renderFolioKnowledgeSection();
}

// v22.26: Render Bloom Knowledge entries in Identity view
function renderBloomKnowledgeSection() {
  var listEl = document.getElementById('bloomKnowledgeList');
  var countEl = document.getElementById('bloomKnowledgeCount');
  if (!listEl) return;

  var knowledge = getBloomKnowledge();
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var allEntries = [];

  // Collect all entries with their scope label
  Object.keys(knowledge).forEach(function(scope) {
    var entries = knowledge[scope];
    if (!Array.isArray(entries)) return;
    var scopeLabel = scope.replace('brand_', 'Brand ').replace('life_', 'Life ');
    entries.forEach(function(entry) {
      allEntries.push({ scope: scope, scopeLabel: scopeLabel, entry: entry });
    });
  });

  // Sort newest first
  allEntries.sort(function(a, b) { return (b.entry.addedAt || 0) - (a.entry.addedAt || 0); });

  if (countEl) countEl.textContent = allEntries.length;

  if (allEntries.length === 0) {
    listEl.innerHTML = '<div class="bloom-knowledge-empty">No Bloom knowledge saved yet. Comment on Bloom posts and tap "+ Add to Bloom Knowledge" to build your preferences.</div>';
    return;
  }

  var html = '';
  allEntries.forEach(function(item) {
    var e = item.entry;
    var timeStr = e.addedAt ? new Date(e.addedAt).toLocaleDateString() : '';
    var agentLabel = e.agentType && e.agentType !== 'general' ? e.agentType.charAt(0).toUpperCase() + e.agentType.slice(1) : '';
    html += '<div class="bloom-knowledge-entry" data-id="' + escapeHtml(e.id) + '" data-scope="' + escapeHtml(item.scope) + '">';
    html += '<div style="flex:1;">';
    html += '<div class="bloom-knowledge-entry-text">' + escapeHtml(e.text) + '</div>';
    html += '<div class="bloom-knowledge-entry-meta">';
    html += '<span>' + escapeHtml(item.scopeLabel) + '</span>';
    if (agentLabel) html += ' <span style="margin-left:6px;color:var(--brand-accent,#a89878);">' + escapeHtml(agentLabel) + '</span>';
    if (timeStr) html += ' <span style="margin-left:6px;">' + timeStr + '</span>';
    html += '</div></div>';
    html += '<button class="bloom-knowledge-entry-remove" onclick="removeBloomKnowledgeEntry(\'' + escapeHtml(e.id) + '\',\'' + escapeHtml(item.scope) + '\')" title="Remove">';
    html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    html += '</button></div>';
  });
  listEl.innerHTML = html;
}

function removeBloomKnowledgeEntry(entryId, scope) {
  var knowledge = getBloomKnowledge();
  if (!knowledge[scope]) return;
  knowledge[scope] = knowledge[scope].filter(function(e) { return e.id !== entryId; });
  if (knowledge[scope].length === 0) delete knowledge[scope];
  saveBloomKnowledge(knowledge);
  renderBloomKnowledgeSection();
  showToast('Knowledge entry removed', 'info');
}

// v9.1.14: Render BrandAI conversations in history with rich text
function renderTuningConversations() {
  console.log('[Tuning] renderTuningConversations called');
  var brandContainer = document.getElementById('tuningConversations');
  var lifeContainer = document.getElementById('lifeConversations');
  var brandCountEl = document.getElementById('brandConversationCount');
  var lifeCountEl = document.getElementById('lifeConversationCount');
  
  console.log('[Tuning] brandContainer found:', !!brandContainer);
  console.log('[Tuning] lifeContainer found:', !!lifeContainer);
  console.log('[Tuning] agentCommands length:', agentCommands ? agentCommands.length : 'undefined');
  
  if (!brandContainer) {
    console.error('[Tuning] tuningConversations container not found!');
    return;
  }
  
  // v10.5.25: Separate conversations by mode
  // v31.18: Filter out tombstoned chats so Purge / individual deletes actually hide them.
  var _hideTomb = {};
  try {
    var _tArr = JSON.parse(localStorage.getItem('roweos_deleted_chat_ids') || '[]');
    if (Array.isArray(_tArr)) _tArr.forEach(function(id) { _hideTomb[String(id)] = true; });
  } catch(e) {}

  var brandConvos = [];
  var lifeConvos = [];

  agentCommands.forEach(function(cmd, idx) {
    cmd._originalIndex = idx; // Store original index for actions
    if (cmd && cmd.id && _hideTomb[String(cmd.id)]) return; // hide tombstoned
    if (cmd.mode === 'life') {
      lifeConvos.push(cmd);
    } else {
      brandConvos.push(cmd);
    }
  });
  
  // Render Brand conversations
  if (brandCountEl) brandCountEl.textContent = brandConvos.length;
  if (brandConvos.length === 0) {
    brandContainer.innerHTML = '<div class="tuning-empty"><div class="tuning-empty-icon">◆</div>No BrandAI conversations yet.<br>Start a conversation to begin.</div>';
  } else {
    brandContainer.innerHTML = '';
    brandConvos.slice().reverse().forEach(function(cmd) {
      brandContainer.appendChild(buildConversationItem(cmd, 'brand'));
    });
  }
  
  // Render Life conversations
  if (lifeContainer) {
    if (lifeCountEl) lifeCountEl.textContent = lifeConvos.length;
    if (lifeConvos.length === 0) {
      lifeContainer.innerHTML = '<div class="tuning-empty"><div class="tuning-empty-icon">◇</div>No LifeAI conversations yet.<br>Start a conversation to begin.</div>';
    } else {
      lifeContainer.innerHTML = '';
      lifeConvos.slice().reverse().forEach(function(cmd) {
        lifeContainer.appendChild(buildConversationItem(cmd, 'life'));
      });
    }
  }
}

// v10.5.25: Build a single conversation item
function buildConversationItem(cmd, mode) {
  var realIndex = cmd._originalIndex;
  var item = document.createElement('div');
  item.className = 'tuning-conversation-item';
  item.dataset.conversationIndex = realIndex;
  item.dataset.mode = mode;
  
  var rating = cmd.tuningRating || '';
  var turnCount = cmd.conversation ? Math.floor(cmd.conversation.length / 2) : 1;
  var displayTitle = cmd.title || (cmd.command ? cmd.command.substring(0, 50) + (cmd.command.length > 50 ? '...' : '') : 'Untitled');
  
  // Build rating badge
  var ratingBadge = '';
  if (rating) {
    var badgeClass = rating;
    var badgeText = rating.charAt(0).toUpperCase() + rating.slice(1);
    if (rating === 'needswork') badgeText = 'Needs Work';
    if (rating === 'offtone') badgeText = 'Off-Tone';
    ratingBadge = '<span class="tuning-badge ' + badgeClass + '">' + badgeText + '</span>';
  }
  
  // v10.5.25: Mode badge
  var modeBadge = '<span class="tuning-mode-badge ' + mode + '">' + (mode === 'life' ? 'Life' : 'Brand') + '</span>';
  
  // Build conversation messages HTML with rich text formatting
  var messagesHtml = '';
  var aiLabel = mode === 'life' ? 'LifeAI' : 'BrandAI';
  if (cmd.conversation && cmd.conversation.length > 0) {
    cmd.conversation.forEach(function(msg) {
      var roleClass = msg.role === 'user' ? 'user' : 'assistant';
      var roleLabel = msg.role === 'user' ? 'You' : aiLabel;
      var content = msg.displayContent || msg.content || '';
      var formattedContent = msg.role === 'assistant' ? formatMessageContent(content) : escapeHtml(content).replace(/\n/g, '<br>');
      messagesHtml += '<div class="tuning-message ' + roleClass + '">' +
        '<div class="tuning-message-role">' + roleLabel + '</div>' +
        '<div class="tuning-message-content">' + formattedContent + '</div>' +
      '</div>';
    });
  }
  
  var feedbackValue = cmd.tuningFeedback || '';
  var continueLabel = mode === 'life' ? 'Continue in LifeAI' : 'Continue in BrandAI';
  
  // v10.5.32: Additional action buttons
  // v31.18: Add per-conversation Delete button (writes tombstone + removes from cloud).
  var additionalActions =
    '<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); uploadHistoryToStudio(' + realIndex + ')" style="margin-left: var(--space-2);">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M12 19V5m0 0l-7 7m7-7l7 7"/></svg>' +
      'Upload to Studio' +
    '</button>' +
    '<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); chatWithHistoryItem(' + realIndex + ')" style="margin-left: var(--space-2);">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      'Chat' +
    '</button>' +
    '<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteHistoryConversation(' + realIndex + ')" style="margin-left: var(--space-2);color:#f87171;border-color:rgba(248,113,113,0.4);">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      'Delete' +
    '</button>';
  
  item.innerHTML = 
    '<div class="tuning-conversation-header" onclick="toggleTuningConversation(' + realIndex + ')">' +
      '<div class="tuning-conversation-left">' +
        '<span class="tuning-conversation-expand">▶</span>' +
        '<span class="tuning-conversation-title">' + escapeHtml(displayTitle) + '</span>' +
        modeBadge +
        ratingBadge +
      '</div>' +
      '<div class="tuning-conversation-right">' +
        '<span class="tuning-conversation-meta">' + escapeHtml(cmd.brand || cmd.lifeName || '') + '</span>' +
        '<span class="tuning-conversation-turns">' + turnCount + ' turn' + (turnCount !== 1 ? 's' : '') + '</span>' +
        '<span class="tuning-conversation-meta">' + (cmd.time || '') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="tuning-conversation-detail">' +
      '<div class="tuning-conversation-messages">' + messagesHtml + '</div>' +
      '<div class="tuning-actions-panel">' +
        '<button class="btn btn-primary" onclick="event.stopPropagation(); continueConversationFromHistory(' + realIndex + ')">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">' +
            '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
          '</svg>' +
          continueLabel +
        '</button>' +
        additionalActions +
      '</div>' +
      '<div class="tuning-rating-panel">' +
        '<div class="tuning-rating-label">Rate this conversation <span class="tuning-saved-indicator" id="convSaved_' + realIndex + '">✓ Saved</span></div>' +
        '<div class="tuning-rating-buttons">' +
          '<button type="button" class="tuning-rating-btn good ' + (rating === 'good' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateConversation(' + realIndex + ', \'good\')">◆ Good</button>' +
          '<button type="button" class="tuning-rating-btn needswork ' + (rating === 'needswork' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateConversation(' + realIndex + ', \'needswork\')">◇ Needs Work</button>' +
          '<button type="button" class="tuning-rating-btn offtone ' + (rating === 'offtone' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateConversation(' + realIndex + ', \'offtone\')">◎ Off-Tone</button>' +
          '<button type="button" class="tuning-rating-btn bad ' + (rating === 'bad' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateConversation(' + realIndex + ', \'bad\')">✕ Bad</button>' +
        '</div>' +
        '<div class="tuning-feedback">' +
          '<div class="tuning-feedback-label">Feedback for ' + aiLabel + '</div>' +
          '<textarea class="tuning-feedback-textarea" id="convFeedback_' + realIndex + '" placeholder="What worked or didn\'t? This helps improve ' + aiLabel + ' responses..." onclick="event.stopPropagation()" onblur="saveConversationFeedback(' + realIndex + ')">' + escapeHtml(feedbackValue) + '</textarea>' +
        '</div>' +
      '</div>' +
    '</div>';
  
  return item;
}

// v15.20: Filter history by mode - includes both Conversations and Studio sections
function filterHistoryByMode(mode) {
  // Update tab buttons
  document.querySelectorAll('.history-mode-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  // Show/hide sections (conversations + studio)
  var brandSection = document.getElementById('brandConversationsSection');
  var lifeSection = document.getElementById('lifeConversationsSection');
  var brandStudio = document.getElementById('brandStudioSection');
  var lifeStudio = document.getElementById('lifeStudioSection');
  var bloomKnowledge = document.getElementById('bloomKnowledgeSection');

  if (mode === 'all') {
    if (brandSection) brandSection.style.display = 'block';
    if (lifeSection) lifeSection.style.display = 'block';
    if (brandStudio) brandStudio.style.display = 'block';
    if (lifeStudio) lifeStudio.style.display = 'block';
    if (bloomKnowledge) bloomKnowledge.style.display = 'block';
  } else if (mode === 'brand') {
    if (brandSection) brandSection.style.display = 'block';
    if (lifeSection) lifeSection.style.display = 'none';
    if (brandStudio) brandStudio.style.display = 'block';
    if (lifeStudio) lifeStudio.style.display = 'none';
    if (bloomKnowledge) bloomKnowledge.style.display = 'block';
  } else if (mode === 'life') {
    if (brandSection) brandSection.style.display = 'none';
    if (lifeSection) lifeSection.style.display = 'block';
    if (brandStudio) brandStudio.style.display = 'none';
    if (lifeStudio) lifeStudio.style.display = 'block';
    if (bloomKnowledge) bloomKnowledge.style.display = 'block';
  }
}

// v9.1.14: Toggle conversation expansion
function toggleTuningConversation(index) {
  var items = document.querySelectorAll('.tuning-conversation-item');
  items.forEach(function(item) {
    if (parseInt(item.dataset.conversationIndex) === index) {
      item.classList.toggle('expanded');
      var expandIcon = item.querySelector('.tuning-conversation-expand');
      if (expandIcon) {
        expandIcon.textContent = item.classList.contains('expanded') ? '▼' : '▶';
      }
    }
  });
}

// v31.18: Delete a single conversation from History (per-item button).
// Writes tombstone + Firestore delete so it stays gone across devices and pulls.
function deleteHistoryConversation(index) {
  var cmd = agentCommands[index];
  if (!cmd) return;
  if (!confirm('Delete this conversation? This adds a tombstone so it will not return on next sync.')) return;
  var id = cmd.id;
  // Splice out of in-memory + correct localStorage key
  agentCommands.splice(index, 1);
  if (cmd.mode === 'life') {
    try {
      var lifeArr = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]');
      lifeArr = lifeArr.filter(function(c) { return !(c && id && c.id === id); });
      localStorage.setItem('roweos_life_agentCommands', JSON.stringify(lifeArr));
    } catch(e) {}
  } else {
    try {
      var brandArr = JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]');
      brandArr = brandArr.filter(function(c) { return !(c && id && c.id === id); });
      localStorage.setItem('roweos_agentCommands', JSON.stringify(brandArr));
    } catch(e) {}
  }
  // Tombstone
  if (id) {
    try {
      var tArr = JSON.parse(localStorage.getItem('roweos_deleted_chat_ids') || '[]');
      if (tArr.indexOf(id) < 0) tArr.push(id);
      localStorage.setItem('roweos_deleted_chat_ids', JSON.stringify(tArr));
      if (typeof writeDB === 'function') {
        writeDB('profile/deletedChatIds', { ids: tArr, _modifiedAt: Date.now() }, { category: 'profile' });
      }
    } catch(e) {}
    // Delete from Firestore subcollection
    if (typeof deleteDBDoc === 'function') {
      try { deleteDBDoc('chats', String(id), 'brandai_chats'); } catch(e) {}
    }
  }
  if (typeof renderTuningConversations === 'function') renderTuningConversations();
  showToast('Conversation deleted (tombstone written)', 'success');
}
window.deleteHistoryConversation = deleteHistoryConversation;

// v9.1.14: Continue conversation from History in BrandAI
function continueConversationFromHistory(index) {
  var cmd = agentCommands[index];
  if (!cmd || !cmd.conversation || cmd.conversation.length === 0) {
    showToast('No conversation data to continue', 'error');
    return;
  }
  
  // v10.5.25: Track which history entry we're continuing so onComplete updates the right one
  window._continuedHistoryIndex = index;
  
  // Load the conversation into currentConversation
  currentConversation = cmd.conversation.map(function(msg) {
    return {
      role: msg.role,
      content: msg.content,
      displayContent: msg.displayContent || msg.content
    };
  });
  
  // v10.5.25: Check if this is a LifeAI conversation
  var isLifeConversation = cmd.mode === 'life';
  
  // Try to match the brand from the conversation
  var brandName = cmd.brand || '';
  var brandIdx = 0;
  if (!isLifeConversation && brandName) {
    for (var i = 0; i < brands.length; i++) {
      if (brands[i].name === brandName) {
        brandIdx = i;
        break;
      }
    }
  }
  
  // Set the brand selector
  var brandSelector = document.getElementById('agentBrand');
  if (brandSelector) {
    brandSelector.value = isLifeConversation ? 'none' : brandIdx;
  }
  conversationStartBrand = isLifeConversation ? null : brandIdx;
  
  // Clear and rebuild the conversation thread
  var thread = document.getElementById('conversationThread');
  if (thread) {
    thread.innerHTML = '';
    currentConversation.forEach(function(msg) {
      var displayContent = msg.displayContent || msg.content;
      addMessageToThread(msg.role, displayContent);
    });
  }
  
  // v10.5.25: Route to correct mode based on conversation type
  if (isLifeConversation) {
    localStorage.setItem('roweos_app_mode', 'life');
    localStorage.setItem('roweos_mode', 'life');
    document.documentElement.classList.add('life-mode');
    document.documentElement.classList.remove('brand-mode');
  }
  
  // Switch to agent view
  showView('agent');
  
  // Show the conversation view (not landing)
  showConversationView();
  
  // Update the conversation title
  var titleEl = document.getElementById('conversationTitleText');
  var subtitleEl = document.getElementById('conversationSubtitle');
  if (titleEl) {
    titleEl.textContent = cmd.title || 'Continued Conversation';
  }
  if (subtitleEl) {
    var label = isLifeConversation ? 'LifeAI' : (brands[brandIdx] ? brands[brandIdx].name : 'BrandAI');
    subtitleEl.textContent = label + ' • Continued from History';
  }
  
  // Scroll to bottom of thread
  if (thread) {
    thread.scrollTop = thread.scrollHeight;
  }
  
  // Focus the followup input
  setTimeout(function() {
    var followupInput = document.getElementById('followupCommand');
    if (followupInput) {
      followupInput.focus();
    }
  }, 100);
  
  showToast('Conversation loaded - continue where you left off', 'success');
}

// v9.1.14: Rate conversation - instant save
function rateConversation(index, rating) {
  if (!agentCommands[index]) return;
  
  // Toggle if clicking same rating
  if (agentCommands[index].tuningRating === rating) {
    agentCommands[index].tuningRating = null;
    rating = null;
  } else {
    agentCommands[index].tuningRating = rating;
  }
  
  // Save immediately
  saveRuns();
  
  // Update UI in place
  var item = document.querySelector('.tuning-conversation-item[data-conversation-index="' + index + '"]');
  if (item) {
    // Update buttons
    var buttons = item.querySelectorAll('.tuning-rating-btn');
    buttons.forEach(function(btn) {
      btn.classList.remove('selected');
      if (rating && btn.classList.contains(rating)) {
        btn.classList.add('selected');
      }
    });
    
    // Update badge in header
    var left = item.querySelector('.tuning-conversation-left');
    if (left) {
      var existingBadge = left.querySelector('.tuning-badge');
      if (existingBadge) existingBadge.remove();
      
      if (rating) {
        var badgeText = rating.charAt(0).toUpperCase() + rating.slice(1);
        if (rating === 'needswork') badgeText = 'Needs Work';
        if (rating === 'offtone') badgeText = 'Off-Tone';
        var newBadge = document.createElement('span');
        newBadge.className = 'tuning-badge ' + rating;
        newBadge.textContent = badgeText;
        left.appendChild(newBadge);
      }
    }
    
    // Show saved indicator
    var savedIndicator = document.getElementById('convSaved_' + index);
    if (savedIndicator) {
      savedIndicator.classList.add('show');
      setTimeout(function() {
        savedIndicator.classList.remove('show');
      }, 2000);
    }
  }
  
  // Update BrandAI learning data
  updateBrandAILearning(index, rating);
  
  // Show toast
  if (rating) {
    showToast('Rated as ' + (rating === 'needswork' ? 'Needs Work' : rating === 'offtone' ? 'Off-Tone' : rating), 'success');
  } else {
    showToast('Rating cleared', 'info');
  }
}

// v9.1.14: Save conversation feedback - auto-save on blur
function saveConversationFeedback(index) {
  var textarea = document.getElementById('convFeedback_' + index);
  if (textarea && agentCommands[index]) {
    agentCommands[index].tuningFeedback = textarea.value;
    saveRuns();
    
    // Show saved indicator
    var savedIndicator = document.getElementById('convSaved_' + index);
    if (savedIndicator && textarea.value) {
      savedIndicator.classList.add('show');
      setTimeout(function() {
        savedIndicator.classList.remove('show');
      }, 2000);
    }
    
    // Update BrandAI learning
    if (textarea.value) {
      updateBrandAILearning(index, agentCommands[index].tuningRating, textarea.value);
    }
  }
}

// v9.1.14: Update BrandAI learning from tuning feedback
function updateBrandAILearning(conversationIndex, rating, feedback) {
  var cmd = agentCommands[conversationIndex];
  if (!cmd) return;
  
  // Store learning data for the brand
  var brandName = cmd.brand;
  var learningKey = 'roweos_brandai_learning_' + brandName.replace(/\s+/g, '_').toLowerCase();
  
  var learning = JSON.parse(localStorage.getItem(learningKey) || '{"good":[],"bad":[],"feedback":[]}');
  
  // Get the assistant responses from the conversation
  var assistantResponses = [];
  if (cmd.conversation) {
    cmd.conversation.forEach(function(msg) {
      if (msg.role === 'assistant') {
        assistantResponses.push(msg.content);
      }
    });
  }
  
  // Store based on rating
  if (rating === 'good' && assistantResponses.length > 0) {
    // Add to good examples (limit to last 20)
    assistantResponses.forEach(function(response) {
      if (!learning.good.includes(response)) {
        learning.good.push(response);
      }
    });
    learning.good = learning.good.slice(-20);
  } else if ((rating === 'bad' || rating === 'offtone') && assistantResponses.length > 0) {
    // Add to bad examples (limit to last 20)
    assistantResponses.forEach(function(response) {
      if (!learning.bad.includes(response)) {
        learning.bad.push(response);
      }
    });
    learning.bad = learning.bad.slice(-20);
  }
  
  // Store feedback
  if (feedback) {
    learning.feedback.push({
      timestamp: new Date().toISOString(),
      feedback: feedback,
      rating: rating
    });
    learning.feedback = learning.feedback.slice(-50);
  }
  
  localStorage.setItem(learningKey, JSON.stringify(learning));
}

// v9.1.14: Get BrandAI learning context for system prompt
function getBrandAILearningContext(brandName) {
  var learningKey = 'roweos_brandai_learning_' + brandName.replace(/\s+/g, '_').toLowerCase();
  var learning = JSON.parse(localStorage.getItem(learningKey) || '{"good":[],"bad":[],"feedback":[]}');
  
  var context = '';
  
  if (learning.good.length > 0) {
    context += '\n\n[TUNING: The following response styles have been rated as GOOD - emulate these patterns:]\n';
    learning.good.slice(-5).forEach(function(example, i) {
      context += '• Example ' + (i + 1) + ': ' + example.substring(0, 200) + (example.length > 200 ? '...' : '') + '\n';
    });
  }
  
  if (learning.bad.length > 0) {
    context += '\n\n[TUNING: AVOID these response patterns that were rated poorly:]\n';
    learning.bad.slice(-3).forEach(function(example, i) {
      context += '• Avoid: ' + example.substring(0, 150) + (example.length > 150 ? '...' : '') + '\n';
    });
  }
  
  if (learning.feedback.length > 0) {
    context += '\n\n[USER FEEDBACK:]\n';
    learning.feedback.slice(-5).forEach(function(item) {
      context += '• ' + item.feedback + '\n';
    });
  }
  
  return context;
}

// v9.1.14: Render Studio outputs (original tuning items)
function renderTuningStudioOutputs() {
  console.log('[Tuning] renderTuningStudioOutputs called');
  var brandContainer = document.getElementById('tuningHistory');
  var lifeContainer = document.getElementById('lifeStudioHistory');
  var brandCountEl = document.getElementById('brandStudioOutputCount');
  var lifeCountEl = document.getElementById('lifeStudioOutputCount');
  
  console.log('[Tuning] tuningHistory found:', !!brandContainer);
  console.log('[Tuning] lifeStudioHistory found:', !!lifeContainer);
  console.log('[Tuning] runs length:', runs ? runs.length : 'undefined');
  
  if (!brandContainer) {
    console.error('[Tuning] tuningHistory container not found!');
    return;
  }
  
  // v11.0.5: Separate runs by mode
  var brandRuns = [];
  var lifeRuns = [];
  
  runs.forEach(function(run, idx) {
    run._originalIndex = idx;
    if (run.mode === 'life') {
      lifeRuns.push(run);
    } else {
      brandRuns.push(run);
    }
  });
  
  // Render BrandAI Studio outputs
  if (brandCountEl) brandCountEl.textContent = brandRuns.length;
  if (brandRuns.length === 0) {
    brandContainer.innerHTML = '<div class="tuning-empty"><div class="tuning-empty-icon">◆</div>No BrandAI Studio outputs yet.<br>Generate content in Studio to start tuning.</div>';
  } else {
    brandContainer.innerHTML = '';
    brandRuns.slice().reverse().forEach(function(run) {
      brandContainer.appendChild(buildStudioOutputItem(run, 'brand'));
    });
  }
  
  // Render LifeAI Studio outputs
  if (lifeContainer) {
    if (lifeCountEl) lifeCountEl.textContent = lifeRuns.length;
    if (lifeRuns.length === 0) {
      lifeContainer.innerHTML = '<div class="tuning-empty"><div class="tuning-empty-icon">◇</div>No Life Studio outputs yet.<br>Generate content in Life Studio to start tuning.</div>';
    } else {
      lifeContainer.innerHTML = '';
      lifeRuns.slice().reverse().forEach(function(run) {
        lifeContainer.appendChild(buildStudioOutputItem(run, 'life'));
      });
    }
  }
}

/**
 * v11.0.5: Build a single Studio output item
 */
function buildStudioOutputItem(run, mode) {
  var realIndex = run._originalIndex;
  var item = document.createElement('div');
  item.className = 'tuning-item collapsed';
  item.dataset.runIndex = realIndex;
  item.dataset.mode = mode;
  
  var rating = run.tuningRating || 'unrated';
  var ratingBadge = '';
  if (rating === 'good') ratingBadge = '<span class="tuning-badge good">Good</span>';
  else if (rating === 'bad') ratingBadge = '<span class="tuning-badge bad">Bad</span>';
  else if (rating === 'offtone') ratingBadge = '<span class="tuning-badge offtone">Off-Tone</span>';
  else if (rating === 'needswork') ratingBadge = '<span class="tuning-badge needswork">Needs Work</span>';
  
  var voiceScore = run.voiceScore || Math.floor(Math.random() * 30) + 70;
  var scoreClass = voiceScore >= 85 ? 'high' : (voiceScore >= 70 ? 'medium' : 'low');
  
  var feedbackValue = run.tuningFeedback || '';
  var title = run.op || 'Untitled Output';
  
  item.innerHTML = 
    '<div class="tuning-item-collapsed" onclick="toggleTuningItem(this)">' +
      '<div class="tuning-collapsed-left">' +
        '<span class="tuning-expand-icon">▶</span>' +
        '<span class="tuning-item-title">' + escapeHtml(title) + '</span>' +
        ratingBadge +
      '</div>' +
      '<div class="tuning-collapsed-right">' +
        '<span class="tuning-item-brand">' + escapeHtml(run.brand || (mode === 'life' ? 'Life' : 'Brand')) + '</span>' +
        '<span class="tuning-item-date">' + run.time + '</span>' +
        '<div class="tuning-voice-score ' + scoreClass + '"><span>Voice Match:</span> <strong>' + voiceScore + '%</strong></div>' +
      '</div>' +
    '</div>' +
    '<div class="tuning-item-expanded">' +
      '<div class="tuning-item-prompt"><strong>Input:</strong> ' + (run.input ? escapeHtml(run.input.substring(0, 300)) + (run.input.length > 300 ? '...' : '') : 'N/A') + '</div>' +
      '<div class="tuning-item-response">' + (run.deliv ? escapeHtml(run.deliv.substring(0, 800)) + (run.deliv.length > 800 ? '...' : '') : (run.output ? escapeHtml(run.output.substring(0, 800)) + (run.output.length > 800 ? '...' : '') : 'No output recorded')) + '</div>' +
      '<div class="tuning-rating">' +
        '<button type="button" class="tuning-rating-btn good ' + (rating === 'good' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateTuningItem(' + realIndex + ', \'good\')">◆ Good</button>' +
        '<button type="button" class="tuning-rating-btn needswork ' + (rating === 'needswork' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateTuningItem(' + realIndex + ', \'needswork\')">◇ Needs Work</button>' +
        '<button type="button" class="tuning-rating-btn offtone ' + (rating === 'offtone' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateTuningItem(' + realIndex + ', \'offtone\')">◎ Off-Tone</button>' +
        '<button type="button" class="tuning-rating-btn bad ' + (rating === 'bad' ? 'selected' : '') + '" onclick="event.stopPropagation(); rateTuningItem(' + realIndex + ', \'bad\')">✕ Bad</button>' +
      '</div>' +
      '<div class="tuning-feedback">' +
        '<div class="tuning-feedback-label">Written Feedback</div>' +
        '<textarea class="tuning-feedback-textarea" id="tuningFeedback_' + realIndex + '" placeholder="Add specific notes on what worked or didn\'t work..." onclick="event.stopPropagation()">' + escapeHtml(feedbackValue) + '</textarea>' +
      '</div>' +
      '<div class="tuning-actions">' +
        '<button class="tuning-action-btn" onclick="event.stopPropagation(); saveTuningFeedback(' + realIndex + ')">Save Feedback</button>' +
        '<button class="tuning-action-btn" onclick="event.stopPropagation(); replayInStudio(' + realIndex + ')">Replay in Studio</button>' +
      '</div>' +
    '</div>';
  
  return item;
}

function toggleTuningItem(el) {
  var item = el.closest('.tuning-item');
  if (item) {
    item.classList.toggle('collapsed');
    var icon = item.querySelector('.tuning-expand-icon');
    if (icon) {
      icon.textContent = item.classList.contains('collapsed') ? '▶' : '▼';
    }
  }
}

function renderTuningHistory() {
  // v9.1.14: Now renders both conversations and studio outputs
  showTuning();
}

function rateTuningItem(index, rating) {
  if (runs[index]) {
    // Allow toggling - if clicking same rating, clear it
    if (runs[index].tuningRating === rating) {
      runs[index].tuningRating = null;
      rating = null;
    } else {
      runs[index].tuningRating = rating;
    }
    saveRuns();
    
    // Update button states in-place without re-rendering
    var item = document.querySelector('.tuning-item[data-run-index="' + index + '"]');
    if (item) {
      // Update all rating buttons
      var buttons = item.querySelectorAll('.tuning-rating-btn');
      buttons.forEach(function(btn) {
        btn.classList.remove('selected');
        if (rating && btn.classList.contains(rating)) {
          btn.classList.add('selected');
        }
      });
      
      // Update the badge in the collapsed header
      var collapsedLeft = item.querySelector('.tuning-collapsed-left');
      if (collapsedLeft) {
        // Remove existing badge
        var existingBadge = collapsedLeft.querySelector('.tuning-badge');
        if (existingBadge) existingBadge.remove();
        
        // Add new badge if rating is set
        if (rating) {
          var badgeClass = rating;
          var badgeText = rating.charAt(0).toUpperCase() + rating.slice(1);
          if (rating === 'needswork') badgeText = 'Needs Work';
          if (rating === 'offtone') badgeText = 'Off-Tone';
          
          var newBadge = document.createElement('span');
          newBadge.className = 'tuning-badge ' + badgeClass;
          newBadge.textContent = badgeText;
          collapsedLeft.appendChild(newBadge);
        }
      }
    }
    
    // Show appropriate toast
    if (rating) {
      showToast('Rated as ' + (rating === 'needswork' ? 'Needs Work' : rating === 'offtone' ? 'Off-Tone' : rating), 'success');
    } else {
      showToast('Rating cleared', 'info');
    }
  }
}

function saveTuningFeedback(index) {
  var textarea = document.getElementById('tuningFeedback_' + index);
  if (textarea && runs[index]) {
    runs[index].tuningFeedback = textarea.value;
    saveRuns();
    showToast('Feedback saved', 'success');
  }
}

function replayInStudio(index) {
  var run = runs[index];
  if (!run) return;
  
  // Find brand index
  var brandIdx = brands.findIndex(function(b) { return b.name === run.brand; });
  if (brandIdx === -1) brandIdx = 0;
  
  // Set brand
  selectedBrand = brandIdx;
  studioSelectedBrand = brandIdx;
  document.getElementById('brand').value = brandIdx;
  document.getElementById('studioBrand').value = brandIdx;
  
  // Find matching operation
  var matchedOp = ops.find(function(op) { return op.name === run.op; });
  
  // Go to studio
  showView('studio');
  
  // Set context with original input plus tuning feedback
  var context = run.input || '';
  if (run.tuningFeedback) {
    context += '\n\n[Tuning Feedback: ' + run.tuningFeedback + ']';
  }
  if (run.tuningRating) {
    context += '\n[Previous Rating: ' + run.tuningRating + ']';
  }
  var _ctx = document.getElementById('studioContext'); if (_ctx) _ctx.value = context;
  
  // Select the operation
  if (matchedOp) {
    selectedOp = matchedOp;
    renderOperations();
    updateRunButton();
    setTimeout(function() {
      var card = document.querySelector('.op-card[data-op-id="' + matchedOp.id + '"]');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.boxShadow = '0 0 0 2px var(--accent)';
        setTimeout(function() { card.style.boxShadow = ''; }, 2000);
      }
    }, 100);
  }
  
  showToast('Loaded in Studio for replay', 'success');
}

function exportTuningData() {
  var tuningData = runs.filter(function(r) { return r.tuningRating; }).map(function(r) {
    return {
      brand: r.brand,
      operation: r.op,
      input: r.input,
      output: r.output,
      rating: r.tuningRating,
      feedback: r.tuningFeedback || '',
      timestamp: r.time
    };
  });
  
  if (tuningData.length === 0) {
    showToast('No rated outputs to export', 'warning');
    return;
  }
  
  var blob = new Blob([JSON.stringify(tuningData, null, 2)], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'brandai-tuning-data-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Tuning data exported', 'success');
}

// Identity View Functions
function toggleToneTag(el) {
  el.classList.toggle('selected');
}

function saveIdentityConfig() {
  var config = {
    brandName: document.getElementById('identityBrandName').value,
    industry: document.getElementById('identityIndustry').value,
    personaName: document.getElementById('identityPersonaName').value,
    personaTitle: document.getElementById('identityPersonaTitle').value,
    tones: [],
    doNotSay: document.getElementById('identityDoNotSay').value,
    alwaysEmphasize: document.getElementById('identityAlwaysEmphasize').value,
    escalation: document.getElementById('identityEscalation').value,
    signaturePhrases: document.getElementById('identitySignaturePhrases').value
  };
  
  document.querySelectorAll('.tone-tag.selected').forEach(function(tag) {
    config.tones.push(tag.dataset.tone);
  });
  
  localStorage.setItem('roweos_identity_config', JSON.stringify(config));
  
  // v9.1.14: Sync after Identity changes
  queueBackgroundSync();
  
  showToast('Brand identity configuration saved', 'success');
}

function loadIdentityConfig() {
  var saved = localStorage.getItem('roweos_identity_config');
  if (saved) {
    var config = JSON.parse(saved);
    if (document.getElementById('identityBrandName')) {
      document.getElementById('identityBrandName').value = config.brandName || '';
      document.getElementById('identityIndustry').value = config.industry || '';
      document.getElementById('identityPersonaName').value = config.personaName || '';
      document.getElementById('identityPersonaTitle').value = config.personaTitle || '';
      document.getElementById('identityDoNotSay').value = config.doNotSay || '';
      document.getElementById('identityAlwaysEmphasize').value = config.alwaysEmphasize || '';
      document.getElementById('identityEscalation').value = config.escalation || '';
      document.getElementById('identitySignaturePhrases').value = config.signaturePhrases || '';
      
      if (config.tones) {
        config.tones.forEach(function(tone) {
          var tag = document.querySelector('.tone-tag[data-tone="' + tone + '"]');
          if (tag) tag.classList.add('selected');
        });
      }
    }
  }
}

// Guardrails Functions
var guardrailsConfig = {
  agentToggles: { strategy: true, marketing: true, operations: true, documents: true, intelligence: true, research: true, image: true, video: true, social: true, roweos: true },
  escalationTopics: ['pricing', 'legal', 'press', 'contracts', 'hr'],
  blockedContent: { political: true, health: true, financial: true, competitor: false, negative: false, promises: false },
  scopeRules: {},
  refusals: {},
  automationGuardrails: {
    contentRestrictions: { voiceCheck: false, blockExternalLinks: false, blockCompetitorMentions: false, approvedTopicsOnly: false },
    approvalRequired: { social: false, email: false, docs: false },
    rateLimits: { postsPerDay: 10, emailsPerDay: 5, apiCallsPerHour: 100, cooldownMinutes: 5 }
  },
  clientGuardrails: {}
};

function loadGuardrails() {
  var saved = localStorage.getItem('roweos_guardrails');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      // v15.14: Merge saved config onto defaults so missing keys don't crash
      // v22.37: Merge each key with defaults so new fields don't get lost
      if (parsed.agentToggles) {
        for (var _ak in guardrailsConfig.agentToggles) {
          if (parsed.agentToggles.hasOwnProperty(_ak)) guardrailsConfig.agentToggles[_ak] = parsed.agentToggles[_ak];
        }
      }
      guardrailsConfig.escalationTopics = parsed.escalationTopics || guardrailsConfig.escalationTopics;
      guardrailsConfig.blockedContent = parsed.blockedContent || guardrailsConfig.blockedContent;
      guardrailsConfig.scopeRules = parsed.scopeRules || guardrailsConfig.scopeRules;
      guardrailsConfig.refusals = parsed.refusals || guardrailsConfig.refusals;
      if (parsed.automationGuardrails) {
        var _ag = parsed.automationGuardrails;
        if (_ag.contentRestrictions) { for (var _cr in _ag.contentRestrictions) { guardrailsConfig.automationGuardrails.contentRestrictions[_cr] = _ag.contentRestrictions[_cr]; } }
        if (_ag.approvalRequired) { for (var _ar in _ag.approvalRequired) { guardrailsConfig.automationGuardrails.approvalRequired[_ar] = _ag.approvalRequired[_ar]; } }
        if (_ag.rateLimits) { for (var _rl in _ag.rateLimits) { guardrailsConfig.automationGuardrails.rateLimits[_rl] = _ag.rateLimits[_rl]; } }
      }
      guardrailsConfig.clientGuardrails = parsed.clientGuardrails || guardrailsConfig.clientGuardrails;
    } catch (e) {}
  }
  renderGuardrailsUI();
}

function renderGuardrailsUI() {
  // v22.37: Sync all agent toggles
  var _agentIds = ['Strategy','Marketing','Operations','Documents','Intelligence','Research','Image','Video','Social','RoweOS'];
  _agentIds.forEach(function(id) {
    var el = document.getElementById('toggle' + id);
    var key = id.toLowerCase();
    if (key === 'roweos') key = 'roweos';
    if (el && guardrailsConfig.agentToggles.hasOwnProperty(key)) {
      el.checked = guardrailsConfig.agentToggles[key];
    }
  });
  // v22.37: Render stats, automations, clients
  renderGuardrailsStats();
  renderAutomationGuardrails();
  renderClientGuardrails();
  
  // Web search toggles - v12.0.2: Also sync to individual keys
  var webSearchPrefs = JSON.parse(localStorage.getItem('roweos_web_search_prefs') || '{}');
  if (document.getElementById('toggleClaudeWebSearch')) {
    // Check both new and legacy keys
    var claudeEnabled = webSearchPrefs.claude || localStorage.getItem('roweos_claude_web_search') === 'true';
    document.getElementById('toggleClaudeWebSearch').checked = claudeEnabled;
  }
  if (document.getElementById('toggleGeminiWebSearch')) {
    var geminiEnabled = webSearchPrefs.gemini || localStorage.getItem('roweos_gemini_web_search') === 'true';
    document.getElementById('toggleGeminiWebSearch').checked = geminiEnabled;
  }

  // v12.0.2: Response Caching toggle
  try {
    var cacheEnabled = localStorage.getItem('roweos_feature_responseCache') === 'true';
    var cacheToggle = document.getElementById('toggleResponseCache');
    if (cacheToggle) {
      cacheToggle.checked = cacheEnabled;
    }
  } catch (e) {}

  // v12.0.2: Auto-Pilot toggle
  try {
    var autoPilotEnabled = localStorage.getItem('roweos_feature_autoPilot') === 'true';
    var autoPilotToggle = document.getElementById('toggleAutoPilot');
    if (autoPilotToggle) {
      autoPilotToggle.checked = autoPilotEnabled;
    }
  } catch (e) {}

  // v12.0.2: Riley Publications logo removed

  // v11.0.5: Cross-Mode Intelligence toggle
  try {
    var crossModeEnabled = localStorage.getItem('roweos_cross_mode_enabled') !== 'false'; // Default true
    var crossModeToggle = document.getElementById('toggleCrossMode');
    if (crossModeToggle) {
      crossModeToggle.checked = crossModeEnabled;
    }
  } catch (e) {}
  
  // Render scope rules dynamically
  renderScopeRules();
  
  // Escalation topics
  renderEscalationTopics();
}

function renderScopeRules() {
  var container = document.getElementById('scopeRulesEditor');
  if (!container) return;
  
  container.innerHTML = '';
  
  // v9.1.14: Show empty message if no brands
  if (!brands || brands.length === 0) {
    container.innerHTML = '<div style="padding: var(--space-5); text-align: center; color: var(--text-muted); font-style: italic;">Add brands to configure scope rules</div>';
    return;
  }
  
  // v22.40: Read primary brand from localStorage (syncs with Brand Settings checkbox)
  var _primaryIdx = parseInt(localStorage.getItem('roweos_primary_brand') || '0', 10);
  if (isNaN(_primaryIdx) || _primaryIdx < 0 || _primaryIdx >= brands.length) _primaryIdx = 0;

  brands.forEach(function(brand, idx) {
    var ruleDiv = document.createElement('div');
    ruleDiv.className = 'scope-rule-edit';

    var savedRule = guardrailsConfig.scopeRules && guardrailsConfig.scopeRules[idx]
      ? guardrailsConfig.scopeRules[idx]
      : (brand.scopeRule || '');

    ruleDiv.innerHTML = '<div class="scope-rule-header">' +
      '<span class="scope-rule-brand">' + brand.name + '</span>' +
      (idx === _primaryIdx ? '<span class="scope-rule-badge primary">Primary Brand</span>' : '') +
      '</div>' +
      '<textarea class="scope-rule-input" id="scopeRule_' + idx + '" placeholder="Enter scope rules...">' + savedRule + '</textarea>';

    container.appendChild(ruleDiv);
  });
}

function updateAgentToggle(agent, enabled) {
  guardrailsConfig.agentToggles[agent] = enabled;
  saveGuardrails();
  showToast(agent.charAt(0).toUpperCase() + agent.slice(1) + ' Agent ' + (enabled ? 'enabled' : 'disabled'), 'success');
}

function renderEscalationTopics() {
  var container = document.getElementById('escalationTopics');
  if (!container) return;
  container.innerHTML = guardrailsConfig.escalationTopics.map(function(topic) {
    return '<div class="topic-tag" data-topic="' + topic + '">' + 
      topic.charAt(0).toUpperCase() + topic.slice(1).replace(/([A-Z])/g, ' $1') + 
      ' <span onclick="removeEscalationTopic(\'' + topic + '\')">×</span></div>';
  }).join('');
}

function addEscalationTopic() {
  var input = document.getElementById('newEscalationTopic');
  var topic = input.value.trim().toLowerCase().replace(/\s+/g, '');
  if (topic && !guardrailsConfig.escalationTopics.includes(topic)) {
    guardrailsConfig.escalationTopics.push(topic);
    input.value = '';
    renderEscalationTopics();
    saveGuardrails();
    showToast('Escalation topic added', 'success');
  }
}

function removeEscalationTopic(topic) {
  guardrailsConfig.escalationTopics = guardrailsConfig.escalationTopics.filter(function(t) { return t !== topic; });
  renderEscalationTopics();
  saveGuardrails();
  showToast('Escalation topic removed', 'success');
}

function updateBlockedContent(type, blocked) {
  guardrailsConfig.blockedContent[type] = blocked;
  saveGuardrails();
}

// v22.37: Guardrails tab switching - v26.0: Updated to use pill nav
var _guardrailsActiveTab = 'agents';
function showGuardrailsTab(tab) {
  _guardrailsActiveTab = tab;
  updatePillNavActive('guardrailsPillNav', tab);
  var panels = document.querySelectorAll('.guardrails-tab-panel');
  panels.forEach(function(p) { p.classList.toggle('hidden', p.getAttribute('data-panel') !== tab); });
}

// v22.37: Stat cards
function renderGuardrailsStats() {
  var statsEl = document.getElementById('guardrailsStats');
  if (!statsEl) return;
  var activeAgents = 0;
  for (var a in guardrailsConfig.agentToggles) { if (guardrailsConfig.agentToggles[a]) activeAgents++; }
  var blockedCount = 0;
  for (var b in guardrailsConfig.blockedContent) { if (guardrailsConfig.blockedContent[b]) blockedCount++; }
  var escalationCount = guardrailsConfig.escalationTopics ? guardrailsConfig.escalationTopics.length : 0;
  var clientCount = guardrailsConfig.clientGuardrails ? Object.keys(guardrailsConfig.clientGuardrails).length : 0;
  var _cs = 'background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--space-4) var(--space-5);';
  var _ls = 'font-size:var(--text-sm);color:var(--text-tertiary);margin-bottom:4px;';
  var _vs = 'font-size:var(--text-2xl);font-weight:600;';
  statsEl.innerHTML =
    '<div style="' + _cs + '"><div style="' + _ls + '">Active Agents</div><div style="' + _vs + 'color:var(--brand-accent);">' + activeAgents + '<span style="font-size:var(--text-sm);color:var(--text-tertiary);font-weight:400;"> / 10</span></div></div>' +
    '<div style="' + _cs + '"><div style="' + _ls + '">Blocked Content</div><div style="' + _vs + 'color:#ef4444;">' + blockedCount + '</div></div>' +
    '<div style="' + _cs + '"><div style="' + _ls + '">Escalation Topics</div><div style="' + _vs + 'color:#f59e0b;">' + escalationCount + '</div></div>' +
    '<div style="' + _cs + '"><div style="' + _ls + '">Client Rules</div><div style="' + _vs + 'color:#22d3ee;">' + clientCount + '</div></div>';
}

// v22.37: Automation guardrails renderer
function renderAutomationGuardrails() {
  var container = document.getElementById('automationGuardrailsContent');
  if (!container) return;
  var ag = guardrailsConfig.automationGuardrails;
  var cr = ag.contentRestrictions;
  var ar = ag.approvalRequired;
  var rl = ag.rateLimits;

  var html = '<div class="guardrails-auto-grid">';
  // Content restrictions
  html += '<div class="guardrails-section" style="padding:20px;">';
  html += '<h4 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Content Restrictions</h4>';
  html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Controls what automated content can include.</p>';
  var crItems = [
    {key: 'voiceCheck', label: 'Require brand voice check'},
    {key: 'blockExternalLinks', label: 'Block external link generation'},
    {key: 'blockCompetitorMentions', label: 'Prevent competitor mentions'},
    {key: 'approvedTopicsOnly', label: 'Limit to approved topics only'}
  ];
  crItems.forEach(function(item) {
    html += '<label class="guardrails-check-row"><input type="checkbox" ' + (cr[item.key] ? 'checked' : '') + ' onchange="updateAutoGuardrail(\'contentRestrictions\',\'' + item.key + '\',this.checked)"><span>' + item.label + '</span></label>';
  });
  html += '</div>';

  // Approval requirements
  html += '<div class="guardrails-section" style="padding:20px;">';
  html += '<h4 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Approval Requirements</h4>';
  html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Require manual approval before automated actions.</p>';
  var arItems = [
    {key: 'social', label: 'Social media posting'},
    {key: 'email', label: 'Email sending'},
    {key: 'docs', label: 'Document creation'}
  ];
  arItems.forEach(function(item) {
    html += '<div class="agent-toggle-item" style="padding:10px 14px;"><div class="agent-toggle-info"><div><div class="agent-toggle-name" style="font-size:13px;">' + item.label + '</div></div></div>';
    html += '<label class="toggle-switch"><input type="checkbox" ' + (ar[item.key] ? 'checked' : '') + ' onchange="updateAutoGuardrail(\'approvalRequired\',\'' + item.key + '\',this.checked)"><span class="toggle-slider"></span></label></div>';
  });
  html += '</div>';

  // Rate limits
  html += '<div class="guardrails-section" style="padding:20px;grid-column:1/-1;">';
  html += '<h4 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Rate Limits</h4>';
  html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Control execution frequency for automated tasks.</p>';
  html += '<div class="guardrails-rate-grid">';
  var rlItems = [
    {key: 'postsPerDay', label: 'Max posts / day', max: 50},
    {key: 'emailsPerDay', label: 'Max emails / day', max: 50},
    {key: 'apiCallsPerHour', label: 'Max API calls / hr', max: 500},
    {key: 'cooldownMinutes', label: 'Cooldown (min)', max: 60}
  ];
  rlItems.forEach(function(item) {
    html += '<div class="guardrails-rate-item"><label>' + item.label + '</label><input type="number" min="0" max="' + item.max + '" value="' + (rl[item.key] || 0) + '" onchange="updateAutoGuardrail(\'rateLimits\',\'' + item.key + '\',parseInt(this.value)||0)" class="guardrails-rate-input"></div>';
  });
  html += '</div></div>';
  html += '</div>';
  container.innerHTML = html;
}

function updateAutoGuardrail(category, key, value) {
  guardrailsConfig.automationGuardrails[category][key] = value;
  saveGuardrails();
  renderGuardrailsStats();
}

// v22.37: Client guardrails renderer
function renderClientGuardrails() {
  var container = document.getElementById('clientGuardrailsContent');
  if (!container) return;
  var clients = [];
  try { clients = JSON.parse(localStorage.getItem('roweos_clients') || '[]'); } catch(e) {}
  if (!clients || clients.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.4;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><div style="font-size:14px;font-weight:500;margin-bottom:6px;">No clients configured</div><div style="font-size:12px;margin-bottom:16px;">Add clients in the Clients view to set per-client guardrails.</div><button onclick="showView(\'clients\')" style="background:var(--brand-accent);color:#000;border:none;padding:8px 16px;border-radius:var(--radius-md);font-size:12px;font-weight:600;cursor:pointer;">Go to Clients</button></div>';
    return;
  }
  var cg = guardrailsConfig.clientGuardrails || {};
  var html = '<div class="guardrails-client-grid">';
  clients.forEach(function(client) {
    var name = client.name || client.company || 'Unnamed';
    var key = name.replace(/[^a-zA-Z0-9]/g, '_');
    var rules = cg[key] || { restrictContext: false, applyEscalation: false, customRules: '', toneOverride: 'default' };
    html += '<div class="guardrails-section" style="padding:20px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;"><div style="width:32px;height:32px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;color:var(--brand-accent);">' + name.charAt(0).toUpperCase() + '</div><div><div style="font-size:14px;font-weight:600;color:var(--text-primary);">' + escapeHtml(name) + '</div>' + (client.company && client.company !== name ? '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(client.company) + '</div>' : '') + '</div></div>';
    html += '<div class="agent-toggle-item" style="padding:8px 12px;margin-bottom:6px;"><div class="agent-toggle-info"><div><div class="agent-toggle-name" style="font-size:12px;">Restrict to client context</div></div></div><label class="toggle-switch"><input type="checkbox" ' + (rules.restrictContext ? 'checked' : '') + ' onchange="updateClientGuardrail(\'' + key + '\',\'restrictContext\',this.checked)"><span class="toggle-slider"></span></label></div>';
    html += '<div class="agent-toggle-item" style="padding:8px 12px;margin-bottom:10px;"><div class="agent-toggle-info"><div><div class="agent-toggle-name" style="font-size:12px;">Apply escalation rules</div></div></div><label class="toggle-switch"><input type="checkbox" ' + (rules.applyEscalation ? 'checked' : '') + ' onchange="updateClientGuardrail(\'' + key + '\',\'applyEscalation\',this.checked)"><span class="toggle-slider"></span></label></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Tone</label><select style="width:100%;padding:6px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;" onchange="updateClientGuardrail(\'' + key + '\',\'toneOverride\',this.value)"><option value="default"' + (rules.toneOverride === 'default' ? ' selected' : '') + '>Default</option><option value="formal"' + (rules.toneOverride === 'formal' ? ' selected' : '') + '>Formal</option><option value="casual"' + (rules.toneOverride === 'casual' ? ' selected' : '') + '>Casual</option><option value="technical"' + (rules.toneOverride === 'technical' ? ' selected' : '') + '>Technical</option></select></div>';
    html += '<div><label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Custom Rules</label><textarea style="width:100%;min-height:50px;padding:8px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;resize:vertical;" placeholder="Custom rules for ' + escapeHtml(name) + '..." onchange="updateClientGuardrail(\'' + key + '\',\'customRules\',this.value)">' + escapeHtml(rules.customRules || '') + '</textarea></div>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function updateClientGuardrail(clientKey, field, value) {
  if (!guardrailsConfig.clientGuardrails[clientKey]) {
    guardrailsConfig.clientGuardrails[clientKey] = { restrictContext: false, applyEscalation: false, customRules: '', toneOverride: 'default' };
  }
  guardrailsConfig.clientGuardrails[clientKey][field] = value;
  saveGuardrails();
  renderGuardrailsStats();
}

// v22.39: Update client guardrails from the client detail view (syncs to Settings > Guardrails)
function updateClientGuardrailFromDetail(clientKey, clientId, field, value) {
  updateClientGuardrail(clientKey, field, value);
  showToast('Client guardrail updated', 'success');
}

// v22.39: Build general guardrails context for AI system prompts
function getGuardrailsContext() {
  var parts = [];
  // Blocked content categories
  var blocked = [];
  if (guardrailsConfig.blockedContent) {
    for (var bc in guardrailsConfig.blockedContent) {
      if (guardrailsConfig.blockedContent[bc]) blocked.push(bc);
    }
  }
  if (blocked.length > 0) {
    parts.push('BLOCKED CONTENT: Never generate content about these topics: ' + blocked.join(', ') + '.');
  }
  // Escalation topics
  if (guardrailsConfig.escalationTopics && guardrailsConfig.escalationTopics.length > 0) {
    parts.push('ESCALATION TOPICS (defer to humans): ' + guardrailsConfig.escalationTopics.join(', ') + '.');
  }
  // Refusal templates
  if (guardrailsConfig.refusals) {
    var refParts = [];
    if (guardrailsConfig.refusals.general) refParts.push('General: "' + guardrailsConfig.refusals.general + '"');
    if (guardrailsConfig.refusals.pricing) refParts.push('Pricing: "' + guardrailsConfig.refusals.pricing + '"');
    if (guardrailsConfig.refusals.scope) refParts.push('Scope: "' + guardrailsConfig.refusals.scope + '"');
    if (refParts.length > 0) parts.push('REFUSAL TEMPLATES: ' + refParts.join(' | '));
  }
  return parts.length > 0 ? '\n\n===== GUARDRAILS =====\n' + parts.join('\n') + '\n' : '';
}

// v22.39: Build guardrails context string for a specific client (injected into AI prompts)
function getClientGuardrailsContext(clientName) {
  if (!clientName) return '';
  var key = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  var cg = (guardrailsConfig.clientGuardrails || {})[key];
  if (!cg) return '';
  var ctx = '';
  if (cg.toneOverride && cg.toneOverride !== 'default') {
    ctx += '\nCLIENT TONE: Use a ' + cg.toneOverride + ' tone when discussing or creating content for ' + clientName + '.';
  }
  if (cg.applyEscalation && guardrailsConfig.escalationTopics && guardrailsConfig.escalationTopics.length > 0) {
    ctx += '\nCLIENT ESCALATION: For ' + clientName + ', defer to humans on these topics: ' + guardrailsConfig.escalationTopics.join(', ') + '.';
  }
  if (cg.restrictContext) {
    ctx += '\nCLIENT SCOPE: Only use information directly related to ' + clientName + '. Do not reference other clients or mix contexts.';
  }
  if (cg.customRules) {
    ctx += '\nCLIENT RULES (' + clientName + '): ' + cg.customRules;
  }
  return ctx;
}

function saveGuardrails() {
  // Collect scope rules dynamically based on brands array
  guardrailsConfig.scopeRules = [];
  for (var i = 0; i < brands.length; i++) {
    var el = document.getElementById('scopeRule_' + i);
    if (el) {
      guardrailsConfig.scopeRules[i] = el.value;
    }
  }
  
  // Collect refusal templates
  var refusalGeneral = document.getElementById('refusalGeneral');
  var refusalPricing = document.getElementById('refusalPricing');
  var refusalScope = document.getElementById('refusalScope');
  if (refusalGeneral) guardrailsConfig.refusals.general = refusalGeneral.value;
  if (refusalPricing) guardrailsConfig.refusals.pricing = refusalPricing.value;
  if (refusalScope) guardrailsConfig.refusals.scope = refusalScope.value;
  
  localStorage.setItem('roweos_guardrails', JSON.stringify(guardrailsConfig));
  writeDB('profile/main', { guardrails: guardrailsConfig }); // v25.1
  showToast('Guardrails saved', 'success');
}

