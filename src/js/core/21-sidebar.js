// ═══════════════════════════════════════════════════════════════════════════
// v11.0 LIQUID GLASS NAVIGATION SYSTEM
// Adaptive, customizable, floating navigation with scroll-responsive behavior
// ═══════════════════════════════════════════════════════════════════════════

// Available navigation tabs with icons
var liquidNavTabs = {
  agent: {
    id: 'agent',
    label: 'BrandAI',
    lifeLabel: 'LifeAI',
    icon: icon('chat')
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
  },
  signal: {
    id: 'signal',
    label: 'Focus',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>'
  },
  rhythm: {
    id: 'rhythm',
    label: 'Rhythm',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
  },
  pulse: {
    id: 'pulse',
    label: 'Pulse',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>'
  },
  identity: {
    id: 'identity',
    label: 'Identity',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  },
  brandIntel: {
    id: 'brandIntel',
    label: 'Intelligence',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  },
  folio: {
    id: 'folio',
    label: 'Folio',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>'
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  },
  sync: {
    id: 'sync',
    label: 'Sync',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
  },
  more: {
    id: 'more',
    label: 'More',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
  }
};

// v15.43: All navigable views for the grid panel (views NOT in pill)
var liquidGridViews = {
  agent: { label: 'Chat', lifeLabel: 'LifeAI', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', section: 'Core' },
  studio: { label: 'Studio', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>', section: 'Core' },
  signal: { label: 'Focus', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>', section: 'Core' },
  pulse: { label: 'Pulse', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>', section: 'Core' },
  rhythm: { label: 'Rhythm', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', section: 'Orchestration' },
  library: { label: 'Library', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', section: 'Orchestration' },
  automations: { label: 'Automations', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/><path d="M13 8l3-5M11 16l-3 5"/></svg>', section: 'Orchestration' },
  identity: { label: 'Identity', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', section: 'Intelligence' },
  tuning: { label: 'History', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="14" r="2"/></svg>', section: 'Intelligence' },
  guardrails: { label: 'Guardrails', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', section: 'Intelligence' },
  clients: { label: 'Clients', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', section: 'Governance' },
  commerce: { label: 'Analytics', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', section: 'Governance' },
  inventory: { label: 'Inventory', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', section: 'Governance' },
  sync: { label: 'Sync', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>', section: 'Governance' },
  settings: { label: 'System', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', section: 'Governance' }
};

// v15.43: Default nav tabs — 4 primary, no more 'more'
var defaultLiquidNavTabs = ['agent', 'studio', 'signal', 'pulse'];

// Get user's selected tabs from localStorage or use defaults
// v15.43: Max 4 tabs, auto-migrate old configs with 'more'
function getLiquidNavTabs() {
  try {
    var saved = localStorage.getItem('roweos_liquid_nav_tabs');
    if (saved) {
      var tabs = JSON.parse(saved);
      if (Array.isArray(tabs) && tabs.length >= 3) {
        // v15.43: Remove 'more' — FAB replaces it
        tabs = tabs.filter(function(t) { return t !== 'more'; });
        // Cap at 4
        if (tabs.length > 4) tabs = tabs.slice(0, 4);
        // Save migrated config
        if (tabs.length >= 3 && tabs.length <= 4) {
          saveLiquidNavTabs(tabs);
          return tabs;
        }
      }
    }
  } catch (e) {}
  return defaultLiquidNavTabs;
}

// Save user's selected tabs
function saveLiquidNavTabs(tabs) {
  try {
    localStorage.setItem('roweos_liquid_nav_tabs', JSON.stringify(tabs));
  } catch (e) {}
}

// Current active tab
var liquidNavActiveTab = 'agent';

// Scroll state for compact mode
var liquidNavScrollY = 0;
var liquidNavCompact = true; // v11.0: Start in compact mode by default
var liquidNavScrollTimeout = null;

// Render the liquid nav tabs
function renderLiquidNav() {
  var inner = document.getElementById('liquidNavInner');
  if (!inner) return;
  
  var tabs = getLiquidNavTabs();
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  
  var html = '';
  tabs.forEach(function(tabId) {
    var tab = liquidNavTabs[tabId];
    if (!tab) return;
    
    var label = (tabId === 'agent' && isLifeMode) ? tab.lifeLabel : tab.label;
    var isActive = tabId === liquidNavActiveTab;
    
    html += '<button class="liquid-tab' + (isActive ? ' active' : '') + '" onclick="liquidNavTo(\'' + tabId + '\')" data-view="' + tabId + '">';
    html += '<span class="liquid-tab-icon">' + tab.icon + '</span>';
    html += '<span class="liquid-tab-label">' + label + '</span>';
    html += '</button>';
  });
  
  inner.innerHTML = html;
}

// Navigate using liquid nav
function liquidNavTo(view) {
  // v15.43: Close grid if open
  closeLiquidGrid();

  // Update active state
  liquidNavActiveTab = view;

  // Update tab visuals
  document.querySelectorAll('.liquid-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  // v14.0: Navigate to Sync Hub view instead of triggering sync action
  if (view === 'sync') {
    showView('sync');
    return;
  }

  // Navigate to view
  showView(view);
}

// Initialize scroll detection for compact mode
function initLiquidNavScroll() {
  // v11.0: Use event delegation on document for all scroll events
  // This catches scroll on any element including dynamically shown panels
  document.addEventListener('scroll', handleLiquidNavScroll, { passive: true, capture: true });
  
  // Also add to specific known scrollable containers
  var panels = document.querySelectorAll('.panel-view, #agentView, #studioView, #identityView, #rhythmView, #pulseView, #brandIntelView, #tuningView, #settingsView, .panel'); // v28.8: removed #signalView
  
  panels.forEach(function(panel) {
    panel.addEventListener('scroll', handleLiquidNavScroll, { passive: true });
  });
}

// Handle scroll for compact/expand
function handleLiquidNavScroll(e) {
  var target = e.target;
  
  // Get scroll position from target or find active panel
  var scrollTop = 0;
  if (target && target.scrollTop !== undefined) {
    scrollTop = target.scrollTop;
  } else {
    // Try to find the currently visible panel's scroll position
    var visiblePanel = document.querySelector('#agentView:not([style*="display: none"]), #studioView:not([style*="display: none"]), #rhythmView:not([style*="display: none"]), #pulseView:not([style*="display: none"]), #identityView:not([style*="display: none"]), #settingsView:not([style*="display: none"])'); // v28.8: removed #signalView
    if (visiblePanel) {
      scrollTop = visiblePanel.scrollTop || 0;
    }
  }
  
  var liquidNav = document.getElementById('liquidNav');
  if (!liquidNav) return;
  
  // Compact when scrolling down more than 40px
  if (scrollTop > 40 && !liquidNavCompact) {
    liquidNavCompact = true;
    liquidNav.classList.add('compact');
  } else if (scrollTop <= 15 && liquidNavCompact) {
    liquidNavCompact = false;
    liquidNav.classList.remove('compact');
  }
    autoMinimizeLiquidNav(); // v11.0.5: Auto-minimize after expanding
  
  // Auto-expand after scroll stops
  clearTimeout(liquidNavScrollTimeout);
  liquidNavScrollTimeout = setTimeout(function() {
    // Keep compact unless at top
    if (scrollTop <= 15) {
      liquidNavCompact = false;
      liquidNav.classList.remove('compact');
    }
      autoMinimizeLiquidNav(); // v11.0.5: Auto-minimize after expanding
  }, 1500);
}

// Expand nav on touch (when compact)
function expandLiquidNavOnTouch() {
  var liquidNav = document.getElementById('liquidNav');
  if (liquidNav && liquidNavCompact) {
    liquidNavCompact = false;
    liquidNav.classList.remove('compact');
    autoMinimizeLiquidNav(); // v11.0.5: Auto-minimize after touch expand
  }
}

// Open customization modal
function openNavCustomizer() {
  var overlay = document.getElementById('liquidNavModalOverlay');
  var optionsContainer = document.getElementById('liquidNavOptions');
  
  if (!overlay || !optionsContainer) return;
  
  var selectedTabs = getLiquidNavTabs();
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  
  var html = '';
  Object.keys(liquidNavTabs).forEach(function(tabId) {
    // v15.43: 'more' is replaced by FAB — hide from customizer
    if (tabId === 'more') return;
    var tab = liquidNavTabs[tabId];
    var label = (tabId === 'agent' && isLifeMode) ? tab.lifeLabel : tab.label;
    var isSelected = selectedTabs.includes(tabId);

    html += '<div class="liquid-nav-option' + (isSelected ? ' selected' : '') + '" data-tab="' + tabId + '" onclick="toggleNavOption(\'' + tabId + '\')">';
    html += '<svg class="liquid-nav-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + tab.icon.replace(/<svg[^>]*>|<\/svg>/g, '') + '</svg>';
    html += '<span class="liquid-nav-option-label">' + label + '</span>';
    html += '</div>';
  });
  
  optionsContainer.innerHTML = html;
  
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

// Close customization modal
function closeNavCustomizer() {
  var overlay = document.getElementById('liquidNavModalOverlay');
  if (overlay) {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }
  
  // Re-render nav with new selections
  renderLiquidNav();
}

// Toggle a tab option in customizer
// v15.43: Max 4 tabs (was 5)
function toggleNavOption(tabId) {
  var currentTabs = getLiquidNavTabs();
  var option = document.querySelector('.liquid-nav-option[data-tab="' + tabId + '"]');

  if (currentTabs.includes(tabId)) {
    // Remove if more than 3 tabs selected
    if (currentTabs.length > 3) {
      currentTabs = currentTabs.filter(function(t) { return t !== tabId; });
      if (option) option.classList.remove('selected');
    } else {
      showToast('Minimum 3 tabs required', 'warning');
    }
  } else {
    // Add if less than 4 tabs selected
    if (currentTabs.length < 4) {
      currentTabs.push(tabId);
      if (option) option.classList.add('selected');
    } else {
      showToast('Maximum 4 tabs allowed', 'warning');
    }
  }

  saveLiquidNavTabs(currentTabs);
}

// Long press to customize (add touch event to pill)
// v15.43: Target pill, not full nav (which now includes FAB)
function initLiquidNavLongPress() {
  var pill = document.getElementById('liquidNavPill');
  if (!pill) return;

  var pressTimer = null;

  pill.addEventListener('touchstart', function(e) {
    pressTimer = setTimeout(function() {
      openNavCustomizer();
    }, 800);
  }, { passive: true });

  pill.addEventListener('touchend', function() {
    clearTimeout(pressTimer);
  });

  pill.addEventListener('touchmove', function() {
    clearTimeout(pressTimer);
  });

  // Expand on touch when compact
  pill.addEventListener('touchstart', function() {
    if (liquidNavCompact) {
      expandLiquidNavOnTouch();
    }
  }, { passive: true });
}

// Initialize liquid nav on page load
var liquidNavAutoMinimizeTimeout = null;

function autoMinimizeLiquidNav() {
  clearTimeout(liquidNavAutoMinimizeTimeout);
  liquidNavAutoMinimizeTimeout = setTimeout(function() {
    var liquidNav = document.getElementById('liquidNav');
    if (liquidNav && !liquidNavCompact) {
      liquidNavCompact = true;
      liquidNav.classList.add('compact');
    }
  }, 2500); // Auto-minimize after 2.5 seconds
}

function initLiquidNav() {
  renderLiquidNav();
  initLiquidNavScroll();
  initLiquidNavLongPress();
  
  // v11.0: Start in compact mode by default
  var liquidNav = document.getElementById('liquidNav');
  if (liquidNav && liquidNavCompact) {
    liquidNav.classList.add('compact');
  }
  
  // v11.0.5: Auto-minimize after initial load
  autoMinimizeLiquidNav();
}

// Mobile Navigation v2 (legacy compatibility - redirects to liquid nav)
function mobileNavToV2(view) {
  // v11.0: Redirect to liquid nav system
  liquidNavTo(view);
  
  // Also update legacy mobile-tab elements if any exist
  document.querySelectorAll('.mobile-tab').forEach(function(tab) {
    var tabView = tab.dataset.view;
    tab.classList.toggle('active', tabView === view);
  });
  
  // v10.5.25: PRESERVE current mode when navigating - don't reset!
  // The mode is set by the user, not by tab navigation
  // (Removed auto mode setting that was causing issues)
  
  showView(view);
}

// v9.1.14: Mobile header chat button - start new chat or navigate to agent
function mobileNewChat() {
  var agentView = document.getElementById('agentView');
  
  // If already in a conversation, start a new one
  if (agentView && agentView.classList.contains('conversation-active')) {
    newConversation();
  } else {
    // Otherwise just navigate to agent view
    mobileNavToV2('agent');
  }
}

// Menu Navigation (closes menu after navigation)
function mobileMenuNavTo(view) {
  closeMobileFullMenu();
  showView(view);
}

// Mobile Brand Change v2
function onMobileBrandChangeV2(value) {
  // v15.38: Handle life profile selection (life_profile_N)
  if (value.startsWith('life_profile_')) {
    var profileIdx = parseInt(value.replace('life_profile_', ''));
    localStorage.setItem('roweos_mode', 'life');
    localStorage.setItem('roweos_app_mode', 'life');
    updateModeUI('life');
    if (typeof selectLifeProfileByIndex === 'function') selectLifeProfileByIndex(profileIdx);
    if (typeof switchToLifeMode === 'function') switchToLifeMode(profileIdx);
    syncMobileBrandV2();
    var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    var pName = (profiles[profileIdx] && profiles[profileIdx].name) || 'LifeAI';
    showToast('Switched to ' + pName, 'success');
    return;
  }

  // v12.0.4: Handle LifeAI switch
  if (value === 'life') {
    localStorage.setItem('roweos_mode', 'life');
    localStorage.setItem('roweos_app_mode', 'life');
    updateModeUI('life');
    syncMobileBrandV2();
    if (typeof renderFocus2Categories === 'function') renderFocus2Categories();
    if (typeof renderFocusTodoList === 'function') renderFocusTodoList();
    var userName = localStorage.getItem('roweos_user_name') || 'Jordan';
    showToast('Switched to ' + userName + ' (LifeAI)', 'success');
    return;
  }

  var brandIdx = parseInt(value);

  // Sync all brand selectors
  document.getElementById('brand').value = brandIdx;
  if (document.getElementById('agentBrand')) document.getElementById('agentBrand').value = brandIdx;
  if (document.getElementById('studioBrand')) document.getElementById('studioBrand').value = brandIdx;
  if (typeof studioSelectedBrand !== 'undefined') studioSelectedBrand = brandIdx;
  
  // Update sidebar brand name
  var sidebarName = document.getElementById('sidebarBrandName');
  if (sidebarName && brands[brandIdx]) {
    sidebarName.innerHTML = (brands[brandIdx].shortName || brands[brandIdx].name) + ' <span class="sidebar-brand-arrow">▾</span>';
  }
  
  // v9.1.14: Directly update Focus brand badge
  var focusBrandBadge = document.getElementById('focusBrandBadge');
  if (focusBrandBadge && brands[brandIdx]) {
    focusBrandBadge.textContent = brands[brandIdx].shortName || brands[brandIdx].name;
  }
  
  showAllOps = false;
  if (typeof renderOperations === 'function') renderOperations();
  if (typeof renderToolOpsGrid === 'function') renderToolOpsGrid();
  
  // Update brand pill and header dropdown
  syncMobileBrandV2();
  
  // Trigger full brand change for conversation context
  onBrandChange();
  
  // v9.1.14: Always update Focus view when brand changes
  if (typeof renderFocusView === 'function') {
    renderFocusView();
  }
}

// v16.0: Mobile header brand dropdown change handler — delegates to onMobileBrandChangeV2 for shared paths
function onMobileBrandDropdownChange(value) {
  // v11.0.5: Handle LifeAI agent/coach selection (unique to header dropdown)
  if (value.startsWith('agent_')) {
    var agentId = value.replace('agent_', '');
    localStorage.setItem('roweos_life_agent', agentId);
    syncLifeAIToFirestore({ currentAgent: agentId });
    syncMobileBrandV2();
    var agentNames = { personal: 'Personal', coach: 'Life Coach', wellness: 'Wellness', taxintelligence: 'Tax Intelligence' };
    showToast('Switched to ' + (agentNames[agentId] || agentId), 'success');
    return;
  }

  // v10.5.25: Handle brand_ prefixed values (strip prefix, delegate)
  if (value.startsWith('brand_')) {
    var brandIdx = parseInt(value.replace('brand_', ''));
    localStorage.setItem('roweos_mode', 'brand');
    localStorage.setItem('roweos_app_mode', 'brand');
    updateModeUI('brand');
    document.getElementById('brand').value = brandIdx;
    if (document.getElementById('agentBrand')) document.getElementById('agentBrand').value = brandIdx;
    if (document.getElementById('studioBrand')) document.getElementById('studioBrand').value = brandIdx;
    onBrandChange();
    showToast(brands[brandIdx].name + ' selected', 'success');
    return;
  }

  // All other values (life, life_profile_N, brand index) handled by shared handler
  onMobileBrandChangeV2(value);
}

// v9.1.14: Handle mobile model selection via native iOS picker
function onMobileModelSelectChange(value) {
  if (!value) return;
  var parts = value.split('|');
  if (parts.length !== 3) return;
  
  var provider = parts[0];
  var model = parts[1];
  var displayName = parts[2];
  
  selectModel(provider, model, displayName);
}

// v9.1.14: Update mobile model select to show current selection
function syncMobileModelSelect() {
  var select = document.getElementById('mobileModelSelect');
  if (!select) return;
  
  var brandIdx = parseInt(document.getElementById('brand').value) || 0;
  var settings = brandSettings[brandIdx] || {};
  var currentModel = settings.model || 'claude-sonnet-4-6';
  
  // Find and select the matching option
  for (var i = 0; i < select.options.length; i++) {
    var optValue = select.options[i].value;
    if (optValue && optValue.indexOf(currentModel) !== -1) {
      select.selectedIndex = i;
      break;
    }
  }
}

// v9.1.14: Populate chat brand select for mobile iOS picker
function populateChatBrandSelect() {
  var select = document.getElementById('chatBrandSelect');
  if (!select) return;
  
  // v11.0.5: More robust mode detection - check HTML class first, then localStorage
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  if (!isLifeMode) {
    var storedMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    isLifeMode = (storedMode === 'life');
  }
  
  // Clear and repopulate
  select.innerHTML = '';
  
  // v11.0.5: In LifeAI mode, show coaches instead of brands
  if (isLifeMode) {
    var lifeAgents = [
      { id: 'personal', name: 'Personal Assistant' },
      { id: 'coach', name: 'Life Coach' },
      { id: 'wellness', name: 'Wellness Guide' },
      { id: 'taxintelligence', name: 'Tax Intelligence' },
      { id: 'standard', name: 'Standard AI' }
    ];
    
    var currentLifeAgent = localStorage.getItem('roweos_life_agent') || 'personal';
    
    lifeAgents.forEach(function(agent) {
      var opt = document.createElement('option');
      opt.value = 'life_' + agent.id;
      opt.textContent = agent.name;
      if (agent.id === currentLifeAgent) opt.selected = true;
      select.appendChild(opt);
    });
    return;
  }
  
  // BrandAI mode - show brands
  var currentBrandIdx = parseInt(document.getElementById('agentBrand').value);
  if (isNaN(currentBrandIdx)) currentBrandIdx = parseInt(document.getElementById('brand').value) || 0;
  
  // Add regular brands
  brands.forEach(function(brand, idx) {
    var opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = brand.name;
    if (idx === currentBrandIdx) opt.selected = true;
    select.appendChild(opt);
  });
  
  // v9.1.14: Add "No BrandAI" option (only in chat selector)
  var divider = document.createElement('option');
  divider.disabled = true;
  divider.textContent = '──────────';
  select.appendChild(divider);
  
  var noBrandOpt = document.createElement('option');
  noBrandOpt.value = 'none';
  noBrandOpt.textContent = 'StandardAI';
  if (currentBrandIdx === 'none' || document.getElementById('agentBrand').value === 'none') {
    noBrandOpt.selected = true;
  }
  select.appendChild(noBrandOpt);
}

// v9.1.14: Sync chat model select to show current selection
function syncChatModelSelect() {
  var select = document.getElementById('chatModelSelect');
  if (!select) return;
  
  var brandIdx = parseInt(document.getElementById('brand').value) || 0;
  var settings = brandSettings[brandIdx] || {};
  var currentModel = settings.model || 'claude-sonnet-4-6';
  
  // Find and select the matching option
  for (var i = 0; i < select.options.length; i++) {
    var optValue = select.options[i].value;
    if (optValue && optValue.indexOf(currentModel) !== -1) {
      select.selectedIndex = i;
      break;
    }
  }
}

// v9.1.14: Handle chat brand selection from native iOS picker
function onChatBrandSelectChange(value) {
  var mobilePill = document.querySelector('.mobile-brand-pill');
  var pillText = document.getElementById('mobileBrandPillText');
  
  // v11.0.5: Handle LifeAI agent selection
  if (value && value.startsWith('life_')) {
    var agentId = value.replace('life_', '');
    localStorage.setItem('roweos_life_agent', agentId);
    syncLifeAIToFirestore({ currentAgent: agentId });
    
    var agentNames = {
      'personal': 'Personal Assistant',
      'coach': 'Life Coach',
      'wellness': 'Wellness Guide',
      'taxintelligence': 'Tax Intelligence',
      'standard': 'Standard AI'
    };
    var agentName = agentNames[agentId] || 'Personal Assistant';
    
    // Update badge
    var badge = document.querySelector('.chat-brand-badge');
    if (badge) badge.textContent = agentName;
    
    // Update mobile pill
    if (pillText) pillText.textContent = agentName;
    
    showToast('Switched to ' + agentName, 'info');
    return;
  }
  
  // v9.1.14: Handle "StandardAI" selection
  if (value === 'none') {
    document.getElementById('agentBrand').value = 'none';
    // Update badge to show standard mode
    var badge = document.querySelector('.chat-brand-badge');
    if (badge) badge.textContent = 'StandardAI';
    // Update mobile pill to silver mode
    if (mobilePill) mobilePill.classList.add('standard-ai-mode');
    if (pillText) pillText.textContent = 'StandardAI';
    // Update diamond icon to silver
    updateBrandIconState(true);
    // v9.1.14: Update placeholder for StandardAI
    var input = document.getElementById('agentCommand');
    if (input) input.placeholder = 'Explore anything...';
    var followupInput = document.getElementById('followupInput');
    if (followupInput) followupInput.placeholder = 'Ask about your brand...';
    // Clear conversation for fresh start
    currentConversation = [];
    renderConversation();
    showToast('Switched to StandardAI mode', 'info');
    return;
  }
  
  var brandIdx = parseInt(value);
  document.getElementById('agentBrand').value = brandIdx;
  // Update diamond icon to gold
  updateBrandIconState(false);
  // Update mobile pill to gold mode
  if (mobilePill) mobilePill.classList.remove('standard-ai-mode');
  if (pillText && brands[brandIdx]) pillText.textContent = brands[brandIdx].name;
  // v9.1.14: Update badge to show brand name
  var badge = document.querySelector('.chat-brand-badge');
  if (badge && brands[brandIdx]) {
    badge.textContent = brands[brandIdx].name;
    badge.classList.remove('standard-ai-badge');
  }
  // v9.1.14: Restore brand placeholder
  var input = document.getElementById('agentCommand');
  if (input) input.placeholder = "Ask about your brand...";
  var followupInput = document.getElementById('followupInput');
  if (followupInput) followupInput.placeholder = 'Continue the conversation...';
  selectBrandFromDropdown(brandIdx);
}

// v9.1.14: Handle chat model selection from native iOS picker
function onChatModelSelectChange(value) {
  if (!value) return;
  var parts = value.split('|');
  if (parts.length !== 3) return;
  
  var provider = parts[0];
  var model = parts[1];
  var displayName = parts[2];
  
  selectModel(provider, model, displayName);
}

// Sync Mobile Brand Selector and Pill v2
function syncMobileBrandV2() {
  var currentMode = getCurrentMode();
  var isLife = currentMode === 'life';
  var brandIdx = parseInt(document.getElementById('brand').value || 0);
  var selector = document.getElementById('mobileBrandSelectorV2');
  var headerDropdown = document.getElementById('mobileBrandDropdown');
  var pill = document.getElementById('mobileBrandPillText');
  
  // v15.38: Use actual life profiles (matches sidebar)
  var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  var currentProfileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var userName = (profiles.length > 0 && profiles[currentProfileIdx])
    ? (profiles[currentProfileIdx].name || 'My Life')
    : (localStorage.getItem('roweos_user_name') || 'My Life');
  
  // Populate More menu selector (brand/profile switcher)
  if (selector) {
    selector.innerHTML = '';
    
    if (isLife) {
      // v10.5.25: Show Life profile as first option (like a brand)
      var lifeOpt = document.createElement('option');
      lifeOpt.value = 'life';
      lifeOpt.textContent = '◇ ' + userName;
      lifeOpt.selected = true;
      selector.appendChild(lifeOpt);
      
      // Add separator
      var sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── Switch to Brand ──';
      selector.appendChild(sep);
    }
    
    // v13.4: Always show brands (for switching) - use shortName for mobile
    brands.forEach(function(brand, idx) {
      var opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = brand.shortName || brand.name;
      if (!isLife && idx === brandIdx) opt.selected = true;
      selector.appendChild(opt);
    });

    // v15.38: Add LifeAI profiles when in BrandAI mode
    if (!isLife) {
      var sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── Switch to LifeAI ──';
      selector.appendChild(sep);

      if (profiles.length > 0) {
        profiles.forEach(function(profile, idx) {
          var opt = document.createElement('option');
          opt.value = 'life_profile_' + idx;
          opt.textContent = '◇ ' + (profile.name || 'Life ' + (idx + 1));
          selector.appendChild(opt);
        });
      } else {
        var lifeOpt = document.createElement('option');
        lifeOpt.value = 'life';
        lifeOpt.textContent = '◇ ' + userName + ' (Personal)';
        selector.appendChild(lifeOpt);
      }
    }
  }

  // Populate header dropdown (brand/profile switcher)
  if (headerDropdown) {
    headerDropdown.innerHTML = '';
    
    if (isLife) {
      // v15.38: Show all LifeAI profiles in header dropdown
      if (profiles.length > 0) {
        profiles.forEach(function(profile, idx) {
          var opt = document.createElement('option');
          opt.value = 'life_profile_' + idx;
          opt.textContent = profile.name || 'Life ' + (idx + 1);
          if (idx === currentProfileIdx) opt.selected = true;
          headerDropdown.appendChild(opt);
        });
      } else {
        var lifeOpt = document.createElement('option');
        lifeOpt.value = 'life';
        lifeOpt.textContent = userName;
        lifeOpt.selected = true;
        headerDropdown.appendChild(lifeOpt);
      }

      // Add separator and brands for switching
      var sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── Switch to Brand ──';
      headerDropdown.appendChild(sep);

      // v13.4: Use shortName for mobile header
      brands.forEach(function(brand, idx) {
        var opt = document.createElement('option');
        opt.value = 'brand_' + idx;
        opt.textContent = brand.shortName || brand.name;
        headerDropdown.appendChild(opt);
      });
    } else {
      // v13.4: BrandAI mode - show brands with shortName
      brands.forEach(function(brand, idx) {
        var opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = brand.shortName || brand.name;
        if (idx === brandIdx) opt.selected = true;
        headerDropdown.appendChild(opt);
      });

      // v15.38: Add separator and LifeAI profiles for switching
      var sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── Switch to LifeAI ──';
      headerDropdown.appendChild(sep);

      if (profiles.length > 0) {
        profiles.forEach(function(profile, idx) {
          var opt = document.createElement('option');
          opt.value = 'life_profile_' + idx;
          opt.textContent = profile.name || 'Life ' + (idx + 1);
          headerDropdown.appendChild(opt);
        });
      } else {
        var lifeOpt = document.createElement('option');
        lifeOpt.value = 'life';
        lifeOpt.textContent = userName + ' (Personal)';
        headerDropdown.appendChild(lifeOpt);
      }
    }
  }
  
  // v13.4: Set pill text - use shortName for mobile
  if (pill) {
    if (isLife) {
      pill.textContent = userName;
    } else if (brands[brandIdx]) {
      pill.textContent = brands[brandIdx].shortName || brands[brandIdx].name;
    }
  }
}

// Mobile Sidebar Functions
function openMobileSidebar() {
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.getElementById('sidebarMobileOverlay');

  sidebar.classList.add('mobile-open');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  // v15.21: Place native brand picker overlay after sidebar animates open
  if (window.innerWidth <= 768) {
    setTimeout(function() { openNativeSidebarBrandPicker(); }, 350);
  }
}

function closeMobileSidebar() {
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.getElementById('sidebarMobileOverlay');

  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('show');
  document.body.style.overflow = '';

  // v15.21: Clean up native picker
  var picker = document.getElementById('sidebarNativePicker');
  if (picker) picker.remove();
}

// Toggle theme from menu
function toggleThemeFromMenu() {
  toggleTheme();
  updateMobileThemeLabel();
}

// Update mobile theme label/icon
function updateMobileThemeLabel() {
  var isDark = !document.documentElement.classList.contains('light-mode');
  var label = document.getElementById('mobileThemeLabelV2');
  var icon = document.getElementById('mobileThemeIconV2');
  
  if (label) {
    label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  }
  
  if (icon) {
    icon.innerHTML = isDark 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
}

// v10.5.25: Toggle mode from mobile menu
function toggleModeFromMenu() {
  toggleRoweOSMode();
  updateMobileModeLabel();
}

// v10.5.25: Update mobile mode label/icon to show CURRENT mode
function updateMobileModeLabel() {
  var isLife = isLifeMode();
  var label = document.getElementById('mobileModeLabelV2');
  var icon = document.getElementById('mobileModeIconV2');
  var btn = document.getElementById('mobileModeBtn');
  
  // v10.5.25: Show CURRENT mode so users know what's active
  if (label) {
    label.textContent = isLife ? 'LifeAI' : 'BrandAI';
  }
  
  // v10.5.25: Icon shows CURRENT mode (person = LifeAI, briefcase = BrandAI)
  if (icon) {
    icon.innerHTML = isLife 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
  }
  
  // v10.5.25: Highlight button when in LifeAI mode (green/blue accent)
  if (btn) {
    btn.style.color = isLife ? 'var(--lifeai-accent, #5a7a9a)' : '';
  }
}

// v15.43: Scroll-collapse chat input on mobile
var chatInputCollapsed = false;
var lastConvScrollTop = 0;

function initChatInputCollapse() {
  var thread = document.getElementById('conversationThread');
  if (!thread || window.innerWidth > 768) return;
  if (thread._collapseListenerAdded) return;
  thread._collapseListenerAdded = true;

  thread.addEventListener('scroll', function() {
    if (window.innerWidth > 768) return;
    var scrollTop = thread.scrollTop;
    var delta = scrollTop - lastConvScrollTop;
    lastConvScrollTop = scrollTop;

    var input = document.getElementById('followupInputContainer');
    if (!input) return;

    // Don't collapse if user is typing
    var textarea = document.getElementById('followupCommand');
    if (textarea && document.activeElement === textarea) return;

    // Collapse on scroll down > 10px, past 60px from top
    if (delta > 10 && !chatInputCollapsed && scrollTop > 60) {
      chatInputCollapsed = true;
      input.classList.add('chat-input-collapsed');
    }

    // Auto-expand at bottom of conversation
    var atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
    if (atBottom && chatInputCollapsed) {
      expandChatInput();
    }
  }, { passive: true });

  // Tap collapsed bubble to expand
  var followupInput = document.getElementById('followupInputContainer');
  if (followupInput && !followupInput._collapseClickAdded) {
    followupInput._collapseClickAdded = true;
    followupInput.addEventListener('click', function(e) {
      if (chatInputCollapsed) {
        e.preventDefault();
        e.stopPropagation();
        expandChatInput();
        setTimeout(function() {
          var ta = document.getElementById('followupCommand');
          if (ta) ta.focus();
        }, 350);
      }
    });
  }
}

function expandChatInput() {
  chatInputCollapsed = false;
  var input = document.getElementById('followupInputContainer');
  if (input) input.classList.remove('chat-input-collapsed');
}

// Initialize mobile v2 on page load
function initMobileV2() {
  // v11.0: Initialize Liquid Glass navigation
  initLiquidNav();
  
  syncMobileBrandV2();
  updateMobileThemeLabel();
  updateMobileModeLabel(); // v10.5.25: Update mode label on init
  
  // v10.7.9: Update navigation labels based on current mode
  var isLife = typeof isLifeMode === 'function' ? isLifeMode() : false;
  if (typeof updateMobileNavLabels === 'function') {
    updateMobileNavLabels(isLife);
  }
  
  // v11.0: Set liquid nav active tab based on current view
  if (typeof liquidNavActiveTab !== 'undefined') {
    liquidNavActiveTab = currentView || 'agent';
    renderLiquidNav();
  }
  
  // Update active states based on current view (legacy support)
  document.querySelectorAll('.mobile-tab').forEach(function(tab) {
    var tabView = tab.dataset.view;
    tab.classList.toggle('active', tabView === currentView || (tabView === 'more' && !['agent', 'studio', 'signal', 'rhythm'].includes(currentView)));
  });
  
  document.querySelectorAll('.mobile-menu-item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.menuView === currentView);
  });

  // v15.38: Mobile keyboard — keep chat input visible above keyboard
  // v24.27: Use captured initial height so keyboard-close detection is reliable
  if (window.visualViewport && !window._vvListenerAdded) {
    window._vvListenerAdded = true;
    // v29.0: Use a getter so _initialViewportHeight stays fresh after orientation changes
    var _initialViewportHeight = window.innerHeight;
    window.addEventListener('orientationchange', function() {
      setTimeout(function() { _initialViewportHeight = window.innerHeight; }, 500);
    });
    // v29.0: Debounce to prevent rapid-fire repositioning during keyboard animation
    var _kbResizeTimer = null;
    window.visualViewport.addEventListener('resize', function() {
      if (window.innerWidth > 768) return;
      if (_kbResizeTimer) clearTimeout(_kbResizeTimer);
      var vv = window.visualViewport;
      var keyboardOpen = vv.height < _initialViewportHeight * 0.75;
      var kbHeight = _initialViewportHeight - vv.height - vv.offsetTop;
      var inputs = document.querySelectorAll('#agentView .chat-input-area');
      var followup = document.getElementById('followupInputContainer');
      var autoAgentInput = document.querySelector('.auto-agent-input-area');
      var followupV2 = document.querySelector('#agentConversation > .chat-input-v2');
      if (keyboardOpen) {
        var offset = Math.max(kbHeight, 0) + 'px';
        inputs.forEach(function(el) { el.style.bottom = offset; });
        if (followupV2 && getComputedStyle(followupV2).position === 'fixed') followupV2.style.bottom = offset;
        if (autoAgentInput && autoAgentInput.style.position === 'fixed') autoAgentInput.style.bottom = offset;
      } else {
        inputs.forEach(function(el) { el.style.bottom = ''; });
        if (followupV2) followupV2.style.bottom = '';
        if (autoAgentInput) autoAgentInput.style.bottom = '';
        // v29.0: Box-sizing reflow only when no input is focused (prevents stealing focus on tap)
        if (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
          requestAnimationFrame(function() {
            var _kbFix = document.createElement('style');
            _kbFix.textContent = '* { box-sizing: content-box !important; }';
            document.head.appendChild(_kbFix);
            void document.body.offsetHeight;
            requestAnimationFrame(function() {
              _kbFix.remove();
              void document.body.offsetHeight;
            });
          });
        }
      }
      if (typeof resizeHelix === 'function') resizeHelix();
      // v29.0: Single debounced scrollIntoView (replaces triple-scroll that caused flicker)
      if (keyboardOpen) {
        _kbResizeTimer = setTimeout(function() {
          var active = document.activeElement;
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return;
          var scrollTarget = active.closest('.chat-input-area') || active.closest('.chat-input-v2') || active.closest('.auto-agent-input-area');
          if (scrollTarget) scrollTarget.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }, 150);
      }
    });
  }

  // v24.27 / v29.0: Safety net -- clear inline positioning when keyboard fully closes
  // Increased delay to 500ms to avoid interfering with tap-to-focus transitions
  document.addEventListener('focusout', function() {
    if (window.innerWidth > 768) return;
    setTimeout(function() {
      var active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      var inputs = document.querySelectorAll('#agentView .chat-input-area');
      inputs.forEach(function(el) { el.style.bottom = ''; });
      var followupV2 = document.querySelector('#agentConversation > .chat-input-v2');
      if (followupV2) followupV2.style.bottom = '';
      var autoAgentInput = document.querySelector('.auto-agent-input-area');
      if (autoAgentInput) autoAgentInput.style.bottom = '';
      if (typeof resizeHelix === 'function') resizeHelix();
    }, 500);
  });

  // v29.0: Single scrollIntoView on focus (replaced double-tap that caused cursor flicker)
  var agentCmd = document.getElementById('agentCommand');
  if (agentCmd && window.innerWidth <= 768) {
    agentCmd.addEventListener('focus', function() {
      var self = this;
      setTimeout(function() {
        var inputArea = self.closest('.chat-input-area');
        if (inputArea) inputArea.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }, 400);
    });
  }
}

// Call init after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileV2);
} else {
  initMobileV2();
}

// ═══════════════════════════════════════════════════════════════════════════════
// END MOBILE SYSTEM v2.0
// ═══════════════════════════════════════════════════════════════════════════════

// v12.2.4: Handle swipe gestures for mobile sidebar
var touchStartX = 0;
var touchStartY = 0;
var touchEndX = 0;
var touchEndY = 0;

document.addEventListener('touchstart', function(e) {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', function(e) {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  var swipeThreshold = 50;
  var edgeThreshold = 30; // Distance from edge to trigger swipe
  var horizontalSwipe = touchEndX - touchStartX;
  var verticalSwipe = Math.abs(touchEndY - touchStartY);

  // Only handle if horizontal swipe is greater than vertical (not scrolling)
  if (verticalSwipe > Math.abs(horizontalSwipe)) return;

  var sidebar = document.querySelector('.sidebar');
  var isSidebarOpen = sidebar && sidebar.classList.contains('mobile-open');

  // Swipe right from left edge to open sidebar
  if (touchStartX < edgeThreshold && horizontalSwipe > swipeThreshold && !isSidebarOpen) {
    openMobileSidebar();
    return;
  }

  // Swipe left to close sidebar
  if (isSidebarOpen && horizontalSwipe < -swipeThreshold) {
    closeMobileSidebar();
    return;
  }

  // Legacy: Swipe left from right edge to open menu
  var menu = document.getElementById('mobileMenu');
  var isMenuOpen = menu && menu.classList.contains('show');

  if (touchStartX > window.innerWidth - edgeThreshold && horizontalSwipe < -swipeThreshold && !isMenuOpen) {
    toggleMobileMenu();
  }

  // Swipe right to close menu
  if (isMenuOpen && horizontalSwipe > swipeThreshold) {
    closeMobileMenu();
  }
}

// v12.2.4: Mobile Navigation Preference
function getMobileNavPreference() {
  return localStorage.getItem('roweos_mobile_nav') || 'both';
}

function changeMobileNavPreference(value) {
  localStorage.setItem('roweos_mobile_nav', value);
  applyMobileNavPreference();
  showToast('Mobile navigation updated', 'success');
}

function applyMobileNavPreference() {
  var pref = getMobileNavPreference();
  document.documentElement.setAttribute('data-mobile-nav', pref);

  // Update dropdown if exists
  var dropdown = document.getElementById('mobileNavPreferenceSelect');
  if (dropdown) {
    dropdown.value = pref;
  }
}

// Initialize mobile nav preference on load
if (typeof window !== 'undefined') {
  applyMobileNavPreference();
}

// Prevent body scroll when modal is open on iOS
function preventBodyScroll(prevent) {
  if (prevent) {
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  } else {
    document.body.style.position = '';
    document.body.style.width = '';
  }
}

// ═══════════════════════════════════════════════════════════════
// DESKTOP API INTEGRATION
// ═══════════════════════════════════════════════════════════════

var isDesktopApp = typeof window.roweosAPI !== 'undefined';
var apiConnected = false;
var providerConfigs = null;  // Will hold provider configurations from backend
var providerKeys = {};  // Track which providers have keys: { anthropic: true, openai: false, google: false }
var brandSettings = {};  // Per-brand provider and model selection: { 0: { provider: 'anthropic', model: '...' }, ... }

// Initialize brand settings from localStorage or defaults
function initBrandSettings() {
  try {
    var saved = localStorage.getItem(USER_DATA_KEYS.brandSettings);
    if (saved) {
      brandSettings = JSON.parse(saved);
    } else {
      // Default all brands to Anthropic Claude Sonnet 4
      for (var i = 0; i < 5; i++) {
        brandSettings[i] = {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6'
        };
      }
      saveBrandModelConfig();
    }
  } catch (e) {
    console.error('[Storage] Failed to load brand settings:', e);
    // Reset to defaults
    for (var i = 0; i < 5; i++) {
      brandSettings[i] = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6'
      };
    }
  }
}

// v14.2: Renamed from saveBrandSettings() to avoid collision with Identity page function
// v24.10: Track when brand model config was last saved locally to block onSnapshot overwrites
var _brandModelConfigSavedAt = 0;
var _BRAND_MODEL_CONFIG_GRACE = Infinity; // v24.11: Permanent — once user saves model config, cloud NEVER overwrites during this session

function saveBrandModelConfig() {
  try {
    // v24.10: Set _modifiedAt so timestamp merge in _mergeCloudBrandSettings keeps local changes
    brandSettings._modifiedAt = Date.now();
    _brandModelConfigSavedAt = Date.now();
    localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings));
    // v25.0: Write-through handles push via writeDB in saveBrandSettings
    stampLocalSave();
    if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
      writeDB('profile/main', { brandSettings: brandSettings });
    }
  } catch (e) {
    console.error('[Storage] Failed to save brand model config:', e);
  }
}

// API Key Modal Functions - Multi-Provider
var currentProvider = 'anthropic';  // Track which provider tab is active

// v25.3: Per-provider configuration constant
var PROVIDER_CONFIG = {
  anthropic: {
    name: 'Anthropic',
    tagline: 'Claude AI',
    color: '#e8956a',
    bgTint: 'rgba(232,149,106,0.08)',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com',
    docsLabel: 'console.anthropic.com',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#e8956a" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>',
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', desc: 'Most capable, complex tasks' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Balanced speed and quality' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', desc: 'Fast and efficient' }
    ],
    features: []
  },
  openai: {
    name: 'OpenAI',
    tagline: 'GPT Models',
    color: '#4ade80',
    bgTint: 'rgba(74,222,128,0.08)',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    docsLabel: 'platform.openai.com',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#4ade80" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', desc: 'Latest flagship model' },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', desc: 'Extended reasoning' },
      { id: 'gpt-5.4-thinking', name: 'GPT-5.4 Thinking', desc: 'Deep analytical tasks' }
    ],
    features: []
  },
  google: {
    name: 'Google',
    tagline: 'Gemini AI',
    color: '#60a5fa',
    bgTint: 'rgba(96,165,250,0.08)',
    placeholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    docsLabel: 'aistudio.google.com',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#60a5fa" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Most capable multimodal' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash', desc: 'Fast and efficient' }
    ],
    features: [
      { id: 'imagegen', label: 'Nano Banana Image Generation', desc: 'Gemini 3.0 Pro image gen in Studio and Image Lab', toggleFn: 'toggleImageGen', checkFn: 'isImageGenEnabled' },
      { id: 'veo', label: 'Veo Video Generation', desc: 'Veo 3.1 video gen in Studio and Video Lab', static: true },
      { id: 'deep_research', label: 'Deep Research', desc: 'Multi-step research with citations', static: true }
    ]
  }
};

// v25.3: Per-provider preferred model functions
function getPreferredModel(provider) {
  try { return localStorage.getItem('roweos_preferred_model_' + provider) || ''; } catch(e) { return ''; }
}

function setPreferredModel(provider, modelId) {
  localStorage.setItem('roweos_preferred_model_' + provider, modelId);
  var config = PROVIDER_CONFIG[provider];
  if (!config) return;
  var cards = document.querySelectorAll('.provider-model-card');
  for (var i = 0; i < cards.length; i++) {
    var isSelected = cards[i].getAttribute('data-model') === modelId;
    cards[i].style.borderColor = isSelected ? config.color : 'var(--border-color)';
    cards[i].style.background = isSelected ? config.bgTint : 'var(--bg-secondary)';
  }
  showToast('Preferred model set to ' + modelId, 'success');
}

// v25.3: Build per-provider modal content dynamically
function openApiKeyModal(provider) {
  var config = PROVIDER_CONFIG[provider || 'anthropic'];
  if (!config) return;
  currentProvider = provider || 'anthropic';

  // Check if key exists
  var hasKey = false;
  var maskedKey = '';
  try {
    var apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    if (apiKeys[currentProvider]) {
      hasKey = true;
      var k = apiKeys[currentProvider];
      maskedKey = k.substring(0, 6) + '...' + k.substring(k.length - 4);
    }
  } catch(e) {}

  var preferredModel = getPreferredModel(currentProvider);

  // Build HTML
  var html = '';

  // Colored top border
  html += '<div style="position:absolute;top:0;left:0;right:0;height:4px;background:' + config.color + ';border-radius:var(--radius-lg) var(--radius-lg) 0 0;"></div>';

  // Close button
  html += '<button onclick="closeApiKeyModal()" title="Close" style="position:absolute;top:16px;right:16px;background:transparent;border:none;color:var(--text-secondary);cursor:pointer;padding:var(--space-2);border-radius:var(--radius-sm);transition:all 0.2s;">';
  html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  html += '</button>';

  // Header with icon
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;padding-top:8px;">';
  html += config.icon;
  html += '<div>';
  html += '<h3 style="margin:0;font-size:18px;font-weight:600;color:' + config.color + ';">Configure ' + config.name + '</h3>';
  html += '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">' + config.tagline + '</div>';
  html += '</div>';
  html += '</div>';

  // API Key section
  html += '<div style="margin-top:20px;">';
  html += '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">' + config.name.toUpperCase() + ' API KEY</label>';
  html += '<input type="password" class="api-key-input" id="apiKeyInput-' + currentProvider + '" placeholder="' + config.placeholder + '" value="' + (hasKey ? maskedKey : '') + '" onfocus="if(this.value.indexOf(\'...\')>-1)this.value=\'\'" onkeypress="if(event.key===\'Enter\')saveCurrentProviderApiKey()" style="width:100%;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:14px;font-family:\'SF Mono\',\'Monaco\',monospace;">';
  html += '<div id="keyStatus-' + currentProvider + '" style="margin-top:6px;font-size:12px;' + (hasKey ? 'display:block;color:#4ade80;' : 'display:none;') + '">' + (hasKey ? 'API key configured' : '') + '</div>';
  html += '</div>';

  // How to get your key
  html += '<div style="margin-top:14px;padding:12px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;">';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + config.color + '" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  html += '<span style="font-size:12px;font-weight:600;color:var(--text-primary);">How to get your key</span>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);line-height:1.7;">';
  html += '<span style="color:' + config.color + ';">1.</span> Visit <a href="' + config.docsUrl + '" target="_blank" style="color:' + config.color + ';text-decoration:none;">' + config.docsLabel + '</a> to create an API key<br>';
  html += '<span style="color:' + config.color + ';">2.</span> Or email <a href="mailto:roweos@therowecollection.com" style="color:' + config.color + ';text-decoration:none;">roweos@therowecollection.com</a> for private Beta key access';
  html += '</div>';
  html += '</div>';

  // Preferred Model section
  html += '<div style="margin-top:22px;">';
  html += '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">PREFERRED MODEL</label>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  for (var m = 0; m < config.models.length; m++) {
    var model = config.models[m];
    var isSelected = preferredModel === model.id;
    html += '<div class="provider-model-card" data-model="' + model.id + '" onclick="setPreferredModel(\'' + currentProvider + '\',\'' + model.id + '\')" style="';
    html += 'border-color:' + (isSelected ? config.color : 'var(--border-color)') + ';';
    html += 'background:' + (isSelected ? config.bgTint : 'var(--bg-secondary)') + ';';
    html += '" onmouseover="if(!this.style.borderColor||this.style.borderColor===\'var(--border-color)\')this.style.borderColor=\'' + config.color + '50\'" onmouseout="var s=this.getAttribute(\'data-model\')===\'' + preferredModel + '\';if(!s)this.style.borderColor=\'var(--border-color)\'">';
    html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:3px;">' + model.name + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);line-height:1.4;">' + model.desc + '</div>';
    if (isSelected) {
      html += '<div style="margin-top:6px;font-size:10px;color:' + config.color + ';font-weight:600;">SELECTED</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';

  // Features section (Google only, or any provider with features)
  if (config.features && config.features.length > 0) {
    html += '<div style="margin-top:22px;">';
    html += '<label style="display:block;font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">FEATURES</label>';
    for (var f = 0; f < config.features.length; f++) {
      var feat = config.features[f];
      html += '<div class="provider-feature-toggle">';
      html += '<div style="flex:1;">';
      html += '<div style="font-size:13px;font-weight:500;color:var(--text-primary);">' + feat.label + '</div>';
      html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + feat.desc + '</div>';
      html += '</div>';
      if (feat.static) {
        html += '<span style="font-size:11px;color:' + config.color + ';font-weight:600;padding:4px 12px;">Included</span>';
      } else if (feat.toggleFn && feat.checkFn) {
        var isOn = false;
        try { isOn = window[feat.checkFn] && window[feat.checkFn](); } catch(e) {}
        html += '<button class="provider-feature-pill" onclick="' + feat.toggleFn + '();setTimeout(function(){openApiKeyModal(\'' + currentProvider + '\')},100);" style="';
        html += isOn ? 'background:' + config.bgTint + ';color:' + config.color + ';border-color:' + config.color + ';">' : 'background:transparent;color:var(--text-muted);border-color:var(--border-color);">';
        html += isOn ? 'Enabled' : 'Disabled';
        html += '</button>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // Actions
  html += '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid var(--border-color);">';
  if (hasKey) {
    html += '<button id="apiKeyDeleteBtn" onclick="deleteCurrentProviderApiKey()" style="background:transparent;color:#ef4444;border:1px solid #ef4444;font-size:12px;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:inherit;">Delete Key</button>';
  } else {
    html += '<div></div>';
  }
  html += '<div style="display:flex;gap:8px;">';
  html += '<button class="api-key-modal-btn api-key-modal-btn-cancel" onclick="closeApiKeyModal()">Cancel</button>';
  html += '<button class="api-key-modal-btn api-key-modal-btn-save" id="apiKeySaveBtn" onclick="saveCurrentProviderApiKey()" style="background:' + config.color + ';">Validate & Save</button>';
  html += '</div>';
  html += '</div>';

  // Set content and show
  var inner = document.getElementById('apiKeyModalInner');
  if (inner) {
    inner.style.position = 'relative';
    inner.style.overflow = 'hidden';
    inner.innerHTML = html;
  }
  document.getElementById('apiKeyModal').classList.add('active');
}

function closeApiKeyModal() {
  // v25.3: No need to restore original HTML - modal content is built dynamically each time
  document.getElementById('apiKeyModal').classList.remove('active');
}

// v10.5.25: Nanobanana API Key Modal
function openNanobananaKeyModal() {
  var modal = document.getElementById('nanobananaKeyModal');
  if (!modal) {
    // Create modal if it doesn't exist
    modal = document.createElement('div');
    modal.id = 'nanobananaKeyModal';
    modal.className = 'api-key-modal';
    modal.onclick = function() { closeNanobananaKeyModal(); };
    modal.innerHTML = `
      <div class="api-key-modal-content" onclick="event.stopPropagation()" style="max-width: 480px;">
        <h3 class="api-key-modal-title">Nano Banana (Gemini 2.0/3.0)</h3>
        <p class="api-key-modal-desc">Configure your Nano Banana API key for Studio text and image generation. This uses Google's Gemini API.</p>

        <div class="api-key-input-group" style="margin-top: var(--space-4);">
          <label class="api-key-input-label">Nano Banana / Gemini API Key</label>
          <input type="password" class="api-key-input" id="nanobananaKeyInput" placeholder="AIza..." onkeypress="if(event.key==='Enter') saveNanobananaKey()">
        </div>
        <div id="nanobananaKeyStatusBox" style="display: none; font-size: var(--text-sm); padding: var(--space-2); border-radius: var(--radius-sm); margin-top: var(--space-2);"></div>

        <div id="nanobananaKeyControls" style="display:none;margin-top:12px;display:flex;align-items:center;gap:10px;">
          <div style="flex:1;display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--text-muted);">Image Generation</span>
            <button id="nanobananaToggleBtn" onclick="toggleImageGen()" style="font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid;cursor:pointer;transition:all 0.2s;">Enabled</button>
          </div>
          <button onclick="deleteNanobananaKey()" style="font-size:11px;color:var(--text-muted);background:none;border:1px solid var(--border-color);border-radius:6px;padding:4px 10px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.color='#ef4444';this.style.borderColor='#ef4444'" onmouseout="this.style.color='var(--text-muted)';this.style.borderColor='var(--border-color)'">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Remove Key
          </button>
        </div>

        <div style="margin-top:14px;padding:14px 16px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);">
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:10px;">
            <strong style="color:var(--text-primary);font-size:13px;">Available models</strong><br>
            <span style="color:var(--accent);">&#8226;</span> <strong>Flash (Text)</strong> - Fast text generation<br>
            <span style="color:var(--accent);">&#8226;</span> <strong>Studio (Image)</strong> - Image generation with Gemini
          </div>
          <div style="border-top:1px solid var(--border-color);padding-top:10px;font-size:12px;color:var(--text-muted);line-height:1.7;">
            <span style="color:var(--accent);">1.</span> Visit <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent);text-decoration:none;">Google AI Studio</a> to create an API key<br>
            <span style="color:var(--accent);">2.</span> Or email <a href="mailto:roweos@therowecollection.com" style="color:var(--accent);text-decoration:none;">roweos@therowecollection.com</a> for private Beta key access
          </div>
        </div>

        <div class="api-key-modal-actions" style="margin-top: var(--space-5);">
          <button class="api-key-modal-btn api-key-modal-btn-cancel" onclick="closeNanobananaKeyModal()">Cancel</button>
          <button class="api-key-modal-btn api-key-modal-btn-save" onclick="saveNanobananaKey()">Save Key</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Load existing key
  var storedKeys = localStorage.getItem('roweos_api_keys');
  var controls = document.getElementById('nanobananaKeyControls');
  if (storedKeys) {
    var apiKeys = JSON.parse(storedKeys);
    if (apiKeys.nanobanana) {
      document.getElementById('nanobananaKeyInput').value = apiKeys.nanobanana;
      var statusBox = document.getElementById('nanobananaKeyStatusBox');
      statusBox.style.display = 'block';
      statusBox.style.background = 'rgba(74, 222, 128, 0.1)';
      statusBox.style.color = '#4ade80';
      statusBox.textContent = 'API key configured';
      // v24.11: Show controls row with toggle + delete
      if (controls) {
        controls.style.display = 'flex';
        var toggleBtn = document.getElementById('nanobananaToggleBtn');
        if (toggleBtn) updateNanobananaToggleUI(toggleBtn);
      }
    } else {
      if (controls) controls.style.display = 'none';
    }
  } else {
    if (controls) controls.style.display = 'none';
  }

  modal.classList.add('active');
}

function closeNanobananaKeyModal() {
  var modal = document.getElementById('nanobananaKeyModal');
  if (modal) modal.classList.remove('active');
}

function saveNanobananaKey() {
  var key = document.getElementById('nanobananaKeyInput').value.trim();
  
  if (!key) {
    showToast('Please enter an API key', 'error');
    return;
  }
  
  // Save to localStorage
  var storedKeys = localStorage.getItem('roweos_api_keys');
  var apiKeys = storedKeys ? JSON.parse(storedKeys) : {};
  apiKeys.nanobanana = key;
  localStorage.setItem('roweos_api_keys', JSON.stringify(apiKeys));
  
  // Update status
  var statusBox = document.getElementById('nanobananaKeyStatusBox');
  statusBox.style.display = 'block';
  statusBox.style.background = 'rgba(74, 222, 128, 0.1)';
  statusBox.style.color = '#4ade80';
  statusBox.textContent = '✓ API key saved';
  
  // Update settings page status
  var settingsStatus = document.getElementById('nanobananaKeyStatus');
  if (settingsStatus) settingsStatus.textContent = '✓ Configured';
  
  showToast('Nano Banana API key saved', 'success');

  // v13.9: Update Nanobanana visibility in chat model dropdowns
  if (typeof updateNanobananaChatSections === 'function') updateNanobananaChatSections();

  setTimeout(function() {
    closeNanobananaKeyModal();
  }, 1000);
}

// v25.3: switchProviderTab removed - each modal is now single-provider

// v24.10: Delete API key for current provider
// v25.3: Updated to use PROVIDER_CONFIG and unified roweos_api_keys storage
function deleteCurrentProviderApiKey() {
  var config = PROVIDER_CONFIG[currentProvider];
  var providerName = config ? config.name : currentProvider;
  if (!confirm('Delete ' + providerName + ' API key?')) return;
  // Remove from unified JSON storage
  try {
    var apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    delete apiKeys[currentProvider];
    localStorage.setItem('roweos_api_keys', JSON.stringify(apiKeys));
  } catch(e) {}
  // Also remove legacy separate keys
  var keyMap = { anthropic: 'roweos_api_key', openai: 'roweos_openai_api_key', google: 'roweos_google_api_key' };
  var storageKey = keyMap[currentProvider];
  if (storageKey) localStorage.removeItem(storageKey);
  providerKeys[currentProvider] = false;
  writeDB('profile/main', { apiKeyDeleted: currentProvider }); // v25.1
  showToast(providerName + ' API key deleted', 'success');
  checkApiConnection(true);
  closeApiKeyModal();
}

function updateProviderKeyStatuses() {
  ['anthropic', 'openai', 'google'].forEach(function(provider) {
    var statusEl = document.getElementById('keyStatus-' + provider);
    if (statusEl && providerKeys[provider]) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(74, 222, 128, 0.1)';
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '✓ API key configured';
    } else if (statusEl) {
      statusEl.style.display = 'none';
    }
  });
}

function saveCurrentProviderApiKey() {
  saveProviderApiKey(currentProvider);
}

async function saveProviderApiKey(provider) {
  var apiKey = document.getElementById('apiKeyInput-' + provider).value.trim();
  // v25.3: Skip if value is the masked placeholder
  if (apiKey.indexOf('...') > -1) {
    showToast('Key already configured', 'success');
    return;
  }
  if (!apiKey) {
    var statusEl = document.getElementById('keyStatus-' + provider);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(255, 68, 68, 0.1)';
      statusEl.style.color = '#ff4444';
      statusEl.textContent = 'Please enter an API key';
    }
    return;
  }
  
  var saveBtn = document.getElementById('apiKeySaveBtn');
  if (saveBtn) {
    saveBtn.textContent = 'Validating...';
    saveBtn.disabled = true;
  }
  
  var statusEl = document.getElementById('keyStatus-' + provider);
  if (statusEl) statusEl.style.display = 'none';
  
  try {
    console.log('[API] Saving ' + provider + ' API key...');
    
    // Dual-mode: Desktop Electron IPC OR Browser localStorage
    if (isDesktopApp && window.roweosAPI && window.roweosAPI.saveProviderApiKey) {
      // Desktop mode: Use Electron IPC
      var result = await window.roweosAPI.saveProviderApiKey(provider, apiKey);
      console.log('[API] Desktop save result:', result);
    } else {
      // Browser mode: Use localStorage
      var apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
      apiKeys[provider] = apiKey;
      localStorage.setItem('roweos_api_keys', JSON.stringify(apiKeys));
      console.log('[API] Browser save complete for ' + provider);
    }
    
    // Success - the API key was saved
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(74, 222, 128, 0.1)';
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '✓ API key saved successfully!';
    }
    
    // Clear input for security
    document.getElementById('apiKeyInput-' + provider).value = '';
    
    // Check connection
    console.log('[API] Checking connection...');
    await checkApiConnection();
    console.log('[API] Connection check complete. apiConnected:', apiConnected);

    // v29.1: Immediately update provider badges so Connected/Disconnected reflects without page flip
    if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
    
    // v25.3: Re-open modal to show updated state (model picker is now inline)
    setTimeout(function() {
      var config = PROVIDER_CONFIG[provider];
      var providerName = config ? config.name : provider;
      showToast(providerName + ' API key saved!', 'success');
      openApiKeyModal(provider);
      // v19.1: Sync updated key to cloud if scheduler enabled
      if (typeof syncApiKeysToCloud === 'function') syncApiKeysToCloud();
    }, 1500);
  } catch (error) {
    console.error('[API] Exception:', error);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(255, 68, 68, 0.1)';
      statusEl.style.color = '#ff4444';
      statusEl.textContent = 'Error saving API key: ' + error.message;
    }
  }
  
  if (saveBtn) {
    saveBtn.textContent = 'Validate & Save';
    saveBtn.disabled = false;
  }
}

// v14.3: DEPRECATED by v25.3 - model picker is now inline in per-provider modal
function showModelPickerInModal(provider) {
  var modalContent = document.querySelector('.api-key-modal-content');
  if (!modalContent) { closeApiKeyModal(); return; }
  // v18.9: Save original HTML so closeApiKeyModal can restore it
  if (!window._apiKeyModalOriginalHTML) {
    window._apiKeyModalOriginalHTML = modalContent.innerHTML;
  }

  var models = {
    anthropic: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', desc: 'Most capable, complex reasoning and analysis', color: '#a89878', recommended: true },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Fast, intelligent, great for most tasks', color: '#f97316', recommended: false },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', desc: 'Fastest responses, cost-effective', color: '#22c55e', recommended: false }
    ],
    openai: [
      { id: 'gpt-5.4', name: 'GPT-5.4', desc: 'Most capable frontier model for professional work', color: '#22c55e', recommended: true },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', desc: 'Maximum performance on complex tasks', color: '#4ade80', recommended: false },
      { id: 'gpt-5.4-thinking', name: 'GPT-5.4 Thinking', desc: 'Extended reasoning for complex analysis', color: '#86efac', recommended: false }
    ],
    google: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Advanced reasoning and multimodal capabilities', color: '#3b82f6', recommended: true },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash', desc: 'Fast responses, great for quick tasks', color: '#22c55e', recommended: false }
    ]
  };

  var providerModels = models[provider] || models.anthropic;
  var providerName = provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google';

  var html = '<div style="text-align:center;margin-bottom:20px;">';
  html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:8px;"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>';
  html += '<h3 style="margin:0 0 4px;font-size:18px;color:var(--text-primary);">Choose Your Default Model</h3>';
  html += '<p style="margin:0;font-size:13px;color:var(--text-muted);">Select a ' + providerName + ' model for all brands</p>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">';
  providerModels.forEach(function(m) {
    html += '<div class="model-picker-card" onclick="selectModelFromPicker(\'' + provider + '\', \'' + m.id + '\')" style="padding:16px;border:2px solid var(--border-color);border-radius:12px;cursor:pointer;transition:all 0.2s;text-align:center;" onmouseover="this.style.borderColor=\'' + m.color + '\';this.style.background=\'' + m.color + '10\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.background=\'transparent\'">';
    html += '<div style="width:36px;height:36px;border-radius:50%;background:' + m.color + '20;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">';
    html += '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + m.color + '" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/></svg>';
    html += '</div>';
    html += '<div style="font-weight:600;font-size:14px;color:var(--text-primary);margin-bottom:4px;">' + m.name + '</div>';
    html += '<div style="font-size:12px;color:var(--text-muted);line-height:1.4;">' + m.desc + '</div>';
    if (m.recommended) {
      html += '<div style="margin-top:8px;font-size:11px;color:' + m.color + ';font-weight:600;">Recommended</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  html += '<div style="text-align:center;">';
  html += '<button onclick="closeApiKeyModal()" style="background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;padding:8px 16px;">Skip for now</button>';
  html += '</div>';

  modalContent.innerHTML = html;
}

// v14.3: Handle model selection from picker
function selectModelFromPicker(provider, modelId) {
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
    console.error('[v14.3] Error setting model:', e);
  }
  closeApiKeyModal();
}

// Legacy function for backward compatibility
async function saveApiKey() {
  return saveProviderApiKey('anthropic');
}

async function clearApiKey() {
  // Dual-mode: Desktop Electron IPC OR Browser localStorage
  if (isDesktopApp && window.roweosAPI && window.roweosAPI.clearApiKey) {
    await window.roweosAPI.clearApiKey();
  } else {
    // Browser mode: Clear from localStorage
    localStorage.removeItem('roweos_api_keys');
  }
  
  apiConnected = false;
  updateApiStatus();
  if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
  showToast('API keys removed', 'info');
}

// ============================================
// Firebase Cloud Sync Functions
// ============================================

var firebaseInstance = null;
var firebaseUser = null;
var firebaseConfig = null;
var firebaseInitialized = false;

// v15.0: Central RoweOS Firebase config (hardcoded - no user config needed)
var ROWEOS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBHv_Qzsv5ygLH9YehPKpMrgxRGwX0yv6w",
  authDomain: "roweos.firebaseapp.com",
  projectId: "roweos",
  storageBucket: "roweos.firebasestorage.app",
  messagingSenderId: "1084193250080",
  appId: "1:1084193250080:web:70981ab7261f5cdc141545"
};
var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
function isAdmin() { return firebaseUser && firebaseUser.uid === ADMIN_UID; }

function toggleFirebaseStep(stepNum) {
  var content = document.getElementById('firebaseStep' + stepNum);
  var chevron = document.getElementById('firebaseChevron' + stepNum);
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    chevron.classList.add('open');
  } else {
    content.style.display = 'none';
    chevron.classList.remove('open');
  }
}

function openFirebaseConfigModal() {
  var modal = document.getElementById('firebaseConfigModal');
  if (modal) modal.classList.add('active');
  updateFirebaseModalUI();
  updateCloudSyncUI();
}

function closeFirebaseConfigModal() {
  document.getElementById('firebaseConfigModal').classList.remove('active');
}

function updateFirebaseModalUI() {
  var notConnected = document.getElementById('firebaseNotConnected');
  var connected = document.getElementById('firebaseConnected');
  var saveBtn = document.getElementById('firebaseSaveBtn');
  if (!notConnected || !connected || !saveBtn) return;

  if (firebaseUser) {
    notConnected.style.display = 'none';
    connected.style.display = 'block';
    var emailEl = document.getElementById('firebaseUserEmail');
    var projEl = document.getElementById('firebaseProjectId');
    if (emailEl) emailEl.textContent = firebaseUser.email || 'Unknown user';
    if (projEl) projEl.textContent = 'Project: ' + (ROWEOS_FIREBASE_CONFIG.projectId || 'Unknown');
    saveBtn.textContent = 'Disconnect';
    saveBtn.onclick = disconnectFirebase;
  } else {
    notConnected.style.display = 'block';
    connected.style.display = 'none';
    saveBtn.textContent = 'Connect & Sign In';
    saveBtn.onclick = function() { handleGoogleSignIn(); };
  }
}

async function connectFirebase() {
  var configText = document.getElementById('firebaseConfigInput').value.trim();
  var statusEl = document.getElementById('firebaseConfigStatus');
  
  if (!configText) {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
    statusEl.style.color = '#ef4444';
    statusEl.textContent = 'Please paste your Firebase config';
    return;
  }
  
  try {
    // v9.1.14: Clean up common copy-paste issues
    var cleanConfig = configText
      // Remove smart/curly quotes and replace with straight quotes
      .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
      .replace(/[""]/g, '"')            // Fancy double quotes
      .replace(/['']/g, "'")            // Fancy single quotes
      // Remove "const firebaseConfig = " prefix if present
      .replace(/^const\s+firebaseConfig\s*=\s*/, '')
      .replace(/^var\s+firebaseConfig\s*=\s*/, '')
      .replace(/^firebaseConfig\s*=\s*/, '')
      // Remove trailing semicolon
      .replace(/;?\s*$/, '')
      .trim();
    
    // Parse config
    var config;
    try {
      config = JSON.parse(cleanConfig);
    } catch (e) {
      // Try extracting just the object part
      var match = cleanConfig.match(/\{[\s\S]*\}/);
      if (match) {
        // v9.1.14: Fix unquoted keys more robustly
        // Firebase console gives: apiKey:"value" but JSON needs "apiKey":"value"
        var fixedJson = match[0]
          // Add quotes around unquoted keys (word followed by colon)
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
          // Fix any double-quoted keys that got extra quotes
          .replace(/""+/g, '"');
        try {
          config = JSON.parse(fixedJson);
        } catch (e2) {
          throw new Error('JSON Parse error: Expected \'}\'. Make sure you copied the entire config including the closing brace.');
        }
      } else {
        throw new Error('JSON Parse error: ' + e.message + '. Make sure you copied the entire config including the { } braces.');
      }
    }
    
    // Validate required fields
    if (!config.apiKey) {
      throw new Error('Missing apiKey - make sure you copied the complete config');
    }
    if (!config.authDomain) {
      throw new Error('Missing authDomain - make sure you copied the complete config');
    }
    if (!config.projectId) {
      throw new Error('Missing projectId - make sure you copied the complete config');
    }
    
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(168, 152, 120, 0.1)';
    statusEl.style.color = 'var(--accent)';
    statusEl.textContent = 'Connecting to Firebase...';
    
    // Save config
    localStorage.setItem('roweos_firebase_config', JSON.stringify(config, null, 2));
    firebaseConfig = config;
    
    // Initialize Firebase and sign in
    await initializeFirebase(config, true);
    
    statusEl.style.display = 'none';
    
  } catch (error) {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
    statusEl.style.color = '#ef4444';
    statusEl.textContent = 'Error: ' + error.message;
    console.error('Firebase connect error:', error);
  }
}


// Helper function to complete Firebase login flow
function completeFirebaseLogin(user) {
  console.log('Firebase: completeFirebaseLogin called for', user.email);
  
  // Prevent this from running multiple times
  if (window._firebaseLoginInProgress) {
    console.log('Firebase: Login already in progress, skipping');
    return;
  }
  window._firebaseLoginInProgress = true;
  
  try {
    // CRITICAL: Set firebaseUser FIRST before anything else
    window.firebaseUser = user;
    firebaseUser = user;
    console.log('Firebase: Set firebaseUser to', user.uid);
    
    // Close any modals
    if (typeof closeFirebaseConfigModal === 'function') closeFirebaseConfigModal();

    // v12.2.7: If connecting during onboarding, don't hide onboarding screens
    if (window._onboardingInProgress) {
      console.log('Firebase: Connected during onboarding, staying in onboarding flow');
      var onbFirebaseStatus = document.getElementById('onboardingFirebaseStatus');
      if (onbFirebaseStatus) {
        onbFirebaseStatus.style.display = 'block';
        onbFirebaseStatus.style.background = 'rgba(74, 222, 128, 0.1)';
        onbFirebaseStatus.style.color = '#4ade80';
        onbFirebaseStatus.textContent = 'Signed in as ' + user.email;
      }
      if (typeof showToast === 'function') {
        showToast('Signed in as ' + user.email, 'success');
      }
      window._firebaseLoginInProgress = false;
      return;
    }

    // Hide ALL possible screens that might be showing
    var elementsToHide = [
      document.getElementById('onboardingView'),
      document.getElementById('startupScreen'),
      document.getElementById('launchScreen'),
      document.querySelector('.welcome-overlay'),
      document.querySelector('.welcome-screen'),
      document.querySelector('.onboarding-container')
    ];

    elementsToHide.forEach(function(el) {
      if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
      }
    });

    // Remove any body classes that might interfere
    document.body.classList.remove('onboarding-active');
    document.body.classList.remove('welcome-active');

    // Force show the agent view
    if (typeof showView === 'function') {
      showView('agent');
    }

    // v22.1: Show admin nav for admin user
    if (typeof updateAdminNavVisibility === 'function') updateAdminNavVisibility();

    // Show success toast
    if (typeof showToast === 'function') {
      showToast('Signed in as ' + user.email, 'success');
    }

    // v20.6: Detect new users and notify Jordan + auto-assign free tier
    try {
      var creationTime = user.metadata && user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
      var lastSignIn = user.metadata && user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
      // New user: creation time within 60s of last sign-in (first login ever)
      var isNewUser = creationTime > 0 && lastSignIn > 0 && Math.abs(lastSignIn - creationTime) < 60000;
      if (isNewUser) {
        console.log('[RoweOS] New user detected:', user.email);
        // Determine sign-in method
        var signInMethod = 'email';
        if (user.providerData && user.providerData.length > 0) {
          var pid = user.providerData[0].providerId || '';
          if (pid.indexOf('google') !== -1) signInMethod = 'Google';
          else if (pid.indexOf('twitter') !== -1) signInMethod = 'X';
          else if (pid.indexOf('password') !== -1) signInMethod = 'Email';
        }
        // Notify via API (fire-and-forget)
        try {
          fetch('/api/notify-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email || '',
              displayName: user.displayName || '',
              method: signInMethod,
              uid: user.uid,
              createdAt: new Date().toISOString()
            })
          }).catch(function(e) { console.warn('[RoweOS] Signup notification failed:', e.message); });
        } catch(notifyErr) {}
        // v27.1: Auto-generate access key and send welcome email
        if (typeof autoGenerateAccessKey === 'function') {
          autoGenerateAccessKey(user).then(function(generatedKey) {
            if (generatedKey) {
              sendEarlyAccessEmail(user, generatedKey);
              if (typeof showAccessKeyVerification === 'function') {
                showAccessKeyVerification(user.email);
              }
            }
          });
        }
      }
    } catch(newUserErr) { console.warn('[RoweOS] New user check error:', newUserErr.message); }

    // v20.6: Auto-detect access key by email (fire-and-forget)
    try {
      if (typeof autoDetectAccessKey === 'function') {
        autoDetectAccessKey().catch(function(e) {
          console.warn('[RoweOS] Auto-detect key failed:', e.message);
        });
      }
    } catch(autoKeyErr) {}

    // v20.9: Auto-deliver purchased API keys (fire-and-forget)
    try {
      if (typeof checkAndDeliverPurchasedApiKeys === 'function') {
        checkAndDeliverPurchasedApiKeys();
      }
    } catch(apiDeliverErr) {}

    // v22.8: Proactive Firestore cleanup of deleted automation zombies
    try { if (typeof _cleanupDeletedFromFirestore === 'function') _cleanupDeletedFromFirestore(); } catch(e) {}

    // v20.14: Re-register push subscription now that firebaseUser is set
    // (initPushNotifications runs before auth resolves, so silent re-subscribe fails with null uid)
    try {
      if (localStorage.getItem('roweos_push_enabled') === 'true' && typeof subscribeToPush === 'function') {
        subscribeToPush(true);
      }
    } catch(pushErr) {}

    // Start sync after DOM settles - with multiple attempts for reliability
    console.log('Firebase: Scheduling data load...');
    
    // Immediate attempt
    setTimeout(function() {
      console.log('Firebase: First attempt - firebaseUser =', firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser && firebase) {
        if (typeof setupRealtimeSync === 'function') setupRealtimeSync();
        if (typeof loadFromFirebase === 'function') {
          console.log('Firebase: Calling loadFromFirebase (attempt 1)...');
          loadFromFirebase(true).catch(function(e) {
            console.error('Firebase: First load attempt failed:', e);
          });
        }
      }
    }, 300);
    
    // Backup attempt after longer delay (for PWA/iOS)
    setTimeout(function() {
      console.log('Firebase: Backup attempt - firebaseUser =', firebaseUser ? firebaseUser.uid : 'null');
      // Check if brands were loaded
      var brandsStr = localStorage.getItem('roweos_brands');
      var hasBrands = brandsStr && JSON.parse(brandsStr).length > 0;
      
      if (firebaseUser && firebase && !hasBrands) {
        console.log('Firebase: No brands found, retrying load...');
        if (typeof loadFromFirebase === 'function') {
          loadFromFirebase(true).then(function() {
            console.log('Firebase: Backup load completed');
            if (typeof reloadAllData === 'function') reloadAllData();
          }).catch(function(e) {
            console.error('Firebase: Backup load failed:', e);
          });
        }
      } else if (hasBrands) {
        console.log('Firebase: Brands already loaded, count:', JSON.parse(brandsStr).length);
        // Still refresh UI to ensure display
        if (typeof reloadAllData === 'function') reloadAllData();
      }
      
      // v7.10: Start both periodic sync (push) and load check
      if (typeof startPeriodicSync === 'function') startPeriodicSync();
      if (typeof startPeriodicLoadCheck === 'function') startPeriodicLoadCheck();
      
      // v7.10: Show Last Synced row and update display with device
      var lastSync = localStorage.getItem('roweos_last_sync');
      var lastDevice = localStorage.getItem('roweos_last_sync_device');
      if (typeof updateLastSyncDisplay === 'function') {
        updateLastSyncDisplay(lastSync || 'Not yet synced', lastDevice);
      }
      
      // v7.10: Perform immediate sync after login
      setTimeout(function() {
        if (typeof silentSyncToFirebase === 'function' && firebaseUser) {
          console.log('[Firebase] Initial sync after login...');
          silentSyncToFirebase();
        }
      }, 3000);
    }, 2000);
  } catch (e) {
    console.error('Firebase: Error in completeFirebaseLogin:', e);
  } finally {
    window._firebaseLoginInProgress = false;
  }
}

// v15.0: Rewritten as ES5, uses hardcoded ROWEOS_FIREBASE_CONFIG
function initializeFirebase(shouldSignIn) {
  if (shouldSignIn === undefined) shouldSignIn = false;

  // Firebase SDKs are loaded via script tags in <head>, no dynamic loading needed
  if (!window.firebase) {
    console.warn('[Firebase] SDK not loaded - check script tags');
    return Promise.resolve();
  }

  // Initialize or get existing app
  if (firebase.apps.length === 0) {
    firebaseInstance = firebase.initializeApp(ROWEOS_FIREBASE_CONFIG);
  } else {
    firebaseInstance = firebase.app();
  }

  // v25.1: Enable Firestore offline persistence for write-through sync
  try {
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
      .then(function() { console.log('[Sync V3] Firestore offline persistence enabled'); })
      .catch(function(err) {
        if (err.code === 'failed-precondition') {
          console.warn('[Sync V3] Persistence failed: multiple tabs open');
        } else if (err.code === 'unimplemented') {
          console.warn('[Sync V3] Persistence not available in this browser');
        }
      });
  } catch(e) { console.warn('[Sync V3] enablePersistence error:', e); }

  // v26.3: Request persistent storage for PWA (prevents Windows/Chrome from clearing localStorage)
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(function(granted) {
        if (granted) {
          console.log('[Storage] Persistent storage granted');
        } else {
          console.warn('[Storage] Persistent storage denied -- data may be cleared by browser');
        }
      });
    }
  } catch(e) { console.warn('[Storage] persist() error:', e); }

  // v26.3: Explicit auth persistence for PWA -- keep user signed in across app restarts
  try {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch(e) { console.warn('[Firebase] setPersistence error:', e); }

  // Only set up auth listener once
  if (!firebaseInitialized) {
    firebaseInitialized = true;

    // v15.0: Central auth state handler
    firebase.auth().onAuthStateChanged(function(user) {
      firebaseUser = user;
      try { updateFirebaseSyncUI(); } catch(e) { console.warn('[Firebase] updateFirebaseSyncUI error:', e.message); }
      try { updateFirebaseModalUI(); } catch(e) { console.warn('[Firebase] updateFirebaseModalUI error:', e.message); }
      try { updateCloudSyncUI(); } catch(e) { console.warn('[Firebase] updateCloudSyncUI error:', e.message); }
      // v15.0: Delegate to central auth handler
      try { handleAuthState(user); } catch(e) { console.error('[Firebase] handleAuthState error:', e.message); hideAuthGate(); showStartupScreen(); }
    });

    // Track if login has been completed to prevent double-execution
    var firebaseLoginCompleted = false;

    // STEP 1: Check for redirect result FIRST (for mobile redirect flow)
    firebase.auth().getRedirectResult()
      .then(function(result) {
        console.log('Firebase: getRedirectResult returned:', result ? 'has result' : 'no result');
        if (result && result.user && !firebaseLoginCompleted) {
          console.log('Firebase: Redirect login success for', result.user.email);
          firebaseLoginCompleted = true;
          firebaseUser = result.user;
          sessionStorage.removeItem('roweos_firebase_auth_pending');
          completeFirebaseLogin(result.user);
        }
      })
      .catch(function(error) {
        console.log('Firebase: getRedirectResult error:', error.code, error.message);
        // v15.13: Show toast for redirect errors (except suppressed ones)
        if (error.code === 'auth/operation-not-allowed') {
          console.warn('Firebase: Sign-in provider not enabled (redirect result)');
        } else if (error.code !== 'auth/popup-closed-by-user') {
          showToast('Sign-in error: ' + (error.message || '').substring(0, 60), 'error');
        }
        // Clear pending flag on error
        sessionStorage.removeItem('roweos_firebase_auth_pending');
      });
    
    // STEP 2: Also listen for auth state changes (backup and for existing sessions)
    firebase.auth().onAuthStateChanged(function(user) {
      console.log('Firebase: onAuthStateChanged fired, user:', user ? user.email : 'null', 'loginCompleted:', firebaseLoginCompleted);

      if (user) {
        firebaseUser = user;
        // v25.1: Flush any writes queued while signed out
        if (typeof flushPendingWrites === 'function') flushPendingWrites();
        // v25.0: One-time V2-to-V3 migration
        if (typeof migrateToSyncV3 === 'function') migrateToSyncV3();
        // v25.0: Startup reconciliation
  // v28.0: Check for v4 migration before standard sync
  if (firebaseUser && typeof migrationEngine !== 'undefined' && migrationEngine.needsMigration()) {
    var _migOverlay = document.getElementById('migrationOverlay');
    if (_migOverlay) _migOverlay.style.display = 'block';
    var _migSteps = document.getElementById('migrationSteps');
    var _migBar = document.getElementById('migrationProgressBar');
    var _migLabels = ['Brands','Settings','Brand Settings','Life Profiles','Life Settings',
      'Todos','Calendar','Automations','Conversations','Pulse','Library','Folio',
      'Clients','Runs','Inventory','Logos','Knowledge','Social Tokens','Social Activity',
      'Scavenger Configs','Scavenger Targets','Visual Assets','API Keys','Mail',
      'Social Posts','Social Workflows','Notifications','People','Push Subscriptions',
      'Verifying','Complete'];
    var _migDone = {};
    window._migrationProgressCb = function(label, current, total) {
      if (label === 'Complete') {
        if (_migBar) _migBar.style.width = '100%';
        // v29.0: Don't hide overlay — keep it visible until reload so user sees completion
        if (_migSteps) {
          _migSteps.innerHTML += '<div style="color:#4ade80;font-weight:600;margin-top:12px;">Migration complete. Restarting...</div>';
        }
        return;
      }
      _migDone[label] = true;
      var doneCount = Object.keys(_migDone).length;
      var pct = Math.min(95, Math.round((doneCount / _migLabels.length) * 100));
      if (_migBar) _migBar.style.width = pct + '%';
      if (_migSteps) {
        var html = '';
        for (var mi = 0; mi < _migLabels.length; mi++) {
          var sl = _migLabels[mi];
          if (_migDone[sl]) {
            html += '<div style="color:#4ade80;">&#10003; ' + sl + '</div>';
          } else if (mi === doneCount) {
            html += '<div style="color:#a89878;">&#9679; ' + sl + '...</div>';
          } else if (mi > doneCount) {
            html += '<div>&#9675; ' + sl + '</div>';
          }
        }
        _migSteps.innerHTML = html;
      }
    };
    window._v4MigrationRunning = true; // v28.0: Block reconcileOnStartup
    migrationEngine.run(window._migrationProgressCb).then(function() {
      console.log('[SyncV4] Migration complete -- reloading app on v4');
      // v29.0: Give user 3s to see completion before reload
      setTimeout(function() { location.reload(); }, 3000);
    }).catch(function(err) {
      window._v4MigrationRunning = false;
      var errEl = document.getElementById('migrationError');
      var errMsg = document.getElementById('migrationErrorMsg');
      if (errEl) errEl.style.display = 'block';
      if (errMsg) errMsg.textContent = err.message;
      // Let the app continue on old namespace
      if (typeof reconcileOnStartup === 'function') reconcileOnStartup();
    });
    // v28.0: STOP here -- do not continue auth flow while migrating
    return;
  } else if (firebaseUser && typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    syncEngine._setupConnectivity();
    syncEngine.setupListeners();
    _registerDevice();
    // v28.0: One-time brand order fix (adds _order to brands migrated without it)
    try {
      var _bFixArr = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
      if (_bFixArr.length > 0 && typeof _bFixArr[0]._order !== 'number') {
        var _bFixDb = typeof getDB === 'function' ? getDB() : null;
        var _bFixPath = _getV4BasePath();
        if (_bFixDb && _bFixPath) {
          var _bFixBatch = _bFixDb.batch();
          for (var _bi = 0; _bi < _bFixArr.length; _bi++) {
            _bFixArr[_bi]._order = _bi;
            if (_bFixArr[_bi].id) {
              _bFixBatch.set(_bFixDb.doc(_bFixPath + '/brands/' + _bFixArr[_bi].id), { _order: _bi }, { merge: true });
            }
          }
          localStorage.setItem('roweos_user_brands', JSON.stringify(_bFixArr));
          _bFixBatch.commit().then(function() {
            console.log('[SyncV4] Brand order fix applied');
          });
        }
      }
    } catch(_bfe) {}
    // v28.0: Clear stale conflicts from failed migration
    try { localStorage.setItem('roweos_v4_conflicts', '[]'); } catch(_cfe) {}
    console.log('[SyncV4] Already migrated: listeners active');
  }
      // v28.3: Check API keys immediately after auth resolves
      if (typeof checkApiConnection === 'function') {
        checkApiConnection().then(function() {
          if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
        });
      }
        if (!window._v4MigrationRunning && typeof reconcileOnStartup === 'function') reconcileOnStartup();

        // Only complete login if not already done by getRedirectResult
        if (!firebaseLoginCompleted) {
          var hasPendingAuth = sessionStorage.getItem('roweos_firebase_auth_pending');

          if (hasPendingAuth) {
            console.log('Firebase: Completing pending auth for', user.email);
            firebaseLoginCompleted = true;
            sessionStorage.removeItem('roweos_firebase_auth_pending');
            completeFirebaseLogin(user);
          } else {
            console.log('Firebase: Existing session for', user.email);
            setupRealtimeSync();
            // v22.1: Show admin nav for existing session
            if (typeof updateAdminNavVisibility === 'function') updateAdminNavVisibility();
            // v24.11: Resolve tier and update sidebar locks
            if (typeof getUserTier === 'function') {
              getUserTier().then(function() {
                if (typeof updateSidebarTierLocks === 'function') updateSidebarTierLocks();
              });
            }
            // v20.14: Re-register push subscription for existing sessions
            try {
              if (localStorage.getItem('roweos_push_enabled') === 'true' && typeof subscribeToPush === 'function') {
                subscribeToPush(true);
              }
            } catch(pushErr) {}
          }
        }
      } else {
        firebaseUser = null;
      }
    });
  }

  // If already signed in, we're done
  if (firebase.auth().currentUser) {
    firebaseUser = firebase.auth().currentUser;
    // v20.14: Re-register push subscription
    try {
      if (localStorage.getItem('roweos_push_enabled') === 'true' && typeof subscribeToPush === 'function') {
        subscribeToPush(true);
      }
    } catch(pushErr) {}
    return Promise.resolve();
  }

  // Only sign in if explicitly requested
  if (shouldSignIn) {
    return handleGoogleSignIn();
  }
  return Promise.resolve();
}

// v15.0: Centralized Google Sign-In handler (ES5, no async)
function handleGoogleSignIn() {
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  var isAndroid = /Android/i.test(navigator.userAgent);

  if (isStandalone && isIOS) {
    showToast('Opening sign-in...', 'info');
    return firebase.auth().signInWithPopup(provider).then(function(result) {
      if (result && result.user) {
        console.log('Firebase: iOS PWA popup success:', result.user.email);
      }
    }).catch(function(popupError) {
      console.log('Firebase: iOS PWA popup failed:', popupError.code);
      showToast('Please sign in via Safari browser, then re-add the app to your home screen', 'warning', 8000);
      window.open(window.location.href, '_blank');
    });
  } else if (isIOS && !isStandalone) {
    // v16.10: iOS Safari — popup instead of redirect (Safari ITP blocks redirect flow)
    showToast('Opening sign-in...', 'info');
    return firebase.auth().signInWithPopup(provider).then(function(result) {
      if (result && result.user) {
        console.log('Firebase: iOS Safari popup success:', result.user.email);
      }
    }).catch(function(popupError) {
      console.log('Firebase: iOS Safari popup failed:', popupError.code, '- trying redirect');
      sessionStorage.setItem('roweos_firebase_auth_pending', 'true');
      return firebase.auth().signInWithRedirect(provider);
    });
  } else if (isMobile && !isStandalone) {
    sessionStorage.setItem('roweos_firebase_auth_pending', 'true');
    showToast('Redirecting to Google sign-in...', 'info');
    return firebase.auth().signInWithRedirect(provider);
  } else if (isAndroid && isStandalone) {
    sessionStorage.setItem('roweos_firebase_auth_pending', 'true');
    showToast('Redirecting to Google sign-in...', 'info');
    return firebase.auth().signInWithRedirect(provider);
  } else {
    return firebase.auth().signInWithPopup(provider).then(function(result) {
      if (result && result.user) {
        console.log('Firebase popup sign-in success:', result.user.email);
      }
    }).catch(function(error) {
      if (error.code === 'auth/popup-blocked') {
        showToast('Popup blocked - redirecting...', 'info');
        return firebase.auth().signInWithRedirect(provider);
      } else if (error.code === 'auth/popup-closed-by-user') {
        showToast('Sign-in cancelled', 'info');
      } else if (error.code === 'auth/unauthorized-domain') {
        showToast('Add this domain to Firebase: Authentication > Settings > Authorized domains', 'error');
      } else {
        console.error('Firebase sign-in error:', error);
        showToast('Sign-in error: ' + error.message, 'error');
      }
    });
  }
}

// v20.6: X (Twitter) Firebase sign-in
function handleXSignIn() {
  var provider = new firebase.auth.TwitterAuthProvider();
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS) {
    showToast('Opening X sign-in...', 'info');
    return firebase.auth().signInWithPopup(provider).then(function(result) {
      if (result && result.user) {
        console.log('Firebase: X sign-in success:', result.user.displayName);
      }
    }).catch(function(popupError) {
      console.log('Firebase: X popup failed:', popupError.code, '- trying redirect');
      if (popupError.code === 'auth/popup-closed-by-user') {
        showToast('Sign-in cancelled', 'info');
      } else {
        sessionStorage.setItem('roweos_firebase_auth_pending', 'true');
        return firebase.auth().signInWithRedirect(provider);
      }
    });
  } else if (isMobile) {
    sessionStorage.setItem('roweos_firebase_auth_pending', 'true');
    showToast('Redirecting to X sign-in...', 'info');
    return firebase.auth().signInWithRedirect(provider);
  } else {
    return firebase.auth().signInWithPopup(provider).then(function(result) {
      if (result && result.user) {
        console.log('Firebase: X sign-in success:', result.user.displayName);
      }
    }).catch(function(error) {
      if (error.code === 'auth/popup-blocked') {
        showToast('Popup blocked - redirecting...', 'info');
        return firebase.auth().signInWithRedirect(provider);
      } else if (error.code === 'auth/popup-closed-by-user') {
        showToast('Sign-in cancelled', 'info');
      } else if (error.code === 'auth/unauthorized-domain') {
        showToast('Add this domain to Firebase: Authentication > Settings > Authorized domains', 'error');
      } else {
        console.error('Firebase X sign-in error:', error);
        showToast('Sign-in error: ' + error.message, 'error');
      }
    });
  }
}

// v20.6: Email/Password Firebase auth
var _authEmailMode = 'signin'; // 'signin' or 'create'

function toggleEmailAuthMode() {
  var btn = document.getElementById('authEmailBtn');
  var toggle = document.getElementById('authEmailToggle');
  var status = document.getElementById('authEmailStatus');
  var pwInput = document.getElementById('authPasswordInput');
  if (_authEmailMode === 'signin') {
    _authEmailMode = 'create';
    if (btn) btn.textContent = 'Create Account';
    if (toggle) toggle.innerHTML = 'Already have an account? <span style="color:#b2997b;font-weight:600;">Sign in</span>';
    if (pwInput) pwInput.setAttribute('autocomplete', 'new-password');
  } else {
    _authEmailMode = 'signin';
    if (btn) btn.textContent = 'Sign In';
    if (toggle) toggle.innerHTML = 'Don\'t have an account? <span style="color:#b2997b;font-weight:600;">Create one</span>';
    if (pwInput) pwInput.setAttribute('autocomplete', 'current-password');
  }
  if (status) { status.textContent = ''; status.style.color = 'rgba(255,255,255,0.4)'; }
}

function handleEmailPasswordAuth() {
  var email = (document.getElementById('authEmailInput') || {}).value;
  var password = (document.getElementById('authPasswordInput') || {}).value;
  var status = document.getElementById('authEmailStatus');
  var btn = document.getElementById('authEmailBtn');

  if (!email || !email.trim()) {
    if (status) { status.style.color = '#ef4444'; status.textContent = 'Please enter your email address'; }
    return;
  }
  if (!password || password.length < 6) {
    if (status) { status.style.color = '#ef4444'; status.textContent = 'Password must be at least 6 characters'; }
    return;
  }

  email = email.trim();
  if (btn) btn.disabled = true;
  if (status) { status.style.color = 'rgba(255,255,255,0.6)'; status.textContent = _authEmailMode === 'create' ? 'Creating account...' : 'Signing in...'; }

  var authPromise;
  if (_authEmailMode === 'create') {
    authPromise = firebase.auth().createUserWithEmailAndPassword(email, password);
  } else {
    authPromise = firebase.auth().signInWithEmailAndPassword(email, password);
  }

  authPromise.then(function(result) {
    if (btn) btn.disabled = false;
    if (status) { status.style.color = '#22c55e'; status.textContent = _authEmailMode === 'create' ? 'Account created!' : 'Signed in!'; }
    console.log('Firebase: Email auth success:', result.user.email);
  }).catch(function(error) {
    if (btn) btn.disabled = false;
    var msg = error.message || 'Authentication failed';
    // Friendlier error messages
    if (error.code === 'auth/email-already-in-use') msg = 'Email already has an account. Try signing in instead.';
    else if (error.code === 'auth/user-not-found') msg = 'No account with this email. Try creating one.';
    else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'Incorrect password. Please try again.';
    else if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
    else if (error.code === 'auth/weak-password') msg = 'Password is too weak. Use at least 6 characters.';
    else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Please wait and try again.';
    if (status) { status.style.color = '#ef4444'; status.textContent = msg; }
  });
}

function loadScript(src) {
  return new Promise(function(resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function disconnectFirebase() {
  // v15.7: Clean up real-time listeners before sign-out
  if (firebaseUnsubscribers && firebaseUnsubscribers.length > 0) {
    firebaseUnsubscribers.forEach(function(unsub) { if (typeof unsub === 'function') unsub(); });
    firebaseUnsubscribers = [];
    console.log('[Firebase] Real-time listeners cleaned up on sign-out');
  }
  isSyncing = false;

  if (firebase && firebase.auth()) {
    firebase.auth().signOut().then(function() {
      firebaseUser = null;
      updateFirebaseModalUI();
      updateCloudSyncUI();
      updateFirebaseSyncUI();
      showToast('Signed out', 'info');
      closeFirebaseConfigModal();
      // v15.0: Show auth gate on sign out
      showAuthGate();
    }).catch(function(error) {
      console.error('Firebase disconnect error:', error);
      showToast('Error disconnecting: ' + error.message, 'error');
    });
  }
}

function signOutFirebase() {
  if (confirm('Are you sure you want to sign out? Your local data will remain, but cloud sync will stop.')) {
    disconnectFirebase();
  }
}

// v15.0: signInWithGoogle simplified - always configured
function signInWithGoogle() {
  handleGoogleSignIn();
}

/**
 * v15.4: Sign in with Apple via Firebase OAuthProvider
 */
function handleAppleSignIn() {
  var provider = new firebase.auth.OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  if (isMobile && !isStandalone) {
    sessionStorage.setItem('roweos_firebase_auth_pending', 'true');
    showToast('Redirecting to Apple sign-in...', 'info');
    return firebase.auth().signInWithRedirect(provider);
  } else {
    return firebase.auth().signInWithPopup(provider).then(function(result) {
      if (result && result.user) {
        console.log('Firebase: Apple sign-in success:', result.user.email);
      }
    }).catch(function(error) {
      console.error('Firebase: Apple sign-in error:', error.code, error.message);
      if (error.code === 'auth/popup-closed-by-user') {
        showToast('Sign-in cancelled', 'info');
      } else if (error.code === 'auth/operation-not-allowed') {
        // v15.13: Suppress — Apple provider not enabled in Firebase Console
        console.warn('Firebase: Apple sign-in not enabled in Firebase project');
        showToast('Apple sign-in is not available. Use Google sign-in instead.', 'warning');
      } else {
        showToast('Apple sign-in failed: ' + error.message, 'error');
      }
    });
  }
}

// Manual sync trigger for Cloud Sync UI
function triggerCloudSync() {
  if (!firebaseUser) {
    showToast('Sign in to sync', 'warning');
    openFirebaseConfigModal();
    return;
  }
  
  syncToFirebase();
  showToast('Syncing to cloud...', 'info');
}

// v15.0: Firebase is always configured (hardcoded central config)
function isFirebaseConfigured() {
  return true;
}

// Update Cloud Sync UI status
function updateCloudSyncUI() {
  var statusEl = document.getElementById('cloudSyncStatus');
  var btnEl = document.getElementById('cloudSyncBtn');
  
  if (!statusEl || !btnEl) return;
  
  if (firebaseUser) {
    statusEl.innerHTML = '<span style="color: #22c55e;">●</span> Synced as ' + firebaseUser.email;
    btnEl.textContent = 'Sign Out';
    btnEl.onclick = signOutFirebase;
  } else if (isFirebaseConfigured()) {
    statusEl.innerHTML = '<span style="color: var(--text-muted);">○</span> Not signed in';
    btnEl.textContent = 'Sign In';
    btnEl.onclick = signInWithGoogle;
  } else {
    statusEl.innerHTML = '<span style="color: var(--warning);">○</span> Not configured';
    btnEl.textContent = 'Configure';
    btnEl.onclick = openFirebaseConfigModal;
  }
}

function updateFirebaseSyncUI() {
  var statusEl = document.getElementById('firebaseSyncStatus');
  var dotEl = document.getElementById('firebaseSyncDot');
  var syncRow = document.getElementById('syncNowRow');
  var signOutRow = document.getElementById('signOutRow');
  var signedInAs = document.getElementById('signedInAs');
  
  if (firebaseUser) {
    if (statusEl) statusEl.textContent = 'Connected as ' + (firebaseUser.email || 'Unknown');
    if (dotEl) dotEl.style.background = '#22c55e';
    if (syncRow) syncRow.style.display = 'flex';
    if (signOutRow) signOutRow.style.display = 'flex';
    if (signedInAs) signedInAs.textContent = firebaseUser.email || 'Sign out of cloud sync';
  } else {
    if (statusEl) statusEl.textContent = 'Not configured';
    if (dotEl) dotEl.style.background = '#ef4444';
    if (syncRow) syncRow.style.display = 'none';
    if (signOutRow) signOutRow.style.display = 'none';
  }
}

