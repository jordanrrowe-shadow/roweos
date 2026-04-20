// ═══════════════════════════════════════════════════════════════════════════
// OPERATION PARAMETERS (v9.1.14)
// ═══════════════════════════════════════════════════════════════════════════

var currentParamValues = {};

function renderOperationParams() {
  var container = document.getElementById('studioParams');
  var grid = document.getElementById('studioParamsGrid');
  if (!container || !grid) return;
  
  // Hide if no operation or no params
  if (!selectedOp || !selectedOp.params || selectedOp.params.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  grid.innerHTML = '';
  
  // Initialize param values with defaults
  if (!currentParamValues[selectedOp.id]) {
    currentParamValues[selectedOp.id] = {};
    selectedOp.params.forEach(function(param) {
      if (param.default !== undefined) {
        currentParamValues[selectedOp.id][param.id] = param.default;
      }
    });
  }
  
  var values = currentParamValues[selectedOp.id];
  
  selectedOp.params.forEach(function(param) {
    var group = document.createElement('div');
    group.className = 'studio-param-group';
    
    var label = document.createElement('label');
    label.className = 'studio-param-label';
    label.textContent = param.label;
    group.appendChild(label);
    
    if (param.type === 'text') {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'studio-param-input';
      input.placeholder = param.placeholder || '';
      input.value = values[param.id] || '';
      input.dataset.paramId = param.id;
      input.oninput = function() {
        currentParamValues[selectedOp.id][param.id] = this.value;
      };
      group.appendChild(input);
      
    } else if (param.type === 'select') {
      var select = document.createElement('select');
      select.className = 'studio-param-select';
      select.dataset.paramId = param.id;
      
      param.options.forEach(function(opt) {
        var option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (values[param.id] === opt) option.selected = true;
        select.appendChild(option);
      });
      
      select.onchange = function() {
        currentParamValues[selectedOp.id][param.id] = this.value;
      };
      group.appendChild(select);
      
    } else if (param.type === 'multi') {
      var multiContainer = document.createElement('div');
      multiContainer.className = 'studio-param-multi';
      
      var selectedValues = values[param.id] || [];
      if (!Array.isArray(selectedValues)) selectedValues = [selectedValues];
      
      param.options.forEach(function(opt) {
        var chip = document.createElement('span');
        chip.className = 'studio-param-chip';
        if (selectedValues.indexOf(opt) >= 0) chip.classList.add('selected');
        chip.textContent = opt;
        chip.dataset.value = opt;
        chip.onclick = function() {
          this.classList.toggle('selected');
          // Update values
          var newValues = [];
          multiContainer.querySelectorAll('.studio-param-chip.selected').forEach(function(c) {
            newValues.push(c.dataset.value);
          });
          currentParamValues[selectedOp.id][param.id] = newValues;
        };
        multiContainer.appendChild(chip);
      });
      
      group.appendChild(multiContainer);
    }
    
    grid.appendChild(group);
  });
}

function resetOperationParams() {
  if (!selectedOp) return;
  currentParamValues[selectedOp.id] = {};
  
  if (selectedOp.params) {
    selectedOp.params.forEach(function(param) {
      if (param.default !== undefined) {
        currentParamValues[selectedOp.id][param.id] = param.default;
      }
    });
  }
  
  renderOperationParams();
  showToast('Parameters reset', 'info');
}

// v22.33: Build contextual title from params + brand (e.g. "Acme Corp x TRC Integration")
function getStudioContextTitle(op, brandName) {
  if (!op || !op.params) return '';
  var values = currentParamValues[op.id] || {};
  // Look for a client/recipient/company name param
  var nameKeys = ['recipientName', 'clientName', 'companyName', 'brandName', 'targetBrand'];
  var clientName = '';
  for (var i = 0; i < nameKeys.length; i++) {
    if (values[nameKeys[i]] && values[nameKeys[i]].trim()) {
      clientName = values[nameKeys[i]].trim();
      break;
    }
  }
  // Fallback: check first text param that has a value
  if (!clientName) {
    for (var j = 0; j < op.params.length; j++) {
      var p = op.params[j];
      if (p.type === 'text' && values[p.id] && values[p.id].trim()) {
        clientName = values[p.id].trim();
        break;
      }
    }
  }
  // v22.37: DOM fallback — read directly from rendered param inputs if currentParamValues empty
  if (!clientName) {
    for (var di = 0; di < nameKeys.length; di++) {
      var domEl = document.getElementById('param_' + nameKeys[di]);
      if (domEl && domEl.value && domEl.value.trim()) {
        clientName = domEl.value.trim();
        break;
      }
    }
  }
  if (!clientName) {
    for (var dj = 0; dj < op.params.length; dj++) {
      var dp = op.params[dj];
      if (dp.type === 'text') {
        var domP = document.getElementById('param_' + dp.id);
        if (domP && domP.value && domP.value.trim()) {
          clientName = domP.value.trim();
          break;
        }
      }
    }
  }
  if (!clientName) return '';
  // v22.37: For pitch docs, format as "Brand x Client Client Proposal"
  if (op.name && op.name.toLowerCase().indexOf('pitch') !== -1) {
    return (brandName || 'Studio') + ' x ' + clientName + ' Client Proposal';
  }
  return clientName + ' x ' + (brandName || 'Studio');
}

function getOperationParamsString() {
  if (!selectedOp || !selectedOp.params || selectedOp.params.length === 0) return '';
  
  var values = currentParamValues[selectedOp.id] || {};
  var parts = [];
  
  selectedOp.params.forEach(function(param) {
    var val = values[param.id];
    if (val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0)) {
      if (Array.isArray(val)) {
        parts.push(param.label + ': ' + val.join(', '));
      } else {
        parts.push(param.label + ': ' + val);
      }
    }
  });
  
  return parts.length > 0 ? '\n\nParameters:\n' + parts.join('\n') : '';
}

// v24.27: Removed dead updateBreadcrumb no-op stub

function updateBreadcrumb() {
  var breadcrumb = document.getElementById('studioBreadcrumb');
  if (!breadcrumb) return;
  
  var currentBrandName = brands[studioSelectedBrand] ? brands[studioSelectedBrand].name : 'Studio';
  
  var html = '<span class="breadcrumb-item"><a href="#" onclick="showView(\'agent\'); return false;">Home</a></span>';
  html += '<span class="breadcrumb-item"><a href="#" onclick="selectedOp = null; updateBreadcrumb(); renderOperations(); return false;">Studio</a></span>';
  html += '<span class="breadcrumb-item"><a href="#" onclick="return false;">' + currentBrandName + '</a></span>';
  
  if (selectedOp) {
    html += '<span class="breadcrumb-item active">' + selectedOp.name + '</span>';
  }
  
  breadcrumb.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// RESIZABLE STUDIO PANELS v10.0
// Supports: Sidebar (horizontal), Workspace/Output (vertical)
// ═══════════════════════════════════════════════════════════════

function initStudioResize() {
  var sidebarHandle = document.getElementById('resizeSidebar');
  var workspaceHandle = document.getElementById('resizeWorkspace');
  var sidebar = document.getElementById('studioSidebar');
  var inputPanel = document.getElementById('studioInputPanel');
  var outputPanel = document.getElementById('studioOutputPanel');
  var workspaceContent = document.querySelector('.studio-workspace-content');
  
  // Load saved dimensions
  var savedSidebarWidth = localStorage.getItem('studioSidebarWidth');
  var savedInputHeight = localStorage.getItem('studioInputHeight');
  
  if (savedSidebarWidth && sidebar) {
    var width = parseInt(savedSidebarWidth);
    sidebar.style.width = width + 'px';
    sidebar.style.minWidth = '280px';
    sidebar.style.maxWidth = '600px';
  }
  
  if (savedInputHeight && inputPanel) {
    inputPanel.style.height = savedInputHeight + 'px';
    inputPanel.style.flex = '0 0 auto';
  }
  
  // ═══ Sidebar horizontal resize ═══
  var isDraggingSidebar = false;
  if (sidebarHandle) {
    sidebarHandle.addEventListener('mousedown', function(e) {
      isDraggingSidebar = true;
      sidebarHandle.classList.add('dragging');
      document.body.classList.add('resizing');
      e.preventDefault();
    });
  }
  
  // ═══ Workspace/Output vertical resize ═══
  var isDraggingWorkspace = false;
  if (workspaceHandle) {
    workspaceHandle.addEventListener('mousedown', function(e) {
      isDraggingWorkspace = true;
      workspaceHandle.classList.add('dragging');
      document.body.classList.add('resizing');
      e.preventDefault();
    });
  }
  
  // ═══ Mouse move handler ═══
  document.addEventListener('mousemove', function(e) {
    // Sidebar resize (horizontal)
    if (isDraggingSidebar && sidebar) {
      var studioView = document.getElementById('studioView');
      if (!studioView) return;
      var studioRect = studioView.getBoundingClientRect();
      var newWidth = e.clientX - studioRect.left;
      
      // Clamp between 280 and 600px
      newWidth = Math.max(280, Math.min(600, newWidth));
      
      sidebar.style.width = newWidth + 'px';
    }
    
    // Workspace/Output resize (vertical)
    if (isDraggingWorkspace && inputPanel && workspaceContent) {
      var contentRect = workspaceContent.getBoundingClientRect();
      var newHeight = e.clientY - contentRect.top;
      
      // Clamp between 150px and 80% of content height
      var maxHeight = contentRect.height * 0.8;
      var minHeight = 150;
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      
      inputPanel.style.height = newHeight + 'px';
      inputPanel.style.flex = '0 0 auto';
    }
  });
  
  // ═══ Mouse up handler ═══
  document.addEventListener('mouseup', function() {
    if (isDraggingSidebar && sidebar) {
      isDraggingSidebar = false;
      if (sidebarHandle) sidebarHandle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      localStorage.setItem('studioSidebarWidth', parseInt(sidebar.style.width));
    }
    
    if (isDraggingWorkspace && inputPanel) {
      isDraggingWorkspace = false;
      if (workspaceHandle) workspaceHandle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      localStorage.setItem('studioInputHeight', parseInt(inputPanel.style.height));
    }
  });
  
  // ═══ Touch support for mobile ═══
  if (sidebarHandle) {
    sidebarHandle.addEventListener('touchstart', function(e) {
      isDraggingSidebar = true;
      sidebarHandle.classList.add('dragging');
    }, { passive: true });
  }
  
  if (workspaceHandle) {
    workspaceHandle.addEventListener('touchstart', function(e) {
      isDraggingWorkspace = true;
      workspaceHandle.classList.add('dragging');
    }, { passive: true });
  }
  
  document.addEventListener('touchmove', function(e) {
    var touch = e.touches[0];
    
    if (isDraggingSidebar && sidebar) {
      var studioView = document.getElementById('studioView');
      if (!studioView) return;
      var studioRect = studioView.getBoundingClientRect();
      var newWidth = touch.clientX - studioRect.left;
      newWidth = Math.max(280, Math.min(600, newWidth));
      sidebar.style.width = newWidth + 'px';
    }
    
    if (isDraggingWorkspace && inputPanel && workspaceContent) {
      var contentRect = workspaceContent.getBoundingClientRect();
      var newHeight = touch.clientY - contentRect.top;
      var maxHeight = contentRect.height * 0.8;
      newHeight = Math.max(150, Math.min(maxHeight, newHeight));
      inputPanel.style.height = newHeight + 'px';
      inputPanel.style.flex = '0 0 auto';
    }
  }, { passive: true });
  
  document.addEventListener('touchend', function() {
    if (isDraggingSidebar) {
      isDraggingSidebar = false;
      if (sidebarHandle) sidebarHandle.classList.remove('dragging');
      if (sidebar) localStorage.setItem('studioSidebarWidth', parseInt(sidebar.style.width));
    }
    if (isDraggingWorkspace) {
      isDraggingWorkspace = false;
      if (workspaceHandle) workspaceHandle.classList.remove('dragging');
      if (inputPanel) localStorage.setItem('studioInputHeight', parseInt(inputPanel.style.height));
    }
  });
}

// Initialize resize when studio is shown
document.addEventListener('DOMContentLoaded', function() {
  // v26.0: Apply sidebar mode on init
  applySidebarMode();
  // v26.2: Apply selector style (pills/squircles) on init
  applySelectorStyle();
  // v26.0: Render sidebar favorites on init
  renderFavorites();

  // v26.4: Migrate prompt key to canonical
  (function() {
    var alt = localStorage.getItem('roweos_lifeai_main_prompt');
    var canonical = localStorage.getItem('roweos_life_main_prompt');
    if (alt && !canonical) {
      localStorage.setItem('roweos_life_main_prompt', alt);
    }
    if (alt) localStorage.removeItem('roweos_lifeai_main_prompt');
  })();

  // v26.4: Migrate taxcopilot -> taxintelligence in localStorage
  (function() {
    var agent = localStorage.getItem('roweos_life_agent');
    if (agent === 'taxcopilot') {
      localStorage.setItem('roweos_life_agent', 'taxintelligence');
    }
    // Also migrate in coach prompts if stored
    try {
      var prompts = JSON.parse(localStorage.getItem('roweos_life_coach_prompts') || '{}');
      if (prompts.taxcopilot) {
        prompts.taxintelligence = prompts.taxcopilot;
        delete prompts.taxcopilot;
        localStorage.setItem('roweos_life_coach_prompts', JSON.stringify(prompts));
      }
    } catch(e) {}
  })();

  // v24.27: Force iOS Safari box-sizing recalculation — replicates the inspector toggle that fixes rendering
  // iOS PWA renders with stale content-box sizing on initial load; toggling border-box off/on forces recalc
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.addEventListener('load', function() {
      requestAnimationFrame(function() {
        var _fix = document.createElement('style');
        _fix.id = '_boxfix';
        _fix.textContent = '* { box-sizing: content-box !important; }';
        document.head.appendChild(_fix);
        void document.body.offsetHeight;
        requestAnimationFrame(function() {
          _fix.remove();
          void document.body.offsetHeight;
        });
      });
    });
  }

  // v22.25: Nuclear Safari autofill kill — Safari ignores autocomplete on email/text fields
  // Must: remove type="email", set autocomplete="one-time-code", add data-1p-ignore, role on forms
  (function() {
    var _authInputIds = { authEmailInput: true, authPasswordInput: true }; // login fields keep type
    function disableAutofill(el) {
      el.setAttribute('autocomplete', 'one-time-code');
      el.setAttribute('data-lpignore', 'true');
      el.setAttribute('data-1p-ignore', 'true');
      el.setAttribute('data-form-type', 'other');
      // Safari uses type="email" as autofill hint — convert to type="text" (except login fields)
      if (el.type === 'email' && !_authInputIds[el.id]) {
        el.setAttribute('type', 'text');
        el.setAttribute('inputmode', 'email'); // keep email keyboard on mobile
      }
    }
    // Kill all forms' native autocomplete
    document.querySelectorAll('form').forEach(function(f) {
      f.setAttribute('autocomplete', 'off');
      f.setAttribute('role', 'presentation');
    });
    document.querySelectorAll('input, textarea, select').forEach(disableAutofill);
    // Catch dynamically created inputs
    var _afObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType === 1) {
            if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT') disableAutofill(n);
            if (n.tagName === 'FORM') { n.setAttribute('autocomplete', 'off'); n.setAttribute('role', 'presentation'); }
            if (n.querySelectorAll) {
              n.querySelectorAll('input, textarea, select').forEach(disableAutofill);
              n.querySelectorAll('form').forEach(function(f) { f.setAttribute('autocomplete', 'off'); f.setAttribute('role', 'presentation'); });
            }
          }
        });
      });
    });
    _afObserver.observe(document.body, { childList: true, subtree: true });
    // Safari re-attaches autofill on focus — block it aggressively
    document.addEventListener('focus', function(e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        t.setAttribute('autocomplete', 'one-time-code');
        if (t.type === 'email' && !_authInputIds[t.id]) {
          t.setAttribute('type', 'text');
          t.setAttribute('inputmode', 'email');
        }
      }
    }, true);
  })();

  // v12.0.0: Initialize event delegation system
  if (typeof initEventDelegation === 'function') {
    initEventDelegation();
  }

  // Brand dropdown overlay click handler
  var brandOverlay = document.getElementById('brandDropdownOverlay');
  if (brandOverlay) {
    brandOverlay.addEventListener('click', function(e) {
      if (e.target === brandOverlay) {
        brandOverlay.style.display = 'none';
      }
    });
  }
  
  // v23.16: Click-to-edit on Studio output — enter edit mode when clicking output content
  var _studioOutput = document.getElementById('studioOutputContent');
  if (_studioOutput) {
    _studioOutput.addEventListener('click', function(e) {
      // Don't enter edit mode if clicking on buttons, links, selects, or UI elements
      var target = e.target;
      while (target && target !== _studioOutput) {
        if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'SELECT' || target.tagName === 'INPUT') return;
        var cls = target.className || '';
        if (typeof cls === 'string' && (cls.indexOf('studio-smart-suggestions') !== -1 || cls.indexOf('studio-smart-pill') !== -1 ||
            cls.indexOf('studio-save-edits-bar') !== -1 || cls.indexOf('studio-edit-toolbar') !== -1 ||
            cls.indexOf('studio-v2-output-empty') !== -1)) return;
        target = target.parentElement;
      }
      // Only enter edit mode if there's actual content
      var canvas = _studioOutput.querySelector('.studio-output-canvas') || _studioOutput.querySelector('.output-canvas');
      if (canvas || _studioOutput.textContent.trim()) {
        enterOutputEditMode();
      }
    });
  }

  // Watch for studio view becoming visible
  var studioView = document.getElementById('studioView');
  if (studioView) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class') {
          if (!studioView.classList.contains('hidden')) {
            setTimeout(initStudioResize, 100);
          }
        }
      });
    });
    observer.observe(studioView, { attributes: true });
  }
  
  // Event delegation for tuning rating buttons
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.tuning-rating-btn');
    if (btn) {
      e.stopPropagation();
      var rating = btn.dataset.rating;
      var index = parseInt(btn.dataset.index, 10);
      if (rating && !isNaN(index)) {
        rateTuningItem(index, rating);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTIONS (v9.1.14 - Phase 1)
// ═══════════════════════════════════════════════════════════════════════════

var collapsedSections = {};

function initCollapsedSections() {
  try {
    collapsedSections = JSON.parse(localStorage.getItem('roweos_collapsed_sections') || '{}');
    // Apply saved collapse states
    Object.keys(collapsedSections).forEach(function(sectionId) {
      if (collapsedSections[sectionId]) {
        var section = document.getElementById(sectionId);
        if (section) section.classList.add('collapsed');
      }
    });
  } catch (e) {
    collapsedSections = {};
  }
}

function toggleOpsSection(sectionId) {
  var section = document.getElementById(sectionId);
  if (!section) return;
  
  var isCollapsed = section.classList.toggle('collapsed');
  collapsedSections[sectionId] = isCollapsed;
  
  // Save to localStorage
  try {
    localStorage.setItem('roweos_collapsed_sections', JSON.stringify(collapsedSections));
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDIO MODEL & OUTPUT LENGTH CONTROLS (v9.1.14)
// ═══════════════════════════════════════════════════════════════════════════

var studioOutputLength = 'standard'; // brief, standard, comprehensive
var studioModelOverride = null; // null = use brand default
var studioProviderOverride = null;
var studioModelName = 'Sonnet 4.6';

function setOutputLength(length) {
  studioOutputLength = length;
  
  // Update UI - both config panel and studio length buttons
  document.querySelectorAll('.length-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.length === length);
  });
  document.querySelectorAll('.studio-length-toggle .length-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.length === length);
  });
  
  // Save preference
  try {
    localStorage.setItem('roweos_studio_output_length', length);
  } catch (e) {}
  
  // v10.5.25: Update live prompt preview
  if (typeof updateLivePromptPreview === 'function') {
    updateLivePromptPreview();
  }
}

// v22.33: Native select handler for mobile
function handleNativeModelSelect(sel) {
  var parts = sel.value.split('|');
  if (parts.length === 2) {
    var displayNames = {
      'auto': 'RoweOS AI', 'claude-sonnet-4-6': 'Sonnet 4.6', 'claude-haiku-4-20250514': 'Haiku 4.5',
      'claude-opus-4-7': 'Opus 4.7', 'gpt-5.4': 'GPT-5.4', 'gpt-5.4-pro': 'GPT-5.4 Pro',
      'gpt-5.4-thinking': 'GPT-5.4 Thinking', 'gemini-3.1-pro-preview': '3.1 Pro',
      'gemini-3-flash-preview': '3.0 Flash', 'gemini-3-pro-image-preview': 'Nano Banana Pro 3',
      'gemini-2.5-flash-image': 'Nano Banana 3.0', 'gemini-2.0-flash-exp-image-generation': 'Flash Image',
      'veo-3.1-fast-generate-preview': 'Veo 3.1 Fast', 'veo-3.1-generate-preview': 'Veo 3.1',
      'veo-3-fast-generate-preview': 'Veo 3 Fast', 'veo-3-generate-preview': 'Veo 3',
      'veo-2-generate-preview': 'Veo 2'
    };
    selectStudioModel(parts[0], parts[1], displayNames[parts[1]] || parts[1]);
  }
}

function toggleStudioModelDropdown() {
  // v22.33: Mobile uses native select now
  if (window.innerWidth <= 768) {
    return; // native select handles it
  }
  
  var dropdown = document.getElementById('studioModelDropdown');
  var selector = document.querySelector('.studio-model-selector');
  
  if (dropdown && selector) {
    var isActive = dropdown.classList.toggle('active');
    selector.classList.toggle('active', isActive);
    
    // Position dropdown below selector
    if (isActive) {
      var rect = selector.getBoundingClientRect();
      // v22.33: Position above if not enough room below
      var spaceBelow = window.innerHeight - rect.bottom - 16;
      var dropHeight = Math.min(dropdown.scrollHeight, window.innerHeight * 0.7);
      if (spaceBelow < dropHeight && rect.top > spaceBelow) {
        dropdown.style.top = Math.max(8, rect.top - dropHeight - 8) + 'px';
      } else {
        dropdown.style.top = (rect.bottom + 8) + 'px';
      }
      dropdown.style.left = rect.left + 'px';
      dropdown.style.maxHeight = Math.min(window.innerHeight * 0.7, Math.max(spaceBelow, rect.top) - 16) + 'px';

      // v22.33: Prevent scroll inside dropdown from scrolling the page
      dropdown.addEventListener('wheel', _stopDropdownScrollLeak, { passive: false });

      // Close on outside click
      setTimeout(function() {
        document.addEventListener('click', closeStudioModelDropdown);
      }, 10);
      // v22.33: Close on page scroll
      var scrollParent = selector.closest('.panel-view') || selector.closest('.panel') || document;
      if (scrollParent) {
        var _scrollClose = function() {
          closeStudioModelDropdown({ target: document.body });
          scrollParent.removeEventListener('scroll', _scrollClose, true);
        };
        scrollParent.addEventListener('scroll', _scrollClose, true);
      }
    } else {
      var dd = document.getElementById('studioModelDropdown');
      if (dd) dd.removeEventListener('wheel', _stopDropdownScrollLeak);
    }
  }
}

// v22.33: Prevent dropdown internal scroll from leaking to page
function _stopDropdownScrollLeak(e) {
  var el = e.currentTarget;
  var scrollTop = el.scrollTop;
  var scrollHeight = el.scrollHeight;
  var clientHeight = el.clientHeight;
  var delta = e.deltaY;
  // At top scrolling up, or at bottom scrolling down — prevent
  if ((delta < 0 && scrollTop <= 0) || (delta > 0 && scrollTop + clientHeight >= scrollHeight)) {
    e.preventDefault();
  }
}

function showStudioModelActionSheet() {
  // Create backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'studio-mobile-model-backdrop';
  backdrop.id = 'studioModelBackdrop';
  backdrop.onclick = hideStudioModelActionSheet;
  
  // Create centered popup (matching BrandAI style)
  var popup = document.createElement('div');
  popup.className = 'studio-mobile-model-popup';
  popup.id = 'studioModelSheet';
  
  var currentModel = studioModelOverride || 'claude-sonnet-4-6';
  
  popup.innerHTML =
    '<div style="padding:10px 16px 4px;font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;">Text Models</div>' +
    '<div class="studio-mobile-model-section">' +
      '<div class="studio-mobile-model-label">RoweOS AI</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'auto' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'roweos\', \'auto\', \'RoweOS AI\')">Auto (Smart Routing)</div>' +
    '</div>' +
    '<div class="studio-mobile-model-section">' +
      '<div class="studio-mobile-model-label">Anthropic</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'claude-sonnet-4-6' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'anthropic\', \'claude-sonnet-4-6\', \'Sonnet 4.6\')">Sonnet 4.6</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'claude-haiku-4-20250514' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'anthropic\', \'claude-haiku-4-20250514\', \'Haiku 4.5\')">Haiku 4.5</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'claude-opus-4-7' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'anthropic\', \'claude-opus-4-7\', \'Opus 4.7\')">Opus 4.7</div>' +
    '</div>' +
    '<div class="studio-mobile-model-section">' +
      '<div class="studio-mobile-model-label">OpenAI</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gpt-5.4' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'openai\', \'gpt-5.4\', \'GPT-5.4\')">GPT-5.4</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gpt-5.4-pro' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'openai\', \'gpt-5.4-pro\', \'GPT-5.4 Pro\')">GPT-5.4 Pro</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gpt-5.4-thinking' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'openai\', \'gpt-5.4-thinking\', \'GPT-5.4 Thinking\')">GPT-5.4 Thinking</div>' +
    '</div>' +
    '<div class="studio-mobile-model-section">' +
      '<div class="studio-mobile-model-label">Google</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gemini-3.1-pro-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'google\', \'gemini-3.1-pro-preview\', \'3.1 Pro\')">3.1 Pro</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gemini-3-flash-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'google\', \'gemini-3-flash-preview\', \'3.0 Flash\')">3.0 Flash</div>' +
    '</div>' +
    '<div style="padding:10px 16px 4px;font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;border-top:1px solid var(--border-color);margin-top:4px;">Image &amp; Video Models</div>' +
    '<div class="studio-mobile-model-section">' +
      '<div class="studio-mobile-model-label">Nano Banana (Image)</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gemini-3-pro-image-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'nanobanana\', \'gemini-3-pro-image-preview\', \'Nano Banana Pro 3\')">Nano Banana Pro 3</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gemini-2.5-flash-image' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'nanobanana\', \'gemini-2.5-flash-image\', \'Nano Banana 3.0\')">Nano Banana 3.0</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'gemini-2.0-flash-exp-image-generation' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'nanobanana\', \'gemini-2.0-flash-exp-image-generation\', \'Flash Image\')">Flash Image (Legacy)</div>' +
    '</div>' +
    '<div class="studio-mobile-model-section">' +
      '<div class="studio-mobile-model-label">Veo (Video)</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'veo-3.1-fast-generate-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'veo\', \'veo-3.1-fast-generate-preview\', \'Veo 3.1 Fast\')">Veo 3.1 Fast</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'veo-3.1-generate-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'veo\', \'veo-3.1-generate-preview\', \'Veo 3.1\')">Veo 3.1</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'veo-3-fast-generate-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'veo\', \'veo-3-fast-generate-preview\', \'Veo 3 Fast\')">Veo 3 Fast</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'veo-3-generate-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'veo\', \'veo-3-generate-preview\', \'Veo 3\')">Veo 3</div>' +
      '<div class="studio-mobile-model-item' + (currentModel === 'veo-2-generate-preview' ? ' selected' : '') + '" onclick="selectStudioModelMobile(\'veo\', \'veo-2-generate-preview\', \'Veo 2\')">Veo 2</div>' +
    '</div>';
  
  document.body.appendChild(backdrop);
  document.body.appendChild(popup);
  
  // Trigger animation
  requestAnimationFrame(function() {
    backdrop.classList.add('active');
    popup.classList.add('active');
  });
}

function hideStudioModelActionSheet() {
  var backdrop = document.getElementById('studioModelBackdrop');
  var popup = document.getElementById('studioModelSheet');
  
  if (backdrop) backdrop.classList.remove('active');
  if (popup) popup.classList.remove('active');
  
  setTimeout(function() {
    if (backdrop) backdrop.remove();
    if (popup) popup.remove();
  }, 300);
}

function selectStudioModelMobile(provider, model, displayName) {
  selectStudioModel(provider, model, displayName);
  hideStudioModelActionSheet();
}

function closeStudioModelDropdown(e) {
  var dropdown = document.getElementById('studioModelDropdown');
  var selector = document.querySelector('.studio-model-selector');

  if (dropdown && (!e || !e.target || !dropdown.contains(e.target)) && (!selector || !e || !e.target || !selector.contains(e.target))) {
    dropdown.classList.remove('active');
    if (selector) selector.classList.remove('active');
    dropdown.removeEventListener('wheel', _stopDropdownScrollLeak);
    document.removeEventListener('click', closeStudioModelDropdown);
  }
}

function selectStudioModel(provider, model, displayName) {
  studioProviderOverride = provider;
  studioModelOverride = model;
  studioModelName = displayName;
  
  // Update display
  var nameEl = document.getElementById('studioModelName');
  if (nameEl) nameEl.textContent = displayName;
  
  // Update active state
  document.querySelectorAll('.studio-model-item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.model === model);
  });
  
  // Close dropdown
  var dropdown = document.getElementById('studioModelDropdown');
  var selector = document.querySelector('.studio-model-selector');
  if (dropdown) dropdown.classList.remove('active');
  if (selector) selector.classList.remove('active');
  document.removeEventListener('click', closeStudioModelDropdown);
  
  // v22.33: Sync native select
  var nativeSel = document.getElementById('studioModelNativeSelect');
  if (nativeSel) nativeSel.value = provider + '|' + model;

  // Save preference
  try {
    localStorage.setItem('roweos_studio_model', model);
    localStorage.setItem('roweos_studio_provider', provider);
    localStorage.setItem('roweos_studio_model_name', displayName);
  } catch (e) {}

  // v22.9: Update Deep Research toggle visibility based on model + selected op
  updateDeepResearchToggle();
}

// v22.9: Show/hide Deep Research toggle based on model + operation category
function updateDeepResearchToggle() {
  var toggleRow = document.getElementById('deepResearchToggleRow');
  var toggle = document.getElementById('deepResearchToggle');
  if (!toggleRow || !toggle) return;

  var isGemini3 = studioModelOverride && studioModelOverride.indexOf('gemini-3') !== -1;
  var isResearchOp = selectedOp && selectedOp.category === 'research';
  var isDedicatedDR = selectedOp && selectedOp.id === 53;

  if (isDedicatedDR) {
    // Dedicated Deep Research op — always checked, disabled
    toggleRow.style.display = 'flex';
    toggle.checked = true;
    toggle.disabled = true;
  } else if (isGemini3 && isResearchOp) {
    // Research op with Gemini 3.1 Pro — show toggle, user opts in
    toggleRow.style.display = 'flex';
    toggle.disabled = false;
  } else {
    // Not applicable — hide and uncheck
    toggleRow.style.display = 'none';
    toggle.checked = false;
    toggle.disabled = false;
  }
}

function initStudioControls() {
  // Load saved preferences
  try {
    var savedLength = localStorage.getItem('roweos_studio_output_length');
    if (savedLength) {
      studioOutputLength = savedLength;
      document.querySelectorAll('.studio-length-toggle .length-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.length === savedLength);
      });
    }
    
    var savedModel = localStorage.getItem('roweos_studio_model');
    var savedProvider = localStorage.getItem('roweos_studio_provider');
    var savedName = localStorage.getItem('roweos_studio_model_name');
    
    if (savedModel && savedProvider) {
      studioModelOverride = savedModel;
      studioProviderOverride = savedProvider;
      studioModelName = savedName || 'Sonnet 4.6';
      
      // Update display
      var nameEl = document.getElementById('studioModelName');
      if (nameEl) nameEl.textContent = studioModelName;
      
      // Update active state
      document.querySelectorAll('.studio-model-item').forEach(function(item) {
        item.classList.toggle('active', item.dataset.model === savedModel);
      });
    } else {
      // Set default active state
      document.querySelectorAll('.studio-model-item').forEach(function(item) {
        item.classList.toggle('active', item.dataset.model === 'claude-sonnet-4-6');
      });
    }
  } catch (e) {}
}

function getOutputLengthInstruction() {
  var instructions = {
    'brief': 'Keep your response concise and focused. Target approximately 400-600 words. Prioritize the most essential information and deliverables.',
    'standard': 'Provide a comprehensive but focused response. Target approximately 800-1200 words. Include all key deliverables with appropriate detail.',
    'comprehensive': 'Provide an in-depth, detailed response. Target approximately 1500-2500 words. Include extensive detail, examples, and thorough coverage of all deliverables.'
  };
  return instructions[studioOutputLength] || instructions['standard'];
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANDAI OPERATION GENERATOR (v9.1.14)
// ═══════════════════════════════════════════════════════════════════════════

var generatedBrandOps = []; // Track AI-generated BrandAI operations
var generatedLifeOps = [];  // v10.5.25: Track AI-generated LifeAI operations

// v13.3: Central brand context aggregator for Adaptive Operations
function getFullBrandContext(brand) {
  if (!brand) return {};
  var ctx = {};

  // Identity depth fields
  ctx.name = brand.name || '';
  ctx.shortName = brand.shortName || brand.name || '';
  ctx.tagline = brand.tagline || '';
  ctx.essence = brand.essence || '';
  ctx.voice = brand.voice || '';
  ctx.tone = brand.tone || '';
  ctx.audience = brand.audience || '';
  ctx.positioning = brand.positioning || '';
  ctx.values = brand.values || '';
  ctx.messaging = brand.messaging || '';
  ctx.products = brand.products || '';
  ctx.promise = brand.promise || '';
  ctx.visual = brand.visual || '';
  ctx.competitive = brand.competitive || '';
  ctx.location = brand.location || '';
  ctx.industry = brand.industry || '';
  ctx.philosophy = brand.philosophy || '';
  ctx.vocabDo = brand.vocabDo || '';
  ctx.vocabDont = brand.vocabDont || '';
  ctx.constraints = brand.constraints || '';

  // Identity card data (may be richer than brand object fields)
  try {
    var brandIdx = brands.indexOf(brand);
    if (brandIdx === -1) brandIdx = parseInt(localStorage.getItem('selectedBrand') || '0');
    var sections = ['role', 'essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
    ctx.identityCards = {};
    sections.forEach(function(s) {
      var aiVal = localStorage.getItem('identity_' + s + '_ai_' + brandIdx) || '';
      var ownerVal = localStorage.getItem('identity_' + s + '_owner_' + brandIdx) || '';
      if (aiVal || ownerVal) ctx.identityCards[s] = { ai: aiVal, owner: ownerVal };
    });
  } catch(e) {}

  // Active Pulse goals for this brand
  ctx.goals = (pulseGoals || []).filter(function(g) {
    return !g.archived && !g.completed && (g.source === 'brandai' || g.source === 'studio');
  }).map(function(g) {
    var items = (g.items || []);
    if (g.sections) g.sections.forEach(function(s) { items = items.concat(s.items || []); });
    var done = items.filter(function(i) { return i.completed; }).length;
    return { title: g.title, progress: items.length > 0 ? Math.round((done / items.length) * 100) : 0, total: items.length, done: done };
  });

  // Pending Focus todos for this brand
  var brandIdx2 = brands.indexOf(brand);
  ctx.pendingTodos = (todos || []).filter(function(t) {
    return !t.completed && (t.brand === brandIdx2 || t.brand === String(brandIdx2));
  }).length;
  ctx.overdueTodos = (todos || []).filter(function(t) {
    return !t.completed && (t.brand === brandIdx2 || t.brand === String(brandIdx2)) && t.date && t.date < new Date().toISOString().slice(0, 10);
  }).length;

  // Recent Studio runs for this brand (last 30 days)
  var thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  ctx.recentRuns = (runs || []).filter(function(r) {
    return r.brand === brand.name && new Date(r.time || r.timestamp).getTime() > thirtyDaysAgo;
  }).map(function(r) { return r.op; });

  // Inventory item count
  try {
    var inv = JSON.parse(localStorage.getItem('roweos_inventory') || '[]');
    ctx.inventoryCount = inv.filter(function(item) { return item.brand === brand.name || item.brand === brandIdx2; }).length;
  } catch(e) { ctx.inventoryCount = 0; }

  // Knowledge documents
  try {
    var kb = localStorage.getItem('brand_' + brandIdx2);
    ctx.hasKnowledge = !!(kb && kb.length > 50);
  } catch(e) { ctx.hasKnowledge = false; }

  return ctx;
}

// v13.3: Central life context aggregator
function getFullLifeContext() {
  var ctx = {};

  // LifeAI profile
  try {
    var profile = typeof getCurrentLifeProfile === 'function' ? getCurrentLifeProfile() : null;
    if (profile) {
      ctx.name = profile.name || '';
      ctx.identityData = profile.identityData || {};
    }
  } catch(e) {}

  // Life identity
  try {
    var identity = JSON.parse(localStorage.getItem('roweos_life_identity') || '{}');
    ctx.role = identity.role || '';
    ctx.location = identity.location || '';
    ctx.values = identity.values || [];
    ctx.goals = identity.goals || [];
    ctx.interests = identity.interests || [];
    ctx.focusAreas = identity.focusAreas || [];
  } catch(e) {}

  // Active Pulse goals (life mode)
  ctx.pulseGoals = (pulseGoals || []).filter(function(g) {
    return !g.archived && !g.completed && g.source === 'lifeai';
  }).map(function(g) {
    var items = (g.items || []);
    if (g.sections) g.sections.forEach(function(s) { items = items.concat(s.items || []); });
    var done = items.filter(function(i) { return i.completed; }).length;
    return { title: g.title, progress: items.length > 0 ? Math.round((done / items.length) * 100) : 0 };
  });

  // Pending life todos
  ctx.pendingTodos = (todos || []).filter(function(t) { return !t.completed && t.brand === '_life'; }).length;

  // Recent life runs
  var thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  ctx.recentRuns = (runs || []).filter(function(r) {
    return r.lifeMode && new Date(r.time || r.timestamp).getTime() > thirtyDaysAgo;
  }).map(function(r) { return r.op; });

  // Journal tags (last 7 days)
  var weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  ctx.recentTags = [];
  (pulse2JournalEntries || []).forEach(function(e) {
    if (e.date >= weekAgo && e.tag && ctx.recentTags.indexOf(e.tag) === -1) ctx.recentTags.push(e.tag);
  });

  // Rhythm preferences
  try {
    ctx.rhythmPrefs = JSON.parse(localStorage.getItem('roweos_life_rhythm_preferences') || 'null');
  } catch(e) { ctx.rhythmPrefs = null; }

  return ctx;
}

// v13.3: Identity depth score -- maps to brand guide's Minimal/Moderate/Complete tiers
function getIdentityDepthScore(brand) {
  if (!brand) return { score: 0, filled: 0, total: 8, tier: 'minimal', gaps: [] };

  var sections = [
    { key: 'essence', label: 'Brand Essence', field: 'essence' },
    { key: 'voice', label: 'Voice & Tone', field: 'voice' },
    { key: 'audience', label: 'Target Audience', field: 'audience' },
    { key: 'messaging', label: 'Key Messaging', field: 'messaging' },
    { key: 'products', label: 'Products & Services', field: 'products' },
    { key: 'visual', label: 'Visual Identity', field: 'visual' },
    { key: 'competitive', label: 'Competitive Positioning', field: 'competitive' },
    { key: 'role', label: 'Your Role', field: 'philosophy' }
  ];

  var brandIdx = brands.indexOf(brand);
  if (brandIdx === -1) brandIdx = parseInt(localStorage.getItem('selectedBrand') || '0');

  var filled = 0;
  var gaps = [];

  sections.forEach(function(s) {
    var hasContent = false;
    // Check Identity card data
    var aiVal = localStorage.getItem('identity_' + s.key + '_ai_' + brandIdx) || '';
    var ownerVal = localStorage.getItem('identity_' + s.key + '_owner_' + brandIdx) || '';
    if (aiVal.trim().length > 10 || ownerVal.trim().length > 10) hasContent = true;
    // Fallback: check brand object field
    if (!hasContent && brand[s.field] && String(brand[s.field]).trim().length > 10) hasContent = true;

    if (hasContent) {
      filled++;
    } else {
      gaps.push(s.label);
    }
  });

  var pct = Math.round((filled / sections.length) * 100);
  var tier = pct >= 80 ? 'complete' : (pct >= 50 ? 'moderate' : 'minimal');

  return { score: pct, filled: filled, total: sections.length, tier: tier, gaps: gaps };
}

// v13.3: Smart Studio suggestions based on cross-system context
function getStudioSuggestions(brand) {
  if (!brand) return [];
  var suggestions = [];
  var ctx = getFullBrandContext(brand);
  var depth = getIdentityDepthScore(brand);

  // 1. Identity gaps
  if (depth.tier === 'minimal') {
    suggestions.push({
      icon: 'identity',
      text: 'Your Identity is ' + depth.score + '% complete. Fill in ' + depth.gaps[0] + ' to unlock better AI output.',
      action: 'identity',
      priority: 1
    });
  }

  // 2. No recent runs
  if (ctx.recentRuns.length === 0) {
    suggestions.push({
      icon: 'studio',
      text: 'No operations run in 30 days. Try a Weekly Content Calendar to get started.',
      action: 'op',
      opName: 'Weekly Content Calendar',
      priority: 2
    });
  }

  // 3. Has products but never ran product ops
  if (ctx.products && ctx.recentRuns.indexOf('Product Description Writer') === -1 && ctx.inventoryCount > 0) {
    suggestions.push({
      icon: 'inventory',
      text: 'You have ' + ctx.inventoryCount + ' inventory items. Generate product descriptions with Studio.',
      action: 'op',
      opName: 'Product Description Writer',
      priority: 3
    });
  }

  // 4. Has audience defined but no persona
  if (ctx.audience && ctx.recentRuns.indexOf('Customer Persona Builder') === -1) {
    suggestions.push({
      icon: 'audience',
      text: 'Audience defined -- build a Customer Persona to sharpen targeting.',
      action: 'op',
      opName: 'Customer Persona Builder',
      priority: 3
    });
  }

  // 5. Has goals but no related ops run
  if (ctx.goals.length > 0) {
    var lowestGoal = ctx.goals.reduce(function(low, g) {
      return g.progress < low.progress ? g : low;
    }, ctx.goals[0]);
    if (lowestGoal.progress < 50) {
      suggestions.push({
        icon: 'goal',
        text: '"' + lowestGoal.title + '" is at ' + lowestGoal.progress + '%. Run an operation to move it forward.',
        action: 'dismiss',
        priority: 2
      });
    }
  }

  // 6. Overdue todos
  if (ctx.overdueTodos > 0) {
    suggestions.push({
      icon: 'warning',
      text: ctx.overdueTodos + ' overdue tasks. Consider a Priority Matrix operation.',
      action: 'op',
      opName: 'Priority Matrix',
      priority: 1
    });
  }

  // 7. Content calendar cadence
  var lastCalendar = ctx.recentRuns.filter(function(r) { return r.indexOf('Content Calendar') !== -1; });
  if (lastCalendar.length === 0 && ctx.voice) {
    suggestions.push({
      icon: 'calendar',
      text: 'No content calendar this month. Stay consistent with weekly content.',
      action: 'op',
      opName: 'Weekly Content Calendar',
      priority: 3
    });
  }

  // Sort by priority, limit to 4
  suggestions.sort(function(a, b) { return a.priority - b.priority; });
  return suggestions.slice(0, 4);
}

async function generateBrandAIRecommendations() {
  var btn = document.querySelector('.studio-v2-generate-btn');
  if (!btn || btn.classList.contains('generating')) return;
  
  var brand = brands[studioSelectedBrand];
  if (!brand) {
    showToast('Please select a brand first', 'warning');
    return;
  }
  
  // Get API key
  var settings = brandSettings[studioSelectedBrand] || {};
  var provider = settings.provider || brand.provider || 'anthropic';
  var model = settings.model || brand.model || 'claude-sonnet-4-6';
  // v28.8: Resolve 'roweos'/'auto' smart routing to actual provider/model
  if (model === 'auto' || provider === 'roweos') {
    var _resolved = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: 'brand strategy recommendations' }) : null;
    if (_resolved) { provider = _resolved.provider; model = _resolved.model; }
    else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
  }
  var apiKey = await getApiKey(provider);

  if (!apiKey) {
    showToast('API key not configured', 'error');
    return;
  }

  btn.classList.add('generating');
  btn.querySelector('span').textContent = 'Generating...';
  
  // v13.3: Use full brand context for deeper analysis
  var ctx = getFullBrandContext(brand);
  var depth = getIdentityDepthScore(brand);

  var prompt = 'You are an expert brand strategist. Based on this brand profile, suggest 5-8 highly specific, actionable operations that would benefit this brand right now.\n\n';
  prompt += 'BRAND IDENTITY (COMPLETE):\n';
  prompt += '- Name: ' + (ctx.name || 'N/A') + '\n';
  prompt += '- Tagline: ' + (ctx.tagline || 'N/A') + '\n';
  prompt += '- Essence: ' + (ctx.essence || 'N/A') + '\n';
  prompt += '- Voice: ' + (ctx.voice || 'Professional') + '\n';
  prompt += '- Audience: ' + (ctx.audience || 'General') + '\n';
  prompt += '- Messaging: ' + (ctx.messaging || 'N/A') + '\n';
  prompt += '- Products/Services: ' + (ctx.products || ctx.positioning || 'N/A') + '\n';
  prompt += '- Visual Identity: ' + (ctx.visual || 'N/A') + '\n';
  prompt += '- Competitive Positioning: ' + (ctx.competitive || 'N/A') + '\n';
  prompt += '- Location/Industry: ' + (ctx.industry ? ctx.industry + ' in ' : '') + (ctx.location || 'N/A') + '\n';
  if (ctx.vocabDo) prompt += '- Vocabulary Do\'s: ' + ctx.vocabDo + '\n';
  if (ctx.vocabDont) prompt += '- Vocabulary Don\'ts: ' + ctx.vocabDont + '\n';

  prompt += '\nCURRENT STATE:\n';
  if (ctx.goals && ctx.goals.length > 0) {
    prompt += '- Active Goals: ' + ctx.goals.map(function(g) { return g.title + ' (' + g.progress + '%)'; }).join(', ') + '\n';
  }
  prompt += '- Pending Tasks: ' + (ctx.pendingTodos || 0) + (ctx.overdueTodos > 0 ? ' (' + ctx.overdueTodos + ' overdue)' : '') + '\n';
  if (ctx.recentRuns && ctx.recentRuns.length > 0) {
    prompt += '- Recent Operations: ' + ctx.recentRuns.slice(0, 5).join(', ') + '\n';
  }
  prompt += '- Inventory Items: ' + (ctx.inventoryCount || 0) + '\n';
  prompt += '- Knowledge Documents: ' + (ctx.hasKnowledge ? 'Yes' : 'No') + '\n';
  prompt += '- Identity Completeness: ' + depth.score + '% (' + depth.tier + ')\n';

  prompt += '\nGenerate 5-8 highly specific operations. Name them with brand-specific details.\n';
  prompt += 'BAD: "Guest Welcome Guide"\n';
  prompt += 'GOOD: "Domain Property Guest Welcome Book" (if brand is luxury rentals in The Domain)\n\n';

  if (ctx.recentRuns && ctx.recentRuns.length > 0) {
    prompt += 'Do NOT suggest operations similar to recently run: ' + ctx.recentRuns.slice(0, 5).join(', ') + '\n\n';
  }

  prompt += 'Return ONLY a JSON array. Each operation must have:\n';
  prompt += '- name: Short, specific operation name (5-8 words max)\n';
  prompt += '- desc: One-line description (under 60 chars)\n';
  prompt += '- category: One of "marketing", "strategic", "operations", "documents"\n';
  prompt += '- outputs: Array of 4-5 specific deliverables\n\n';
  prompt += 'Focus on what THIS specific brand needs. Use their industry, audience, location, and positioning.\n\n';
  prompt += 'Example format:\n';
  prompt += '[{"name": "Q1 Loyalty Program Launch Kit", "desc": "Member acquisition campaign materials", "category": "marketing", "outputs": ["Welcome sequence", "Tier benefits guide", "Referral program copy", "Social announcement posts"]}]\n\n';
  prompt += 'Return ONLY the JSON array, no other text.';

  try {
    var response = await callBrandAIGeneratorAPI(provider, model, apiKey, prompt);
    
    // v9.1.14: Strip markdown code fences if present
    var cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    var operations = JSON.parse(cleanResponse);
    
    if (Array.isArray(operations) && operations.length > 0) {
      // v24.12: Keep custom-created ops when regenerating BrandAI ops (was wiping all)
      generatedBrandOps = generatedBrandOps.filter(function(op) { return op.generatedForBrand !== brand.name || op.customCreated; });
      
      // Add new generated operations
      operations.forEach(function(op, idx) {
        var newOp = {
          id: 'gen-' + Date.now() + '-' + idx,
          name: op.name,
          desc: op.desc,
          category: op.category || 'marketing',
          brand: brand.name,
          outputs: op.outputs || ['Custom output'],
          aiGenerated: true,
          isSocialOp: op.category === 'social' || !!op.isSocialOp,
          generatedForBrand: brand.name,
          generatedAt: new Date().toISOString()
        };
        generatedBrandOps.push(newOp);
      });
      
      // Save and re-render
      saveBrandAIGeneratedOps();
      renderOperations();
      // v29.3: Show inline results panel with summary
      var summaryText = '## Generated ' + operations.length + ' Operations for ' + brand.name + '\n\n';
      operations.forEach(function(op, i) {
        summaryText += '### ' + (i + 1) + '. ' + op.name + '\n';
        summaryText += op.desc + '\n\n';
        if (op.outputs && op.outputs.length > 0) {
          summaryText += '**Deliverables:**\n';
          op.outputs.forEach(function(o) { summaryText += '- ' + o + '\n'; });
          summaryText += '\n';
        }
      });
      showStudioResultsPanel(summaryText);
      showToast('Generated ' + operations.length + ' recommendations for ' + brand.name, 'success');
    }
  } catch (err) {
    console.error('BrandAI generation error:', err);
    showToast('Failed to generate recommendations', 'error');
  }

  btn.classList.remove('generating');
  btn.querySelector('span').textContent = 'Generate BrandAI Operations';
}

// v29.3: Show AI recommendations in an inline results panel
function showStudioResultsPanel(content) {
  var panel = document.getElementById('studioResultsPanel');
  if (!panel) return;

  var html = '<div class="studio-results-header">' +
    '<span style="font-size:12px;font-weight:600;color:var(--text-primary);">AI Recommendations</span>' +
    '<button onclick="document.getElementById(\'studioResultsPanel\').style.display=\'none\'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">&times;</button>' +
    '</div>' +
    '<div class="studio-results-content">' + (typeof marked !== 'undefined' ? marked.parse(content) : escapeHtml(content)) + '</div>';

  panel.innerHTML = html;
  panel.style.display = 'block';
}

async function createCustomBrandOperation() {
  var input = document.getElementById('brandAICreatorInput');
  var btn = document.querySelector('.studio-v2-creator-btn') || document.querySelector('.brandai-creator-submit');
  
  if (!input || !input.value.trim()) {
    showToast('Please describe the operation you need', 'warning');
    return;
  }
  
  var brand = brands[studioSelectedBrand];
  if (!brand) {
    showToast('Please select a brand first', 'warning');
    return;
  }
  
  var userRequest = input.value.trim();
  
  // Get API key
  var provider = brand.provider || 'anthropic';
  var model = brand.model || 'claude-sonnet-4-6';
  // v28.8: Resolve 'roweos'/'auto' smart routing to actual provider/model
  if (model === 'auto' || provider === 'roweos') {
    var _resolved = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: userRequest }) : null;
    if (_resolved) { provider = _resolved.provider; model = _resolved.model; }
    else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
  }
  var apiKey = await getApiKey(provider);

  if (!apiKey) {
    showToast('API key not configured', 'error');
    return;
  }

  if (btn) {
    btn.classList.add('creating');
    btn.disabled = true;
  }
  input.disabled = true;
  
  var prompt = `You are creating a custom brand operation based on a user's request.

BRAND: ${brand.name}
TAGLINE: ${brand.tagline || 'N/A'}
VOICE: ${brand.voice || 'Professional'}
AUDIENCE: ${brand.audience || 'General'}

USER REQUEST: "${userRequest}"

Create ONE highly specific operation tailored to this brand. Return ONLY a JSON object with:
- name: Clear, specific operation name (5-8 words max)
- desc: One-line description (under 60 chars)
- category: Best fit from "marketing", "strategic", "operations", "documents", "research", "image", "social"
- outputs: Array of 5-6 specific deliverables this operation will produce
- isImageOp: (ONLY if category is "image") Set to true for AI image generation operations
- isSocialOp: (ONLY if category is "social") Set to true for social media posting operations

IMPORTANT: If the user requests anything related to:
- Image generation, AI images, visuals, graphics, photos
- Brand imagery, product photos, social media images
- Mood boards, visual concepts, image prompts
Then set category to "image" and isImageOp to true. These will use DALL-E to generate actual images.

IMPORTANT: If the user requests anything related to:
- Social media posts, tweets, threads, reels, captions
- X/Twitter, Threads, Instagram, TikTok posting
- Hashtag strategies, social campaigns, cross-platform content
Then set category to "social" and isSocialOp to true. These connect to the social publisher.

Make it specific to the brand and the user's request. Be creative but practical.

Return ONLY the JSON object, no other text.`;

  try {
    var response = await callBrandAIGeneratorAPI(provider, model, apiKey, prompt);
    
    // v9.1.14: Strip markdown code fences if present
    var cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    var operation = JSON.parse(cleanResponse);
    
    if (operation && operation.name) {
      var newOp = {
        id: 'custom-' + Date.now(),
        name: operation.name,
        desc: operation.desc || userRequest.substring(0, 50),
        category: operation.category || 'operations',
        brand: brand.name,
        outputs: operation.outputs || ['Custom output'],
        aiGenerated: true,
        customCreated: true,
        generatedForBrand: brand.name,
        userPrompt: userRequest,
        generatedAt: new Date().toISOString()
      };
      
      // v9.1.14: Support image operations
      if (operation.isImageOp || operation.category === 'image') {
        newOp.isImageOp = true;
        newOp.category = 'image';
      }
      // v17.2: Support social operations — keyword fallback
      var socialKeywords = /\b(thread|threads|tweet|post.*to|instagram|tiktok|x\/twitter|social media|caption|hashtag|reel)\b/i;
      if (operation.isSocialOp || operation.category === 'social' || socialKeywords.test(userRequest)) {
        newOp.isSocialOp = true;
        newOp.category = 'social';
      }
      
      generatedBrandOps.push(newOp);
      saveBrandAIGeneratedOps();
      renderOperations();
      
      // Clear input
      input.value = '';
      
      // Auto-select the new operation
      selectedOp = newOp;
      updateSelectedOpDisplay();
      updateRunButton();
      
      showToast('Created: ' + newOp.name, 'success');
    }
  } catch (err) {
    console.error('Custom operation creation error:', err);
    showToast('Failed to create operation', 'error');
  }
  
  if (btn) {
    btn.classList.remove('creating');
    btn.disabled = false;
  }
  input.disabled = false;
}

// API helper for BrandAI generator
async function callBrandAIGeneratorAPI(provider, model, apiKey, prompt) {
  var url, headers, body;
  
  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    body = JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/responses'; // v22.18: Responses API
    headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    body = JSON.stringify({
      model: model,
      max_output_tokens: 1024,
      input: [{ role: 'user', content: prompt }],
      store: false
    });
  } else if (provider === 'google') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 }
    });
  }
  
  var response = await fetch(url, { method: 'POST', headers: headers, body: body });
  if (!response.ok) throw new Error('API error: ' + response.status);
  
  var data = await response.json();
  
  // Extract text based on provider
  if (provider === 'anthropic') {
    return data.content[0].text;
  } else if (provider === 'openai') {
    return data.output_text || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text); // v22.18: Responses API
  } else if (provider === 'google') {
    return data.candidates[0].content.parts[0].text;
  }
}

// Persist generated operations
function saveBrandAIGeneratedOps() {
  try {
    localStorage.setItem('roweos_generated_brand_ops', JSON.stringify(generatedBrandOps));
    // v9.1.14: Auto-sync to Firebase if connected
    if (typeof firebaseUser !== 'undefined' && firebaseUser && typeof syncToFirebase === 'function') {
      // Debounce sync to avoid too many writes
      clearTimeout(window.brandOpsFirebaseSyncTimeout);
      window.brandOpsFirebaseSyncTimeout = setTimeout(function() {
        writeDB('profile/generatedBrandOps', { data: JSON.parse(localStorage.getItem('roweos_generated_brand_ops') || '[]') });
      }, 2000);
    }
  } catch (e) {
    console.error('Error saving generated brand ops:', e);
  }
}

function loadBrandAIGeneratedOps() {
  try {
    generatedBrandOps = JSON.parse(localStorage.getItem('roweos_generated_brand_ops') || '[]');
  } catch (e) {
    generatedBrandOps = [];
  }
  // v18.5: Migrate existing ops to have generatedForBrand
  if (typeof migrateCustomOpsGeneratedForBrand === 'function') migrateCustomOpsGeneratedForBrand();
}

// v24.13: Toggle showing hidden operations
function toggleShowHiddenOps() {
  window._studioShowHidden = !window._studioShowHidden;
  var btn = document.getElementById('showHiddenOpsBtn');
  if (btn) {
    btn.style.color = window._studioShowHidden ? 'var(--accent)' : 'var(--text-muted)';
    btn.style.borderColor = window._studioShowHidden ? 'var(--accent)' : 'var(--border-subtle)';
    btn.textContent = window._studioShowHidden ? 'Hide Hidden' : 'Show Hidden';
  }
  renderOperations();
}

function renderOperations() {
  var pinnedGrid = document.getElementById('pinnedOps');
  var recentGrid = document.getElementById('recentOps');
  var brandOpsGrid = document.getElementById('brandOps');
  var universalOpsGrid = document.getElementById('universalOps');
  var pinnedSection = document.getElementById('pinnedSection');
  var recentSection = document.getElementById('recentSection');
  
  // Clear all grids
  if (pinnedGrid) pinnedGrid.innerHTML = '';
  if (recentGrid) recentGrid.innerHTML = '';
  if (brandOpsGrid) brandOpsGrid.innerHTML = '';
  if (universalOpsGrid) universalOpsGrid.innerHTML = '';
  
  // v10.5.25: Check if in LifeAI mode and use appropriate ops
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';
  var opsToUse = isLifeMode ? window.lifeOps : ops;
  
  // Get current brand name
  var currentBrandName = brands[studioSelectedBrand] ? brands[studioSelectedBrand].name : 'Your Brand';
  
  // v10.5.25: Update label based on mode
  var brandLabel = document.getElementById('brandOpsLabel');
  if (brandLabel) {
    brandLabel.textContent = isLifeMode ? '◇ Life Operations' : '✦ BrandAI Recommendations';
  }
  
  // Category filter helper
  function matchesCategoryLocal(op) {
    if (selectedCategory === 'all') return true;
    // v17.0: Social agent matches ops with isSocialOp flag
    if (selectedCategory === 'social') return !!op.isSocialOp;
    var cat = (op.category || 'operations').toLowerCase();
    // v10.5.25: Support LifeAI categories
    return cat === selectedCategory.toLowerCase();
  }
  
  // Combined filter helper (category + search)
  function matchesFilters(op) {
    return matchesCategoryLocal(op) && matchesSearch(op);
  }
  
  // v24.13: Hidden ops filter
  var hiddenOps = [];
  try { hiddenOps = JSON.parse(localStorage.getItem('roweos_hidden_ops') || '[]'); } catch(e) {}
  var showHidden = window._studioShowHidden || false;

  // v10.5.25: Filter operations using correct ops array
  var brandSpecificOps = opsToUse.filter(function(op) { return op.brand === currentBrandName && matchesFilters(op) && (showHidden || hiddenOps.indexOf(op.id) === -1); });
  var universalOpsList = opsToUse.filter(function(op) { return op.brand === null && matchesFilters(op) && (showHidden || hiddenOps.indexOf(op.id) === -1); });

  
  // v13.3: Include AI-generated operations -- brand mode by brand name, life mode by mode flag
  var aiGeneratedOps = isLifeMode
    ? generatedBrandOps.filter(function(op) { return op.generatedForMode === 'life' && matchesFilters(op) && (showHidden || hiddenOps.indexOf(op.id) === -1); })
    : generatedBrandOps.filter(function(op) { return op.generatedForBrand === currentBrandName && matchesFilters(op) && (showHidden || hiddenOps.indexOf(op.id) === -1); });
  
  // Update op count
  var totalForBrand = brandSpecificOps.length + universalOpsList.length + aiGeneratedOps.length;
  var opCountEl = document.getElementById('studioOpCount');
  if (opCountEl) {
    opCountEl.innerHTML = '<span>' + totalForBrand + '</span> agent tasks';
  }
  
  // Check if we have no results (only when searching)
  if (opsSearchQuery && totalForBrand === 0) {
    if (pinnedSection) pinnedSection.classList.add('hidden');
    if (recentSection) recentSection.classList.add('hidden');
    
    if (brandOpsGrid) {
      brandOpsGrid.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);"><div style="font-size:24px;margin-bottom:8px;">◇</div><div>No results for "' + opsSearchQuery + '"</div></div>';
    }
    return;
  }
  
  // v9.1.14: Render AI-generated operations first in BrandAI section
  if (brandOpsGrid && aiGeneratedOps.length > 0) {
    aiGeneratedOps.forEach(function(op) {
      createOpCard(op, brandOpsGrid, true, true); // Pass aiGenerated flag
    });
  }
  
  // Render pinned operations (with sorting)
  var availableOpIds = brandSpecificOps.concat(universalOpsList).concat(aiGeneratedOps).map(function(op) { return op.id; });
  var brandPinned = pinnedOps[studioSelectedBrand] || [];
  var filteredPinnedOps = brandPinned.filter(function(opId) { 
    var op = opsToUse.find(function(o) { return o.id === opId; });
    return availableOpIds.indexOf(opId) !== -1 && op && matchesFilters(op);
  }).map(function(opId) {
    return opsToUse.find(function(o) { return o.id === opId; });
  }).filter(function(op) { return op; });
  
  // v9.1.14: Don't sort pinned ops - maintain user's custom drag order
  // var sortedPinnedOps = getSortedOperations(filteredPinnedOps);
  var sortedPinnedOps = filteredPinnedOps; // Keep user's order
  
  if (sortedPinnedOps.length > 0 && pinnedSection && pinnedGrid) {
    pinnedSection.classList.remove('hidden');
    sortedPinnedOps.forEach(function(op) {
      createOpCard(op, pinnedGrid, true);
    });
  } else if (pinnedSection) {
    pinnedSection.classList.add('hidden');
  }
  
  // Get pinned IDs for exclusion from recent
  var pinnedIds = sortedPinnedOps.map(function(op) { return op.id; });
  
  // Render recent operations (exclude pinned, max 4, with sorting)
  var brandRecent = recentOps[studioSelectedBrand] || [];
  var filteredRecentOps = brandRecent.filter(function(opId) {
    var op = opsToUse.find(function(o) { return o.id === opId; });
    return pinnedIds.indexOf(opId) === -1 && availableOpIds.indexOf(opId) !== -1 && op && matchesFilters(op);
  }).map(function(opId) {
    return opsToUse.find(function(o) { return o.id === opId; });
  }).filter(function(op) { return op; }).slice(0, 4);
  
  // Apply sorting to recent
  var sortedRecentOps = getSortedOperations(filteredRecentOps);
  
  if (sortedRecentOps.length > 0 && recentSection && recentGrid) {
    recentSection.classList.remove('hidden');
    sortedRecentOps.forEach(function(op) {
      createOpCard(op, recentGrid, true);
    });
  } else if (recentSection) {
    recentSection.classList.add('hidden');
  }
  
  // Render brand-specific operations (with sorting)
  if (brandOpsGrid) {
    var sortedBrandOps = getSortedOperations(brandSpecificOps);
    sortedBrandOps.forEach(function(op) {
      createOpCard(op, brandOpsGrid, true);
    });
  }
  
  // Render universal operations (with sorting)
  if (universalOpsGrid) {
    var sortedUniversalOps = getSortedOperations(universalOpsList);
    sortedUniversalOps.forEach(function(op) {
      createOpCard(op, universalOpsGrid, true);
    });
  }
  
  // Update selected op display and run button
  updateSelectedOpDisplay();
  updateRunButton();

  // v13.3: Update depth badge and suggestions
  updateStudioDepthBadge();
  renderStudioSuggestions();
}

// v13.3: Update Identity Depth badge in Studio header
function updateStudioDepthBadge() {
  var badge = document.getElementById('studioDepthBadge');
  var ring = document.getElementById('studioDepthRing');
  var label = document.getElementById('studioDepthLabel');
  if (!badge || !ring || !label) return;

  var brand = brands[studioSelectedBrand];
  if (!brand) return;

  var depth = getIdentityDepthScore(brand);
  ring.style.setProperty('--depth-pct', depth.score + '%');
  label.textContent = depth.score + '%';
  badge.setAttribute('data-tier', depth.tier);

  var tierDesc = depth.tier === 'complete' ? 'Identity complete' : (depth.tier === 'moderate' ? 'Identity moderate' : 'Identity minimal');
  var tipText = tierDesc + ' (' + depth.filled + '/' + depth.total + ')';
  if (depth.gaps.length > 0) tipText += ' -- Missing: ' + depth.gaps[0];
  badge.title = tipText;
}

// v13.3: Render Smart Studio Suggestions
function renderStudioSuggestions() {
  var bar = document.getElementById('studioSuggestionsBar');
  var list = document.getElementById('studioSuggestionsList');
  if (!bar || !list) return;

  var brand = brands[studioSelectedBrand];
  var suggestions = getStudioSuggestions(brand);

  if (suggestions.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = '';
  list.innerHTML = '';

  suggestions.forEach(function(s) {
    var chip = document.createElement('div');
    chip.className = 'studio-suggestion-chip';
    chip.innerHTML = '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(s.text) + '</span>' +
      '<svg class="suggestion-dismiss" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    chip.addEventListener('click', function(e) {
      if (e.target.closest('.suggestion-dismiss')) {
        chip.remove();
        if (list.children.length === 0) bar.style.display = 'none';
        return;
      }
      if (s.action === 'identity') {
        showView('memory');
      } else if (s.action === 'op' && s.opName) {
        // Find and select the operation
        var allOps = (window.lifeOps || []).concat(ops || []);
        var targetOp = allOps.find(function(op) { return op.name === s.opName; });
        if (targetOp) {
          selectedOp = targetOp;
          updateSelectedOpDisplay();
          updateRunButton();
        }
      }
    });

    list.appendChild(chip);
  });
}

function changeStudioBrand(value) {
  studioSelectedBrand = parseInt(value);
  showAllOps = false; // Reset show all when changing brands
  selectedCategory = 'all'; // Reset category filter
  selectedOp = null; // Clear selected op when changing brands
  
  // v10.5.25: Update brand name display
  updateStudioBrandName();
  
  // v9.1.14: Sync to ALL brand selectors for consistent brand state
  var brandIdx = studioSelectedBrand;
  document.getElementById('brand').value = brandIdx;
  if (document.getElementById('agentBrand')) document.getElementById('agentBrand').value = brandIdx;
  if (document.getElementById('mobileBrand')) document.getElementById('mobileBrand').value = brandIdx;
  
  // Update selected state in brand dropdown
  document.querySelectorAll('#brandDropdown .brand-option').forEach(function(opt) {
    opt.classList.remove('selected');
    if (opt.dataset.value == brandIdx) {
      opt.classList.add('selected');
    }
  });
  
  // Update brand name display and provider pills
  updateBrandName();
  updateProviderPills();
  
  // Sync mobile brand pill
  if (typeof syncMobileBrandV2 === 'function') syncMobileBrandV2();
  
  // Reset category filter UI
  document.querySelectorAll('.category-filter').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.category === 'all');
  });
  
  // Clear search
  opsSearchQuery = '';
  var searchInput = document.getElementById('opsSearch');
  var searchClear = document.getElementById('opsSearchClear');
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.classList.remove('visible');
  
  renderOperations();
  updateBreadcrumb();

  // v13.3: Update depth badge and suggestions on brand change
  updateStudioDepthBadge();
  renderStudioSuggestions();

  // v9.1.14: Removed toast - silent brand switch
}

function toggleShowAllOps() {
  showAllOps = !showAllOps;
  renderOperations();
}

// ═══════════════════════════════════════════════════════════════
// v28.9: Studio Action Bar — expandable panels
// ═══════════════════════════════════════════════════════════════

var _studioExpanderActive = null;

function toggleStudioExpander(type) {
  var panel = document.getElementById('studioExpanderPanel');
  if (!panel) return;

  // Toggle off if same type clicked again
  if (_studioExpanderActive === type) {
    panel.style.display = 'none';
    _studioExpanderActive = null;
    // Remove active state from all buttons
    var btns = document.querySelectorAll('.studio-action-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    return;
  }

  _studioExpanderActive = type;
  panel.style.display = 'block';

  // Update active button state
  var btns2 = document.querySelectorAll('.studio-action-btn');
  for (var j = 0; j < btns2.length; j++) btns2[j].classList.remove('active');
  // Find the clicked button by matching the type
  var allBtns = document.querySelectorAll('.studio-action-btn');
  var typeMap = ['search', 'recommend', 'generate', 'custom'];
  for (var k = 0; k < allBtns.length && k < typeMap.length; k++) {
    if (typeMap[k] === type) allBtns[k].classList.add('active');
  }

  var html = '';
  if (type === 'search') {
    html = '<div style="display:flex;align-items:center;gap:8px;">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
      '<input type="text" id="opsSearch" placeholder="Search operations..." oninput="searchOperations(this.value)" style="flex:1;padding:8px 12px;background:transparent;border:none;color:var(--text-primary);font-size:14px;outline:none;">' +
    '</div>';
  } else if (type === 'custom') {
    html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<span style="font-size:13px;font-weight:600;">Create Custom</span>' +
    '</div>' +
    '<div style="display:flex;gap:8px;">' +
      '<input type="text" id="brandAICreatorInput" placeholder="Describe a specific operation to create..." onkeypress="if(event.key===\'Enter\'){createCustomBrandOperation();toggleStudioExpander(\'custom\');}" style="flex:1;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px;">' +
      '<button onclick="createCustomBrandOperation();toggleStudioExpander(\'custom\');" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">Create</button>' +
    '</div>';
  }

  panel.innerHTML = html;

  // Auto-focus search input
  if (type === 'search') {
    var searchInput = document.getElementById('opsSearch');
    if (searchInput) searchInput.focus();
  }
  if (type === 'custom') {
    var customInput = document.getElementById('brandAICreatorInput');
    if (customInput) customInput.focus();
  }
}

// v28.9: AI Generate — runs generation with glow animation on button
function runStudioAIGenerate(btn) {
  if (!btn) return;
  // Add glow animation
  btn.classList.add('studio-ai-generating');
  btn.disabled = true;
  var origHTML = btn.innerHTML;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="studio-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg><span>Generating...</span>';

  // Call the actual generation function
  if (typeof generateBrandAIRecommendations === 'function') {
    generateBrandAIRecommendations();
  }

  // Restore button after a delay (generation is async, this is a visual indicator)
  setTimeout(function() {
    btn.innerHTML = origHTML;
    btn.classList.remove('studio-ai-generating');
    btn.disabled = false;
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// AGENT SELECTION v10.0
// ═══════════════════════════════════════════════════════════════
function selectAgent(agentId) {
  currentAgent = agentId;

  // v26.2: Update unified pill nav
  updatePillNavActive('studioPillNav', agentId);

  // v28.9: Image Chat and Blog show special panels instead of operations
  var studioContent = document.getElementById('studioV2Content');
  var studioMediaPanel = document.getElementById('studioMediaPanel');
  // v28.9: Hide/show action bar based on panel type
  var studioActionBar = document.getElementById('studioActionBar');
  var studioExpander = document.getElementById('studioExpanderPanel');
  if (agentId === 'imagechat' || agentId === 'videochat' || agentId === 'blog') {
    // Hide normal operations + action bar, show media panel
    if (studioContent) studioContent.style.display = 'none';
    if (studioActionBar) studioActionBar.style.display = 'none';
    if (studioExpander) studioExpander.style.display = 'none';
    if (!studioMediaPanel) {
      studioMediaPanel = document.createElement('div');
      studioMediaPanel.id = 'studioMediaPanel';
      studioMediaPanel.style.cssText = 'margin-top:var(--space-4);';
      if (studioContent && studioContent.parentNode) {
        studioContent.parentNode.insertBefore(studioMediaPanel, studioContent.nextSibling);
      }
    }
    studioMediaPanel.style.display = 'block';
    if (agentId === 'imagechat') {
      renderStudioImageChat(studioMediaPanel);
    } else if (agentId === 'videochat') {
      renderStudioVideoChat(studioMediaPanel);
    } else {
      renderStudioBlog(studioMediaPanel);
    }
    return;
  }

  // Normal agent/category selection — show operations + action bar, hide media panel
  if (studioContent) studioContent.style.display = '';
  if (studioMediaPanel) studioMediaPanel.style.display = 'none';
  if (studioActionBar) studioActionBar.style.display = '';

  // If an agent is selected (not 'all'), auto-filter to that category
  if (agentId !== 'all') {
    var agent = null;
    for (var ai = 0; ai < agents.length; ai++) {
      if (agents[ai].id === agentId) { agent = agents[ai]; break; }
    }
    if (agent) {
      selectedCategory = agent.category;
    } else {
      // v22.0: Tab is a category directly (image, video, social, research)
      selectedCategory = agentId;
    }
  } else {
    selectedCategory = 'all';
  }

  // Update agent info card if present
  updateAgentInfoCard();

  // v13.1: Update live system prompt preview
  updateStudioPromptPreview();

  // Re-render operations
  renderOperations();

  // v10.5.25: Scroll to top of content area
  var contentArea2 = document.getElementById('studioV2Content');
  if (contentArea2) {
    contentArea2.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * v13.1: Toggle Studio system prompt preview visibility
 */
// v28.9: Image Chat panel in Studio — reuses existing renderAutoLabImageLab
function renderStudioImageChat(container) {
  if (!container) return;
  container.innerHTML = '<div id="studioImageLabPanel"></div>';
  if (typeof renderAutoLabImageLab === 'function') {
    renderAutoLabImageLab('studioImageLabPanel');
  } else {
    container.innerHTML = '<div style="padding:40px;text-align:center;opacity:0.5;">Image Chat loading...</div>';
  }
}

// v28.9: Video Chat panel in Studio — reuses existing video lab
function renderStudioVideoChat(container) {
  if (!container) return;
  container.innerHTML = '<div id="studioVideoLabPanel"></div>';
  if (typeof renderAutoLabVideoLab === 'function') {
    renderAutoLabVideoLab('studioVideoLabPanel');
  } else {
    container.innerHTML = '<div style="padding:40px;text-align:center;opacity:0.5;">Video Chat not available.</div>';
  }
}

// v28.9: Blog panel in Studio — renders blog editor inline
function renderStudioBlog(container) {
  if (!container) return;
  // Show the existing blog tab content by cloning it from socialTabBlog
  var blogSource = document.getElementById('socialTabBlog');
  if (blogSource) {
    // Make the original visible temporarily so we can use it
    container.innerHTML = '';
    // Move the blog tab content to studio temporarily
    blogSource.style.display = 'block';
    container.appendChild(blogSource);
    if (typeof initBlogTab === 'function') initBlogTab();
  } else {
    container.innerHTML = '<div style="padding:40px;text-align:center;opacity:0.5;">Blog editor not available. Open Media Lab first to initialize.</div>';
  }
}

function toggleStudioPromptPreview() {
  var body = document.getElementById('studioPromptPreviewBody');
  var icon = document.getElementById('studioPromptToggleIcon');
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  if (icon) icon.innerHTML = isHidden ? '&#9650;' : '&#9660;';
  if (isHidden) updateStudioPromptPreview();
}

/**
 * v13.1: Update the live system prompt preview based on current agent/brand
 */
function updateStudioPromptPreview() {
  var section = document.getElementById('studioPromptPreviewSection');
  var textarea = document.getElementById('studioPromptPreviewText');
  if (!section || !textarea) return;

  section.style.display = 'block';

  var brandIdx = typeof studioSelectedBrand !== 'undefined' ? studioSelectedBrand : parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  if (!brand) {
    textarea.value = 'No brand selected';
    return;
  }

  var agent = null;
  if (typeof currentAgent !== 'undefined' && currentAgent !== 'all') {
    agent = (typeof agents !== 'undefined') ? agents.find(function(a) { return a.id === currentAgent; }) : null;
  }

  try {

    if (typeof buildBrandSystemPrompt === 'function') {
      prompt = buildBrandSystemPrompt(brand, agent);
    } else {
      prompt = 'System prompt builder not available';
    }
    textarea.value = prompt;
  } catch (e) {
    textarea.value = 'Error building prompt: ' + e.message;
  }
}

/**
 * v13.1: Toggle Studio run history visibility
 */
function toggleStudioRunHistory() {
  var body = document.getElementById('studioRunHistoryBody');
  var icon = document.getElementById('studioRunHistoryToggle');
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  if (icon) icon.innerHTML = isHidden ? '&#9650;' : '&#9660;';
  if (isHidden) renderStudioRunHistory();
}

/**
 * v13.1: Render Studio run history from saved runs
 */
function renderStudioRunHistory() {
  var container = document.getElementById('studioRunHistoryList');
  var countEl = document.getElementById('studioRunHistoryCount');
  if (!container) { console.warn('[RunHistory] Container #studioRunHistoryList not found'); return; }

  // v13.9: Fix - use global `runs` array (Studio outputs), not agentCommands (chat history)
  var studioRuns = window.runs || [];
  console.log('[RunHistory] Rendering', studioRuns.length, 'runs');
  // Show most recent 20 runs
  var recentRuns = studioRuns.slice(-20).reverse();

  if (countEl) countEl.textContent = '(' + studioRuns.length + ')';

  // v15.33: Auto-show history body if there are runs
  var body = document.getElementById('studioRunHistoryBody');
  var toggleIcon = document.getElementById('studioRunHistoryToggle');
  if (body && studioRuns.length > 0) {
    body.style.display = 'block';
    if (toggleIcon) toggleIcon.innerHTML = '&#9650;';
  }

  if (recentRuns.length === 0) {
    container.innerHTML = '<div style="font-size: var(--text-sm); color: var(--text-muted); text-align: center; padding: var(--space-3);">No runs yet. Complete a Studio operation to see history.</div>';
    return;
  }

  var html = recentRuns.map(function(run, idx) {
    var title = run.op || 'Untitled';
    var time = run.time || 'Unknown';
    var brand = run.brand || 'N/A';
    var hasOutput = run.deliv || run.output;
    var outputPreview = hasOutput ? (run.deliv || run.output).substring(0, 200) + ((run.deliv || run.output).length > 200 ? '...' : '') : 'No output';
    // v13.4: Better timestamp formatting
    var timeDisplay = time;
    try {
      var d = new Date(time);
      if (!isNaN(d.getTime())) {
        timeDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + formatDateTimeDisplay(d);
      }
    } catch(e) {}

    return '<div class="studio-run-history-item" style="background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; cursor: pointer;" onclick="this.querySelector(\'.studio-run-detail\').style.display = this.querySelector(\'.studio-run-detail\').style.display === \'none\' ? \'block\' : \'none\'">' +
      '<div style="display: flex; justify-content: space-between; align-items: center;">' +
        '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">' + escapeHtml(title) + '</div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + escapeHtml(timeDisplay) + '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + escapeHtml(brand) + '</div>' +
        '<button onclick="event.stopPropagation(); rerunStudioOp(\'' + escapeHtml(title).replace(/'/g, "\\'") + '\')" style="background:none;border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:2px 8px;font-size:10px;color:var(--accent);cursor:pointer;display:flex;align-items:center;gap:3px;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> Re-run</button>' +
      '</div>' +
      (hasOutput ? '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(outputPreview.substring(0, 80)) + '</div>' : '') +
      '<div class="studio-run-detail" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 4px;">Output:</div>' +
        '<div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap;">' + escapeHtml(outputPreview) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
}

/**
 * v13.4: Re-run a Studio operation by name
 */
function rerunStudioOp(opName) {
  var allOps = (ops || []).concat(window.lifeOps || []).concat(generatedBrandOps || []);
  var op = allOps.find(function(o) { return o.name === opName; });
  if (op) {
    selectedOp = op;
    showConfigPanel(op);
    showToast('Ready to re-run: ' + opName, 'info');
  } else {
    showToast('Operation not found: ' + opName, 'warning');
  }
}

// v10.5.25: Toggle new operation dropdown
function toggleNewOperationDropdown() {
  var dropdown = document.getElementById('newOperationDropdown');
  if (dropdown) {
    dropdown.classList.toggle('visible');
  }
}

function closeNewOperationDropdown() {
  var dropdown = document.getElementById('newOperationDropdown');
  if (dropdown) {
    dropdown.classList.remove('visible');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var dropdown = document.getElementById('newOperationDropdown');
  var btn = e.target.closest('.studio-v2-add-btn');
  if (dropdown && !btn && !e.target.closest('.studio-v2-add-dropdown')) {
    dropdown.classList.remove('visible');
  }
});

function updateAgentInfoCard() {
  // Function kept for compatibility but elements have been removed
  // Agent selection is now indicated by the pill highlighting only
}

function getAgentSystemPrompt(agentId) {
  var agent = agents.find(function(a) { return a.id === agentId; });
  if (!agent) return '';
  
  var brand = brands[selectedBrand];
  var prompt = agent.systemPrompt
    .replace('{brandName}', brand.name)
    .replace('{brandPhilosophy}', brand.philosophy || '')
    .replace('{brandVoice}', brand.voice || '')
    .replace('{brandTone}', brand.tone || '')
    .replace('{brandPositioning}', brand.positioning || '');
  
  return prompt;
}

// v10.5.25: Build brand system prompt for Studio operations
function buildBrandSystemPrompt(brand, agent) {
  var systemPrompt = `You are an expert AI assistant for ${brand.name}.

BRAND CONTEXT:
- Name: ${brand.name}
- Tagline: ${brand.tagline || 'N/A'}
- Voice: ${brand.voice || 'Professional and warm'}
- Audience: ${brand.audience || 'Discerning clients'}
- Positioning: ${brand.positioning || 'Excellence in every detail'}
- Values: ${brand.values || 'Quality, integrity, service'}`;

  // Add any additional brand identity elements from chips
  if (typeof addedBrandChips !== 'undefined' && addedBrandChips.size > 0) {
    systemPrompt += '\n\nADDITIONAL BRAND ELEMENTS:';
    addedBrandChips.forEach(function(key) {
      var value = brand[key];
      if (value && !['name', 'tagline', 'voice', 'audience', 'positioning', 'values'].includes(key)) {
        systemPrompt += '\n- ' + key.charAt(0).toUpperCase() + key.slice(1) + ': ' + value;
      }
    });
  }
  
  // v11.0.5: CROSS-MODE INTELLIGENCE - Add owner context from LifeAI
  var ownerContext = getBrandOwnerContext();
  if (ownerContext) {
    systemPrompt += '\n\n' + ownerContext;
  }

  // v15.14: BRAND IDENTITY INTELLIGENCE - Pull learned knowledge from Identity
  var brandIdentityKnowledge = getBrandIdentityIntelligence(brand);
  if (brandIdentityKnowledge) {
    systemPrompt += '\n\n' + brandIdentityKnowledge;
  }

  systemPrompt += '\n\nGUIDELINES:\n- Maintain the brand voice consistently throughout your response\n- Be professional, thorough, and helpful\n- Focus on quality and attention to detail\n- Tailor content to the target audience\n- Never use em-dashes or en-dashes in any output. Use commas, periods, semicolons, or hyphens instead.\n- When the user\'s message contains "[Web page content from ...]", that is REAL fetched content from that URL. Use it directly. Never say you cannot access URLs. The system fetches pages for you automatically. If no web page content block is present, say you could not retrieve the page.';

  // v11.0.5: Check for custom agent prompt from Guardrails
  if (agent) {
    var customAgentPrompts = JSON.parse(localStorage.getItem('roweos_brand_agent_prompts') || '{}');
    var agentPrompt = customAgentPrompts[agent.id] || agent.systemPrompt;

    if (agentPrompt) {
      systemPrompt += '\n\nAGENT SPECIALIZATION:\n' + agentPrompt
        .replace(/{brandName}/g, brand.name)
        .replace(/{brandVoice}/g, brand.voice || '')
        .replace(/{brandTone}/g, brand.tone || '')
        .replace(/{brandPhilosophy}/g, brand.philosophy || '')
        .replace(/{brandPositioning}/g, brand.positioning || '');
    }
  }

  // v22.39: Inject guardrails into Studio system prompts
  if (typeof getGuardrailsContext === 'function') {
    systemPrompt += getGuardrailsContext();
  }

  // v24.8: Inject user contact card and automation memory
  var _ucPrompt = typeof getUserContactPrompt === 'function' ? getUserContactPrompt() : '';
  if (_ucPrompt) systemPrompt += '\n\n' + _ucPrompt;
  var _amPrompt = typeof getAutomationMemoryPrompt === 'function' ? getAutomationMemoryPrompt() : '';
  if (_amPrompt) systemPrompt += '\n\n' + _amPrompt;

  // v19.7: Append automation creation capability
  systemPrompt += buildAutomationCapabilityPrompt();

  return systemPrompt;
}

// v19.7: Teach AI to emit structured automation/pipeline JSON blocks
function buildAutomationCapabilityPrompt() {
  var today = new Date().toISOString().split('T')[0];
  return '\n\nAUTOMATION CREATION CAPABILITY:\n' +
    'When the user asks you to schedule, automate, or set up a recurring task, you can output a structured JSON block that they can activate with one click.\n' +
    'Today is ' + today + '. Never schedule in the past.\n\n' +
    'For multi-step pipelines, use:\n' +
    '```roweos-pipeline\n' +
    '{"name":"Pipeline Name","scheduledDate":"YYYY-MM-DD","time":"HH:MM","recurType":"daily|weekly|monthly|none",' +
    '\"steps\":[{\"action\":\"studio|image|post|notify|research|email|video\",\"name\":\"Step Name\",' +
    '\"target\":{\"agentId\":\"strategy|marketing|operations|documents|social|intelligence\",\"operationId\":1,\"text\":\"prompt or instructions\",\"contextRef\":\"Detailed instructions for what this step should produce\",\"platforms\":[\"threads\",\"instagram\",\"x\"]}}]}\\n' +
    '```\\n\\n' +
    'CRITICAL PIPELINE RULES:\\n' +
    '- Every studio step MUST include \"contextRef\" in target with detailed instructions explaining exactly what the AI should produce. Without contextRef, the step will have no guidance and will fail or produce poor results.\\n' +
    '- For research steps, include \"researchQuery\" in target with the specific research query text.\\n' +
    '- To reference a previous step output, use {{stepN_output}} where N is the step number. Step 2 references {{step1_output}}, step 3 references {{step2_output}}, etc. Always reference the immediately preceding step unless there is a specific reason to reference an earlier one.\\n' +
    '- For email steps, include \"to\", \"emailSubject\", and \"emailBody\" in target. Use {{stepN_output}} in emailBody to include previous step content.\\n\\n' +
    'For single-step automations, use:\n' +
    '```roweos-automation\n' +
    '{"name":"Automation Name","action":"studio|image|post|notify|create|message|pulse",' +
    '"scheduledDate":"YYYY-MM-DD","time":"HH:MM","recurType":"daily|weekly|monthly|none",' +
    '"target":{"agentId":"marketing","operationId":45,"text":"instructions","platforms":["threads"]}}\n' +
    '```\n\n' +
    'Common operation IDs: 1=Content Calendar, 2=Campaign Sprint, 45=Social Post, 48=Caption Writer, 508=Email Writer (agentId: documents, use for any email drafting/writing tasks).\\n' +
    'Rules: Always include a human-readable explanation alongside the JSON block. Only output these blocks when the user explicitly asks for scheduling or automation.\n\n' +
    'SOCIAL POST CAPABILITY:\n' +
    'When the user asks you to post, publish, or share something to social media, output:\n' +
    '```roweos-social-post\n' +
    '{"text":"Your post caption here","platforms":["threads","instagram"],"useConversationImage":true}\n' +
    '```\n' +
    'Fields: text (required), platforms (optional array of connected platforms), useConversationImage (true to attach the last generated image from this conversation).\n' +
    'Only output this block when the user explicitly asks to post or publish to social media. Always include a brief explanation alongside it.\n\n' +
    'IDENTITY UPDATE CAPABILITY:\n' +
    'When the user asks you to update, save, add, or modify their brand identity, output one or more structured blocks:\n' +
    '```roweos-identity-update\n' +
    '{"section":"products","content":"The new content to save in that identity section"}\n' +
    '```\n' +
    'Valid sections: essence, voice, audience, messaging, products, visual, competitive.\n' +
    'The content will be saved to the AI Insights field of that identity section.\n' +
    'When the user says "add to identity" after discussing a document or topic, output MULTIPLE blocks - one for each relevant section. Extract and organize the information by section. For example, if analyzing a brand guide, output separate blocks for essence, voice, audience, messaging, products, visual, and competitive as applicable.\n' +
    'Always output this block when the user asks to update, add to, or save something to their brand identity. Include a brief confirmation message alongside it.\n\n' +
    'CLIENT/LEAD MANAGEMENT CAPABILITY:\n' +
    'When the user asks you to add clients, leads, prospects, or contacts to their client list, output:\n' +
    '```roweos-add-clients\n' +
    '[{"name":"Business Name","company":"Company Name","industry":"Industry","location":"City, ST","notes":"Brief context"}]\n' +
    '```\n' +
    'Include all known fields from context. Always output this block when the user explicitly asks to add to clients or leads. Include a brief confirmation alongside it.\n\n' +
    'PULSE GOAL CREATION CAPABILITY:\n' +
    'When the user asks you to create a goal, action plan, checklist, or objective, output:\n' +
    '```pulse_goal\n' +
    '{"title":"Goal Title","description":"Brief description of the goal","items":["Task 1","Task 2","Task 3"]}\n' +
    '```\n' +
    'Fields: title (required), description (optional), items (array of actionable task strings, 3-8 recommended).\n' +
    'Each item should be a concise, actionable task. Never use em-dashes in task text.\n' +
    'Only output this block when the user explicitly asks to create a goal, plan, or checklist for Pulse. Include a brief explanation alongside it.\n';
}

/**
 * v15.14: Get brand Identity intelligence for system prompt injection
 * Pulls insights, document knowledge, and brand memory from Identity
 * This makes BrandAI learn and adapt as the user adds documents and insights
 */
function getBrandIdentityIntelligence(brand) {
  if (!brand || !brand.name) return '';

  var intelligence = '';
  var hasContent = false;

  // 1. Brand Knowledge from Identity documents (roweos_brand_knowledge_BRANDNAME)
  try {
    var knowledge = getBrandKnowledge(brand.name);
    if (knowledge) {
      // systemPromptAdditions is pre-built from document analysis
      if (knowledge.systemPromptAdditions && knowledge.systemPromptAdditions.trim()) {
        intelligence += knowledge.systemPromptAdditions;
        hasContent = true;
      } else if (knowledge.insights && knowledge.insights.length > 0) {
        // Fallback: build from raw insights if systemPromptAdditions wasn't generated
        intelligence += '\n\n=== LEARNED BRAND KNOWLEDGE (from Identity) ===\n';
        intelligence += 'Key Insights:\n';
        knowledge.insights.slice(-20).forEach(function(insight) {
          var insightText = typeof insight === 'object' ? insight.text : insight;
          if (insightText) intelligence += '- ' + insightText + '\n';
        });
        hasContent = true;
      }
    }
  } catch (e) {
    console.warn('[BrandAI] Error loading brand knowledge:', e);
  }

  // 2. Brand Memory documents (brandMemory['brand_X']) - uploaded doc insights
  try {
    var brandIdx = brands.indexOf(brand);
    if (brandIdx === -1) {
      brandIdx = brands.findIndex(function(b) { return b.name === brand.name; });
    }
    var memKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(brandIdx) : 'brand_' + brandIdx;
    if (typeof brandMemory !== 'undefined' && brandMemory[memKey] && brandMemory[memKey].documents) {
      var docs = brandMemory[memKey].documents;
      if (docs.length > 0) {
        var docSummaries = [];
        docs.forEach(function(doc) {
          if (doc.insights && doc.insights.length > 0) {
            doc.insights.forEach(function(ins) {
              var txt = typeof ins === 'object' ? ins.text : ins;
              if (txt) docSummaries.push(txt);
            });
          }
        });
        if (docSummaries.length > 0 && !hasContent) {
          intelligence += '\n\n=== BRAND DOCUMENT INTELLIGENCE ===\n';
          docSummaries.slice(-15).forEach(function(s) {
            intelligence += '- ' + s + '\n';
          });
          hasContent = true;
        } else if (docSummaries.length > 0) {
          // Append additional doc insights not already covered
          intelligence += '\nAdditional Document Insights:\n';
          docSummaries.slice(-10).forEach(function(s) {
            intelligence += '- ' + s + '\n';
          });
        }
      }
    }
  } catch (e) {
    console.warn('[BrandAI] Error loading brand memory:', e);
  }

  // 3. Brand Knowledge Repository (brand_X from Memory view)
  try {
    var brandIdx2 = brands.indexOf(brand);
    if (brandIdx2 === -1) brandIdx2 = brands.findIndex(function(b) { return b.name === brand.name; });
    var repoKnowledge = localStorage.getItem('brand_' + brandIdx2);
    if (repoKnowledge && repoKnowledge.length > 50) {
      // Truncate to prevent token bloat (first 3000 chars)
      intelligence += '\n\n=== BRAND KNOWLEDGE REPOSITORY ===\n';
      intelligence += repoKnowledge.substring(0, 3000);
      if (repoKnowledge.length > 3000) intelligence += '\n[...additional knowledge available]';
      hasContent = true;
    }
  } catch (e) {
    console.warn('[BrandAI] Error loading knowledge repository:', e);
  }

  return hasContent ? intelligence : '';
}

/**
 * v11.0.5: Get owner context from LifeAI for BrandAI prompts
 * Provides personal context that helps with brand content
 */
function getBrandOwnerContext() {
  // Check if cross-mode is enabled (user might want privacy)
  var crossModeEnabled = localStorage.getItem('roweos_cross_mode_enabled') !== 'false';
  if (!crossModeEnabled) return '';
  
  // Get LifeAI profile
  if (typeof getLifeProfiles !== 'function') return '';
  
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  
  if (!profile) return '';
  
  var context = 'BRAND OWNER CONTEXT (from LifeAI):';
  var hasContent = false;
  
  // Owner name
  if (profile.name) {
    context += '\n- Owner: ' + profile.name;
    hasContent = true;
  }
  
  // Work/business info
  var identityData = profile.identityData || {};
  var work = identityData.work || [];
  work.forEach(function(item) {
    if (item.type === 'role') {
      context += '\n- Owner Role: ' + item.value;
      hasContent = true;
    }
  });
  
  // Location (for local business relevance)
  var personal = identityData.personal || [];
  personal.forEach(function(item) {
    if (item.type === 'location') {
      context += '\n- Location: ' + item.value;
      hasContent = true;
    }
  });
  
  // Communication style preference
  if (profile.preferences && profile.preferences.communicationStyle) {
    var styleLabels = {
      supportive: 'Warm and supportive',
      direct: 'Direct and concise',
      coach: 'Motivating and action-oriented',
      analytical: 'Data-driven and detailed'
    };
    context += '\n- Owner Prefers: ' + (styleLabels[profile.preferences.communicationStyle] || profile.preferences.communicationStyle) + ' communication';
    hasContent = true;
  }
  
  return hasContent ? context : '';
}

/**
 * v29.0: Villainous Game Master - hidden /villain command
 */
function buildVillainousSystemPrompt() {
  return 'You are the Villainous Game Master, an expert rules advisor for the Disney Villainous and Marvel Villainous board game families. You exist to help players resolve complex rule disputes, clarify card interactions, and ensure fair play.\n\n' +
  '## YOUR EXPERTISE\n\n' +
  '### Disney Villainous (all expansions)\n' +
  '- Base game: The Worst Takes It All (Captain Hook, Jafar, Maleficent, Prince John, Queen of Hearts, Ursula)\n' +
  '- Wicked to the Core (Dr. Facilier, Evil Queen, Hades)\n' +
  '- Evil Comes Prepared (Scar, Yzma, Ratigan)\n' +
  '- Perfectly Wretched (Cruella De Vil, Pete, Mother Gothel)\n' +
  '- Despicable Plots (Gaston, Lady Tremaine, The Horned King)\n' +
  '- Bigger and Badder (Syndrome, Lotso, Madam Mim)\n' +
  '- Sugar and Spite (King Candy, Shere Khan, Oogie Boogie)\n' +
  '- Filled with Fright (Jafar Dragon Form, DOR-15, The Headless Horseman)\n' +
  '- Plus any standalone or special editions\n\n' +
  '### Marvel Villainous (all expansions)\n' +
  '- Infinite Power (Thanos, Hela, Killmonger, Ultron, Taskmaster)\n' +
  '- Mischief and Malice (Loki, M.O.D.O.K., Madame Masque)\n' +
  '- We Are Venom (Venom, Mysterio, Titania)\n' +
  '- Plus any standalone or special editions\n\n' +
  '## CORE RULES KNOWLEDGE\n\n' +
  '### Turn Structure\n' +
  '1. Move your Villain mover to a different location in your realm (you MUST move, you cannot stay)\n' +
  '2. Perform available actions at that location (top row = your actions, bottom row = blocked by heroes)\n' +
  '3. Actions can be performed in ANY order, but each action icon can only be used once per turn\n\n' +
  '### Key Action Types\n' +
  '- Gain Power (currency tokens)\n' +
  '- Play a Card (pay its cost, allies/items to your realm, effects/conditions resolve immediately)\n' +
  '- Activate (trigger an Ally or Item ability)\n' +
  '- Fate (draw from another player Fate deck, play a Hero or effect against them)\n' +
  '- Move an Item or Ally (move within your realm)\n' +
  '- Move a Hero (move a Hero in another player realm during Fate, or within your own realm if you have that action)\n' +
  '- Vanquish (defeat a Hero -- requires Ally at same location with sufficient Strength)\n' +
  '- Discard Cards (discard any number from your hand, then draw back to hand size)\n\n' +
  '### Critical Rules Often Disputed\n' +
  '- Locked locations: Heroes played to a location COVER the top row actions (they are locked/blocked). You can still move there but only use bottom-row actions.\n' +
  '- Vanquish requirements: The Ally Strength must be >= the Hero Strength. Multiple Allies at the same location can combine Strength to Vanquish one Hero.\n' +
  '- Card timing: When played effects happen immediately. When revealed effects on Fate cards happen when drawn from the Fate deck.\n' +
  '- Condition cards: Stay in play until their condition is met, then resolve and discard.\n' +
  '- Hand size: Draw up to hand size (default 4) at END of turn, not beginning. If you have 4+ cards, you do NOT draw.\n' +
  '- Fate deck: You can ONLY Fate another player, never yourself. You draw 2 cards from their Fate deck and may play 0 or 1 of them.\n' +
  '- Moving: You MUST move to a DIFFERENT location each turn. You cannot stay in place.\n' +
  '- Power: Power tokens are public information. Players can always see how much Power others have.\n' +
  '- Discard vs. Defeat: Discarding a card from a realm is NOT the same as defeating/vanquishing. Cards that say defeat or vanquish trigger defeat-related effects.\n\n' +
  '### Marvel Villainous Differences\n' +
  '- Uses Specialty cards unique to each villain in addition to standard actions\n' +
  '- Some villains have unique mechanics (e.g., Thanos collecting Infinity Stones, Hela using Odinforce)\n' +
  '- Events deck is shared between all players (separate from individual Fate decks)\n' +
  '- Event cards trigger at the start of each player turn if the Events deck icon is showing\n\n' +
  '## REFERENCE SOURCES\n' +
  'When I need to verify specific card text, FAQ rulings, or expansion-specific rules, I reference:\n' +
  '- Disney Villainous Wiki: https://disney-villainous.fandom.com/wiki/Disney_Villainous_Wiki\n' +
  '- Marvel Villainous Wiki: https://marvel-villainous-infinite-power.fandom.com/wiki/Turn\n' +
  '- Official Disney Villainous Rulebook (Ravensburger)\n' +
  '- Official Marvel Villainous Rulebook (Ravensburger)\n\n' +
  '## HOW TO RESPOND\n\n' +
  '1. Be definitive: Give clear yes/no rulings. Do not hedge unless the rules genuinely are ambiguous.\n' +
  '2. Cite the rule: Always explain WHY a ruling is correct by referencing the specific rule.\n' +
  '3. Resolve disputes fairly: When players describe a scenario, consider all perspectives before ruling.\n' +
  '4. Acknowledge edge cases: Some interactions ARE ambiguous. When they are, explain the common interpretations and recommend one.\n' +
  '5. Be fun: You are a game master, not a robot. Match the playful villainy energy of the games. Light themed humor is welcome.\n' +
  '6. Ask for clarification: If a scenario is unclear, ask what specific cards/characters/locations are involved.\n' +
  '7. Support complex scenarios: Players may describe multi-step turns or chain interactions. Walk through them step by step.\n\n' +
  '## PERSONALITY\n' +
  'You speak with the authority of a seasoned game master who has played hundreds of rounds. You appreciate clever plays and dramatic turns. You might reference iconic villain quotes when appropriate. You treat rule disputes seriously but keep the mood fun -- after all, the whole point is that being the villain should feel deliciously satisfying.\n\n' +
  'The players you are helping are Jordan and Elisa. Address them by name when they identify themselves in a question.\n\n' +
  'If the user provides a URL to a wiki page or rulebook, read and reference it to give the most accurate answer possible.';
}

/**
 * v10.5.25: Build LifeAI System Prompt
 * This prompt learns about the user and adapts over time
 */
function buildLifeAISystemPrompt() {
  // v10.5.25: Check for CUSTOM LifeAI main prompt first (from Settings)
  var customPrompt = localStorage.getItem('roweos_life_main_prompt');
  if (customPrompt && customPrompt.trim()) {
    console.log('[LifeAI] Using custom main system prompt from Settings');
    // v19.7: Append automation capability to custom prompt + v20.6: URL guidance
    return customPrompt + buildAutomationCapabilityPrompt() +
      '\n\nWhen the user\'s message contains "[Web page content from ...]", that is REAL fetched content from that URL. Use it directly. Never say you cannot access URLs.';
  }

  // v10.5.25: Check agent type for specialized prompts
  var agentType = localStorage.getItem('roweos_life_agent') || 'personal';
  // v19.7: Append automation capability + v20.6: URL + identity guidance
  var prompt = buildLifeAISystemPromptForCategory(agentType) + buildAutomationCapabilityPrompt();
  prompt += '\n\nWhen the user\'s message contains "[Web page content from ...]", that is REAL fetched content from that URL. Use it directly. Never say you cannot access URLs. The system fetches pages for you automatically.';
  return prompt;
}

/**
 * v11.0.5: Map Studio task category to appropriate LifeAI agent type
 * This ensures Studio tasks use the correct specialist, not the global LifeAI profile
 */
function mapCategoryToAgent(category) {
  var categoryToAgent = {
    'wellness': 'wellness',
    'taxes': 'taxintelligence',
    'finances': 'personal',      // Could be 'finance' specialist if added
    'planning': 'coach',
    'development': 'coach',
    'relationships': 'personal',
    'home': 'personal',
    'creativity': 'personal',
    'reflection': 'coach'
  };
  return categoryToAgent[category] || 'personal';
}

/**
 * v11.0.5: Build LifeAI system prompt for a specific agent type
 * Now injects user knowledge from Identity (About Me + Coach Context)
 * Also supports custom prompt overrides from Guardrails
 */
function buildLifeAISystemPromptForCategory(agentType) {
  var profile = getLifeAIProfile();
  var userName = profile.name || localStorage.getItem('roweos_user_name') || 'there';
  
  // v11.0.5: Check for custom prompt override from Guardrails
  var customPrompts = JSON.parse(localStorage.getItem('roweos_life_coach_prompts') || '{}');
  if (customPrompts[agentType]) {
    var customPrompt = customPrompts[agentType];
    // Inject user knowledge into custom prompt
    var userKnowledge = getLifeAIUserKnowledge(agentType);
    if (userKnowledge) {
      customPrompt += '\n\n' + userKnowledge;
    }
    return customPrompt;
  }
  
  // v11.0.5: Get user knowledge to inject
  var userKnowledge = '';
  if (typeof getLifeAIUserKnowledge === 'function') {
    userKnowledge = getLifeAIUserKnowledge(agentType);
  }
  
  // v10.5.25: Agent-specific prompts
  if (agentType === 'coach') {
    var prompt = `You are a Life Coach for ${userName}.

YOUR ROLE:
You help ${userName} achieve their goals through motivation, accountability, and strategic planning. You push them forward while being supportive.

COACHING APPROACH:
- Ask powerful questions that promote self-reflection
- Help break down big goals into actionable steps
- Celebrate progress and acknowledge challenges
- Hold ${userName} accountable to commitments
- Provide frameworks and tools for success

GUIDELINES:
- Be encouraging but direct
- Focus on solutions and forward movement
- Help identify patterns and blind spots
- Never use emojis in your responses`;
    
    if (userKnowledge) prompt += '\n\n' + userKnowledge;
    return prompt;
  }
  
  if (agentType === 'wellness') {
    var prompt = `You are a Wellness Guide for ${userName}.

YOUR ROLE:
You support ${userName}'s holistic wellbeing including physical health, mental wellness, sleep, nutrition, and stress management.

WELLNESS APPROACH:
- Take a holistic view of health and wellbeing
- Provide evidence-based wellness guidance
- Help establish healthy habits and routines
- Support mental health with empathy and care
- Encourage balance and self-compassion
- Consider work schedule and family responsibilities when suggesting routines

GUIDELINES:
- Be warm and supportive
- Respect boundaries around health topics
- Suggest professional help when appropriate
- Tailor recommendations to their available time and energy levels
- Never use emojis in your responses`;
    
    if (userKnowledge) prompt += '\n\n' + userKnowledge;
    
    // v11.0.5: Add lifestyle context for holistic recommendations
    if (typeof getWellnessContext === 'function') {
      var wellnessContext = getWellnessContext();
      if (wellnessContext) prompt += '\n' + wellnessContext;
    }
    
    return prompt;
  }
  
  // v10.5.25: Tax Intelligence - Evidence-first, deduction-maximizing, audit-ready
  if (agentType === 'taxintelligence') {
    var prompt = `You are Tax Intelligence for ${userName}. Your only goal is to maximize ${userName}'s legal tax outcome while staying fully compliant.

CORE PRINCIPLES:
- Evidence-first: Never invent expenses or facts. If evidence is missing, request the specific document or detail.
- Reconciliation: Cross-check totals across forms, statements, and ledgers; flag mismatches (common audit/notice triggers).
- Explainability: For every recommendation, cite the rule/IRS guidance and list the minimum proof needed.
- Optimization within the rules: Maximize legal benefits, minimize avoidable risk and errors.

COMPLIANCE GUARDRAILS (NON-NEGOTIABLES):
- No invented or backfilled expenses. If evidence is missing, flag it as an evidence gap.
- No suppression of income. Information returns and deposits must be reconciled and explained.
- Separation: Business and personal tracked distinctly; mixed-use items require allocation method.
- High-risk areas (travel/meals/car, home office, large cash, crypto, related-party) get stricter substantiation.

SUBSTANTIATION REQUIREMENTS:
- Receipts/invoices: vendor, date, amount, item/service, and business purpose
- Travel/meals/car: who/what/when/where/why; keep itineraries, receipts, mileage logs
- HSA: proof distribution paid qualified medical expenses; EOBs matched to distribution date
- Asset purchases: purchase docs, placed-in-service date, business use %, depreciation method

WHAT I CAN HELP WITH:
1. Document intake and checklist creation
2. Key field extraction from tax forms (W-2, 1099, K-1, 1098, etc.)
3. Reconciliation (1099-K to deposits, 1099-B to trades, payroll to bank)
4. Deduction and credit discovery with evidence requirements
5. Audit-ready substantiation pack creation
6. Pre-file review for common notice triggers

OUTPUTS I PRODUCE:
- Tax Packet: Organized folder + index with all forms, extracted values, summary
- Deduction/Credit Opportunities: Ranked list with evidence requirements and impact estimates
- Evidence Gap List: Exactly what's missing before a claim is safe to file
- Reconciliation Report: Form totals vs statements vs books with mismatch flags
- Substantiation Pack: For each major deduction: who/what/when/where/why + proof

REFERENCE SOURCES:
- IRS Publication 583 (Starting a Business and Keeping Records)
- IRS Publication 463 (Travel, Gift, and Car Expenses)
- IRS Form Instructions (8889 for HSA, Schedule C, etc.)

GUIDELINES:
- When uncertain, present options, tradeoffs, and what information would resolve uncertainty
- Always cite the IRS rule or publication supporting recommendations
- Be thorough but clear - produce audit-ready workpapers
- You must not assist tax evasion or misreporting
- Never use emojis in your responses`;
    
    if (userKnowledge) prompt += '\n\n' + userKnowledge;
    return prompt;
  }
  
  if (agentType === 'standard') {
    return `You are a helpful AI assistant.

Be helpful, harmless, and honest. Provide accurate information and assistance across any topic the user wants to explore.

Never use emojis in your responses.`;
  }
  
  // Default: Personal Assistant
  var systemPrompt = `You are LifeAI, a personal intelligence assistant for ${userName}.

YOUR ROLE:
You help ${userName} organize their personal life, track goals, manage tasks, and provide thoughtful assistance. You remember what they share and learn their preferences over time.

USER PROFILE:
- Name: ${userName}`;

  // Add goals if any
  if (profile.goals && profile.goals.length > 0) {
    systemPrompt += '\n\nCURRENT GOALS:';
    profile.goals.forEach(function(goal, i) {
      systemPrompt += '\n' + (i + 1) + '. ' + (goal.title || goal);
    });
  }

  // Add recent insights/learnings
  if (profile.insights && profile.insights.length > 0) {
    systemPrompt += '\n\nTHINGS I\'VE LEARNED ABOUT ' + userName.toUpperCase() + ':';
    profile.insights.slice(-10).forEach(function(insight) {
      systemPrompt += '\n- ' + insight;
    });
  }

  // Add preferences
  if (profile.preferences) {
    systemPrompt += '\n\nPREFERENCES:';
    if (profile.preferences.communicationStyle) {
      systemPrompt += '\n- Communication style: ' + profile.preferences.communicationStyle;
    }
    if (profile.preferences.interests && profile.preferences.interests.length > 0) {
      systemPrompt += '\n- Interests: ' + profile.preferences.interests.join(', ');
    }
  }

  systemPrompt += `

GUIDELINES:
- Be warm, supportive, and genuinely helpful
- Remember context from our conversations
- Help with goal tracking, task management, and life organization
- Provide thoughtful advice when asked
- Respect privacy and be discrete
- Learn ${userName}'s preferences and adapt your responses accordingly
- Never use em-dashes or en-dashes in any output. Use commas, periods, semicolons, or hyphens instead.

IMPORTANT: When ${userName} shares something personal or important, make a mental note to remember it for future conversations. This helps you become a better personal assistant over time.`;

  // v11.0.5: Inject user knowledge from Identity
  if (userKnowledge) {
    systemPrompt += '\n\n' + userKnowledge;
  }

  return systemPrompt;
}

/**
 * v10.5.25: Get or create LifeAI profile
 */
function getLifeAIProfile() {
  var profileStr = localStorage.getItem('roweos_life_profile');
  if (profileStr) {
    try {
      return JSON.parse(profileStr);
    } catch (e) {
      console.warn('[LifeAI] Failed to parse profile:', e);
    }
  }
  
  // Return default profile
  return {
    name: localStorage.getItem('roweos_user_name') || 'My Life',
    goals: [],
    tasks: [],
    habits: [],
    notes: [],
    preferences: {},
    insights: [],
    conversationHistory: []
  };
}

/**
 * v10.5.25: Save insight to LifeAI profile
 * Call this when user shares something worth remembering
 */
function addLifeAIInsight(insight) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  if (!profile) return;

  if (!profile.insights) profile.insights = [];
  profile.insights.unshift({ text: insight, timestamp: new Date().toISOString() });
  if (profile.insights.length > 50) profile.insights = profile.insights.slice(0, 50);
  profile.updatedAt = new Date().toISOString();

  profiles[currentIdx] = profile;
  saveLifeProfiles(profiles);
  console.log('[LifeAI] Insight saved:', insight);
}

/**
 * v10.5.25: Add goal to LifeAI profile
 */
function addLifeAIGoal(goal) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  if (!profile) return null;

  if (!profile.goals) profile.goals = [];
  var goalObj = { title: goal, createdAt: new Date().toISOString(), completed: false };
  profile.goals.push(goalObj);
  profile.updatedAt = new Date().toISOString();

  profiles[currentIdx] = profile;
  saveLifeProfiles(profiles);
  console.log('[LifeAI] Goal added:', goalObj.title);
  return goalObj;
}

/**
 * v10.5.25: Save LifeAI conversation to history
 */
function saveLifeAIConversation() {
  if (!currentConversation || currentConversation.length === 0) return;

  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  if (!profile) return;

  if (!profile.conversationHistory) profile.conversationHistory = [];

  // Create conversation snapshot
  var convoSnapshot = {
    id: 'convo_' + Date.now(),
    timestamp: new Date().toISOString(),
    messages: currentConversation.map(function(m) {
      return { role: m.role, content: typeof m.content === 'string' ? m.content.substring(0, 500) : '[complex content]' };
    }),
    summary: (currentConversation[0] && typeof currentConversation[0].content === 'string' ? currentConversation[0].content.substring(0, 100) : 'Conversation')
  };

  profile.conversationHistory.unshift(convoSnapshot);

  // Keep last 50 conversations
  if (profile.conversationHistory.length > 50) {
    profile.conversationHistory = profile.conversationHistory.slice(0, 50);
  }

  profile.updatedAt = new Date().toISOString();

  // v26.4: Route through saveLifeProfiles (which calls syncLifeAIToFirestore)
  profiles[currentIdx] = profile;
  saveLifeProfiles(profiles);

  console.log('[LifeAI] Conversation saved to history');
}

function filterByCategory(category) {
  selectedCategory = category;
  
  // If category filter is clicked, reset to 'all' agent (unless category matches current agent)
  if (currentAgent !== 'all') {
    var agent = agents.find(function(a) { return a.id === currentAgent; });
    if (agent && agent.category !== category && category !== 'all') {
      // Category changed to something different from current agent - reset to all
      currentAgent = 'all';
      document.querySelectorAll('.agent-pill').forEach(function(pill) {
        pill.classList.toggle('active', pill.dataset.agent === 'all');
      });
      updateAgentInfoCard();
    }
  }
  
  // Update active state on buttons (support both old and new class names)
  document.querySelectorAll('.category-filter, .studio-filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  
  renderOperations();
}

function searchOperations(query) {
  opsSearchQuery = query.toLowerCase().trim();
  
  // Show/hide clear button
  var clearBtn = document.getElementById('opsSearchClear');
  if (clearBtn) {
    clearBtn.classList.toggle('visible', opsSearchQuery.length > 0);
  }
  
  renderOperations();
}

var currentSortOrder = 'default';

function toggleSortDropdown() {
  var dropdown = document.getElementById('sortDropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
  }
  
  // Close dropdown when clicking outside
  if (dropdown && dropdown.classList.contains('open')) {
    setTimeout(function() {
      document.addEventListener('click', closeSortDropdown);
    }, 10);
  }
}

function closeSortDropdown(e) {
  var dropdown = document.getElementById('sortDropdown');
  var btn = document.querySelector('.studio-v2-sort-btn');
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove('open');
    document.removeEventListener('click', closeSortDropdown);
  }
}

function sortOperations(sortBy) {
  currentSortOrder = sortBy;
  
  // Update active state in dropdown
  var options = document.querySelectorAll('.studio-v2-sort-option');
  options.forEach(function(opt) {
    opt.classList.remove('active');
    if (opt.textContent.trim().toLowerCase().includes(sortBy === 'default' ? 'default' : 
        sortBy === 'alpha' ? 'a →' : 
        sortBy === 'alpha-desc' ? 'z →' : 
        sortBy === 'category' ? 'category' : 
        sortBy === 'recent' ? 'recent' : sortBy)) {
      opt.classList.add('active');
    }
  });
  
  // Update sort label
  var sortLabel = document.getElementById('sortLabel');
  if (sortLabel) {
    var labels = {
      'default': 'Default',
      'alpha': 'A → Z',
      'alpha-desc': 'Z → A',
      'category': 'Category',
      'recent': 'Recent'
    };
    sortLabel.textContent = labels[sortBy] || 'Default';
  }
  
  // Close dropdown
  var dropdown = document.getElementById('sortDropdown');
  if (dropdown) dropdown.classList.remove('open');
  document.removeEventListener('click', closeSortDropdown);
  
  renderOperations();
}

function getSortedOperations(opsList) {
  if (currentSortOrder === 'default') {
    return opsList;
  }
  
  var sorted = opsList.slice(); // Create copy
  
  if (currentSortOrder === 'alpha') {
    sorted.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
  } else if (currentSortOrder === 'alpha-desc') {
    sorted.sort(function(a, b) {
      return b.name.localeCompare(a.name);
    });
  } else if (currentSortOrder === 'category') {
    sorted.sort(function(a, b) {
      var catA = a.category || 'operations';
      var catB = b.category || 'operations';
      if (catA === catB) return a.name.localeCompare(b.name);
      return catA.localeCompare(catB);
    });
  } else if (currentSortOrder === 'recent') {
    // Get recent ops list
    var recentIds = JSON.parse(localStorage.getItem('roweos_recent_ops') || '[]');
    sorted.sort(function(a, b) {
      var idxA = recentIds.indexOf(a.id);
      var idxB = recentIds.indexOf(b.id);
      // Items in recent list come first (lower index = more recent)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  
  return sorted;
}

function clearOpsSearch() {
  opsSearchQuery = '';
  document.getElementById('opsSearch').value = '';
  document.getElementById('opsSearchClear').classList.remove('visible');
  renderOperations();
}

function matchesSearch(op) {
  if (!opsSearchQuery) return true;
  
  // Search in name, description, and outputs
  var searchText = (op.name + ' ' + op.desc + ' ' + op.outputs.join(' ')).toLowerCase();
  return searchText.indexOf(opsSearchQuery) !== -1;
}

function highlightMatch(text, query) {
  if (!query) return text;
  
  var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return text.replace(regex, '<span class="ops-search-highlight">$1</span>');
}

function togglePin(e, opId) {
  e.stopPropagation();
  
  var brandPinned = pinnedOps[studioSelectedBrand] || [];
  var idx = brandPinned.indexOf(opId);
  var op = ops.find(function(o) { return o.id === opId; });
  
  if (idx === -1) {
    brandPinned.push(opId);
    showToast(op.name + ' pinned for ' + brands[studioSelectedBrand].name, 'success');
  } else {
    brandPinned.splice(idx, 1);
    showToast(op.name + ' unpinned', 'info');
  }
  
  pinnedOps[studioSelectedBrand] = brandPinned;
  saveRuns();
  renderOperations();
}

// v9.1.14: Reorder pinned operations via drag-and-drop
function reorderPinnedOps(draggedId, targetId) {
  var brandPinned = pinnedOps[studioSelectedBrand] || [];
  
  var draggedIdx = brandPinned.indexOf(draggedId);
  var targetIdx = brandPinned.indexOf(targetId);
  
  if (draggedIdx === -1 || targetIdx === -1) return;
  
  // Remove dragged item and insert at target position
  brandPinned.splice(draggedIdx, 1);
  brandPinned.splice(targetIdx, 0, draggedId);
  
  pinnedOps[studioSelectedBrand] = brandPinned;
  saveRuns();
  renderOperations();
  
  showToast('Pinned order updated', 'info');
}

function addToRecent(opId) {
  var brandRecent = recentOps[studioSelectedBrand] || [];
  
  // Remove if already exists
  var idx = brandRecent.indexOf(opId);
  if (idx !== -1) {
    brandRecent.splice(idx, 1);
  }
  // Add to front
  brandRecent.unshift(opId);
  // Keep only last 5
  if (brandRecent.length > 5) {
    brandRecent = brandRecent.slice(0, 5);
  }
  
  recentOps[studioSelectedBrand] = brandRecent;
  saveRuns();
}

// v24.27: Removed dead showTab() — zero callers, referenced tab0-tab4 IDs that no longer exist

function showHistory() {
  var h = document.getElementById('tuningHistory');
  if (runs.length === 0) {
    h.innerHTML = '<div style="color:#888;padding:24px;text-align:center">No runs yet</div>';
    return;
  }
  h.innerHTML = '';
  runs.slice().reverse().forEach(function(run) {
    var item = document.createElement('div');
    item.className = 'history-item';
    var aiTag = run.aiGenerated ? '<span style="background:#22c55e;color:#000;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:8px;">AI</span>' : '';
    item.innerHTML = '<div style="font-weight:600">' + run.op + aiTag + '</div><div style="font-size:13px;color:#888">' + run.brand + ' • ' + run.time + '</div>';
    item.onclick = function() { 
      showOutput(run); 
      showView('studio'); 
    };
    h.appendChild(item);
  });
}

// Simple markdown to HTML converter
function markdownToHtml(text) {
  if (!text) return '';
  
  // First, handle tables before escaping
  var lines = text.split('\n');
  var result = [];
  var inTable = false;
  var tableRows = [];
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    
    // Check if this is a table row (contains | and isn't just a separator)
    if (line.trim().match(/^\|.*\|$/) && !line.trim().match(/^\|[\s\-:]+\|$/)) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
    } else if (line.trim().match(/^\|[\s\-:]+\|$/)) {
      // Table separator row - skip it but stay in table mode
      continue;
    } else {
      // Not a table row
      if (inTable) {
        // End table and render it
        result.push(renderTable(tableRows));
        inTable = false;
        tableRows = [];
      }
      result.push(line);
    }
  }
  
  // Handle table at end of text
  if (inTable && tableRows.length > 0) {
    result.push(renderTable(tableRows));
  }
  
  text = result.join('\n');
  
  var html = text
    // Escape HTML (but not in tables which are already rendered)
    .replace(/&(?!#?\w+;)/g, '&amp;')
    .replace(/<(?!\/?(table|thead|tbody|tr|th|td)[>\s])/g, '&lt;')
    .replace(/(?<!<\/(table|thead|tbody|tr|th|td))>/g, function(match, p1) {
      return p1 ? match : '&gt;';
    })
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    .replace(/^===+$/gm, '<hr>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Callout boxes (custom syntax: ::: note/tip/warning)
    .replace(/^::: ?(note|tip|warning|info)\n([\s\S]*?)^:::/gm, function(match, type, content) {
      return '<div class="callout callout-' + type + '"><div class="callout-title">' + type.charAt(0).toUpperCase() + type.slice(1) + '</div>' + content.trim() + '</div>';
    })
    // Unordered lists - use temporary marker
    .replace(/^[\-\•\*] (.+)$/gm, '<uli>$1</uli>')
    // Numbered lists - use temporary marker
    .replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br>');
  
  // v10.5.25: Wrap consecutive list items in proper list tags (ol vs ul)
  // Handle ordered lists first (consecutive <oli> including across <br> breaks)
  html = html.replace(/(<oli>[\s\S]*?<\/oli>)(\s*(<br>|<\/p><p>)\s*<oli>[\s\S]*?<\/oli>)*/g, function(match) {
    var items = match.replace(/<br>/g, '').replace(/<\/p><p>/g, '').replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>');
    return '<ol>' + items + '</ol>';
  });
  // Handle unordered lists (consecutive <uli> including across <br> breaks)
  html = html.replace(/(<uli>[\s\S]*?<\/uli>)(\s*(<br>|<\/p><p>)\s*<uli>[\s\S]*?<\/uli>)*/g, function(match) {
    var items = match.replace(/<br>/g, '').replace(/<\/p><p>/g, '').replace(/<uli>/g, '<li>').replace(/<\/uli>/g, '</li>');
    return '<ul>' + items + '</ul>';
  });
  // Clean any remaining stray markers (shouldn't happen)
  html = html.replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>');
  html = html.replace(/<uli>/g, '<li>').replace(/<\/uli>/g, '</li>');
  
  // Wrap in paragraph
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs and fix structure
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p><hr><\/p>/g, '<hr>');
  html = html.replace(/<p>(<h[123]>)/g, '$1');
  html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ol>)/g, '$1');
  html = html.replace(/(<\/ol>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table>)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p>(<div class="callout)/g, '$1');
  html = html.replace(/(<\/div>)<\/p>/g, '$1');
  html = html.replace(/<p><br>/g, '<p>');
  html = html.replace(/<br><\/p>/g, '</p>');
  
  return html;
}

function renderTable(rows) {
  if (rows.length === 0) return '';
  
  var html = '<table>';
  
  rows.forEach(function(row, index) {
    var cells = row.split('|').filter(function(c) { return c.trim() !== ''; });
    var tag = index === 0 ? 'th' : 'td';
    var wrapper = index === 0 ? 'thead' : (index === 1 ? 'tbody' : '');
    
    if (wrapper === 'thead') html += '<thead>';
    if (wrapper === 'tbody') html += '<tbody>';
    
    html += '<tr>';
    cells.forEach(function(cell) {
      html += '<' + tag + '>' + cell.trim() + '</' + tag + '>';
    });
    html += '</tr>';
    
    if (wrapper === 'thead') html += '</thead>';
  });
  
  html += '</tbody></table>';
  return html;
}

function showOutput(run) {
  // For new studio layout, render in the output panel
  var outputContent = document.getElementById('studioOutputContent');
  var outputActions = document.getElementById('studioOutputActions');
  var outputHeader = document.getElementById('studioOutputHeader');
  
  if (outputContent) {
    // v22.33: Smart header — use contextual title if available
    if (outputHeader) {
      var agentInfo = run.agentIcon ? run.agentIcon + ' ' : '';
      var headerTitle = run.contextTitle || run.op;
      outputHeader.innerHTML = '<div class="studio-selected-op-info"><div class="studio-selected-op-name">' + agentInfo + escapeHtml(headerTitle) + '</div><div class="studio-selected-op-brand">' + escapeHtml(run.brand) + '</div></div>';
    }

    // Calculate stats
    var wordCount = run.deliv.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    var readingTime = Math.ceil(wordCount / 200);

    // v22.33: Clean meta — just word count and read time
    var metaHtml = '<div class="studio-output-meta">';
    metaHtml += '<span>' + wordCount.toLocaleString() + ' words</span>';
    metaHtml += ' · <span>~' + readingTime + ' min read</span>';
    metaHtml += '</div>';
    
    // v23.16: Use edited HTML if available (preserves rich text edits)
    var contentHtml = run._editedHtml || markdownToHtml(run.deliv);

    outputContent.innerHTML = metaHtml + '<div class="studio-output-canvas">' + contentHtml + '</div>';
    
    // Show actions
    if (outputActions) {
      outputActions.style.display = 'flex';
    }
  }
  
  // Also update hidden elements for compatibility
  document.getElementById('plan').textContent = run.plan;
  document.getElementById('deliv').value = run.deliv;
  document.getElementById('delivCanvas').innerHTML = markdownToHtml(run.deliv);
  
  window.currentRun = run;
}

function scrollToHeading(id) {
  var element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function toggleReadingMode() {
  var panel = document.getElementById('output');
  if (panel.classList.contains('output-reading-mode')) {
    panel.classList.remove('output-reading-mode');
    document.body.style.overflow = '';
    showToast('Exited reading mode', 'info');
  } else {
    panel.classList.remove('output-fullscreen');
    panel.classList.add('output-reading-mode');
    document.body.style.overflow = 'hidden';
    showToast('Reading mode - clean distraction-free view', 'info');
  }
}

// v23.16: Inline rich text editing for Studio output
// v23.16: Enter edit mode on the output canvas (called by click or Edit button)
function enterOutputEditMode() {
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent) return;
  var canvasEl = outputContent.querySelector('.studio-output-canvas') || outputContent.querySelector('.output-canvas');
  if (!canvasEl) {
    if (!outputContent.textContent.trim()) return;
    // Wrap existing content, excluding UI elements
    var wrapper = document.createElement('div');
    wrapper.className = 'studio-output-canvas';
    var children = outputContent.childNodes;
    for (var ci = 0; ci < children.length; ci++) {
      var child = children[ci];
      if (child.nodeType === 1) {
        var cls = child.className || '';
        if (cls.indexOf('studio-smart-suggestions') !== -1 || cls.indexOf('studio-edit-toolbar') !== -1 ||
            cls.indexOf('studio-output-meta') !== -1 || cls.indexOf('studio-save-edits-bar') !== -1 || child.tagName === 'SELECT') continue;
      }
      wrapper.appendChild(child.cloneNode(true));
    }
    var preserved = outputContent.querySelectorAll('.studio-smart-suggestions, .studio-output-meta');
    var preservedArr = [];
    for (var pi = 0; pi < preserved.length; pi++) preservedArr.push(preserved[pi].cloneNode(true));
    outputContent.innerHTML = '';
    outputContent.appendChild(wrapper);
    for (var pi2 = 0; pi2 < preservedArr.length; pi2++) outputContent.appendChild(preservedArr[pi2]);
    canvasEl = wrapper;
  }

  // Already editing?
  if (canvasEl.getAttribute('contenteditable') === 'true') return;

  canvasEl.setAttribute('contenteditable', 'true');

  // Show floating save bar at bottom
  var existingBar = outputContent.querySelector('.studio-save-edits-bar');
  if (!existingBar) {
    var bar = document.createElement('div');
    bar.className = 'studio-save-edits-bar';
    bar.innerHTML = '<span style="font-size:11px;color:var(--text-muted);margin-right:auto;">Editing output</span>' +
      '<button class="cancel-edits-btn" onclick="cancelOutputEdits()">Cancel</button>' +
      '<button class="save-edits-btn" onclick="saveOutputEdits()">Save Edits</button>';
    outputContent.appendChild(bar);
  }

  // Update the Edit button text
  var editBtn = document.querySelector('.studio-v2-action-btn[onclick="toggleOutputEdit()"]');
  if (editBtn) editBtn.textContent = 'Editing...';
}

// v23.16: Toggle for the Edit button (backwards compat)
function toggleOutputEdit() {
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent) return;
  var canvasEl = outputContent.querySelector('.studio-output-canvas') || outputContent.querySelector('.output-canvas');
  if (canvasEl && canvasEl.getAttribute('contenteditable') === 'true') {
    saveOutputEdits();
    return;
  }
  enterOutputEditMode();
}

// v23.16: Execute formatting command on Studio output canvas
function studioExecCmd(cmd, val) {
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent) return;
  var canvas = outputContent.querySelector('.studio-output-canvas') || outputContent.querySelector('.output-canvas');
  if (!canvas) return;
  canvas.focus();
  if (cmd === 'formatBlock' && val) {
    document.execCommand('formatBlock', false, '<' + val + '>');
  } else {
    document.execCommand(cmd, false, val || null);
  }
}

// v23.16: Insert link in Studio edit mode
function studioInsertLink() {
  var url = prompt('Enter URL:');
  if (url) {
    document.execCommand('createLink', false, url);
  }
}

// v23.16: Clear formatting in Studio edit mode
function studioClearFormat() {
  document.execCommand('removeFormat', false, null);
}

// v23.16: Save edits — capture HTML, update currentRun, exit edit mode
function saveOutputEdits() {
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent) return;
  var canvasEl = outputContent.querySelector('.studio-output-canvas') || outputContent.querySelector('.output-canvas');
  if (!canvasEl) return;

  // Exit contenteditable
  canvasEl.removeAttribute('contenteditable');

  // Remove toolbar and save bar
  var toolbar = document.getElementById('studioEditToolbar');
  if (toolbar) toolbar.remove();
  var saveBar = outputContent.querySelector('.studio-save-edits-bar');
  if (saveBar) saveBar.remove();

  // Capture the edited HTML content — strip any UI elements that crept in
  var _tempCanvas = canvasEl.cloneNode(true);
  var _uiEls = _tempCanvas.querySelectorAll('.studio-smart-suggestions, .studio-edit-toolbar, .studio-output-meta, .studio-save-edits-bar, select');
  for (var _ui = 0; _ui < _uiEls.length; _ui++) _uiEls[_ui].remove();
  var editedHtml = _tempCanvas.innerHTML;

  // Update currentRun with HTML content (preserve for PDF export)
  if (window.currentRun) {
    window.currentRun._editedHtml = editedHtml;
    // Also update deliv with a cleaned text version for copy/markdown
    window.currentRun.deliv = htmlToMarkdownBasic(editedHtml);
  }

  // Update hidden elements
  var delivEl = document.getElementById('deliv');
  if (delivEl && window.currentRun) delivEl.value = window.currentRun.deliv;
  var delivCanvas = document.getElementById('delivCanvas');
  if (delivCanvas) delivCanvas.innerHTML = editedHtml;

  // Save to runs array
  if (typeof saveRuns === 'function') saveRuns();

  // Reset Edit button text
  var editBtn = document.querySelector('.studio-v2-action-btn[onclick="toggleOutputEdit()"]');
  if (editBtn) editBtn.textContent = 'Edit';

  showToast('Edits saved', 'success');
}

// v23.16: Cancel edits — revert contenteditable without saving
function cancelOutputEdits() {
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent) return;
  var canvasEl = outputContent.querySelector('.studio-output-canvas') || outputContent.querySelector('.output-canvas');
  if (canvasEl) canvasEl.removeAttribute('contenteditable');
  var toolbar = document.getElementById('studioEditToolbar');
  if (toolbar) toolbar.remove();
  var saveBar = outputContent.querySelector('.studio-save-edits-bar');
  if (saveBar) saveBar.remove();
  var editBtn = document.querySelector('.studio-v2-action-btn[onclick="toggleOutputEdit()"]');
  if (editBtn) editBtn.textContent = 'Edit';
}

// v23.16: Basic HTML to markdown converter for preserving edits in deliv
function htmlToMarkdownBasic(html) {
  if (!html) return '';
  var temp = document.createElement('div');
  temp.innerHTML = html;
  // Convert headings
  var headings = temp.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (var i = 0; i < headings.length; i++) {
    var h = headings[i];
    var level = parseInt(h.tagName.charAt(1));
    var prefix = '';
    for (var j = 0; j < level; j++) prefix += '#';
    h.outerHTML = '\n' + prefix + ' ' + h.textContent + '\n';
  }
  // Convert bold
  var bolds = temp.querySelectorAll('strong, b');
  for (var i = bolds.length - 1; i >= 0; i--) {
    bolds[i].outerHTML = '**' + bolds[i].innerHTML + '**';
  }
  // Convert italic
  var italics = temp.querySelectorAll('em, i');
  for (var i = italics.length - 1; i >= 0; i--) {
    italics[i].outerHTML = '*' + italics[i].innerHTML + '*';
  }
  // Convert links
  var links = temp.querySelectorAll('a');
  for (var i = links.length - 1; i >= 0; i--) {
    links[i].outerHTML = '[' + links[i].textContent + '](' + (links[i].href || '') + ')';
  }
  // Convert list items
  var lis = temp.querySelectorAll('li');
  for (var i = 0; i < lis.length; i++) {
    var parent = lis[i].parentElement;
    var prefix = (parent && parent.tagName === 'OL') ? ((i + 1) + '. ') : '- ';
    lis[i].outerHTML = prefix + lis[i].innerHTML + '\n';
  }
  // Convert blockquotes
  var bqs = temp.querySelectorAll('blockquote');
  for (var i = bqs.length - 1; i >= 0; i--) {
    bqs[i].outerHTML = '\n> ' + bqs[i].textContent.trim().replace(/\n/g, '\n> ') + '\n';
  }
  // Convert hr
  var hrs = temp.querySelectorAll('hr');
  for (var i = hrs.length - 1; i >= 0; i--) {
    hrs[i].outerHTML = '\n---\n';
  }
  // Convert br
  temp.innerHTML = temp.innerHTML.replace(/<br\s*\/?>/gi, '\n');
  // Strip remaining tags
  var text = temp.textContent || temp.innerText || '';
  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function copyOutput() {
  // v22.33: Fall back to currentRun.deliv if textarea empty
  var text = document.getElementById('deliv').value;
  if (!text && window.currentRun && window.currentRun.deliv) text = window.currentRun.deliv;
  if (!text) { showToast('Nothing to copy', 'warning'); return; }
  navigator.clipboard.writeText(text).then(function() {
    showToast('Copied to clipboard!', 'success');
  }).catch(function() {
    // Fallback
    var textarea = document.getElementById('deliv');
    textarea.value = text;
    textarea.classList.remove('hidden');
    textarea.select();
    document.execCommand('copy');
    textarea.classList.add('hidden');
    showToast('Copied to clipboard!', 'success');
  });
}

function copyOutputRich() {
  // Copy with HTML formatting for pasting into docs/email
  var canvas = document.getElementById('delivCanvas');
  var html = canvas.innerHTML;
  var text = document.getElementById('deliv').value;
  // v22.33: Fall back to currentRun if elements empty
  if (!text && window.currentRun && window.currentRun.deliv) text = window.currentRun.deliv;
  if (!html && text) html = markdownToHtml(text);
  
  // Try to copy as rich text
  try {
    var blob = new Blob([html], { type: 'text/html' });
    var textBlob = new Blob([text], { type: 'text/plain' });
    
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob
      })
    ]).then(function() {
      showToast('Copied with formatting!', 'success');
    }).catch(function() {
      // Fallback to plain text
      navigator.clipboard.writeText(text);
      showToast('Copied as plain text', 'info');
    });
  } catch (e) {
    // Fallback for browsers without ClipboardItem
    navigator.clipboard.writeText(text).then(function() {
      showToast('Copied as plain text', 'info');
    });
  }
}

function shareOutput() {
  if (!window.currentRun) {
    showToast('No output to share', 'warning');
    return;
  }
  
  var run = window.currentRun;
  var text = run.deliv;
  var title = run.op + ' - ' + run.brand;
  
  // Check for native share API (mobile)
  if (navigator.share) {
    navigator.share({
      title: title,
      text: text
    }).catch(function(err) {
      if (err.name !== 'AbortError') {
        showShareModal(run);
      }
    });
  } else {
    showShareModal(run);
  }
}

/**
 * v10.5.31: Chat with Studio output - opens BrandAI/LifeAI with output as context
 */
function chatWithStudioOutput() {
  // Get output from currentRun or lastStudioOutput or DOM
  var outputText = '';
  var opName = '';
  var brandLabel = '';

  if (window.currentRun && window.currentRun.deliv) {
    outputText = window.currentRun.deliv;
    opName = window.currentRun.op || 'Studio Output';
    brandLabel = window.currentRun.brand || '';
  } else if (window.lastStudioOutput) {
    outputText = window.lastStudioOutput;
    opName = selectedOp ? selectedOp.name : 'Studio Output';
  } else {
    // Try to get from DOM
    var outputContent = document.getElementById('studioOutputContent');
    if (outputContent) {
      outputText = outputContent.innerText || outputContent.textContent || '';
    }
    opName = selectedOp ? selectedOp.name : 'Studio Output';
  }

  if (!outputText || outputText.trim().length === 0) {
    showToast('No output to chat about', 'warning');
    return;
  }

  // Navigate to chat
  showView('agent');

  // Clear current conversation and start fresh
  currentConversation = [];
  continuingFromHistoryIndex = null;

  // v23.14: Auto-load full Studio context and send automatically
  var contextMessage = 'Here is the full output from the Studio operation "' + opName + '"' + (brandLabel ? ' for ' + brandLabel : '') + ':\n\n' + outputText.substring(0, 15000);
  if (outputText.length > 15000) {
    contextMessage += '\n\n[Output truncated - ' + outputText.length + ' chars total]';
  }
  contextMessage += '\n\nI have loaded this entire Studio session into our conversation. What would you like to discuss, refine, or do with this output?';

  setTimeout(function() {
    var agentInput = document.getElementById('agentCommand');
    if (agentInput) {
      agentInput.value = contextMessage;
      autoResizeTextarea(agentInput);
      // Auto-send to start the conversation immediately
      if (typeof runAgent === 'function') {
        runAgent();
      }
    }
    showToast('Studio session loaded into BrandAI chat', 'success');
  }, 200);
}

/**
 * v10.5.31: Upload content to Studio's Content & Context field
 */
function uploadToStudioContext(content, sourceName) {
  if (!content) {
    showToast('No content to upload', 'warning');
    return;
  }
  
  // Navigate to Studio
  showView('studio');
  
  setTimeout(function() {
    var contextEl = document.getElementById('studioContext');
    if (contextEl) {
      // Append to existing content or set new
      var existingContent = contextEl.value.trim();
      if (existingContent) {
        contextEl.value = existingContent + '\n\n---\n[From ' + (sourceName || 'History') + ']\n' + content;
      } else {
        contextEl.value = '[From ' + (sourceName || 'History') + ']\n' + content;
      }
      
      // Trigger resize if needed
      if (typeof autoResizeTextarea === 'function') {
        autoResizeTextarea(contextEl);
      }
      
      showToast('Content added to Studio context', 'success');
    }
  }, 100);
}

function showShareModal(run) {
  var modalHtml = '<div class="modal-overlay" id="shareModal" onclick="closeShareModal(event)">';
  modalHtml += '<div class="modal" onclick="event.stopPropagation()">';
  modalHtml += '<div class="modal-title">Share Output</div>';
  modalHtml += '<div class="modal-body">Choose how to share this output:</div>';
  modalHtml += '<div class="share-options">';
  modalHtml += '<div class="share-option" onclick="shareViaEmail()"><span class="share-option-icon">◇</span> Email</div>';
  modalHtml += '<div class="share-option" onclick="copyOutputRich(); closeShareModal();"><span class="share-option-icon">◇</span> Copy Rich Text</div>';
  modalHtml += '<div class="share-option" onclick="copyOutput(); closeShareModal();"><span class="share-option-icon">◇</span> Copy Plain Text</div>';
  modalHtml += '<div class="share-option" onclick="exportOutput(); closeShareModal();"><span class="share-option-icon">◇</span> Download File</div>';
  modalHtml += '</div>';
  modalHtml += '<div style="margin-top: var(--space-5); text-align: right;">';
  modalHtml += '<button class="btn btn-secondary" onclick="closeShareModal()">Close</button>';
  modalHtml += '</div></div></div>';
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  setTimeout(function() {
    document.getElementById('shareModal').classList.add('show');
  }, 10);
}

function closeShareModal(event) {
  if (event && event.target.id !== 'shareModal') return;
  var modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(function() { modal.remove(); }, 200);
  }
}

function shareViaEmail() {
  if (!window.currentRun) return;
  var run = window.currentRun;
  var subject = encodeURIComponent(run.op + ' - ' + run.brand);
  var body = encodeURIComponent(run.deliv);
  window.open('mailto:?subject=' + subject + '&body=' + body);
  closeShareModal();
}

function exportOutputPDF() {
  if (!window.currentRun) {
    showToast('No output to export', 'warning');
    return;
  }
  
  var run = window.currentRun;
  
  // For desktop app, use the file save dialog
  if (isDesktopApp && window.roweosAPI) {
    // Create formatted text for PDF (will be plain text for now)
    var content = '═══════════════════════════════════════════════════════════════\n';
    content += run.op.toUpperCase() + '\n';
    content += run.brand + ' | ' + run.time + '\n';
    content += '═══════════════════════════════════════════════════════════════\n\n';
    content += run.deliv;
    
    window.roweosAPI.saveFile({
      content: content,
      defaultName: run.op.replace(/\s+/g, '_') + '_' + run.brand.replace(/\s+/g, '_') + '.txt',
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }).then(function(result) {
      if (result.success) {
        showToast('Exported to ' + result.filePath, 'success');
      } else if (!result.canceled) {
        showToast('Export failed: ' + result.error, 'error');
      }
    });
  } else {
    // Browser fallback - download as text file
    var content = run.op + '\n' + run.brand + ' | ' + run.time + '\n\n' + run.deliv;
    var blob = new Blob([content], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = run.op.replace(/\s+/g, '_') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('File downloaded', 'success');
  }
}

function copyOutputMarkdown() {
  var text = document.getElementById('deliv').value;
  if (!text && window.currentRun && window.currentRun.deliv) text = window.currentRun.deliv;
  if (!text) { showToast('Nothing to copy', 'warning'); return; }
  navigator.clipboard.writeText(text).then(function() {
    showToast('Markdown copied!', 'success');
  }).catch(function() {
    showToast('Copy failed', 'error');
  });
}

function toggleExportDropdown() {
  var dropdown = document.getElementById('exportDropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
    // Close dropdown when clicking outside
    if (!dropdown.classList.contains('hidden')) {
      setTimeout(function() {
        document.addEventListener('click', closeExportDropdown);
      }, 0);
    }
  }
}

function closeExportDropdown(e) {
  var container = document.querySelector('.export-dropdown-container');
  if (container && !container.contains(e.target)) {
    var dropdown = document.getElementById('exportDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    document.removeEventListener('click', closeExportDropdown);
  }
}


// v23.4: Export to PDF — uses universal flow with preview + settings
function exportAsPDF(run) {
  exportStudioAsPDF(run);
}

function exportAs(format) {
  var dropdown = document.getElementById('exportDropdown');
  if (dropdown) dropdown.classList.add('hidden');
  
  if (!window.currentRun) {
    showToast('No output to export', 'warning');
    return;
  }
  
  var run = window.currentRun;
  var content = '';
  var filename = run.op.replace(/\s+/g, '_') + '_' + run.brand.replace(/\s+/g, '_');
  var mimeType = 'text/plain';
  
  if (format === 'md') {
    content = '# ' + run.op + '\n';
    content += '**Brand:** ' + run.brand + '  \n';
    content += '**Generated:** ' + run.time + '  \n';
    if (run.aiGenerated) content += '**AI Generated:** Yes  \n';
    content += '\n---\n\n';
    content += run.deliv;
    filename += '.md';
    mimeType = 'text/markdown';
  } else if (format === 'html') {
    content = '<!DOCTYPE html>\n<html>\n<head>\n';
    content += '<meta charset="UTF-8">\n';
    content += '<title>' + run.op + ' - ' + run.brand + '</title>\n';
    content += '<style>\n';
    content += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: var(--space-5); line-height: 1.6; color: #333; }\n';
    content += 'h1 { color: #8b7355; border-bottom: 2px solid #b8986a; padding-bottom: 10px; }\n';
    content += '</style>\n</head>\n<body>\n';
    content += '<h1>' + run.op + '</h1>\n';
    content += '<div class="meta">Brand: ' + run.brand + ' | Generated: ' + run.time + '</div>\n';
    content += '<div>' + (run._editedHtml || marked.parse(run.deliv)) + '</div>\n';
    content += '</body>\n</html>';
    filename += '.html';
    mimeType = 'text/html';
  } else if (format === 'txt') {
    content = run.op + '\n';
    content += 'Brand: ' + run.brand + '\n';
    content += 'Generated: ' + run.time + '\n';
    content += '---\n\n';
    content += run.deliv.replace(/[#*_`]/g, '');
    filename += '.txt';
    mimeType = 'text/plain';
  } else if (format === 'pdf') {
    // v9.1.14: PDF export using browser print
    exportAsPDF(run);
    return;
  } else if (format === 'docx') {
    // v24.8: Proper DOCX export using docx library
    if (typeof docx !== 'undefined' && docx.Document) {
      try {
        var mdText = run.deliv || '';
        var dLines = mdText.split('\n');
        var dChildren = [];
        // Title
        dChildren.push(new docx.Paragraph({ text: run.op, heading: docx.HeadingLevel.HEADING_1 }));
        dChildren.push(new docx.Paragraph({ children: [
          new docx.TextRun({ text: 'Brand: ' + run.brand + '  |  Generated: ' + run.time, color: '666666', size: 20 })
        ] }));
        dChildren.push(new docx.Paragraph({ text: '' }));
        for (var di = 0; di < dLines.length; di++) {
          var dLine = dLines[di];
          if (dLine.match(/^#{1,3}\s/)) {
            var dLvl = dLine.match(/^(#{1,3})/)[1].length;
            dChildren.push(new docx.Paragraph({ text: dLine.replace(/^#{1,3}\s*/, ''), heading: dLvl === 1 ? docx.HeadingLevel.HEADING_1 : dLvl === 2 ? docx.HeadingLevel.HEADING_2 : docx.HeadingLevel.HEADING_3 }));
          } else if (dLine.match(/^[-*]\s/)) {
            dChildren.push(new docx.Paragraph({ children: [new docx.TextRun(dLine.replace(/^[-*]\s*/, ''))], bullet: { level: 0 } }));
          } else if (dLine.match(/^\d+\.\s/)) {
            dChildren.push(new docx.Paragraph({ children: [new docx.TextRun(dLine.replace(/^\d+\.\s*/, ''))] }));
          } else if (dLine.trim() === '') {
            dChildren.push(new docx.Paragraph({ text: '' }));
          } else {
            var dRuns = [];
            var dParts = dLine.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
            for (var dp = 0; dp < dParts.length; dp++) {
              if (dParts[dp].match(/^\*\*.*\*\*$/)) {
                dRuns.push(new docx.TextRun({ text: dParts[dp].replace(/\*\*/g, ''), bold: true }));
              } else if (dParts[dp].match(/^\*.*\*$/)) {
                dRuns.push(new docx.TextRun({ text: dParts[dp].replace(/\*/g, ''), italics: true }));
              } else if (dParts[dp]) {
                dRuns.push(new docx.TextRun(dParts[dp]));
              }
            }
            dChildren.push(new docx.Paragraph({ children: dRuns }));
          }
        }
        var dDoc = new docx.Document({ sections: [{ properties: {}, children: dChildren }] });
        docx.Packer.toBlob(dDoc).then(function(blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename + '.docx';
          a.click();
          URL.revokeObjectURL(a.href);
          showToast('Word document exported', 'success');
        });
        return;
      } catch(e) { console.error('[Export] docx error:', e); showToast('DOCX export failed: ' + e.message, 'error'); return; }
    }
    showToast('DOCX library not loaded', 'warning');
    return;
  }
  
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported as ' + format.toUpperCase(), 'success');
}

function exportOutput() {
  if (!window.currentRun) {
    showToast('No output to export', 'warning');
    return;
  }
  
  var run = window.currentRun;
  var format = document.getElementById('exportFormat').value;
  var content = '';
  var filename = run.op.replace(/\s+/g, '_') + '_' + run.brand.replace(/\s+/g, '_');
  var mimeType = 'text/plain';
  
  if (format === 'md') {
    // Markdown export
    content = '# ' + run.op + '\n';
    content += '**Brand:** ' + run.brand + '  \n';
    content += '**Generated:** ' + run.time + '  \n';
    if (run.aiGenerated) content += '**AI Generated:** Yes  \n';
    content += '\n---\n\n';
    content += run.deliv;
    filename += '.md';
    mimeType = 'text/markdown';
  } else if (format === 'html') {
    // HTML export with styling
    content = '<!DOCTYPE html>\n<html>\n<head>\n';
    content += '<meta charset="UTF-8">\n';
    content += '<title>' + run.op + ' - ' + run.brand + '</title>\n';
    content += '<style>\n';
    content += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: var(--space-5); line-height: 1.6; color: #333; }\n';
    content += 'h1 { color: #8b7355; border-bottom: 2px solid #b8986a; padding-bottom: 10px; }\n';
    content += 'h2, h3 { color: #8b7355; margin-top: var(--space-6); }\n';
    content += '.meta { color: #666; font-size: var(--text-base); margin-bottom: var(--space-6); }\n';
    content += 'ul, ol { margin-left: 20px; }\n';
    content += 'blockquote { border-left: 4px solid #b8986a; margin: 16px 0; padding-left: var(--space-4); color: #666; font-style: italic; }\n';
    content += 'code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }\n';
    content += 'pre { background: #f4f4f4; padding: var(--space-4); border-radius: var(--radius-sm); overflow-x: auto; }\n';
    content += 'table { border-collapse: collapse; width: 100%; margin: 16px 0; }\n';
    content += 'th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }\n';
    content += 'th { background: #f4f4f4; color: #8b7355; }\n';
    content += '@media print { body { max-width: none; margin: 0; } }\n';
    content += '</style>\n</head>\n<body>\n';
    content += '<h1>' + run.op + '</h1>\n';
    content += '<div class="meta"><strong>Brand:</strong> ' + run.brand + ' | <strong>Generated:</strong> ' + run.time;
    if (run.aiGenerated) content += ' | <strong>AI Generated</strong>';
    content += '</div>\n';
    content += markdownToHtml(run.deliv);
    content += '\n</body>\n</html>';
    filename += '.html';
    mimeType = 'text/html';
  } else if (format === 'docx') {
    // Word-compatible HTML document
    content = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">\n';
    content += '<head><meta charset="UTF-8">\n';
    content += '<style>\n';
    content += '@page { size: letter; margin: 1in; }\n';
    content += 'body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }\n';
    content += 'h1 { font-size: 18pt; color: #8b7355; border-bottom: 2pt solid #b8986a; padding-bottom: 6pt; margin-top: 12pt; }\n';
    content += 'h2 { font-size: 14pt; color: #8b7355; margin-top: 12pt; }\n';
    content += 'h3 { font-size: 12pt; color: #8b7355; margin-top: 10pt; }\n';
    content += 'p { margin-bottom: 8pt; }\n';
    content += 'ul, ol { margin-left: 24pt; margin-bottom: 8pt; }\n';
    content += 'li { margin-bottom: 4pt; }\n';
    content += 'blockquote { border-left: 3pt solid #b8986a; padding-left: 12pt; color: #666; font-style: italic; margin: 12pt 0; }\n';
    content += 'table { border-collapse: collapse; width: 100%; margin: 12pt 0; }\n';
    content += 'th, td { border: 1pt solid #ccc; padding: 6pt 10pt; }\n';
    content += 'th { background-color: #f4f4f4; color: #8b7355; font-weight: bold; }\n';
    content += '.meta { color: #666; font-size: 10pt; margin-bottom: 18pt; }\n';
    content += '</style>\n</head>\n<body>\n';
    content += '<h1>' + run.op + '</h1>\n';
    content += '<p class="meta"><b>Brand:</b> ' + run.brand + ' &nbsp;|&nbsp; <b>Generated:</b> ' + run.time;
    if (run.aiGenerated) content += ' &nbsp;|&nbsp; <b>AI Generated</b>';
    content += '</p>\n';
    content += markdownToHtml(run.deliv);
    content += '\n</body>\n</html>';
    filename += '.doc';
    mimeType = 'application/msword';
  } else {
    // Plain text export
    content = '═══════════════════════════════════════════════════════════════\n';
    content += run.op.toUpperCase() + '\n';
    content += run.brand + ' | ' + run.time + '\n';
    content += '═══════════════════════════════════════════════════════════════\n\n';
    content += run.deliv;
    filename += '.txt';
  }
  
  // For desktop app, use the file save dialog
  if (isDesktopApp && window.roweosAPI) {
    window.roweosAPI.saveFile({
      content: content,
      defaultName: filename,
      filters: [
        { name: format.toUpperCase() + ' Files', extensions: [format === 'docx' ? 'doc' : format] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }).then(function(result) {
      if (result.success) {
        showToast('Exported to ' + result.filePath, 'success');
      } else if (!result.canceled) {
        showToast('Export failed: ' + result.error, 'error');
      }
    });
  } else {
    // Browser fallback - download
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File downloaded', 'success');
  }
}

function toggleFullscreen() {
  var panel = document.getElementById('output');
  if (panel.classList.contains('output-fullscreen')) {
    panel.classList.remove('output-fullscreen');
    document.body.style.overflow = '';
    showToast('Exited fullscreen', 'info');
  } else {
    panel.classList.add('output-fullscreen');
    document.body.style.overflow = 'hidden';
    showToast('Fullscreen mode', 'info');
  }
}

function clearOutput() {
  // Hide the output panel
  document.getElementById('output').classList.add('hidden');
  
  // Clear content
  document.getElementById('delivCanvas').innerHTML = '';
  document.getElementById('deliv').value = '';
  document.getElementById('plan').textContent = '';
  document.getElementById('outputMeta').innerHTML = '';
  
  // Clear context/input textarea
  var context = document.getElementById('studioContext');
  if (context) context.value = '';
  
  var toc = document.getElementById('outputTOC');
  if (toc) toc.classList.add('hidden');
  
  // Clear current run
  window.currentRun = null;
  
  // Exit any special modes
  var panel = document.getElementById('output');
  panel.classList.remove('output-fullscreen', 'output-reading-mode');
  document.body.style.overflow = '';
  
  showToast('Output cleared', 'info');
}

function clearRecentOps() {
  // Clear recent ops for current brand
  recentOps[studioSelectedBrand] = [];
  
  // Save to localStorage
  try {
    localStorage.setItem('roweosRecentOps', JSON.stringify(recentOps));
  } catch (e) {}
  
  // Re-render the ops
  renderOperations();
  
  showToast('Recent operations cleared', 'info');
}

function printOutput() {
  if (!window.currentRun) {
    showToast('No output to print', 'warning');
    return;
  }
  
  var run = window.currentRun;
  var content = markdownToHtml(run.deliv);
  
  var printWindow = window.open('', '_blank');
  
  // Check if popup was blocked
  if (!printWindow || !printWindow.document) {
    showToast('Popup blocked - please allow popups for printing', 'error');
    return;
  }
  
  printWindow.document.write('<!DOCTYPE html><html><head>');
  printWindow.document.write('<title>' + run.op + ' - ' + run.brand + '</title>');
  printWindow.document.write('<style>');
  printWindow.document.write('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 700px; margin: 40px auto; padding: var(--space-5); line-height: 1.6; color: #333; }');
  printWindow.document.write('h1 { color: #8b7355; border-bottom: 2px solid #b8986a; padding-bottom: 10px; font-size: var(--text-3xl); }');
  printWindow.document.write('h2 { color: #8b7355; margin-top: var(--space-6); font-size: var(--text-xl); }');
  printWindow.document.write('h3 { color: #8b7355; margin-top: var(--space-5); font-size: var(--text-lg); }');
  printWindow.document.write('.meta { color: #666; font-size: var(--text-sm); margin-bottom: var(--space-5); border-bottom: 1px solid #ddd; padding-bottom: 10px; }');
  printWindow.document.write('ul, ol { margin-left: 20px; }');
  printWindow.document.write('li { margin-bottom: var(--space-1); }');
  printWindow.document.write('blockquote { border-left: 3px solid #b8986a; margin: 12px 0; padding-left: var(--space-3); color: #666; font-style: italic; }');
  printWindow.document.write('table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: var(--text-sm); }');
  printWindow.document.write('th, td { border: 1px solid #ccc; padding: var(--space-2); text-align: left; }');
  printWindow.document.write('th { background: #f0f0f0; color: #8b7355; }');
  printWindow.document.write('@media print { body { margin: 0; max-width: none; } }');
  printWindow.document.write('</style></head><body>');
  printWindow.document.write('<h1>' + run.op + '</h1>');
  printWindow.document.write('<div class="meta"><strong>Brand:</strong> ' + run.brand + ' &nbsp;|&nbsp; <strong>Generated:</strong> ' + run.time);
  if (run.aiGenerated) printWindow.document.write(' &nbsp;|&nbsp; <em>AI Generated</em>');
  printWindow.document.write('</div>');
  printWindow.document.write(content);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  
  setTimeout(function() {
    printWindow.print();
  }, 250);
}

function regenerateOutput() {
  if (!window.currentRun) {
    showToast('No output to regenerate', 'warning');
    return;
  }
  
  // Find the operation
  var run = window.currentRun;
  var op = ops.find(function(o) { return o.name === run.op; });
  
  if (!op) {
    showToast('Operation not found', 'error');
    return;
  }
  
  // Set up state for regeneration
  selectedOp = op;
  selectedOpId = op.id;
  
  // Find brand index
  var brandIdx = brands.findIndex(function(b) { return b.name === run.brand; });
  if (brandIdx !== -1) {
    document.getElementById('brand').value = brandIdx;
    studioSelectedBrand = brandIdx;
  }
  
  // Set context from original run
  if (run.context) {
    var _ctx = document.getElementById('studioContext'); if (_ctx) _ctx.value = run.context;
  }
  
  // Run the operation with API
  showToast('Regenerating with AI...', 'info');
  runOp();
}

// Delete brand function
function confirmDeleteBrand(brandIdx) {
  var brand = brands[brandIdx];
  if (!brand) return;
  
  var confirmed = confirm('Are you sure you want to delete "' + brand.name + '"? This action cannot be undone.');
  
  if (confirmed) {
    deleteBrand(brandIdx);
  }
}

function deleteBrand(brandIdx) {
  var brand = brands[brandIdx];
  if (!brand) return;

  // v28.2: Confirm BEFORE any Firestore writes
  if (!confirm('Delete "' + brand.name + '"? You can restore it from Settings > Deleted Brands for 30 days.')) {
    return;
  }

  // Move to trash (soft delete)
  window.deletedBrands.unshift({
    brand: JSON.parse(JSON.stringify(brand)), // Deep copy
    deletedAt: Date.now(),
    deletedBy: 'user'
  });

  // Remove brand from active array
  brands.splice(brandIdx, 1);

  // v29.0: Remove both ID-based and index-based logo keys
  try {
    if (brand && brand.id) {
      localStorage.removeItem(getBrandLogoKeyById(brand.id));
      localStorage.removeItem(getBrandLogoKeyById(brand.id) + '_size');
    }
    localStorage.removeItem('roweos_brand_' + brandIdx + '_logo');
    localStorage.removeItem('roweos_brand_' + brandIdx + '_logo_size');
  } catch(e) {}

  // v28.3: Delete the Firestore doc IMMEDIATELY (before saveBrands triggers onSnapshot)
  try {
    var _delDb = typeof getDB === 'function' ? getDB() : null;
    var _delUser = typeof firebaseUser !== 'undefined' ? firebaseUser : null;
    if (_delDb && _delUser && brand.id) {
      var _delBasePath = 'roweos_users/' + _delUser.uid;
      // Delete the individual brand doc right now
      _delDb.doc(_delBasePath + '/brands/' + brand.id).delete().then(function() {
        console.log('[deleteBrand] v28.3 Firestore doc deleted:', brand.id);
      }).catch(function(err) {
        console.warn('[deleteBrand] Failed to delete Firestore doc:', err.message);
      });
      // Also update _all doc immediately (remove deleted brand)
      var _remainingForAll = brands.map(function(b) {
        var d = JSON.parse(JSON.stringify(b));
        Object.keys(d).forEach(function(k) {
          if (typeof d[k] === 'string' && d[k].indexOf('data:') === 0 && d[k].length > 50000) d[k] = '';
        });
        return d;
      });
      _delDb.doc(_delBasePath + '/brands/_all').set({
        items: _remainingForAll, count: _remainingForAll.length, updatedAt: new Date().toISOString()
      }).catch(function() {});
    }
  } catch(e) { console.warn('[deleteBrand] Immediate Firestore delete error:', e); }

  // Save remaining brands to localStorage + Firestore (saveBrands also cleans up ghosts)
  try {
    saveBrands();
    saveDeletedBrands();
    showToast('Brand deleted', 'info');
  } catch (e) {
    console.error('Delete error:', e);
    showToast('Error deleting brand', 'error');
    return;
  }

  // Update all brand selectors
  updateBrandSelectors();

  // v28.2: Switch to first remaining brand and fully re-render
  if (brands.length > 0) {
    var _newBrand = brands[0];
    if (_newBrand && _newBrand.id) {
      setSelectedBrand(_newBrand.id);
    }
    var brandSelect = document.getElementById('brand');
    if (brandSelect) brandSelect.value = '0';
    selectedBrand = 0;
    onBrandChange();
    // Re-render the current view (Identity page if we're on it)
    if (typeof showSettings === 'function') showSettings();
  } else {
    // No brands left - show message
    var s = document.getElementById('settings');
    if (s) {
      s.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">No brands configured. Create your first brand from the launch screen.</div>';
    }
  }
}

// ========== BRAND RESTORE SYSTEM ==========

function openBrandTrash() {
  renderDeletedBrandsList();
  document.getElementById('brandTrashModal').classList.add('show');
}

function closeBrandTrash() {
  document.getElementById('brandTrashModal').classList.remove('show');
}

function renderDeletedBrandsList() {
  var container = document.getElementById('deletedBrandsList');
  
  if (window.deletedBrands.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">' +
      '<div style="font-size: var(--text-5xl); margin-bottom: var(--space-4);">✨</div>' +
      '<div style="font-size: var(--text-lg);">No deleted brands</div>' +
      '<div style="font-size: var(--text-base); margin-top: var(--space-2);">Deleted brands will appear here for 30 days</div>' +
      '</div>';
    return;
  }
  
  var html = '';
  window.deletedBrands.forEach(function(item, index) {
    var brand = item.brand;
    var deletedAt = new Date(item.deletedAt);
    var now = new Date();
    var diffDays = Math.floor((now - deletedAt) / (1000 * 60 * 60 * 24));
    var daysLeft = 30 - diffDays;
    var timeStr = diffDays === 0 ? 'Today' : 
                   diffDays === 1 ? 'Yesterday' :
                   diffDays + ' days ago';
    
    html += '<div style="display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4); background: var(--bg-tertiary); border-radius: var(--radius-md); margin-bottom: var(--space-3);">';
    html += '<div style="flex: 1;">';
    html += '<div style="font-weight: 600; font-size: var(--text-lg); margin-bottom: var(--space-1);">' + escapeHtml(brand.name) + '</div>';
    html += '<div style="color: var(--text-muted); font-size: var(--text-base);">Deleted ' + timeStr + ' • ' + daysLeft + ' days left</div>';
    if (brand.description) {
      html += '<div style="color: var(--text-secondary); font-size: var(--text-base); margin-top: var(--space-1);">' + escapeHtml(brand.description) + '</div>';
    }
    html += '</div>';
    html += '<div style="display: flex; gap: var(--space-2);">';
    html += '<button onclick="restoreBrand(' + index + ')" style="padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500;">Restore</button>';
    html += '<button onclick="permanentlyDeleteBrand(' + index + ')" style="padding: 8px 16px; background: transparent; color: var(--error); border: 1px solid var(--error); border-radius: var(--radius-sm); cursor: pointer;">Delete Forever</button>';
    html += '</div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

function restoreBrand(trashIndex) {
  var item = window.deletedBrands[trashIndex];
  if (!item) return;
  
  var brand = item.brand;
  
  // Check if brand name already exists
  var nameExists = brands.some(function(b) {
    return b.name.toLowerCase() === brand.name.toLowerCase();
  });
  
  if (nameExists) {
    if (!confirm('A brand named "' + brand.name + '" already exists. Restore anyway? The restored brand will have "(Restored)" added to its name.')) {
      return;
    }
    brand.name = brand.name + ' (Restored)';
  }
  brand._modifiedAt = Date.now();
  if (!brand.id) brand.id = 'brand_' + Date.now();

  // Add back to brands array
  brands.push(brand);
  
  // Remove from trash
  window.deletedBrands.splice(trashIndex, 1);
  
  // Save both arrays
  try {
    localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));
    saveDeletedBrands();
    showToast('Brand "' + brand.name + '" restored successfully', 'success');
  } catch (e) {
    console.error('Restore error:', e);
    showToast('Error restoring brand', 'error');
    return;
  }
  
  // Update UI
  updateBrandSelectors();
  renderDeletedBrandsList();
}

function permanentlyDeleteBrand(trashIndex) {
  var item = window.deletedBrands[trashIndex];
  if (!item) return;
  
  var brand = item.brand;
  
  if (!confirm('Permanently delete "' + brand.name + '"? This cannot be undone.')) {
    return;
  }
  
  // Remove from trash
  window.deletedBrands.splice(trashIndex, 1);
  saveDeletedBrands();

  // v24.25: Clean up any orphaned logo data
  for (var li = 0; li < 10; li++) {
    var logoKey = 'roweos_brand_' + li + '_logo';
    // Only remove if no active brand uses this index
    if (!brands[li]) {
      try { localStorage.removeItem(logoKey); localStorage.removeItem(logoKey + '_size'); } catch(e) {}
    }
  }

  showToast('Brand "' + brand.name + '" permanently deleted', 'info');
  renderDeletedBrandsList();
}

function showSettings() {
  // v14.0: Dynamically set version display
  var versionEl = document.getElementById('settingsVersionDisplay');
  if (versionEl) versionEl.textContent = ROWEOS_VERSION;

  // v16.12: Pre-fill calendar integration fields and update status
  // v23.2: gcalClientIdInput removed — Client ID is hardcoded
  var icloudIdInput = document.getElementById('icloudAppleIdInput');
  if (icloudIdInput) icloudIdInput.value = localStorage.getItem('roweos_icloud_apple_id') || '';
  updateCalendarIntegrationUI();
  // v18.4: Load calendar scope toggle state
  loadCalendarScopeToggle();
  // v20.14: Initialize push notification toggle state
  initPushNotifications();
  // v25.2: Start reminder checker
  if (typeof startReminderChecker === 'function') startReminderChecker();
  // v22.20: Initialize Bloom default feed display
  if (typeof updateBloomDefaultFeedDisplay === 'function') updateBloomDefaultFeedDisplay();

  // v15.1: Initialize unified personalization UI
  if (typeof initPersonalizationUI === 'function') {
    initPersonalizationUI();
  }
  
  var brandSelect = document.getElementById('brand');
  var brandIdx = brandSelect ? parseInt(brandSelect.value) : 0;
  var brand = brands[brandIdx];
  var s = document.getElementById('settings');
  
  // Guard against no brands
  if (!brand && brands.length === 0) {
    if (s) {
      s.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: var(--text-muted);"><div style="font-size: var(--text-5xl); margin-bottom: var(--space-4);">✦</div><div style="font-size: var(--text-xl); font-weight: 500; margin-bottom: var(--space-2);">No Brands Yet</div><div style="font-size: var(--text-base);">Create your first brand to access settings.</div><button onclick="showOnboarding()" style="margin-top: var(--space-5); background: var(--accent); color: var(--bg-primary); border: none; padding: 12px 24px; border-radius: var(--radius-md); cursor: pointer; font-weight: 500;">+ Create Brand</button></div>';
    }
    return;
  }
  
  // Fallback to first brand if brandIdx is invalid
  if (!brand && brands.length > 0) {
    brandIdx = 0;
    brand = brands[0];
  }
  
  // Update deleted brands badge count
  var badgeEl = document.getElementById('deletedBrandsCount');
  if (badgeEl) {
    if (window.deletedBrands.length > 0) {
      badgeEl.textContent = window.deletedBrands.length;
      badgeEl.style.display = 'inline-block';
    } else {
      badgeEl.style.display = 'none';
    }
  }
  
  // Update brand intelligence title (v9.1.14: now in merged view)
  var brandTitle = document.getElementById('brandIntelligenceTitle') || document.getElementById('memoryBrandTitle');
  if (brandTitle && brand) {
    brandTitle.textContent = brand.name;
  }
  
  // Define field groups for boxed layout (matches Edit Brand modal structure)
  var fieldGroups = [
    { title: 'Brand Identity', desc: 'Core brand name and products', fields: ['name', 'tagline', 'products'] },
    { title: 'Brand Philosophy', desc: 'Mission, values, and beliefs', fields: ['philosophy', 'coreBelief', 'mission', 'ethos'] },
    { title: 'Audience & Promise', desc: 'Who you serve and what you promise', fields: ['audience', 'promise', 'cta'] },
    { title: 'Voice & Tone', desc: 'How BrandAI should communicate', fields: ['voice', 'tone', 'approach'] },
    { title: 'Vocabulary Rules', desc: 'Words to use and avoid', fields: ['vocabDo', 'vocabDont', 'constraints'] },
    { title: 'Operations', desc: 'Services, pricing, and partnerships', fields: ['services', 'pricing', 'partnerships', 'deliverables'] },
    { title: 'Specialty Fields', desc: 'Brand-specific details', fields: ['trainingApproach', 'programs', 'adaEssentials', 'experience', 'properties', 'companionGoods'] },
    { title: 'Location & Contact', desc: 'Where you are and how to reach you', fields: ['location', 'localCuration', 'contacts', 'availability', 'safetyNote'] }
  ];
  
  // Custom field labels
  var customLabels = {
    'products': 'Products',
    'vocabDo': 'Words to Use',
    'vocabDont': 'Words to Avoid',
    'coreBelief': 'Core Belief',
    'localCuration': 'Local Curation',
    'adaEssentials': 'ADA Essentials',
    'trainingApproach': 'Training Approach',
    'companionGoods': 'Companion Goods',
    'safetyNote': 'Safety Note'
  };
  
  // Add brand management section
  var html = '<div style="margin-bottom: var(--space-6); padding: var(--space-4); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">';
  html += '<div>';
  html += '<div style="font-size: var(--text-base); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1);">Brand: ' + escapeHtml(brand.name) + '</div>';
  html += '<div style="font-size: var(--text-sm); color: var(--text-muted);">Manage this brand profile</div>';
  html += '</div>';
  html += '</div>';
  
  html += '<div class="identity-config-grid">';
  
  fieldGroups.forEach(function(group) {
    // Always show section (even if empty) to match Edit Brand modal
    html += '<div class="identity-section">';
    html += '<h3 class="identity-section-title">' + group.title + '</h3>';
    html += '<p class="identity-section-desc">' + group.desc + '</p>';
    
    // Check if any fields in this group have values
    var hasFields = group.fields.some(function(field) { return brand[field] || (field === 'products' && brand['positioning']); });
    
    if (!hasFields) {
      // Show empty state
      html += '<div style="padding: var(--space-5); text-align: center; color: var(--text-muted); font-size: var(--text-base); font-style: italic;">No data yet. Click "Edit Brand" to add information.</div>';
    } else {
    group.fields.forEach(function(field) {
      // Handle backward compatibility: show 'positioning' as 'Products'
      var actualField = field;
      var fieldValue = brand[field];
      
      if (field === 'products' && !brand[field] && brand['positioning']) {
        fieldValue = brand['positioning'];
      }
      
      if (fieldValue) {
        var label = customLabels[field] || (field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1'));
        var value = pendingSettingsChanges[actualField] !== undefined ? pendingSettingsChanges[actualField] : fieldValue;
        var rules = validationRules[field] || { maxLength: 1000 };
        var isReadonly = !settingsEditMode;
        var readonlyAttr = isReadonly ? 'readonly style="opacity:0.7"' : '';
        var onChangeAttr = settingsEditMode ? 'oninput="onSettingsFieldChange(\'' + field + '\', this.value)"' : '';
        
        html += '<div class="form-group settings-field" data-field="' + field + '">';
        html += '<label class="form-label">' + label + '</label>';
        
        if (value.length > 100 || field === 'constraints' || field === 'vocabDo' || field === 'vocabDont' || field === 'philosophy') {
          html += '<textarea ' + readonlyAttr + ' ' + onChangeAttr + ' style="min-height:80px">' + escapeHtml(value) + '</textarea>';
        } else {
          html += '<input type="text" value="' + escapeHtml(value) + '" ' + readonlyAttr + ' ' + onChangeAttr + '>';
        }
        
        if (settingsEditMode) {
          html += '<div class="settings-validation"></div>';
          if (rules.maxLength) {
            html += '<div class="settings-char-count">' + value.length + ' / ' + rules.maxLength + '</div>';
          }
        }
        
        html += '</div>';
      }
    });
    } // Close else block for fields
    
    html += '</div>';
  });
  
  html += '</div>';
  
  if (settingsEditMode) {
    html += '<div class="settings-actions" style="margin-top: var(--space-5);">';
    html += '<button class="btn" onclick="saveSettings()">Save Changes</button>';
    html += '<button class="btn btn-secondary" onclick="toggleSettingsEdit()">Cancel</button>';
    html += '</div>';
  }
  
  s.innerHTML = html;
  
  // v11.5.4: Initialize sidebar behavior dropdown with current state
  setTimeout(function() {
    if (typeof updateSidebarBehaviorDropdown === 'function') {
      updateSidebarBehaviorDropdown();
    }
  }, 100);
}

// v12.0.0: escapeHtml moved to utils.escapeHtml (alias at top of JS section)

// Smart output template generator based on operation type
function generateOutputTemplate(op, brand, context, agent) {
  var templates = {
    // Marketing outputs
    'Content calendar': '## Week of [Date]\n\n### Monday: Instagram Carousel\n**Topic:** Brand Story Highlight\n\n> "' + brand.tagline + '"\n\nCaption framework:\n- Hook with emotional question\n- Share the story behind the brand\n- End with soft CTA\n\n**Hashtags:** #' + brand.name.replace(/\s+/g, '') + ' #LuxuryLifestyle #Austin\n\n---\n\n### Tuesday: LinkedIn Article\n**Topic:** Industry Thought Leadership\n\nOutline:\n1. Open with contrarian insight\n2. Share data or observation\n3. Connect to brand values\n4. Invite discussion\n\n---\n\n### Wednesday: Instagram Stories\n**Type:** Behind-the-Scenes\n\nSequence:\n- Story 1: Process shot\n- Story 2: Team moment\n- Story 3: Poll or question sticker\n- Story 4: Swipe-up or link sticker\n\n---\n\n### Thursday: Engagement Post\n**Platform:** Facebook\n\nGoal: Community building\n- Ask an opinion question\n- Respond to every comment\n- Share user-generated content\n\n---\n\n### Friday: Instagram Reel\n**Topic:** Weekly Highlight\n\nFormat: 15-30 seconds\n- Trending audio\n- Quick cuts\n- Text overlay with key message\n- Strong hook in first 2 seconds',
    
    'Post copy': '## Instagram Post\n\n### Caption\n\n' + brand.tagline + '\n\nEvery detail matters. Every moment counts. Every experience curated with intention.\n\nThis is what sets **' + brand.name + '** apart, not just in what we deliver, but in *how* we deliver it.\n\n→ Link in bio\n\n---\n\n### Hashtag Strategy\n\n**Primary (Brand):**\n#' + brand.name.replace(/\s+/g, '') + ' #TheRoweCollection\n\n**Secondary (Niche):**\n#LuxuryAustin #ElevatedExperiences #CuratedLiving\n\n**Tertiary (Discovery):**\n#AustinTexas #LuxuryLifestyle #EveryDetailMatters',
    
    'Email sequence': '## Email Nurture Sequence\n\n### Email 1: Welcome (Immediate)\n\n**Subject:** Welcome to ' + brand.name + '\n**Preview:** Your journey begins here...\n\n**Body Framework:**\n\n> Dear [First Name],\n>\n> Thank you for joining us. ' + brand.tagline + '\n>\n> Here\'s what you can expect from us:\n> - [Value proposition 1]\n> - [Value proposition 2]\n> - [Value proposition 3]\n>\n> Warmly,\n> The ' + brand.name + ' Team\n\n**CTA:** Explore Our Story\n\n---\n\n### Email 2: Value (Day 2)\n\n**Subject:** What makes the difference\n**Preview:** It\'s in the details...\n\n**Goal:** Establish authority and differentiation\n\n---\n\n### Email 3: Social Proof (Day 4)\n\n**Subject:** Don\'t take our word for it\n**Preview:** See what others are saying...\n\n**Include:**\n- 2-3 testimonials\n- Star ratings if applicable\n- Photos of happy clients\n\n---\n\n### Email 4: Soft Offer (Day 7)\n\n**Subject:** Ready when you are\n**Preview:** Your next step awaits...\n\n**CTA:** Schedule a Consultation',
    
    'Campaign strategy': '## Campaign Strategy\n\n### Overview\n\n| Element | Details |\n|---------|--------|\n| **Campaign Name** | [Name] |\n| **Brand** | ' + brand.name + ' |\n| **Duration** | 4 weeks |\n| **Budget** | $[Amount] |\n\n---\n\n### Objective\n\n**Primary Goal:** [Awareness / Engagement / Conversion]\n\n**Key Results:**\n1. Increase brand awareness by X%\n2. Generate X qualified leads\n3. Achieve X% engagement rate\n\n---\n\n### Target Audience\n\n' + (brand.audience || 'Discerning individuals seeking thoughtfully curated, elevated experiences') + '\n\n**Demographics:**\n- Age: 35-55\n- Income: $150k+\n- Location: Austin metro area\n\n---\n\n### Key Messages\n\n1. **Primary:** ' + brand.tagline + '\n2. **Secondary:** Every detail, perfected\n3. **Proof Point:** Trusted by discerning clients since [year]\n\n---\n\n### Channel Strategy\n\n| Channel | Role | Frequency |\n|---------|------|----------|\n| Instagram | Primary engagement | Daily |\n| Email | Nurture & convert | 2x weekly |\n| LinkedIn | Authority building | 3x weekly |\n\n---\n\n### Success Metrics\n\n- **Engagement Rate:** Target 4%+\n- **Click-through Rate:** Target 2%+\n- **Conversion Rate:** Target 1%+',
    
    // Strategic outputs
    'Competitor profiles': '## Competitive Analysis\n\n### Competitor 1: [Name]\n\n| Attribute | Assessment |\n|-----------|------------|\n| **Positioning** | [Their tagline] |\n| **Price Point** | $$$ |\n| **Strengths** | [What they do well] |\n| **Weaknesses** | [Where they fall short] |\n\n**Key Differentiator:** [What sets them apart]\n\n---\n\n### Competitor 2: [Name]\n\n| Attribute | Assessment |\n|-----------|------------|\n| **Positioning** | [Their tagline] |\n| **Price Point** | $$$$ |\n| **Strengths** | [What they do well] |\n| **Weaknesses** | [Where they fall short] |\n\n---\n\n### Competitive Advantage for ' + brand.name + '\n\n**Our Unique Position:**\n\n1. **[Advantage 1]**: How we\'re different\n2. **[Advantage 2]**: Why it matters\n3. **[Advantage 3]**: The gap we fill\n\n> *"' + brand.tagline + '"*',
    
    'SWOT matrix': '## SWOT Analysis: ' + brand.name + '\n\n### Strengths\n\n- **Brand Voice:** ' + (brand.voice || 'Calm, warm, structured, quietly premium') + '\n- **Market Position:** Established luxury presence\n- **Team Expertise:** Deep domain knowledge\n- **Client Relationships:** High retention and referral rates\n\n---\n\n### Weaknesses\n\n- **[Area 1]:** Opportunity for improvement\n- **[Area 2]:** Resource or capability gap\n- **[Area 3]:** Process inefficiency\n\n---\n\n### Opportunities\n\n- **Market Trend:** Growing demand for curated experiences\n- **Untapped Segment:** [Specific demographic or need]\n- **Partnership Potential:** Strategic alliance possibilities\n- **Technology:** Digital experience enhancement\n\n---\n\n### Threats\n\n- **Competition:** New entrants in the luxury space\n- **Economic:** Market sensitivity to economic shifts\n- **Perception:** Need for continued brand elevation',
    
    'Customer personas': '## Customer Persona\n\n### Primary Persona: [Name]\n\n**Demographics:**\n\n| Attribute | Details |\n|-----------|--------|\n| Age | 38-52 |\n| Location | Austin, TX metro |\n| Income | $200k+ household |\n| Occupation | Executive / Entrepreneur |\n\n---\n\n**Psychographics:**\n\n> *"I don\'t have time to waste on experiences that don\'t deliver. I want quality, curation, and someone who understands what \'elevated\' actually means."*\n\n**Values:**\n- Quality over quantity\n- Time is the ultimate luxury\n- Authenticity and craftsmanship\n\n---\n\n**Goals:**\n1. Find trusted providers who understand their standards\n2. Create memorable experiences without the research burden\n3. Feel confident in every recommendation\n\n**Pain Points:**\n1. Overwhelmed by options, underwhelmed by execution\n2. Past experiences with "luxury" that fell flat\n3. Limited time for vetting and research\n\n---\n\n**How ' + brand.name + ' Helps:**\n\n- **Trust:** We\'ve done the vetting so you don\'t have to\n- **Standards:** Our definition of quality matches yours\n- **Ease:** One point of contact, zero friction',
    
    // Documents
    'Welcome message': '## Welcome to ' + brand.name + '\n\n---\n\nDear **[Guest/Client Name]**,\n\nThank you for choosing ' + brand.name + '.\n\n> *"' + brand.tagline + '"*\n\nWe\'re honored to welcome you and committed to ensuring every detail of your experience exceeds expectations.\n\n---\n\n### What\'s Next\n\n1. **[First Step]**: Brief description\n2. **[Second Step]**: Brief description\n3. **[Third Step]**: Brief description\n\n---\n\n### We\'re Here For You\n\nShould you need anything at all:\n\n- **Email:** contact@therowecollection.com\n- **Phone:** [Number]\n- **Location:** Austin, Texas\n\n---\n\nWith warmth,\n\n**The ' + brand.name + ' Team**',
    
    'Service agreement': '## Service Agreement\n\n**' + brand.name + '**\n\n---\n\nThis agreement is entered into between:\n\n- **Provider:** ' + brand.name + '\n- **Client:** [Client Name]\n- **Effective Date:** [Date]\n\n---\n\n### 1. Services\n\n[Detailed description of services to be provided]\n\n### 2. Timeline\n\n| Milestone | Date |\n|-----------|------|\n| Project Start | [Date] |\n| [Phase 1] | [Date] |\n| [Phase 2] | [Date] |\n| Completion | [Date] |\n\n### 3. Investment\n\n**Total:** $[Amount]\n\n**Payment Schedule:**\n- 50% upon signing\n- 50% upon completion\n\n### 4. Terms & Conditions\n\n[Standard terms to be included]\n\n### 5. Cancellation Policy\n\n[Policy details]\n\n---\n\n**Signatures:**\n\n___________________________ Date: ________\nProvider\n\n___________________________ Date: ________\nClient',
    
    // Operations
    'Response templates': '## Review Response Templates\n\n### 5-Star Response\n\n> Dear [Name],\n>\n> Thank you so much for your incredibly kind words! We\'re absolutely thrilled that [specific mention from their review].\n>\n> *"' + brand.tagline + '"*, and guests like you make it all worthwhile.\n>\n> We can\'t wait to welcome you back.\n>\n> Warmly,\n> The ' + brand.name + ' Team\n\n---\n\n### 4-Star Response\n\n> Dear [Name],\n>\n> Thank you for taking the time to share your experience with us. We\'re so pleased that [positive mention], and we genuinely appreciate your feedback about [area for improvement].\n>\n> We\'re always looking for ways to elevate, and your insight helps us do exactly that.\n>\n> We hope to welcome you again soon.\n>\n> Warmly,\n> The ' + brand.name + ' Team\n\n---\n\n### 3-Star or Below Response\n\n> Dear [Name],\n>\n> Thank you for your honest feedback. We sincerely apologize that your experience didn\'t meet the standard we hold ourselves to.\n>\n> [Acknowledge specific issue]\n>\n> We\'d truly appreciate the opportunity to make this right. Please reach out directly to [contact] so we can address this personally.\n>\n> With gratitude for your candor,\n> The ' + brand.name + ' Team'
  };
  
  var output = '# ' + op.name + '\n\n';
  output += '**Brand:** ' + brand.name + '  \n';
  output += '**Voice:** ' + (brand.voice || 'Calm, warm, structured, quietly premium') + '\n';
  if (agent) output += '**Agent:** ' + agent.name + '\n';
  if (context) output += '**Context:** ' + context + '\n';
  output += '\n---\n\n';
  
  op.outputs.forEach(function(o, index) {
    // Check if we have a template for this output type
    var templateKey = Object.keys(templates).find(function(key) {
      return o.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(o.toLowerCase());
    });
    
    if (templateKey) {
      output += templates[templateKey] + '\n\n';
    } else {
      // Generate structured placeholder with proper markdown
      output += '## ' + o + '\n\n';
      output += '*[' + o + ' content for ' + brand.name + ']*\n\n';
      output += '**Key Elements:**\n\n';
      output += '- **Brand Voice:** ' + (brand.voice || 'Calm, warm, structured, quietly premium') + '\n';
      output += '- **Tagline:** ' + brand.tagline + '\n';
      output += '- **Audience:** ' + (brand.audience || 'Discerning individuals seeking thoughtfully curated, elevated experiences') + '\n\n';
    }
    
    if (index < op.outputs.length - 1) {
      output += '---\n\n';
    }
  });
  
  return output;
}

function clearStudio() {
  // Reset selected operation
  selectedOp = null;
  
  // Clear the selected op display
  var selectedOpEl = document.getElementById('studioSelectedOp');
  if (selectedOpEl) {
    selectedOpEl.innerHTML = '<div class="studio-selected-op-empty"><div class="studio-selected-op-empty-icon">▤</div><div>Select an Agent and its task</div></div>';
  }
  
  // Clear context textarea
  var contextEl = document.getElementById('studioContext');
  if (contextEl) contextEl.value = '';
  
  // v9.1.14: Clear and hide the generated prompt section
  var promptSection = document.getElementById('studioPromptSection');
  var editablePrompt = document.getElementById('editablePrompt');
  if (promptSection) promptSection.style.display = 'none';
  if (editablePrompt) editablePrompt.value = '';
  
  // Reset run button
  var runBtn = document.getElementById('runBtn');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'Add Content from Library';
  }
  
  // Clear output
  var outputEl = document.getElementById('studioOutputContent');
  if (outputEl) {
    outputEl.innerHTML = '<div class="studio-output-empty"><div class="studio-output-empty-icon">◇</div><div class="studio-output-empty-text">Run an Agent to generate content. Output will appear here.</div></div>';
  }
  
  // Reset output title
  var outputTitle = document.getElementById('outputTitle');
  if (outputTitle) outputTitle.textContent = 'Output';
  
  // Reset agent selection to "All Agents"
  currentAgent = 'all';
  selectedCategory = 'all';
  document.querySelectorAll('.agent-pill').forEach(function(pill) {
    pill.classList.toggle('active', pill.dataset.agent === 'all');
  });
  
  // Re-render operations
  renderOperations();
  
  showToast('Studio cleared', 'success');
}

function newAgentOperation() {
  // Clear everything in studio
  clearStudio();
  
  // CRITICAL: Force clear the output title
  var outputTitle = document.getElementById('outputTitle');
  if (outputTitle) {
    outputTitle.textContent = 'Output';
    outputTitle.style.display = '';
  }
  
  // v10.5.25: Close config panel and deselect cards
  closeConfigPanel();
  document.querySelectorAll('.studio-v2-card').forEach(function(c) { 
    c.classList.remove('selected'); 
  });
  
  // v10.5.25: Clear attached content
  window.studioAttachedContent = null;
  var subjectBtn = document.getElementById('subjectButtonText');
  if (subjectBtn) subjectBtn.textContent = 'Add from RoweOS Library';
  
  // v10.5.25: Clear context
  var contextEl = document.getElementById('studioContext');
  if (contextEl) contextEl.value = '';
  
  // v10.5.25: Reset brand chips
  if (typeof addedBrandChips !== 'undefined') addedBrandChips.clear();
  
  // v9.1.14: Clear the output header (operation name/brand display)
  var outputHeader = document.getElementById('studioOutputHeader');
  if (outputHeader) {
    outputHeader.innerHTML = '<div class="studio-output-toolbar-inline"><button class="studio-outline-btn" onclick="copyOutput()">Copy</button><button class="studio-outline-btn" onclick="openSaveLibraryModal()">Save</button><div class="export-dropdown-container"><button class="studio-outline-btn" onclick="toggleExportDropdown()">Export</button><div id="exportDropdown" class="export-dropdown hidden"><button onclick="exportAs(\'md\')">.md</button><button onclick="exportAs(\'html\')">.html</button><button onclick="exportAs(\'txt\')">.txt</button><button onclick="exportAs(\'pdf\')">.pdf</button><button onclick="exportAs(\'docx\')">.docx</button></div></div><button class="studio-outline-btn" onclick="printOutput()">Print</button><button class="studio-outline-btn" onclick="toggleOutputEdit()">Edit</button><button class="studio-outline-btn" onclick="clearStudio()">Clear</button></div>';
  }
  
  // Force clear the output content
  var outputContent = document.getElementById('studioOutputContent');
  if (outputContent) {
    outputContent.innerHTML = '<div class="studio-v2-output-empty"><div class="studio-v2-output-empty-icon">◇</div><div class="studio-v2-output-empty-text">Select a task above and run an agent to generate content.</div></div>';
  }
  
  // Hide output actions
  var outputActions = document.getElementById('studioOutputActions');
  if (outputActions) outputActions.style.display = 'none';
  
  // Clear selected operation
  selectedOp = null;
  document.querySelectorAll('.studio-op-item').forEach(function(c) { c.classList.remove('selected'); });
  updateSelectedOpDisplay();
  updateRunButton();
  
  // Clear currentRun
  window.currentRun = null;
  window.lastStudioOutput = null;
  
  // Update live prompt preview
  if (typeof updateLivePromptPreview === 'function') updateLivePromptPreview();
  
  showToast('Studio reset - ready for new task', 'success');
}

// Studio API call handler - supports all providers
function callStudioAPI(provider, model, apiKey, prompt, onSuccess, onError) {
  console.log('Studio API: Calling', provider, 'with model', model);
  
  if (provider === 'anthropic') {
    callAnthropicStudio(model, apiKey, prompt, onSuccess, onError);
  } else if (provider === 'openai') {
    callOpenAIStudio(model, apiKey, prompt, onSuccess, onError);
  } else if (provider === 'google') {
    callGoogleStudio(model, apiKey, prompt, onSuccess, onError);
  } else {
    onError('Unknown provider: ' + provider);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDIO STREAMING API FUNCTIONS (v9.1.14 - Phase 1)
// ═══════════════════════════════════════════════════════════════════════════

function callStudioAPIStreaming(provider, model, apiKey, prompt, onChunk, onComplete, onError) {
  console.log('[Studio v9.1.14] Streaming call to', provider, 'model:', model);
  if (provider === 'anthropic') {
    callAnthropicStudioStreaming(model, apiKey, prompt, onChunk, onComplete, onError);
  } else if (provider === 'openai') {
    callOpenAIStudioStreaming(model, apiKey, prompt, onChunk, onComplete, onError);
  } else if (provider === 'google') {
    callGoogleStudioStreaming(model, apiKey, prompt, onChunk, onComplete, onError);
  } else {
    onError('Unknown provider: ' + provider);
  }
}

async function callAnthropicStudioStreaming(model, apiKey, prompt, onChunk, onComplete, onError) {
  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 8192,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!response.ok) {
      var errorData = await response.json();
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
          if (jsonStr === '[DONE]') continue;
          try {
            var data = JSON.parse(jsonStr);
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              fullText += data.delta.text;
              onChunk(data.delta.text, fullText);
            }
          } catch (e) { /* skip */ }
        }
      }
    }
    onComplete(fullText);
  } catch (err) {
    console.error('[Studio] Anthropic streaming error:', err);
    onError(err.message);
  }
}

// v22.19: GPT-5.4 Thinking model helpers
function resolveOpenAIModel(model) {
  if (model && model.indexOf('-thinking') !== -1) {
    return model.replace('-thinking', '');
  }
  return model;
}

function isOpenAIThinkingModel(model) {
  return model && model.indexOf('-thinking') !== -1;
}

// v22.18: Migrated to OpenAI Responses API (from Chat Completions)
async function callOpenAIStudioStreaming(model, apiKey, prompt, onChunk, onComplete, onError) {
  // v22.19: Show thinking progress for thinking models and wrap callbacks
  // v29.0: Skip progress bars for multimodal (image) conversations
  var _studioHasMultimodal = typeof prompt === 'object' && Array.isArray(prompt);
  var _thinkingShownStudio = false;
  if (isOpenAIThinkingModel(model) && !_studioHasMultimodal) {
    showThinkingProgress();
    _thinkingShownStudio = true;
    var _origOnChunkS = onChunk;
    var _firstChunkS = true;
    onChunk = function(chunk, full) {
      if (_firstChunkS) { _firstChunkS = false; hideThinkingProgress(); _thinkingShownStudio = false; }
      _origOnChunkS(chunk, full);
    };
    var _origOnCompleteS = onComplete;
    onComplete = function(text) {
      if (_thinkingShownStudio) hideThinkingProgress();
      _origOnCompleteS(text);
    };
    var _origOnErrorS = onError;
    onError = function(msg) {
      if (_thinkingShownStudio) hideThinkingProgress();
      _origOnErrorS(msg);
    };
  }
  try {
    var actualModel = resolveOpenAIModel(model); // v22.19
    var requestBody = {
      model: actualModel,
      stream: true,
      max_output_tokens: 8192,
      input: [{ role: 'user', content: prompt }]
    };
    // v22.19: Inject reasoning for thinking models
    if (isOpenAIThinkingModel(model)) {
      requestBody.reasoning = { effort: 'high', summary: 'auto' };
      requestBody.max_output_tokens = 16384;
    }
    // v22.20: Add web search tool for GPT-5.4 models
    if (model.indexOf('gpt-5.4') === 0) {
      requestBody.tools = [{ type: 'web_search_preview' }];
    }
    var response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      var errorData = await response.json();
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
          if (jsonStr === '[DONE]') continue;
          try {
            var data = JSON.parse(jsonStr);
            // v22.18: Responses API - text deltas come as response.output_text.delta
            if (data.type === 'response.output_text.delta' && data.delta) {
              fullText += data.delta;
              onChunk(data.delta, fullText);
            }
          } catch (e) { /* skip */ }
        }
      }
    }
    onComplete(fullText);
  } catch (err) {
    console.error('[Studio] OpenAI streaming error:', err);
    onError(err.message);
  }
}

// v22.2: Extract non-thinking text from Gemini response parts (Gemini 3.x thinking enabled by default)
function extractGeminiResponseText(parts) {
  if (!parts || !parts.length) return '';
  var text = '';
  for (var p = 0; p < parts.length; p++) {
    if (parts[p].thought) continue;
    text += parts[p].text || '';
  }
  // Fallback: if ALL parts are thought parts, return parts[0].text (shouldn't happen but safety)
  if (!text && parts[0] && parts[0].text) text = parts[0].text;
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// v24.25: GEMINI CONTEXT CACHING — 90% discount on cached input tokens
// Uses generativelanguage.googleapis.com/v1beta/cachedContents API.
// Caches system instructions + conversation history; only sends new user message.
// ═══════════════════════════════════════════════════════════════════════════════

var _geminiCacheStore = {}; // { hash: { name, model, created, ttl, tokenCount } }

// Models that support explicit context caching
var _geminiCacheModels = [
  'gemini-3.1-pro', 'gemini-3.1-flash-lite', 'gemini-3-pro', 'gemini-3-flash',
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'
];

function _geminiSupportsCaching(model) {
  if (!model) return false;
  return _geminiCacheModels.some(function(m) { return model.indexOf(m) !== -1; });
}

function _geminiMinCacheTokens(model) {
  return (model && model.indexOf('gemini-2') === 0) ? 2048 : 4096;
}

function _geminiCacheHash(model, systemPrompt, messages) {
  var str = model + '|' + (systemPrompt || '').length + '|';
  for (var i = 0; i < messages.length; i++) {
    var c = messages[i].content;
    str += messages[i].role + ':' + (typeof c === 'string' ? c.length : JSON.stringify(c).length) + '|';
  }
  // Simple hash for fast lookup
  var h = 0;
  for (var j = 0; j < str.length; j++) {
    h = ((h << 5) - h) + str.charCodeAt(j);
    h |= 0;
  }
  return 'gc_' + Math.abs(h).toString(36);
}

// Build Gemini-format contents array from messages
function _buildGeminiContents(messages) {
  var contents = [];
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    var role = m.role === 'assistant' ? 'model' : 'user';
    var parts = [];
    if (Array.isArray(m.content)) {
      m.content.forEach(function(part) {
        if (part.type === 'image' && part.source) {
          parts.push({ inlineData: { mimeType: part.source.media_type, data: part.source.data } });
        } else if (part.type === 'text') {
          parts.push({ text: part.text });
        }
      });
    } else {
      parts.push({ text: m.content || '' });
    }
    contents.push({ role: role, parts: parts });
  }
  return contents;
}

// Estimate token count (~4 chars per token)
function _estimateGeminiTokens(systemPrompt, messages) {
  var chars = (systemPrompt || '').length;
  for (var i = 0; i < messages.length; i++) {
    var c = messages[i].content;
    chars += typeof c === 'string' ? c.length : JSON.stringify(c).length;
  }
  return Math.ceil(chars / 4);
}

// Create a context cache via the REST API
async function _createGeminiCache(model, apiKey, contents, systemPrompt, ttlSeconds) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/cachedContents?key=' + apiKey;
  var body = {
    model: 'models/' + model,
    contents: contents,
    ttl: (ttlSeconds || 300) + 's'
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  try {
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      var errData = await resp.json().catch(function() { return {}; });
      if (ROWEOS_DEBUG) console.warn('[GeminiCache] Create failed:', resp.status, errData.error ? errData.error.message : '');
      return null;
    }
    var data = await resp.json();
    if (ROWEOS_DEBUG) console.log('[GeminiCache] Created:', data.name, 'tokens:', data.usageMetadata ? data.usageMetadata.totalTokenCount : '?');
    return data;
  } catch (e) {
    if (ROWEOS_DEBUG) console.warn('[GeminiCache] Error:', e.message);
    return null;
  }
}

// Get existing cache or create a new one for conversation context
async function _getOrCreateGeminiCache(model, apiKey, systemPrompt, messagesToCache) {
  if (!_geminiSupportsCaching(model) || messagesToCache.length === 0) return null;

  // Check token minimum
  var estimated = _estimateGeminiTokens(systemPrompt, messagesToCache);
  if (estimated < _geminiMinCacheTokens(model)) return null;

  // Check for existing valid cache
  var hash = _geminiCacheHash(model, systemPrompt, messagesToCache);
  var existing = _geminiCacheStore[hash];
  if (existing && (Date.now() - existing.created) < (existing.ttl * 800)) {
    return existing; // Still valid (80% of TTL as safety margin)
  }

  // Create new cache
  var contents = _buildGeminiContents(messagesToCache);
  var cacheData = await _createGeminiCache(model, apiKey, contents, systemPrompt, 300);
  if (!cacheData || !cacheData.name) return null;

  var entry = {
    name: cacheData.name,
    model: model,
    created: Date.now(),
    ttl: 300,
    tokenCount: cacheData.usageMetadata ? cacheData.usageMetadata.totalTokenCount : estimated
  };
  _geminiCacheStore[hash] = entry;

  // Purge expired entries
  var now = Date.now();
  Object.keys(_geminiCacheStore).forEach(function(k) {
    if ((now - _geminiCacheStore[k].created) > (_geminiCacheStore[k].ttl * 1000)) {
      delete _geminiCacheStore[k];
    }
  });

  return entry;
}

// ═══════════════════════════════════════════════════════════════════════════════

async function callGoogleStudioStreaming(model, apiKey, prompt, onChunk, onComplete, onError) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?key=' + apiKey + '&alt=sse';
  
  try {
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192 }
      })
    });
    
    if (!response.ok) {
      var errorData = await response.json();
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
              var text = extractGeminiResponseText(data.candidates[0].content.parts);
              if (text) {
                fullText += text;
                onChunk(text, fullText);
              }
            }
          } catch (e) { /* skip */ }
        }
      }
    }
    onComplete(fullText);
  } catch (err) {
    console.error('[Studio] Google streaming error:', err);
    onError(err.message);
  }
}

function callAnthropicStudio(model, apiKey, prompt, onSuccess, onError) {
  console.log('=== Anthropic Studio API Call ===');
  console.log('Model:', model);
  console.log('Prompt length:', prompt.length);
  
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
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  .then(function(response) {
    console.log('Anthropic response status:', response.status);
    if (!response.ok) {
      return response.json().then(function(errorData) {
        console.error('Anthropic API error response:', errorData);
        throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'Unknown error'));
      });
    }
    return response.json();
  })
  .then(function(data) {
    console.log('Anthropic response received');
    var content = data.content && data.content[0] && data.content[0].text;
    if (content) {
      console.log('✓ Anthropic content received, length:', content.length);
      onSuccess(content);
    } else {
      console.error('✗ No content in Anthropic response');
      onError('No content in response');
    }
  })
  .catch(function(err) {
    console.error('✗ Anthropic Studio error:', err);
    onError(err.message);
  });
}

// v22.18: Migrated to OpenAI Responses API
function callOpenAIStudio(model, apiKey, prompt, onSuccess, onError) {
  console.log('=== OpenAI Studio API Call (Responses API) ===');
  var actualModel = resolveOpenAIModel(model); // v22.19
  console.log('Model:', actualModel, isOpenAIThinkingModel(model) ? '(thinking)' : '');
  console.log('Prompt length:', prompt.length);

  var requestBody = {
    model: actualModel,
    input: [{ role: 'user', content: prompt }],
    max_output_tokens: 4096,
    store: false
  };
  // v22.19: Inject reasoning for thinking models
  if (isOpenAIThinkingModel(model)) {
    requestBody.reasoning = { effort: 'high', summary: 'auto' };
    requestBody.max_output_tokens = 16384;
  }

  fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(requestBody)
  })
  .then(function(response) {
    console.log('OpenAI response status:', response.status);
    if (!response.ok) {
      return response.json().then(function(errorData) {
        console.error('OpenAI API error response:', errorData);
        throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'Unknown error'));
      });
    }
    return response.json();
  })
  .then(function(data) {
    console.log('OpenAI response data:', data);
    // v22.18: Responses API returns output_text helper or output array
    var content = data.output_text || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text);
    if (content) {
      console.log('OpenAI content received, length:', content.length);
      // v22.18: Track usage from Responses API format
      try {
        var usg = data.usage || {};
        if (typeof trackAPIUsage === 'function') {
          trackAPIUsage('openai', model, usg.input_tokens || 0, usg.output_tokens || 0, false, false, 'studio');
        }
      } catch(trackErr) { console.warn('[Analytics] Track error:', trackErr); }
      onSuccess(content);
    } else {
      console.error('No content in OpenAI response');
      console.error('Full response:', JSON.stringify(data));
      onError('No content in response');
    }
  })
  .catch(function(err) {
    console.error('OpenAI Studio error:', err);
    console.error('Error message:', err.message);
    onError(err.message);
  });
}

function callGoogleStudio(model, apiKey, prompt, onSuccess, onError) {
  console.log('=== Google Studio API Call ===');
  console.log('Model:', model);
  console.log('Prompt length:', prompt.length);
  
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: 4096
      }
    })
  })
  .then(function(response) {
    console.log('Google response status:', response.status);
    if (!response.ok) {
      return response.json().then(function(errorData) {
        console.error('Google API error response:', errorData);
        throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'Unknown error'));
      });
    }
    return response.json();
  })
  .then(function(data) {
    console.log('Google response received');
    
    // Track API usage for analytics
    if (data.usageMetadata) {
      var webSearchUsed = localStorage.getItem('roweos_gemini_web_search') === 'true';
      trackAPIUsage('gemini', model,
        data.usageMetadata.promptTokenCount || 0,
        data.usageMetadata.candidatesTokenCount || 0,
        false,
        webSearchUsed,
        'studio'
      );
    }

    var content = data.candidates && data.candidates[0] && data.candidates[0].content &&
                  data.candidates[0].content.parts ? extractGeminiResponseText(data.candidates[0].content.parts) : '';
    if (content) {
      console.log('✓ Google content received, length:', content.length);
      onSuccess(content);
    } else {
      console.error('✗ No content in Google response');
      console.error('Full response:', JSON.stringify(data));
      onError('No content in response');
    }
  })
  .catch(function(err) {
    console.error('✗ Google Studio error:', err);
    onError(err.message);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WEB-BASED CHAT API FUNCTIONS (for browser mode without Electron)
// ═══════════════════════════════════════════════════════════════════════════

// v10.5.25: Promise-based API calls for simple tasks
async function callAnthropicAPI(model, apiKey, messages, systemPrompt) {
  console.log('[API] Anthropic call, model:', model);
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12

  var apiMessages = messages.map(function(m) {
    return { role: m.role, content: m.content };
  });

  // v24.24: Prompt caching — cache system prompt for 90% input cost reduction on hits
  var systemPayload = systemPrompt
    ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    : undefined;

  var response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      system: systemPayload,
      messages: apiMessages
    })
  });

  if (!response.ok) {
    var errorData = await response.json();
    throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
  }

  var data = await response.json();
  var content = data.content && data.content[0] && data.content[0].text;
  if (!content) throw new Error('No content in response');
  // v15.15: Track API usage for analytics (non-streaming path)
  try {
    var usage = data.usage || {};
    if (typeof trackAPIUsage === 'function') {
      trackAPIUsage('anthropic', model, usage.input_tokens || 0, usage.output_tokens || 0, false, false);
    }
    // v24.24: Log cache stats when available
    if (usage.cache_read_input_tokens || usage.cache_creation_input_tokens) {
      if (localStorage.getItem('roweos_debug') === 'true') {
        console.log('[Cache] read:', usage.cache_read_input_tokens || 0, 'write:', usage.cache_creation_input_tokens || 0);
      }
    }
  } catch(trackErr) { console.warn('[Analytics] Track error:', trackErr); }
  return content;
}

// v22.18: Migrated to OpenAI Responses API
async function callOpenAIAPI(model, apiKey, messages, systemPrompt) {
  var actualModel = resolveOpenAIModel(model); // v22.19
  console.log('[API] OpenAI call (Responses API), model:', actualModel, isOpenAIThinkingModel(model) ? '(thinking)' : '');
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12

  var inputMessages = [];
  messages.forEach(function(m) {
    inputMessages.push({ role: m.role, content: m.content });
  });

  var requestBody = {
    model: actualModel,
    instructions: systemPrompt || undefined,
    max_output_tokens: 4096,
    input: inputMessages,
    store: false
  };
  // v22.19: Inject reasoning for thinking models
  if (isOpenAIThinkingModel(model)) {
    requestBody.reasoning = { effort: 'high', summary: 'auto' };
    requestBody.max_output_tokens = 16384;
  }

  var response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    var errorData = await response.json();
    throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
  }

  var data = await response.json();
  // v22.18: Responses API returns output_text helper
  var content = data.output_text || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text);
  if (!content) throw new Error('No content in response');
  // v22.18: Track API usage (Responses API uses input_tokens/output_tokens)
  try {
    var usage = data.usage || {};
    if (typeof trackAPIUsage === 'function') {
      trackAPIUsage('openai', model, usage.input_tokens || 0, usage.output_tokens || 0, false, false);
    }
  } catch(trackErr) { console.warn('[Analytics] Track error:', trackErr); }
  return content;
}

async function callGoogleAPI(model, apiKey, messages, systemPrompt) {
  console.log('[API] Google call, model:', model);
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12

  // v24.25: Try context caching for conversations with 3+ messages
  var cacheEntry = null;
  var requestBody = {};
  if (messages.length >= 3 && _geminiSupportsCaching(model)) {
    var lastUserIdx = -1;
    for (var ci = messages.length - 1; ci >= 0; ci--) {
      if (messages[ci].role === 'user') { lastUserIdx = ci; break; }
    }
    if (lastUserIdx > 0) {
      cacheEntry = await _getOrCreateGeminiCache(model, apiKey, systemPrompt, messages.slice(0, lastUserIdx));
    }
  }

  if (cacheEntry) {
    requestBody = {
      cachedContent: cacheEntry.name,
      contents: _buildGeminiContents(messages.slice(-1)),
      generationConfig: { maxOutputTokens: 4096 }
    };
  } else {
    requestBody = {
      contents: _buildGeminiContents(messages),
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: { maxOutputTokens: 4096 }
    };
  }

  var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    var errorData = await response.json();
    throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
  }

  var data = await response.json();
  var content = data.candidates && data.candidates[0] && data.candidates[0].content &&
                data.candidates[0].content.parts ? extractGeminiResponseText(data.candidates[0].content.parts) : '';
  if (!content) throw new Error('No content in response');
  // v15.15: Track API usage, v24.25: track cached tokens
  try {
    var um = data.usageMetadata || {};
    var cachedTk = um.cachedContentTokenCount || 0;
    if (typeof trackAPIUsage === 'function') {
      trackAPIUsage('google', model, um.promptTokenCount || 0, um.candidatesTokenCount || 0, cachedTk > 0, false);
    }
  } catch(trackErr) { console.warn('[Analytics] Track error:', trackErr); }
  return content;
}

function callAnthropicChat(model, apiKey, messages, systemPrompt, onSuccess, onError) {
  console.log('[Chat Web] Anthropic API call, model:', model);
  
  var apiMessages = messages.map(function(m) {
    return { role: m.role, content: m.content };
  });
  
  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: apiMessages
    })
  })
  .then(function(response) {
    if (!response.ok) {
      return response.json().then(function(errorData) {
        throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
      });
    }
    return response.json();
  })
  .then(function(data) {
    var content = data.content && data.content[0] && data.content[0].text;
    if (content) {
      onSuccess(content);
    } else {
      onError('No content in response');
    }
  })
  .catch(function(err) {
    console.error('[Chat Web] Anthropic error:', err);
    onError(err.message);
  });
}

// v8.0: Streaming API call for Anthropic
// v12.0.3: Added response caching support
async function callAnthropicStreaming(model, apiKey, messages, systemPrompt, onChunk, onComplete, onError, abortSignal) {
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12
  setLastModelUsed('anthropic', model); // v23.5
  console.log('[Chat Web] Anthropic STREAMING call, model:', model);

  // v12.0.3: Check cache first
  var cachedResponse = getCachedResponse(messages, systemPrompt);
  if (cachedResponse) {
    console.log('[Cache] Using cached response');
    // v18.4: Track cache hit for analytics
    trackAPIUsage('anthropic', model, 0, 0, true, false);
    // Simulate streaming for cached response
    var words = cachedResponse.split(' ');
    var fullText = '';
    for (var w = 0; w < words.length; w++) {
      fullText += (w > 0 ? ' ' : '') + words[w];
      onChunk(words[w] + ' ', fullText);
      await new Promise(function(r) { setTimeout(r, 10); }); // Small delay for visual effect
    }
    onComplete(cachedResponse);
    return;
  }

  var apiMessages = messages.map(function(m) {
    return { role: m.role, content: m.content };
  });

  try {
    var fetchOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 8192,
        stream: true,
        system: systemPrompt
          ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
          : undefined,
        messages: apiMessages
      })
    };
    if (abortSignal) fetchOpts.signal = abortSignal;
    var response = await fetch('https://api.anthropic.com/v1/messages', fetchOpts);
    
    if (!response.ok) {
      var errorData = await response.json();
      throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
    }
    
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullText = '';
    var buffer = '';
    // v15.14: Track token usage from stream events
    var usageInputTokens = 0;
    var usageOutputTokens = 0;

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
          if (jsonStr === '[DONE]') continue;
          try {
            var data = JSON.parse(jsonStr);
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              fullText += data.delta.text;
              onChunk(data.delta.text, fullText);
            }
            // v15.14: Capture usage from message_start event
            if (data.type === 'message_start' && data.message && data.message.usage) {
              usageInputTokens = data.message.usage.input_tokens || 0;
            }
            // v15.14: Capture output tokens from message_delta event
            if (data.type === 'message_delta' && data.usage) {
              usageOutputTokens = data.usage.output_tokens || 0;
            }
          } catch (e) { /* skip invalid JSON */ }
        }
      }
    }

    // v12.0.3: Save to cache before completing
    setCachedResponse(messages, systemPrompt, fullText);
    // v15.14: Track API usage for analytics
    if (usageInputTokens > 0 || usageOutputTokens > 0) {
      trackAPIUsage('claude', model, usageInputTokens, usageOutputTokens, false, false);
    }
    onComplete(fullText);
  } catch (err) {
    // v16.4: Handle abort gracefully — return partial text
    if (err.name === 'AbortError') {
      console.log('[Chat Web] Anthropic stream aborted, returning partial text');
      onComplete(fullText || '');
      return;
    }
    console.error('[Chat Web] Anthropic streaming error:', err);
    onError(err.message || 'Unknown error');
  }
}

// v22.18: Migrated to OpenAI Responses API
function callOpenAIChat(model, apiKey, messages, systemPrompt, onSuccess, onError) {
  var actualModel = resolveOpenAIModel(model); // v22.19
  console.log('[Chat Web] OpenAI API call (Responses API), model:', actualModel, isOpenAIThinkingModel(model) ? '(thinking)' : '');

  var inputMessages = [];
  messages.forEach(function(m) {
    inputMessages.push({ role: m.role, content: m.content });
  });

  var requestBody = {
    model: actualModel,
    instructions: systemPrompt || undefined,
    input: inputMessages,
    max_output_tokens: 4096,
    store: false
  };
  // v22.19: Inject reasoning for thinking models
  if (isOpenAIThinkingModel(model)) {
    requestBody.reasoning = { effort: 'high', summary: 'auto' };
    requestBody.max_output_tokens = 16384;
  }

  fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(requestBody)
  })
  .then(function(response) {
    if (!response.ok) {
      return response.json().then(function(errorData) {
        throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
      });
    }
    return response.json();
  })
  .then(function(data) {
    // v22.18: Responses API format
    var content = data.output_text || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text);
    if (content) {
      try {
        var usg = data.usage || {};
        if (typeof trackAPIUsage === 'function') {
          trackAPIUsage('openai', model, usg.input_tokens || 0, usg.output_tokens || 0, false, false);
        }
      } catch(trackErr) { console.warn('[Analytics] Track error:', trackErr); }
      onSuccess(content);
    } else {
      onError('No content in response');
    }
  })
  .catch(function(err) {
    console.error('[Chat Web] OpenAI error:', err);
    onError(err.message);
  });
}

// v22.18: Migrated to OpenAI Responses API with streaming, web search, and reasoning support
async function callOpenAIStreaming(model, apiKey, messages, systemPrompt, onChunk, onComplete, onError, abortSignal) {
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12
  var actualModel = resolveOpenAIModel(model); // v22.19
  setLastModelUsed('openai', actualModel); // v23.5
  console.log('[Chat Web] OpenAI STREAMING call (Responses API), model:', actualModel, isOpenAIThinkingModel(model) ? '(thinking)' : '');

  // v12.0.3: Check cache first
  var cachedResponse = getCachedResponse(messages, systemPrompt);
  if (cachedResponse) {
    console.log('[Cache] Using cached response');
    trackAPIUsage('openai', model, 0, 0, true, false);
    var words = cachedResponse.split(' ');
    var fullText = '';
    for (var w = 0; w < words.length; w++) {
      fullText += (w > 0 ? ' ' : '') + words[w];
      onChunk(words[w] + ' ', fullText);
      await new Promise(function(r) { setTimeout(r, 10); });
    }
    onComplete(cachedResponse);
    return;
  }

  // v22.19: Show thinking progress for thinking models and wrap callbacks
  // v22.22: Skip progress bars for multimodal (image) conversations
  var _hasMultimodal = messages.some(function(m) { return Array.isArray(m.content); });
  var _thinkingShown = false;
  if (isOpenAIThinkingModel(model) && !_hasMultimodal) {
    showThinkingProgress();
    _thinkingShown = true;
    var _origOnChunk = onChunk;
    var _firstChunk = true;
    onChunk = function(chunk, full) {
      if (_firstChunk) { _firstChunk = false; hideThinkingProgress(); _thinkingShown = false; }
      _origOnChunk(chunk, full);
    };
    var _origOnComplete = onComplete;
    onComplete = function(text) {
      if (_thinkingShown) hideThinkingProgress();
      _origOnComplete(text);
    };
    var _origOnError = onError;
    onError = function(msg) {
      if (_thinkingShown) hideThinkingProgress();
      _origOnError(msg);
    };
  }

  // v22.18: Build input array for Responses API
  var inputMessages = [];
  messages.forEach(function(m) {
    // v20.1: Convert Anthropic multimodal format to OpenAI Responses API format
    var msgContent = m.content;
    if (Array.isArray(msgContent)) {
      var convertedParts = [];
      for (var pi = 0; pi < msgContent.length; pi++) {
        var part = msgContent[pi];
        if (part.type === 'image' && part.source) {
          convertedParts.push({ type: 'input_image', image_url: 'data:' + part.source.media_type + ';base64,' + part.source.data });
        } else if (part.type === 'text') {
          convertedParts.push({ type: 'input_text', text: part.text });
        } else {
          convertedParts.push(part);
        }
      }
      msgContent = convertedParts;
    }
    inputMessages.push({ role: m.role, content: msgContent });
  });

  try {
    // v22.18: Build Responses API request body
    var requestBody = {
      model: actualModel,
      instructions: systemPrompt || undefined,
      input: inputMessages,
      max_output_tokens: 4096,
      stream: true,
      store: false
    };

    // v22.19: Inject reasoning for thinking models
    if (isOpenAIThinkingModel(model)) {
      requestBody.reasoning = { effort: 'high', summary: 'auto' };
      requestBody.max_output_tokens = 16384;
    }

    // v22.18: Add web search tool for GPT-5.4 models
    if (model.indexOf('gpt-5.4') === 0) {
      requestBody.tools = [{ type: 'web_search_preview' }];
    }

    var fetchOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(requestBody)
    };
    if (abortSignal) fetchOpts.signal = abortSignal;
    var response = await fetch('https://api.openai.com/v1/responses', fetchOpts);

    if (!response.ok) {
      var errorData = await response.json();
      throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullText = '';
    var buffer = '';
    var oaiUsage = null;

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
          if (jsonStr === '[DONE]') continue;
          try {
            var data = JSON.parse(jsonStr);
            // v22.18: Responses API streaming - text deltas
            if (data.type === 'response.output_text.delta' && data.delta) {
              fullText += data.delta;
              onChunk(data.delta, fullText);
            }
            // v22.19: Skip reasoning events silently (thinking model emits these before text)
            // v22.18: Capture usage from response.completed event
            if (data.type === 'response.completed' && data.response && data.response.usage) {
              oaiUsage = data.response.usage;
            }
          } catch (e) { /* skip invalid JSON */ }
        }
      }
    }

    // v12.0.3: Save to cache before completing
    setCachedResponse(messages, systemPrompt, fullText);
    // v22.18: Track API usage (Responses API uses input_tokens/output_tokens)
    if (oaiUsage) {
      trackAPIUsage('openai', model, oaiUsage.input_tokens || 0, oaiUsage.output_tokens || 0, false, false);
    } else {
      var estInput = Math.ceil((systemPrompt || '').length / 4) + messages.reduce(function(sum, m) { return sum + Math.ceil((typeof m.content === 'string' ? m.content : '').length / 4); }, 0);
      var estOutput = Math.ceil(fullText.length / 4);
      trackAPIUsage('openai', model, estInput, estOutput, false, false);
    }
    onComplete(fullText);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[Chat Web] OpenAI stream aborted, returning partial text');
      onComplete(fullText || '');
      return;
    }
    console.error('[Chat Web] OpenAI streaming error:', err);
    onError(err.message);
  }
}

function callGoogleChat(model, apiKey, messages, systemPrompt, onSuccess, onError) {
  console.log('[Chat Web] Google API call, model:', model);
  
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  
  // Build conversation text
  var fullPrompt = systemPrompt + '\n\n';
  messages.forEach(function(m) {
    fullPrompt += (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content + '\n\n';
  });
  
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { maxOutputTokens: 4096 }
    })
  })
  .then(function(response) {
    if (!response.ok) {
      return response.json().then(function(errorData) {
        throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
      });
    }
    return response.json();
  })
  .then(function(data) {
    var content = data.candidates && data.candidates[0] && data.candidates[0].content &&
                  data.candidates[0].content.parts ? extractGeminiResponseText(data.candidates[0].content.parts) : '';
    if (content) {
      // v15.15: Track API usage for analytics (non-streaming callback path)
      try {
        var usg = data.usageMetadata || {};
        if (typeof trackAPIUsage === 'function') {
          trackAPIUsage('google', model, usg.promptTokenCount || 0, usg.candidatesTokenCount || 0, false, false);
        }
      } catch(trackErr) { console.warn('[Analytics] Track error:', trackErr); }
      onSuccess(content);
    } else {
      onError('No content in response');
    }
  })
  .catch(function(err) {
    console.error('[Chat Web] Google error:', err);
    onError(err.message);
  });
}

// v8.0: Streaming API call for Google Gemini
// v12.0.3: Added response caching support
async function callGoogleStreaming(model, apiKey, messages, systemPrompt, onChunk, onComplete, onError, abortSignal) {
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12
  setLastModelUsed('google', model); // v23.5
  console.log('[Chat Web] Google STREAMING call, model:', model);

  // v12.0.3: Check cache first
  var cachedResponse = getCachedResponse(messages, systemPrompt);
  if (cachedResponse) {
    console.log('[Cache] Using cached response');
    // v18.4: Track cache hit for analytics
    trackAPIUsage('google', model, 0, 0, true, false);
    var words = cachedResponse.split(' ');
    var fullText = '';
    for (var w = 0; w < words.length; w++) {
      fullText += (w > 0 ? ' ' : '') + words[w];
      onChunk(words[w] + ' ', fullText);
      await new Promise(function(r) { setTimeout(r, 10); });
    }
    onComplete(cachedResponse);
    return;
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + apiKey;

  // v24.25: Build structured contents array (required for context caching)
  var geminiContents = _buildGeminiContents(messages);

  // v24.25: Try Gemini context caching — cache system prompt + all messages except last user message
  var cacheEntry = null;
  var requestBody = {};
  if (messages.length >= 3 && _geminiSupportsCaching(model)) {
    // Split: cache everything before the last user message, send only the last message
    var lastUserIdx = -1;
    for (var mi = messages.length - 1; mi >= 0; mi--) {
      if (messages[mi].role === 'user') { lastUserIdx = mi; break; }
    }
    if (lastUserIdx > 0) {
      var messagesToCache = messages.slice(0, lastUserIdx);
      cacheEntry = await _getOrCreateGeminiCache(model, apiKey, systemPrompt, messagesToCache);
    }
  }

  if (cacheEntry) {
    // Use cached context — only send the new message(s)
    var newMessages = messages.slice(messages.length - 1);
    requestBody = {
      cachedContent: cacheEntry.name,
      contents: _buildGeminiContents(newMessages),
      generationConfig: { maxOutputTokens: 16384 }
    };
    if (ROWEOS_DEBUG) console.log('[GeminiCache] Using cache:', cacheEntry.name, 'cached tokens:', cacheEntry.tokenCount);
  } else {
    // No cache — send full contents with systemInstruction
    requestBody = {
      contents: geminiContents,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: { maxOutputTokens: 16384 }
    };
  }

  try {
    var fetchOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    };
    if (abortSignal) fetchOpts.signal = abortSignal;
    var response = await fetch(url, fetchOpts);

    if (!response.ok) {
      var errorData = await response.json();
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
            // v15.14: Track usage from final chunk, v24.25: track cached tokens
            if (data.usageMetadata) {
              var gemInputTokens = data.usageMetadata.promptTokenCount || 0;
              var gemOutputTokens = data.usageMetadata.candidatesTokenCount || 0;
              var gemCachedTokens = data.usageMetadata.cachedContentTokenCount || 0;
              if (gemInputTokens > 0 || gemOutputTokens > 0) {
                var webSearchUsed = localStorage.getItem('roweos_gemini_web_search') === 'true';
                trackAPIUsage('gemini', model, gemInputTokens, gemOutputTokens, gemCachedTokens > 0, webSearchUsed);
                if (gemCachedTokens > 0 && ROWEOS_DEBUG) {
                  console.log('[GeminiCache] Cached tokens used:', gemCachedTokens, '/ total input:', gemInputTokens, '(saved ~' + Math.round(gemCachedTokens * 0.9 / gemInputTokens * 100) + '%)');
                }
              }
            }
          } catch (e) { /* skip invalid JSON */ }
        }
      }
    }

    // v12.0.3: Save to cache before completing
    setCachedResponse(messages, systemPrompt, fullText);
    // v25.0: If no text was received, report as error instead of silent empty
    if (!fullText || !fullText.trim()) {
      onError('No response received from Google AI. The model may be temporarily overloaded or the request was filtered. Try again.');
    } else {
      onComplete(fullText);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[Chat Web] Google stream aborted, returning partial text');
      onComplete(fullText || '');
      return;
    }
    console.error('[Chat Web] Google streaming error:', err);
    if (err instanceof TypeError && err.message.indexOf('Failed to fetch') !== -1) {
      onError('API connection failed. Check your internet connection and try again.');
    } else {
      onError(err.message);
    }
  }
}

function handleChatSuccess(response, brand, btnId, btn) {
  console.log('[Chat Web] Success, response length:', response.length);
  
  // Add assistant response to conversation
  currentConversation.push({ role: 'assistant', content: response });
  
  // Show conversation UI
  showConversationView();
  renderConversation();
  
  // Scroll to show the latest message
  setTimeout(function() {
    var conversationThread = document.getElementById('conversationThread');
    if (conversationThread) {
      conversationThread.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, 100);
  
  // Save to history only on first message
  if (currentConversation.length === 2) {
    // v10.5.25: Include mode and life profile info
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    var lifeProfile = currentMode === 'life' && typeof getCurrentLifeProfile === 'function' ? getCurrentLifeProfile() : null;
    
    var commandRecord = {
      id: Date.now(),
      brand: brand.name,
      mode: currentMode,
      lifeName: lifeProfile ? lifeProfile.name : null,
      command: currentConversation[0].content,
      conversation: JSON.parse(JSON.stringify(currentConversation)),
      time: new Date().toLocaleString()
    };
    agentCommands.push(commandRecord);
    saveRuns();
    renderAgentHistory();
    
    // v9.1.14: Generate AI title in background
    generateConversationTitle(currentConversation, brand, commandRecord.id);
  } else {
    // v10.5.25: Update the CORRECT conversation entry
    var targetCmd = null;
    if (window._continuedHistoryIndex !== null && window._continuedHistoryIndex !== undefined && agentCommands[window._continuedHistoryIndex]) {
      targetCmd = agentCommands[window._continuedHistoryIndex];
    } else {
      targetCmd = agentCommands[agentCommands.length - 1];
    }
    if (targetCmd) {
      targetCmd.conversation = JSON.parse(JSON.stringify(currentConversation));
      saveRuns();
    }
  }
  
  if (btnId === 'agentRunBtn') {
    document.getElementById('agentCommand').value = '';
  } else {
    var _fc = document.getElementById('followupCommand');
    _fc.value = '';
    autoResizeTextarea(_fc); // v10.5.25: Reset height
  }
  
  btn.disabled = false;
  btn.classList.remove('sending');
  setAgentStatus('ready');
  
  
}

// v9.1.14: AI-generated conversation title
async function generateConversationTitle(conversation, brand, commandId) {
  try {
    var provider = brand.provider || 'anthropic';
    // v28.8: Resolve 'roweos'/'auto' smart routing to actual provider/model
    if (provider === 'roweos') {
      var _resolved = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: 'title generation' }) : null;
      if (_resolved) { provider = _resolved.provider; }
      else { provider = 'anthropic'; }
    }
    var apiKey = await getApiKey(provider);

    if (!apiKey) {
      console.log('[Title Gen] No API key, using fallback title');
      return;
    }
    
    // v20.1: Handle multimodal content (array) — use displayContent fallback
    var userMsg = (conversation[0].displayContent || (typeof conversation[0].content === 'string' ? conversation[0].content : '[Image]')).substring(0, 200);
    var aiMsg = (conversation[1].displayContent || (typeof conversation[1].content === 'string' ? conversation[1].content : '')).substring(0, 300);
    
    var titlePrompt = 'Generate a brief title (3-6 words max) for this conversation. Return ONLY the title, no quotes, no punctuation at end, no explanation.\n\nUser: ' + userMsg + '\n\nAssistant: ' + aiMsg;
    
    console.log('[Title Gen] Generating title for conversation', commandId);
    
    if (provider === 'anthropic') {
      var response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 30,
          messages: [{ role: 'user', content: titlePrompt }]
        })
      });
      
      if (response.ok) {
        var data = await response.json();
        var title = data.content && data.content[0] && data.content[0].text;
        if (title) {
          title = title.trim().replace(/^["']|["']$/g, '').substring(0, 50);
          updateConversationTitle(commandId, title);
        }
      }
    } else if (provider === 'openai') {
      var response = await fetch('https://api.openai.com/v1/responses', { // v22.18: Responses API
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'gpt-5.4',
          input: [{ role: 'user', content: titlePrompt }],
          max_output_tokens: 30,
          store: false
        })
      });

      if (response.ok) {
        var data = await response.json();
        var title = data.output_text; // v22.18: Responses API format
        if (title) {
          title = title.trim().replace(/^["']|["']$/g, '').substring(0, 50);
          updateConversationTitle(commandId, title);
        }
      }
    } else if (provider === 'google') {
      var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: titlePrompt }] }],
          generationConfig: { maxOutputTokens: 30 }
        })
      });
      
      if (response.ok) {
        var data = await response.json();
        var title = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts ? extractGeminiResponseText(data.candidates[0].content.parts) : '';
        if (title) {
          title = title.trim().replace(/^["']|["']$/g, '').substring(0, 50);
          updateConversationTitle(commandId, title);
        }
      }
    }
  } catch (err) {
    console.log('[Title Gen] Error generating title:', err.message);
  }
}

function updateConversationTitle(commandId, title) {
  console.log('[Title Gen] ✓ Generated title:', title);
  
  // Update the command record
  var cmd = agentCommands.find(function(c) { return c.id === commandId; });
  if (cmd) {
    cmd.title = title;
    saveRuns();
    renderAgentHistory();
  }
  
  // Update displayed title if this is the current conversation
  var titleEl = document.getElementById('conversationTitleText');
  if (titleEl && agentCommands.length > 0 && agentCommands[agentCommands.length - 1].id === commandId) {
    titleEl.textContent = title;
  }
}

function handleChatError(error, btnId, btn) {
  console.error('[Chat Web] Error:', error);
  
  // Provide more helpful error messages
  var errorMsg = error;
  if (error.includes('Load failed') || error.includes('Failed to fetch') || error.includes('NetworkError')) {
    errorMsg = 'API connection failed. Check your internet connection and try again. If this persists, the API may be temporarily unavailable.';
  } else if (error.includes('401') || error.includes('Unauthorized')) {
    errorMsg = 'Invalid API key. Please check your API key in Settings.';
  } else if (error.includes('429') || error.includes('rate')) {
    errorMsg = 'Rate limited. Please wait a moment and try again.';
  } else if (error.includes('500') || error.includes('503')) {
    errorMsg = 'API server error. Please try again later.';
  }
  
  showToast(errorMsg, 'error');
  btn.disabled = false;
  btn.classList.remove('sending');
  // v15.38: Re-enable both send buttons on error
  var allBtns = ['agentRunBtn', 'followupBtn'];
  allBtns.forEach(function(id) {
    var b = document.getElementById(id);
    if (b) { b.disabled = false; b.classList.remove('sending'); }
  });
  setAgentStatus('ready');
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW QUEUE (v9.1.14)
// ═══════════════════════════════════════════════════════════════════════════

var workflowQueue = [];

function addToWorkflowQueue() {
  if (!selectedOp) {
    showToast('Select an operation first', 'warning');
    return;
  }
  
  // Check if already in queue
  if (workflowQueue.find(function(item) { return item.op.id === selectedOp.id; })) {
    showToast('Operation already in queue', 'info');
    return;
  }
  
  // Add to queue with current context
  var _ctxEl = document.getElementById('studioContext'); var context = _ctxEl ? _ctxEl.value.trim() : '';
  workflowQueue.push({
    op: selectedOp,
    context: context,
    params: currentParamValues[selectedOp.id] || {}
  });
  
  renderWorkflowQueue();
  showToast(selectedOp.name + ' added to workflow', 'success');
}

// v13.9: Schedule selected operation - now redirects to Automations Lab
function scheduleSelectedOperation() {
  if (!selectedOp) {
    showToast('Select an operation first', 'warning');
    return;
  }

  // v13.9: Navigate to Automations Lab and pre-fill workflow
  showView('automations');
  setTimeout(function() {
    showAutoLabTab('workflows');
    setTimeout(function() {
      showAutoLabWorkflowForm();
      setTimeout(function() {
        var nameEl = document.getElementById('autoLabWfName');
        if (nameEl) nameEl.value = selectedOp.name;
        var actionEl = document.getElementById('autoLabWfAction');
        if (actionEl) {
          actionEl.value = 'studio';
          renderAutoLabTargetConfig('studio');
          setTimeout(function() {
            var agentEl = document.getElementById('autoLabWfTargetAgent');
            if (agentEl && typeof currentAgent !== 'undefined' && currentAgent) agentEl.value = currentAgent;
            updateAutoLabWfOperations(currentAgent || 'all');
            setTimeout(function() {
              var opEl = document.getElementById('autoLabWfTargetOp');
              if (opEl) opEl.value = String(selectedOp.id);
            }, 50);
          }, 50);
        }
      }, 100);
    }, 50);
  }, 100);
  showToast('Configure your scheduled operation', 'info');
}

function renderWorkflowQueue() {
  var container = document.getElementById('workflowQueue');
  var itemsContainer = document.getElementById('workflowQueueItems');
  var queueBtn = document.getElementById('queueBtn');
  
  if (!container || !itemsContainer) return;
  
  if (workflowQueue.length === 0) {
    container.style.display = 'none';
    if (queueBtn) queueBtn.classList.remove('has-items');
    return;
  }
  
  container.style.display = 'block';
  if (queueBtn) queueBtn.classList.add('has-items');
  
  itemsContainer.innerHTML = '';
  workflowQueue.forEach(function(item, idx) {
    var div = document.createElement('div');
    div.className = 'workflow-queue-item';
    div.innerHTML = 
      '<span class="workflow-queue-item-num">' + (idx + 1) + '</span>' +
      '<span class="workflow-queue-item-name">' + item.op.name + '</span>' +
      '<span class="workflow-queue-item-remove" onclick="removeFromWorkflowQueue(' + idx + ')">×</span>';
    itemsContainer.appendChild(div);
  });
}

function removeFromWorkflowQueue(idx) {
  workflowQueue.splice(idx, 1);
  renderWorkflowQueue();
}

function clearWorkflowQueue() {
  workflowQueue = [];
  renderWorkflowQueue();
  showToast('Workflow cleared', 'info');
}

async function runWorkflow() {
  if (workflowQueue.length === 0) {
    showToast('Workflow queue is empty', 'warning');
    return;
  }
  
  showToast('Running workflow with ' + workflowQueue.length + ' operations...', 'info');
  
  var outputContent = document.getElementById('studioOutputContent');
  
  if (outputContent) {
    outputContent.innerHTML = '<div class="studio-output-workflow-progress"><div class="workflow-progress-title">Workflow Running...</div><div id="workflowProgressSteps"></div></div>';
  }
  
  var previousOutput = '';
  var allOutputs = [];
  var brandIdx = studioSelectedBrand;
  var brand = brands[brandIdx] || brands[0];
  
  for (var i = 0; i < workflowQueue.length; i++) {
    var item = workflowQueue[i];
    
    // Update progress UI
    updateWorkflowProgress(i);
    
    // Build context with previous output if available
    var context = item.context || '';
    if (previousOutput && i > 0) {
      context = 'Previous operation output:\n---\n' + previousOutput.substring(0, 2000) + '\n---\n\n' + context;
    }
    
    try {
      // Make direct API call for this operation
      var result = await executeWorkflowOperation(item.op, brand, context, item.params);
      previousOutput = result;
      allOutputs.push({
        name: item.op.name,
        output: result
      });
      
      // Show incremental results
      updateWorkflowResults(allOutputs, i + 1 < workflowQueue.length);
      
    } catch (err) {
      showToast('Error in ' + item.op.name + ': ' + err.message, 'error');
      allOutputs.push({
        name: item.op.name,
        output: 'Error: ' + err.message,
        error: true
      });
      break;
    }
  }
  
  // Clear queue
  workflowQueue = [];
  renderWorkflowQueue();
  showToast('Workflow completed!', 'success');
}

function updateWorkflowProgress(currentIdx) {
  var progressSteps = document.getElementById('workflowProgressSteps');
  if (!progressSteps) return;
  
  progressSteps.innerHTML = '';
  workflowQueue.forEach(function(wItem, wIdx) {
    var stepClass = wIdx < currentIdx ? 'completed' : (wIdx === currentIdx ? 'active' : 'pending');
    progressSteps.innerHTML += '<div class="workflow-step ' + stepClass + '">' +
      '<span class="workflow-step-num">' + (wIdx + 1) + '</span>' +
      '<span class="workflow-step-name">' + wItem.op.name + '</span>' +
      (wIdx < currentIdx ? ' ✓' : (wIdx === currentIdx ? ' ...' : '')) +
      '</div>';
  });
}

function updateWorkflowResults(allOutputs, stillRunning) {
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent || allOutputs.length === 0) return;
  
  var html = '<div class="studio-output-workflow-results">';
  html += '<div class="workflow-results-title">' + (stillRunning ? 'Workflow Progress...' : 'Workflow Complete ✓') + '</div>';
  
  allOutputs.forEach(function(result, idx) {
    html += '<div class="workflow-result-section' + (result.error ? ' error' : '') + '">';
    html += '<div class="workflow-result-header">' + (idx + 1) + '. ' + result.name + (result.error ? ' ❌' : ' ✓') + '</div>';
    html += '<div class="workflow-result-content">' + (result.error ? result.output : markdownToHtml(result.output)) + '</div>';
    html += '</div>';
  });
  
  if (stillRunning) {
    html += '<div class="workflow-running-indicator">Running next operation...</div>';
  }
  
  html += '</div>';
  outputContent.innerHTML = html;
}

async function executeWorkflowOperation(op, brand, context, params) {
  // Build prompt for this operation
  var aiPrompt = 'You are creating content for ' + brand.name + '.\n\n';
  aiPrompt += 'BRAND CONTEXT:\n';
  aiPrompt += '- Tagline: ' + (brand.tagline || '') + '\n';
  aiPrompt += '- Voice: ' + (brand.voice || '') + '\n';
  aiPrompt += '- Products: ' + (brand.products || brand.positioning || '') + '\n';
  aiPrompt += '- Audience: ' + (brand.audience || '') + '\n\n';
  
  aiPrompt += 'TASK: ' + op.name + '\n';
  aiPrompt += 'Description: ' + op.desc + '\n';
  aiPrompt += 'DELIVERABLES:\n';
  if (op.outputs) {
    op.outputs.forEach(function(o) { aiPrompt += '• ' + o + '\n'; });
  }
  aiPrompt += '\n';
  
  // Add parameters if any
  if (params && Object.keys(params).length > 0 && op.params) {
    aiPrompt += 'PARAMETERS:\n';
    op.params.forEach(function(param) {
      var val = params[param.id];
      if (val !== undefined && val !== '') {
        if (Array.isArray(val)) {
          aiPrompt += '- ' + param.label + ': ' + val.join(', ') + '\n';
        } else {
          aiPrompt += '- ' + param.label + ': ' + val + '\n';
        }
      }
    });
    aiPrompt += '\n';
  }
  
  if (context) {
    aiPrompt += 'ADDITIONAL CONTEXT:\n' + context + '\n\n';
  }
  
  aiPrompt += 'Create polished, on-brand content. OUTPUT ONLY THE FINAL CONTENT.';
  
  // Get API settings
  var settings = brandSettings[studioSelectedBrand] || {};
  var provider = settings.provider || 'anthropic';
  var model = settings.model || 'claude-sonnet-4-6';
  // v28.8: Resolve 'roweos'/'auto' smart routing to actual provider/model
  if (model === 'auto' || provider === 'roweos') {
    var _resolved = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: aiPrompt.substring(0, 200) }) : null;
    if (_resolved) { provider = _resolved.provider; model = _resolved.model; }
    else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
  }
  var apiKey = await getApiKey(provider); // v24.27: was missing await — passed Promise as key

  if (!apiKey) {
    throw new Error('No API key configured for ' + provider);
  }
  
  // Make API call
  var systemPrompt = 'You are an expert content creator and brand strategist. Create professional, engaging content that aligns perfectly with the brand voice.';
  
  return await makeWorkflowAPICall(provider, model, apiKey, systemPrompt, aiPrompt);
}

async function makeWorkflowAPICall(provider, model, apiKey, systemPrompt, userPrompt) {
  var url, headers, body;
  
  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    body = JSON.stringify({
      model: model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/responses'; // v22.18: Responses API
    headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    body = JSON.stringify({
      model: model,
      instructions: systemPrompt,
      max_output_tokens: 4000,
      input: [{ role: 'user', content: userPrompt }],
      store: false
    });
  } else {
    throw new Error('Unsupported provider: ' + provider);
  }
  
  var response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: body
  });
  
  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('API error: ' + response.status + ' - ' + errorText.substring(0, 200));
  }
  
  var data = await response.json();
  
  if (provider === 'anthropic') {
    return data.content[0].text;
  } else if (provider === 'openai') {
    return data.output_text || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text) || ''; // v22.18: Responses API
  }

  return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART CONTEXT PRE-FILL (v9.1.14)
// ═══════════════════════════════════════════════════════════════════════════

function smartPreFillContext() {
  var contextEl = document.getElementById('studioContext');
  if (!contextEl) return;
  
  // Get current brand
  var brand = brands[studioSelectedBrand] || {};
  var settings = brandSettings[studioSelectedBrand] || {};
  
  // Build smart context based on brand identity
  var contextParts = [];
  
  // Brand basics
  if (brand.name) {
    contextParts.push('Brand: ' + brand.name);
  }
  
  // Voice & Tone
  if (settings.voice) {
    contextParts.push('Voice/Tone: ' + settings.voice);
  }
  
  // Target Audience
  if (settings.audience) {
    contextParts.push('Target Audience: ' + settings.audience);
  }
  
  // Brand Values
  if (settings.values) {
    contextParts.push('Brand Values: ' + settings.values);
  }
  
  // Products/Services
  if (settings.products) {
    contextParts.push('Products/Services: ' + settings.products);
  }
  
  // Differentiators
  if (settings.differentiators) {
    contextParts.push('Key Differentiators: ' + settings.differentiators);
  }
  
  // Industry
  if (settings.industry) {
    contextParts.push('Industry: ' + settings.industry);
  }
  
  // Add operation-specific context hints
  if (selectedOp) {
    var opHints = getOperationContextHints(selectedOp);
    if (opHints) {
      contextParts.push('');
      contextParts.push('--- Operation Notes ---');
      contextParts.push(opHints);
    }
  }
  
  // Check if context already has content
  if (contextEl.value.trim()) {
    // Append to existing
    contextEl.value = contextEl.value.trim() + '\n\n--- Brand Context ---\n' + contextParts.join('\n');
  } else {
    // Fresh fill
    contextEl.value = contextParts.join('\n');
  }
  
  showToast('Context filled with brand data', 'success');
}

// Get operation-specific context hints
function getOperationContextHints(op) {
  var category = op.category || 'marketing';
  var hints = {
    'marketing': 'Consider: campaign goals, key messages, call-to-action, platform requirements',
    'strategic': 'Consider: business objectives, competitive landscape, success metrics',
    'operations': 'Consider: process requirements, stakeholders, timeline, dependencies',
    'documents': 'Consider: document purpose, audience, required sections, tone',
    'research': 'Consider: research questions, data sources, analysis framework',
    'platform': 'Consider: feature requirements, user workflows, technical constraints'
  };
  return hints[category] || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// v9.1.15: Image Provider Selection & Nanobanana Integration
// ═══════════════════════════════════════════════════════════════════════════

var selectedImageProvider = localStorage.getItem('imageProvider') || 'openai';

// v9.1.16: Track reference image for image-to-image generation
var imageReferenceData = null; // { base64, mimeType, filename }

function selectImageProvider(provider) {
  selectedImageProvider = provider;
  localStorage.setItem('imageProvider', provider);
  
  // Update button active states
  document.querySelectorAll('.image-provider-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });
  
  // Show/hide provider-specific settings
  var dalleSettings = document.getElementById('dalleSettings');
  var geminiSettings = document.getElementById('geminiSettings');
  var nanobananaModelSettings = document.getElementById('nanobananaModelSettings');
  var imageRefSection = document.getElementById('imageReferenceSection');

  if (dalleSettings) dalleSettings.style.display = provider === 'openai' ? 'flex' : 'none';
  if (geminiSettings) geminiSettings.style.display = (provider === 'gemini' || provider === 'nanobanana') ? 'flex' : 'none';
  // v13.9: Show Nanobanana model selector and reference image for Nanobanana
  if (nanobananaModelSettings) nanobananaModelSettings.style.display = provider === 'nanobanana' ? 'flex' : 'none';
  if (imageRefSection) imageRefSection.style.display = (provider === 'gemini' || provider === 'nanobanana') ? 'block' : 'none';
  
  console.log('[Image Provider] Selected:', provider);
}

function showImageProviderSelector(show) {
  var selector = document.getElementById('imageProviderSelector');
  var modelControlsRow = document.getElementById('studioModelControlsRow');
  
  if (!selector) return;
  
  if (show) {
    selector.classList.add('visible');
    // v10.5.25: Hide model controls when showing image provider (they're not relevant)
    if (modelControlsRow) modelControlsRow.style.display = 'none';
    // Initialize with saved provider when showing
    selectImageProvider(selectedImageProvider);
  } else {
    selector.classList.remove('visible');
    // v10.5.25: Show model controls when hiding image provider
    if (modelControlsRow) modelControlsRow.style.display = '';
    // Clear reference image when hiding
    clearImageReference();
  }
}

// v9.1.16: Handle image reference upload
function handleImageReferenceUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }
  
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64Full = e.target.result;
    var base64Data = base64Full.split(',')[1];
    
    imageReferenceData = {
      base64: base64Data,
      mimeType: file.type,
      filename: file.name
    };
    
    // Show preview
    var preview = document.getElementById('imageReferencePreview');
    var previewContainer = document.getElementById('imageReferencePreviewContainer');
    var emptyState = document.getElementById('imageReferenceEmpty');
    var dropzone = document.getElementById('imageReferenceDropzone');
    
    if (preview) preview.src = base64Full;
    if (previewContainer) previewContainer.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (dropzone) dropzone.classList.add('has-image');
    
    showToast('Reference image added', 'success');
    console.log('[Image Reference] Loaded:', file.name, file.type);
  };
  reader.readAsDataURL(file);
}

function clearImageReference() {
  imageReferenceData = null;
  
  var preview = document.getElementById('imageReferencePreview');
  var previewContainer = document.getElementById('imageReferencePreviewContainer');
  var emptyState = document.getElementById('imageReferenceEmpty');
  var dropzone = document.getElementById('imageReferenceDropzone');
  var input = document.getElementById('imageReferenceInput');
  
  if (preview) preview.src = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (emptyState) emptyState.style.display = 'block';
  if (dropzone) dropzone.classList.remove('has-image');
  if (input) input.value = '';
}

// v9.1.16: Setup drag and drop for reference image
function initImageReferenceDragDrop() {
  var dropzone = document.getElementById('imageReferenceDropzone');
  if (!dropzone) return;
  
  dropzone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--accent)';
    dropzone.style.background = 'rgba(168, 152, 120, 0.1)';
  });
  
  dropzone.addEventListener('dragleave', function(e) {
    e.preventDefault();
    if (!dropzone.classList.contains('has-image')) {
      dropzone.style.borderColor = '';
      dropzone.style.background = '';
    }
  });
  
  dropzone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropzone.style.borderColor = '';
    dropzone.style.background = '';
    
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      // Trigger the same handler
      var input = document.getElementById('imageReferenceInput');
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      handleImageReferenceUpload({ target: input });
    }
  });
}

// ============================================
// v10.5.25: STUDIO SUBJECT SELECTOR FUNCTIONS
// ============================================

var selectedStudioSubject = null;
var currentSubjectTab = 'inventory';

function showStudioSubjectSelector(show) {
  var selector = document.getElementById('studioSubjectSelector');
  if (!selector) return;
  selector.classList.toggle('visible', show);
  if (show) populateSubjectGrid(currentSubjectTab);
}

function showSubjectTab(tab) {
  currentSubjectTab = tab;
  document.querySelectorAll('.studio-subject-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  populateSubjectGrid(tab);
}

function populateSubjectGrid(tab) {
  var grid = document.getElementById('studioSubjectGrid');
  if (!grid) return;
  
  var items = [];
  if (tab === 'inventory') {
    items = (inventory.items || []).map(function(item) {
      return { id: item.id, name: item.name, type: item.type, imageData: item.imageData, source: 'inventory', description: item.description };
    });
  } else if (tab === 'library') {
    items = (libraryFiles || []).filter(function(f) {
      return f.type === 'image' || (f.mimeType && f.mimeType.startsWith('image/'));
    }).map(function(f) {
      return { id: f.id, name: f.name, type: 'image', imageData: f.imageData || f.content, source: 'library' };
    });
  }
  
  if (items.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-tertiary);font-size:12px;">' + (tab === 'inventory' ? 'No products/services yet' : 'No images in Library') + '</div>';
    return;
  }
  
  grid.innerHTML = items.map(function(item) {
    var isSelected = selectedStudioSubject && selectedStudioSubject.id === item.id;
    var imageHtml = item.imageData 
      ? '<img src="' + item.imageData + '" alt="">'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
    return '<div class="studio-subject-item' + (isSelected ? ' selected' : '') + '" onclick="selectStudioSubjectById(' + item.id + ',\'' + item.source + '\')">' +
      '<div class="studio-subject-item-image">' + imageHtml + '</div>' +
      '<div class="studio-subject-item-name">' + escapeHtml(item.name) + '</div>' +
    '</div>';
  }).join('');
}

function selectStudioSubjectById(id, source) {
  var item = null;
  if (source === 'inventory') {
    var found = (inventory.items || []).find(function(i) { return i.id == id; });
    if (found) item = { id: found.id, name: found.name, type: found.type, imageData: found.imageData, source: 'inventory', description: found.description };
  } else if (source === 'library') {
    var found = (libraryFiles || []).find(function(f) { return f.id == id; });
    if (found) item = { id: found.id, name: found.name, type: 'image', imageData: found.imageData || found.content, source: 'library' };
  }
  if (item) selectStudioSubject(item);
}

function selectStudioSubject(item) {
  selectedStudioSubject = item;
  
  var selectedDiv = document.getElementById('studioSubjectSelected');
  var selectedImage = document.getElementById('studioSubjectSelectedImage');
  var selectedName = document.getElementById('studioSubjectSelectedName');
  var selectedType = document.getElementById('studioSubjectSelectedType');
  
  if (selectedDiv) selectedDiv.classList.add('visible');
  if (selectedName) selectedName.textContent = item.name;
  if (selectedType) selectedType.textContent = item.type + ' • ' + item.source;
  if (selectedImage) {
    selectedImage.innerHTML = item.imageData 
      ? '<img src="' + item.imageData + '" alt="">'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
  }
  
  // Set reference image for image generation if applicable
  if (item.imageData && selectedImageProvider === 'gemini') {
    var base64 = item.imageData.includes(',') ? item.imageData.split(',')[1] : item.imageData;
    imageReferenceData = { base64: base64, mimeType: 'image/png', filename: item.name };
    var preview = document.getElementById('imageReferencePreview');
    var previewContainer = document.getElementById('imageReferencePreviewContainer');
    var emptyState = document.getElementById('imageReferenceEmpty');
    var dropzone = document.getElementById('imageReferenceDropzone');
    if (preview) preview.src = item.imageData;
    if (previewContainer) previewContainer.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (dropzone) dropzone.classList.add('has-image');
  }
  
  populateSubjectGrid(currentSubjectTab);
  showToast('Subject attached: ' + item.name, 'success');
}

function clearStudioSubject() {
  selectedStudioSubject = null;
  var selectedDiv = document.getElementById('studioSubjectSelected');
  if (selectedDiv) selectedDiv.classList.remove('visible');
  populateSubjectGrid(currentSubjectTab);
}

function getStudioSubjectContext() {
  if (!selectedStudioSubject) return '';
  var ctx = '\n\n[SUBJECT: ' + selectedStudioSubject.name + ' (' + selectedStudioSubject.type + ')]';
  if (selectedStudioSubject.description) ctx += '\n' + selectedStudioSubject.description;
  return ctx;
}

// v9.1.16: Gemini/Nanobanana Image Generation with Image-to-Image support
async function generateImageWithGemini(prompt, options = {}) {
  var apiKey = await getApiKey('google');
  if (!apiKey) {
    throw new Error('Google API key not configured. Please add your Gemini API key in Settings.');
  }
  
  var aspectRatio = options.aspectRatio || '1:1';
  // v13.9: Use gemini-3-pro-image-preview (Nanobanana 3.0 Pro)
  var model = 'gemini-3-pro-image-preview';
  
  console.log('[generateImageWithGemini] Calling Gemini Image API');
  console.log('[generateImageWithGemini] Model:', model);
  console.log('[generateImageWithGemini] Aspect Ratio:', aspectRatio);
  console.log('[generateImageWithGemini] Has Reference Image:', !!imageReferenceData);
  
  // Build content parts - text prompt first, then optional reference image
  var contentParts = [{ text: prompt }];
  
  // v9.1.16: Add reference image if provided (image-to-image generation)
  if (imageReferenceData && imageReferenceData.base64) {
    contentParts.push({
      inlineData: {
        mimeType: imageReferenceData.mimeType || 'image/png',
        data: imageReferenceData.base64
      }
    });
    console.log('[generateImageWithGemini] Added reference image:', imageReferenceData.filename);
  }
  
  var requestBody = {
    contents: [{
      parts: contentParts
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };
  
  var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    var errorData = await response.json().catch(function() { return {}; });
    var errorMsg = errorData.error?.message || response.statusText || 'Unknown error';
    console.error('[generateImageWithGemini] API Error:', errorMsg);
    
    // Provide helpful error messages
    if (errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Gemini API quota exceeded. Try again later or switch to GPT Image.');
    } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
      throw new Error('Gemini image model not available. Your API key may not have image generation access.');
    } else if (errorMsg.includes('permission') || errorMsg.includes('403')) {
      throw new Error('Gemini image generation not enabled for your API key. Check your Google AI Studio settings.');
    }
    throw new Error(errorMsg);
  }
  
  var data = await response.json();
  console.log('[generateImageWithGemini] Response:', data);
  
  // Extract image and text from response parts
  var images = [];
  var textResponse = '';
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    data.candidates[0].content.parts.forEach(function(part) {
      if (part.text) {
        textResponse += part.text;
      } else if (part.inlineData) {
        images.push({
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        });
      }
    });
  }
  
  if (images.length === 0) {
    // Check if there was a block reason
    if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'SAFETY') {
      throw new Error('Image generation was blocked by safety filters. Try a different prompt.');
    }
    throw new Error('No image was generated. Try a different prompt or check your API access.');
  }
  
  console.log('[generateImageWithGemini] Success, received', images.length, 'image(s)');

  // v15.4: Track Nanobanana image generation cost
  if (typeof trackAPIUsage === 'function') {
    for (var imgIdx = 0; imgIdx < images.length; imgIdx++) {
      trackAPIUsage('nanobanana', model, 0, 0, false, false, 'image');
    }
  }

  return {
    images: images,
    model: model,
    aspectRatio: aspectRatio,
    textResponse: textResponse,
    provider: 'gemini',
    hadReferenceImage: !!imageReferenceData
  };
}

// v25.4: Google Imagen 4 image generation
// v25.4: Upgraded from Imagen 4 (shut down) to Imagen 4
async function generateImageWithImagen3(prompt, aspectRatio) {
  var apiKey = '';
  try {
    apiKey = typeof getNanobananaKey === 'function' ? getNanobananaKey() : '';
  } catch(e) {}
  if (!apiKey) {
    return { success: false, error: 'No Google API key configured' };
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict';

  try {
    var resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio || '1:1'
        }
      })
    });
    var data = await resp.json();
    console.log('[Imagen4] Response keys:', Object.keys(data), 'ok:', resp.ok, 'status:', resp.status);
    if (!resp.ok) {
      console.error('[Imagen4] API error:', JSON.stringify(data).substring(0, 500));
      return { success: false, error: 'Imagen 4 error: ' + (data.error ? data.error.message : resp.status) };
    }
    // v25.4: Try multiple response formats (Vertex AI vs Generative Language API)
    var base64 = null;
    if (data.predictions && data.predictions.length > 0) {
      base64 = data.predictions[0].bytesBase64Encoded;
    } else if (data.generatedImages && data.generatedImages.length > 0) {
      base64 = data.generatedImages[0].image ? data.generatedImages[0].image.imageBytes : null;
    }
    console.log('[Imagen4] base64 found:', !!base64, base64 ? 'length:' + base64.length : 'null');
    if (base64) {
      return {
        success: true,
        images: [{ base64: base64, mimeType: 'image/png' }]
      };
    }
    return { success: false, error: 'No image returned' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// v10.5.25: Nanobanana Image Generation
// ═══════════════════════════════════════════════════════════════════════════════
// v10.5.25: NANOBANANA INTEGRATION (Text & Image)
// ═══════════════════════════════════════════════════════════════════════════════

// v10.5.25: Helper to get Nanobanana API key
// v24.11: Returns '' if image generation is disabled via toggle (key preserved in storage)
function getNanobananaKey() {
  if (localStorage.getItem('roweos_image_gen_disabled') === 'true') return '';
  var storedKeys = localStorage.getItem('roweos_api_keys');
  if (storedKeys) {
    try {
      var apiKeys = JSON.parse(storedKeys);
      // v25.4: Fall back to Google key if nanobanana key not set separately
      return apiKeys.nanobanana || apiKeys.google || '';
    } catch(e) { return ''; }
  }
  return '';
}

// v24.11: Check if raw key exists (ignores toggle - for settings display)
function hasNanobananaKeyStored() {
  try {
    var storedKeys = localStorage.getItem('roweos_api_keys');
    if (storedKeys) {
      var apiKeys = JSON.parse(storedKeys);
      return !!(apiKeys.nanobanana);
    }
  } catch(e) {}
  return false;
}

function isImageGenEnabled() {
  return localStorage.getItem('roweos_image_gen_disabled') !== 'true';
}

function toggleImageGen() {
  var disabled = localStorage.getItem('roweos_image_gen_disabled') === 'true';
  if (disabled) {
    localStorage.removeItem('roweos_image_gen_disabled');
    showToast('Image generation enabled', 'success');
  } else {
    localStorage.setItem('roweos_image_gen_disabled', 'true');
    showToast('Image generation disabled', 'info');
  }
  // Refresh modal UI if open
  var toggleBtn = document.getElementById('nanobananaToggleBtn');
  if (toggleBtn) updateNanobananaToggleUI(toggleBtn);
  // Update settings row status
  updateNanobananaSettingsStatus();
  // Update chat model dropdowns
  if (typeof updateNanobananaChatSections === 'function') updateNanobananaChatSections();
}

function deleteNanobananaKey() {
  if (!confirm('Remove your Nano Banana API key? This cannot be undone.')) return;
  try {
    var storedKeys = localStorage.getItem('roweos_api_keys');
    if (storedKeys) {
      var apiKeys = JSON.parse(storedKeys);
      delete apiKeys.nanobanana;
      localStorage.setItem('roweos_api_keys', JSON.stringify(apiKeys));
    }
  } catch(e) {}
  localStorage.removeItem('roweos_image_gen_disabled');
  showToast('Nano Banana API key removed', 'success');
  updateNanobananaSettingsStatus();
  if (typeof updateNanobananaChatSections === 'function') updateNanobananaChatSections();
  closeNanobananaKeyModal();
}

function updateNanobananaToggleUI(btn) {
  var enabled = isImageGenEnabled();
  btn.textContent = enabled ? 'Enabled' : 'Disabled';
  btn.style.background = enabled ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  btn.style.color = enabled ? '#4ade80' : '#ef4444';
  btn.style.borderColor = enabled ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)';
}

function updateNanobananaSettingsStatus() {
  var settingsStatus = document.getElementById('nanobananaKeyStatus');
  if (!settingsStatus) return;
  var hasKey = hasNanobananaKeyStored();
  var enabled = isImageGenEnabled();
  if (!hasKey) {
    settingsStatus.textContent = 'Gemini 3.0 for Chat, Studio, Image Lab & Deep Research';
  } else if (!enabled) {
    settingsStatus.textContent = 'Key configured - generation disabled';
  } else {
    settingsStatus.textContent = 'Configured';
  }
}

// v15.18: Image Lab Chat state
var _imageLabChatHistory = [];     // Gemini API format: [{role, parts}]
var _imageLabChatMessages = [];    // Display format: [{role, content, imageUrl, timestamp}]
var _imageLabChatModel = 'gemini-3-pro-image-preview';
var _imageLabChatSending = false;

// v15.7: Track active image conversation so follow-ups stay in image mode
var nanobananaImageActive = false;
// v15.10: Track last generated image for multi-turn editing
var _nanobananaLastImage = null; // { base64, mimeType }
var _nanobananaImageHistory = []; // Array of { role, parts } for multi-turn

// v15.7: Nanobanana Usage/Cost Tracker
var nanobananaUsage = [];

function loadNanobananaUsage() {
  try {
    var stored = localStorage.getItem('roweos_nanobanana_usage');
    if (stored) nanobananaUsage = JSON.parse(stored);
  } catch(e) { nanobananaUsage = []; }
}

function saveNanobananaUsage() {
  try {
    // Keep max 500 entries to prevent bloat
    if (nanobananaUsage.length > 500) {
      nanobananaUsage = nanobananaUsage.slice(-500);
    }
    localStorage.setItem('roweos_nanobanana_usage', JSON.stringify(nanobananaUsage));
  } catch(e) { console.warn('[Usage] Could not save usage data:', e); }
}

function trackNanobananaCall(model, type, inputChars, outputChars) {
  loadNanobananaUsage();
  var entry = {
    ts: new Date().toISOString(),
    model: model || 'unknown',
    type: type || 'text',
    inputChars: inputChars || 0,
    outputChars: outputChars || 0
  };
  nanobananaUsage.push(entry);
  saveNanobananaUsage();
}

function getNanobananaUsageStats() {
  loadNanobananaUsage();
  var now = new Date();
  var today = now.toISOString().split('T')[0];
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  var stats = {
    today: { calls: 0, inputChars: 0, outputChars: 0, byModel: {}, byType: { text: 0, image: 0, research: 0 } },
    week: { calls: 0, inputChars: 0, outputChars: 0, byModel: {}, byType: { text: 0, image: 0, research: 0 } },
    month: { calls: 0, inputChars: 0, outputChars: 0, byModel: {}, byType: { text: 0, image: 0, research: 0 } },
    all: { calls: 0, inputChars: 0, outputChars: 0, byModel: {}, byType: { text: 0, image: 0, research: 0 } }
  };

  for (var i = 0; i < nanobananaUsage.length; i++) {
    var e = nanobananaUsage[i];
    var eDate = new Date(e.ts);
    var eDay = e.ts.split('T')[0];
    var periods = ['all'];
    if (eDay === today) periods.push('today');
    if (eDate >= weekAgo) periods.push('week');
    if (eDate >= monthAgo) periods.push('month');

    for (var p = 0; p < periods.length; p++) {
      var s = stats[periods[p]];
      s.calls++;
      s.inputChars += (e.inputChars || 0);
      s.outputChars += (e.outputChars || 0);
      s.byModel[e.model] = (s.byModel[e.model] || 0) + 1;
      if (e.type && s.byType.hasOwnProperty(e.type)) {
        s.byType[e.type]++;
      }
    }
  }
  return stats;
}

// v13.9: Detect image requests for Nanobanana image models in chat
function isNanobananaImageRequest(model, userMessage) {
  if (!model || !userMessage) return false;
  // Only for image-capable models
  var imageModels = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-2.0-flash-exp-image-generation'];
  if (imageModels.indexOf(model) === -1) return false;
  // v15.7: If we're in an active image conversation, keep routing to image handler
  if (nanobananaImageActive) return true;
  var msg = userMessage.toLowerCase();
  // v16.2: Require BOTH an action verb AND an image noun to avoid false positives
  // e.g. "create a business plan" should NOT trigger image gen
  var actionWords = ['generate', 'create', 'draw', 'make', 'design', 'render', 'paint', 'sketch', 'visualize'];
  var imageNouns = ['image', 'picture', 'photo', 'illustration', 'logo', 'icon', 'banner', 'poster', 'artwork'];
  var hasAction = false;
  var hasImageNoun = false;
  for (var i = 0; i < actionWords.length; i++) {
    if (msg.indexOf(actionWords[i]) !== -1) { hasAction = true; break; }
  }
  for (var j = 0; j < imageNouns.length; j++) {
    if (msg.indexOf(imageNouns[j]) !== -1) { hasImageNoun = true; break; }
  }
  return hasAction && hasImageNoun;
}

// v13.9: Handle Nanobanana image generation in chat, rendering result inline
async function handleNanobananaChatImage(model, userMessage, onChunk, onComplete, onError) {
  try {
    onChunk('Generating image...', 'Generating image...');

    // v15.10: Build options with multi-turn history for follow-up editing
    var opts = { model: model };
    if (nanobananaImageActive && _nanobananaImageHistory.length > 0) {
      opts.imageHistory = _nanobananaImageHistory;
      console.log('[ChatImage] Multi-turn edit with', _nanobananaImageHistory.length, 'history turns');
    }

    // v15.23: Extract image references from attached files
    if (typeof currentAgentFiles !== 'undefined' && currentAgentFiles.length > 0) {
      var chatRefImages = [];
      for (var cfi = 0; cfi < currentAgentFiles.length; cfi++) {
        var af = currentAgentFiles[cfi];
        if (af.type && af.type.indexOf('image/') === 0 && af.content && af.status === 'ready') {
          var afParts = af.content.split(',');
          var afBase64 = afParts.length > 1 ? afParts[1] : afParts[0];
          var afMime = af.type || 'image/png';
          chatRefImages.push({ base64: afBase64, mimeType: afMime, name: af.name });
        }
      }
      if (chatRefImages.length > 0) {
        opts.referenceImages = chatRefImages;
        console.log('[ChatImage] Using', chatRefImages.length, 'attached image(s) as references');
      }
    }

    var result = await generateImageWithNanobanana(userMessage, opts);
    var dataUrl = '';
    if (result && result.images && result.images.length > 0 && result.images[0].base64) {
      dataUrl = 'data:' + (result.images[0].mimeType || 'image/png') + ';base64,' + result.images[0].base64;
    } else if (result && result.imageData) {
      dataUrl = result.imageData;
    }
    if (dataUrl) {
      // v15.7: Mark conversation as image-active for follow-up routing
      nanobananaImageActive = true;

      // v15.23: Track image history with ref images in user turn
      var chatUserParts = [];
      if (opts.referenceImages && opts.referenceImages.length > 0) {
        for (var cui = 0; cui < opts.referenceImages.length; cui++) {
          var cu = opts.referenceImages[cui];
          if (cu && cu.base64) chatUserParts.push({ inlineData: { mimeType: cu.mimeType || 'image/png', data: cu.base64 } });
        }
      }
      chatUserParts.push({ text: userMessage });
      _nanobananaImageHistory.push({ role: 'user', parts: chatUserParts });
      // v15.18: Use raw model parts (includes thought_signature for Gemini multi-turn)
      if (result.rawModelParts && result.rawModelParts.length > 0) {
        _nanobananaImageHistory.push({ role: 'model', parts: result.rawModelParts });
      } else if (result.images && result.images[0]) {
        var imgParts = [];
        if (result.text) imgParts.push({ text: result.text });
        imgParts.push({ inlineData: { mimeType: result.images[0].mimeType || 'image/png', data: result.images[0].base64 } });
        _nanobananaImageHistory.push({ role: 'model', parts: imgParts });
      }
      if (result.images && result.images[0]) {
        _nanobananaLastImage = { base64: result.images[0].base64, mimeType: result.images[0].mimeType || 'image/png' };
      }

      // v15.3: Store image separately to prevent conversation bloat
      var imageId = 'chatimg_' + Date.now();
      try { localStorage.setItem(imageId, dataUrl); } catch(e) { console.warn('[ChatImage] Could not cache image:', e); }
      // v15.22: Store last image URL for conversation history persistence
      window._lastChatImageUrl = dataUrl;
      var responseText = '![Generated Image](' + dataUrl + ')\n\n*Image generated with ' + model + '*';
      // v15.18: Limit model commentary to prevent wall of text after image gen
      if (result && result.text && typeof result.text === 'string') {
        var imgText = result.text.trim();
        // Skip if it looks like raw JSON or is excessively long
        if (imgText.length > 0 && imgText.length <= 500 && imgText.charAt(0) !== '{' && imgText.charAt(0) !== '[') {
          responseText = imgText + '\n\n' + responseText;
        } else if (imgText.length > 500) {
          responseText = imgText.substring(0, 300) + '...\n\n' + responseText;
        }
      }
      onComplete(responseText);
    } else {
      // v15.7: Text-only response means image mode ended
      nanobananaImageActive = false;
      _nanobananaLastImage = null;
      _nanobananaImageHistory = [];
      // v15.3: Model returned text only — display it gracefully instead of erroring
      var textResult = (result && result.text) ? result.text : 'Image generation completed but no image was returned. Try a more specific prompt.';
      onComplete(textResult);
    }
  } catch(err) {
    onError(err.message || 'Image generation failed');
  }
}

// ─── v13.9: DEEP RESEARCH (Gemini 3.1 Pro) ────────────────────────────

/**
 * v13.9: Start a Deep Research interaction via Gemini Interactions API
 */
async function startDeepResearch(query) {
  // v15.13: Use Google API key (not Nanobanana key) for Deep Research Interactions API
  var apiKey = await getApiKey('google');
  if (!apiKey) {
    showToast('Google Gemini API key required for Deep Research. Configure in Settings.', 'error');
    throw new Error('No API key');
  }
  // v22.10: Use x-goog-api-key header (matching official docs) instead of ?key= query param
  var url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  var response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      input: query,
      agent: 'deep-research-pro-preview-12-2025',
      background: true
    })
  });
  if (!response.ok) {
    var errData = await response.json().catch(function() { return {}; });
    throw new Error('Deep Research error: ' + (errData.error ? errData.error.message : 'HTTP ' + response.status));
  }
  var data = await response.json();
  // v22.10: Log full initial response for debugging
  console.log('[RoweOS] Deep Research started:', JSON.stringify({ id: data.id, name: data.name, status: data.status, hasOutputs: !!(data.outputs && data.outputs.length) }).substring(0, 300));
  // v15.7: Track deep research usage
  trackNanobananaCall('deep-research-pro', 'research', query.length, 0);
  return data;
}

/**
 * v13.9: Poll Deep Research interaction until completed or failed
 */
function pollDeepResearch(interactionId, onProgress, onComplete, onError, apiKey) {
  // v15.13: API key passed from caller (fetched via getApiKey('google'))
  if (!apiKey) { onError('No Google API key for Deep Research'); return; }
  var startTime = Date.now();
  var consecutiveErrors = 0;
  var maxConsecutiveErrors = 5; // v22.9: Tolerate transient network failures (device sleep, etc.)
  var pollInterval = setInterval(function() {
    var elapsed = Math.round((Date.now() - startTime) / 1000);
    // v24.18: Safety timeout 15 minutes (reduced from 30m - if not done by now, likely stuck)
    if (elapsed > 900) {
      clearInterval(pollInterval);
      onError('Deep Research timed out after 15 minutes. Try a more specific query or retry.');
      return;
    }
    // v22.10: Use x-goog-api-key header (matching official docs)
    fetch('https://generativelanguage.googleapis.com/v1beta/interactions/' + interactionId, { headers: { 'x-goog-api-key': apiKey } })
      .then(function(r) {
        // v22.10: Check HTTP status - don't silently loop on API errors
        if (!r.ok) {
          return r.text().then(function(body) {
            throw new Error('API HTTP ' + r.status + ': ' + body.substring(0, 200));
          });
        }
        return r.json();
      })
      .then(function(data) {
        consecutiveErrors = 0;
        // v24.18: Robust status detection - Google LRO uses done:bool, status may be nested
        var status = 'unknown';
        if (data.status) {
          status = data.status.toLowerCase();
        } else if (data.metadata && data.metadata.status) {
          status = data.metadata.status.toLowerCase();
        } else if (data.response && data.response.status) {
          status = data.response.status.toLowerCase();
        } else if (data.done === true) {
          status = 'completed';
        } else if (data.done === false) {
          status = 'in_progress';
        }
        // v24.18: Normalize Google-style statuses
        if (status === 'state_completed' || status === 'succeeded') status = 'completed';
        if (status === 'state_failed') status = 'failed';
        if (status === 'state_cancelled') status = 'cancelled';
        if (status === 'running' || status === 'state_running' || status === 'state_pending' || status === 'pending' || status === 'in_progress') status = 'in_progress';
        console.log('[RoweOS] Deep Research poll: status=' + status + ', elapsed=' + elapsed + 's, done=' + data.done + ', id=' + interactionId.substring(0, 30) + '...');
        if (onProgress) onProgress(status, elapsed);
        if (status === 'completed') {
          clearInterval(pollInterval);
          // v24.18: Extract text from multiple possible response formats
          var text = '';
          // Format 1: data.outputs[].text (original)
          if (data.outputs && data.outputs.length > 0) {
            data.outputs.forEach(function(o) {
              if (o.text) { text += o.text + '\n\n'; }
              else if (o.content && o.content.parts) {
                o.content.parts.forEach(function(p) { if (p.text) text += p.text + '\n\n'; });
              }
            });
          }
          // Format 2: data.response.outputs (Google LRO wrapper)
          if (!text && data.response && data.response.outputs && data.response.outputs.length > 0) {
            data.response.outputs.forEach(function(o) {
              if (o.text) { text += o.text + '\n\n'; }
              else if (o.content && o.content.parts) {
                o.content.parts.forEach(function(p) { if (p.text) text += p.text + '\n\n'; });
              }
            });
          }
          // Format 3: data.output.text (singular)
          if (!text && data.output && data.output.text) {
            text = data.output.text;
          }
          // Format 4: data.response.output.text
          if (!text && data.response && data.response.output && data.response.output.text) {
            text = data.response.output.text;
          }
          // Format 5: data.result.text or data.response.text
          if (!text && data.result && data.result.text) {
            text = data.result.text;
          }
          if (!text && data.response && typeof data.response.text === 'string') {
            text = data.response.text;
          }
          console.log('[RoweOS] Deep Research completed in ' + elapsed + 's, output length: ' + text.length);
          if (!text) {
            console.warn('[RoweOS] Deep Research completed but no text extracted. Full response keys:', Object.keys(data), data.response ? 'response keys: ' + Object.keys(data.response) : '');
          }
          onComplete(text.trim(), data);
        } else if (status === 'failed' || status === 'cancelled' || status === 'incomplete') {
          // v22.10: Handle all terminal failure statuses
          clearInterval(pollInterval);
          var errMsg = data.error ? (typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error)) : 'Status: ' + status;
          console.error('[RoweOS] Deep Research terminal status: ' + status, data);
          onError('Deep Research ' + status + ': ' + errMsg);
        } else if (status === 'requires_action') {
          // v22.10: requires_action is not recoverable in our context
          clearInterval(pollInterval);
          console.error('[RoweOS] Deep Research requires_action (unsupported)', data);
          onError('Deep Research requires action (unsupported agent state)');
        } else if (status === 'in_progress') {
          // v24.18: Known in-progress state - don't log as unknown
          if (ROWEOS_DEBUG) console.log('[RoweOS] Deep Research in progress, elapsed=' + elapsed + 's');
        } else if (status === 'unknown') {
          // v22.10: Unknown status — log full response for debugging
          console.warn('[RoweOS] Deep Research unknown status, full response:', JSON.stringify(data).substring(0, 500));
        }
      })
      .catch(function(err) {
        consecutiveErrors++;
        console.warn('[RoweOS] Deep Research poll error (' + consecutiveErrors + '/' + maxConsecutiveErrors + '):', err.message || err);
        if (consecutiveErrors >= maxConsecutiveErrors) {
          clearInterval(pollInterval);
          onError('Deep Research failed: ' + (err.message || 'Lost connection after ' + maxConsecutiveErrors + ' retries'));
        }
      });
  }, 10000); // Poll every 10 seconds
  return pollInterval;
}

/**
 * v13.9: Render a Deep Research result card in chat
 */
function renderDeepResearchCard(result, elapsed) {
  var html = '<div class="deep-research-card" style="border:1px solid rgba(168,139,250,0.3);border-radius:12px;padding:20px;margin:8px 0;background:linear-gradient(135deg,rgba(168,139,250,0.05),rgba(212,175,55,0.05));">';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
  html += '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a78bfa" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>';
  html += '<span style="font-weight:600;color:#a78bfa;">Deep Research Report</span>';
  if (elapsed) html += '<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">Completed in ' + elapsed + 's</span>';
  html += '</div>';
  var rendered = result;
  if (typeof marked !== 'undefined' && marked.parse) {
    try { rendered = marked.parse(result); } catch(e) { rendered = result.replace(/\n/g, '<br>'); }
  }
  html += '<div style="font-size:14px;line-height:1.6;color:var(--text-primary);">' + rendered + '</div>';
  // v16.6: Export action bar
  html += '<div class="chat-msg-actions" style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(168,139,250,0.15);display:flex;gap:8px;flex-wrap:wrap;">';
  html += '<button onclick="exportChatMsg(this,\'copy\')" style="padding:5px 12px;border-radius:6px;border:1px solid var(--border-primary);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;">Copy</button>';
  html += '<button onclick="exportChatMsg(this,\'pdf\')" style="padding:5px 12px;border-radius:6px;border:1px solid var(--border-primary);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;">PDF</button>';
  html += '<button onclick="exportChatMsg(this,\'docx\')" style="padding:5px 12px;border-radius:6px;border:1px solid var(--border-primary);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;">Word</button>';
  html += '<button onclick="exportChatMsg(this,\'xlsx\')" style="padding:5px 12px;border-radius:6px;border:1px solid var(--border-primary);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;">Excel</button>';
  html += '</div>';
  html += '</div>';
  return html;
}

// v22.10: Run deep research with auto-retry on immediate cancellation (Google capacity issues)
// Returns Promise resolving with { text, elapsed } or rejecting with error string
function runDeepResearchFull(query, onProgress, maxRetries) {
  maxRetries = maxRetries || 3;
  var attempt = 0;
  var overallStart = Date.now();

  function attemptResearch(resolve, reject) {
    attempt++;
    if (attempt > 1) {
      showToast('Deep Research at capacity, retrying... (attempt ' + attempt + '/' + maxRetries + ')', 'info');
      console.log('[RoweOS] Deep Research retry attempt ' + attempt + '/' + maxRetries);
    }
    startDeepResearch(query).then(function(data) {
      var interactionId = data.id || data.interactionId || (data.name && data.name.indexOf('/') !== -1 ? data.name.split('/').pop() : data.name);
      // Synchronous result
      if (!interactionId && data.outputs && data.outputs.length > 0) {
        var text = data.outputs.map(function(o) { return o.text || ''; }).join('\n\n');
        var elapsed = Math.round((Date.now() - overallStart) / 1000);
        resolve({ text: text.trim(), elapsed: elapsed });
        return;
      }
      if (!interactionId) {
        reject('No interaction ID returned from Deep Research');
        return;
      }
      return getApiKey('google').then(function(apiKey) {
        pollDeepResearch(interactionId, onProgress, function(text, rawData) {
          var elapsed = Math.round((Date.now() - overallStart) / 1000);
          resolve({ text: text, elapsed: elapsed });
        }, function(error) {
          // Auto-retry if cancelled quickly
          if (error && error.toLowerCase().indexOf('cancelled') !== -1 && attempt < maxRetries) {
            var delay = 3000 + (attempt * 2000);
            setTimeout(function() { attemptResearch(resolve, reject); }, delay);
          } else {
            reject(error);
          }
        }, apiKey);
      });
    }).catch(function(err) {
      reject(err.message || 'Deep Research failed to start');
    });
  }

  return new Promise(function(resolve, reject) {
    attemptResearch(resolve, reject);
  });
}

// v13.9: Deep Research state (v16.6: removed duplicate toggleDeepResearch — single definition at line ~82927)
window._deepResearchActive = false;

/**
 * v13.9: Handle Deep Research in chat send flow
 */
async function handleDeepResearchChat(query, onComplete, onError) {
  try {
    var googleKey = await getApiKey('google');
    if (!googleKey) {
      onError('Google Gemini API key required for Deep Research. Configure in Settings.');
      return;
    }
    // v16.7: Enrich query with brand/mode context for better relevance
    var enrichedQuery = query;
    try {
      var contextParts = [];
      if (currentMode === 'brand' && brands && brands.length > 0) {
        var bi = selectedBrand || 0;
        var b = brands[bi];
        if (b) {
          var bName = b.shortName || b.name;
          contextParts.push('Business context: ' + bName + (b.tagline ? ' - ' + b.tagline : '') + (b.industry ? ' (Industry: ' + b.industry + ')' : ''));
          if (b.location) contextParts.push('Location: ' + b.location);
        }
      } else if (currentMode === 'life') {
        var lp = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
        var lpIdx = typeof currentLifeProfileIndex !== 'undefined' ? currentLifeProfileIndex : 0;
        if (lp[lpIdx] && lp[lpIdx].name) {
          contextParts.push('Personal context for: ' + lp[lpIdx].name);
        }
      }
      if (contextParts.length > 0) {
        enrichedQuery = contextParts.join('. ') + '.\n\nResearch request: ' + query;
      }
    } catch(ce) {}
    // v22.10: Use runDeepResearchFull with auto-retry + progress UI
    runDeepResearchFull(enrichedQuery, function(status, elapsed) {
      var streamContent = document.getElementById('streamingContent');
      if (streamContent) {
        var retryInfo = status === 'cancelled' ? ' (retrying...)' : '';
        streamContent.innerHTML = '<div class="deep-research-card" style="border:1px solid rgba(168,139,250,0.3);border-radius:12px;padding:20px;background:linear-gradient(135deg,rgba(168,139,250,0.08),rgba(212,175,55,0.05));animation:pulse 2s ease infinite;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a78bfa" stroke-width="2" style="animation:spin 2s linear infinite;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
          '<span style="font-weight:600;color:#a78bfa;">Deep Research in progress...' + retryInfo + '</span>' +
          '<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">' + elapsed + 's' + (status && status !== 'unknown' ? ' (' + status + ')' : '') + '</span>' +
          '</div></div>';
      }
    }, 3).then(function(result) {
      onComplete(renderDeepResearchCard(result.text, result.elapsed));
    }).catch(function(err) {
      // v22.10: Show error with manual retry button
      var errMsg = typeof err === 'string' ? err : (err.message || 'Deep Research failed');
      var retryHtml = '<div style="border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin:8px 0;background:rgba(239,68,68,0.05);">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        '<span style="color:#ef4444;font-weight:500;font-size:13px;">' + escapeHtml(errMsg) + '</span></div>' +
        '<button onclick="this.parentElement.remove();handleDeepResearchChat(\'' + escapeHtml(query).replace(/'/g, "\\'") + '\', arguments[0] || function(){}, arguments[1] || function(){})" ' +
        'style="padding:6px 16px;border-radius:8px;border:1px solid rgba(168,139,250,0.4);background:rgba(168,139,250,0.1);color:#a78bfa;font-size:12px;cursor:pointer;font-weight:500;">Try Again</button></div>';
      onError(retryHtml);
    });
  } catch(err) {
    onError(err.message || 'Deep Research failed');
  }
}

// v14.3: Deep Research progress indicator functions
var _deepResearchTimerInterval = null;

function showDeepResearchProgress() {
  // v25.1: Removed overly aggressive multimodal guard that blocked all conversations with images
  // v16.8: Progress now above textarea (deepResearchProgressAbove)
  var el = document.getElementById('deepResearchProgressAbove');
  if (el) el.style.display = 'flex';
  var startTime = Date.now();
  if (_deepResearchTimerInterval) clearInterval(_deepResearchTimerInterval);
  _deepResearchTimerInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timerEl = document.getElementById('deepResearchTimerAbove');
    if (timerEl) timerEl.textContent = 'Researching... ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }, 1000);
}

function hideDeepResearchProgress() {
  var el = document.getElementById('deepResearchProgressAbove');
  if (el) el.style.display = 'none';
  if (_deepResearchTimerInterval) {
    clearInterval(_deepResearchTimerInterval);
    _deepResearchTimerInterval = null;
  }
  var timerEl = document.getElementById('deepResearchTimerAbove');
  if (timerEl) timerEl.textContent = 'Researching... 0:00';
}

// v22.19: GPT-5.4 Thinking progress indicator
var _thinkingTimerInterval = null;

function showThinkingProgress() {
  // v25.1: Removed overly aggressive multimodal guard that blocked all conversations with images
  var el = document.getElementById('thinkingProgressAbove');
  if (el) el.style.display = 'flex';
  var startTime = Date.now();
  if (_thinkingTimerInterval) clearInterval(_thinkingTimerInterval);
  _thinkingTimerInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timerEl = document.getElementById('thinkingTimer');
    if (timerEl) timerEl.textContent = 'Thinking... ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }, 1000);
}

function hideThinkingProgress() {
  var el = document.getElementById('thinkingProgressAbove');
  if (el) el.style.display = 'none';
  if (_thinkingTimerInterval) {
    clearInterval(_thinkingTimerInterval);
    _thinkingTimerInterval = null;
  }
  var timerEl = document.getElementById('thinkingTimer');
  if (timerEl) timerEl.textContent = 'Thinking... 0:00';
}

// ─── END DEEP RESEARCH ──────────────────────────────────────────────────
