// ─────────────────────────────────────────────────────────────────────
// v23.9: Address Book tab in Clients view + Add Client from contact
// ─────────────────────────────────────────────────────────────────────

var _clientsActiveTab = localStorage.getItem('roweos_clients_active_tab') || 'pipeline';
function switchClientsTab(tab) {
  _clientsActiveTab = tab;
  try { localStorage.setItem('roweos_clients_active_tab', tab); } catch(e) {}
  var pipelineTab = document.getElementById('clientsPipelineTab');
  var listTab = document.getElementById('clientsListTab');
  var abTab = document.getElementById('clientsAddressBookTab');
  var pipelineBtn = document.getElementById('clientsTabPipeline');
  var listBtn = document.getElementById('clientsTabList');
  var abBtn = document.getElementById('clientsTabAddressBook');
  var detailPanel = document.getElementById('clientDetailPanel');
  // Hide all tabs
  if (pipelineTab) pipelineTab.style.display = 'none';
  if (listTab) listTab.style.display = 'none';
  if (abTab) abTab.style.display = 'none';
  if (detailPanel) detailPanel.style.display = 'none';
  // Reset all buttons
  var allBtns = [pipelineBtn, listBtn, abBtn];
  allBtns.forEach(function(btn) { if (btn) { btn.style.borderBottomColor = 'transparent'; btn.style.color = 'var(--text-muted)'; } });
  // Show selected
  if (tab === 'addressbook') {
    if (abTab) abTab.style.display = 'block';
    if (abBtn) { abBtn.style.borderBottomColor = 'var(--accent)'; abBtn.style.color = 'var(--text-primary)'; }
    renderClientsAddressBook();
  } else if (tab === 'list') {
    if (listTab) listTab.style.display = 'block';
    if (listBtn) { listBtn.style.borderBottomColor = 'var(--accent)'; listBtn.style.color = 'var(--text-primary)'; }
    renderClientsList();
  } else {
    if (pipelineTab) pipelineTab.style.display = 'block';
    if (pipelineBtn) { pipelineBtn.style.borderBottomColor = 'var(--accent)'; pipelineBtn.style.color = 'var(--text-primary)'; }
    renderClientsView();
  }
}

// v24.24: Drag-and-drop reorder for client tabs
function initClientsTabDrag() {
  var bar = document.getElementById('clientsTabBar');
  if (!bar) return;
  // Apply saved order
  try {
    var order = JSON.parse(localStorage.getItem('roweos_clients_tab_order') || '[]');
    if (order.length === 3) {
      order.forEach(function(tabId) {
        var btn = bar.querySelector('[data-client-tab="' + tabId + '"]');
        if (btn) bar.appendChild(btn);
      });
    }
  } catch(e) {}
  var dragBtn = null;
  bar.addEventListener('dragstart', function(e) {
    dragBtn = e.target.closest('[data-client-tab]');
    if (dragBtn) e.dataTransfer.effectAllowed = 'move';
  });
  bar.addEventListener('dragover', function(e) {
    e.preventDefault();
    var target = e.target.closest('[data-client-tab]');
    if (target && dragBtn && target !== dragBtn) {
      var rect = target.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) {
        bar.insertBefore(dragBtn, target);
      } else {
        bar.insertBefore(dragBtn, target.nextSibling);
      }
    }
  });
  bar.addEventListener('dragend', function() {
    dragBtn = null;
    var btns = bar.querySelectorAll('[data-client-tab]');
    var order = [];
    for (var i = 0; i < btns.length; i++) order.push(btns[i].dataset.clientTab);
    try { localStorage.setItem('roweos_clients_tab_order', JSON.stringify(order)); } catch(e) {}
  });
}

// v23.10: Clients List tab — flat alphabetical/sortable list
function renderClientsList() {
  var container = document.getElementById('clientsListContainer');
  if (!container) return;
  var allClients = getClientsForBrand();
  // Search
  var searchTerm = (document.getElementById('clientsListSearch') || {}).value || '';
  if (searchTerm) {
    var term = searchTerm.toLowerCase();
    allClients = allClients.filter(function(c) {
      return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
             (c.company && c.company.toLowerCase().indexOf(term) !== -1) ||
             (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
             (c.role && c.role.toLowerCase().indexOf(term) !== -1);
    });
  }
  // Sort
  var sortVal = (document.getElementById('clientsListSort') || {}).value || 'alpha';
  allClients = allClients.slice().sort(function(a, b) {
    if (sortVal === 'alpha_desc') return (b.name || '').localeCompare(a.name || '');
    if (sortVal === 'stage') {
      var stageOrder = { lead: 0, prospect: 1, proposal: 2, active: 3, retained: 4, archived: 5 };
      var diff = (stageOrder[a.stage] || 0) - (stageOrder[b.stage] || 0);
      return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
    }
    if (sortVal === 'category') return (a.category || '').localeCompare(b.category || '');
    if (sortVal === 'priority') {
      var pOrder = { high: 0, medium: 1, low: 2 };
      return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
    }
    if (sortVal === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return (a.name || '').localeCompare(b.name || '');
  });
  if (allClients.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">' + (searchTerm ? 'No clients match your search' : 'No clients yet') + '</div>';
    return;
  }
  // Group header logic for stage/category sorts
  var showGroupHeaders = (sortVal === 'stage' || sortVal === 'category');
  var lastGroup = '';
  var html = '<div style="display:flex;flex-direction:column;gap:4px;">';
  // v24.9: Pinned "Me" contact card at top
  if (!searchTerm && typeof getUserContact === 'function') {
    var _meContact = getUserContact();
    if (_meContact.name || _meContact.email) {
      var _meInit = (_meContact.name || 'Me').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
      html += '<div class="client-row" onclick="showView(\'memory\')" style="padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--accent,#a89878);border-radius:var(--radius-md);cursor:pointer;opacity:0.85;">';
      html += '<div style="width:32px;height:32px;border-radius:var(--radius-sm);background:var(--accent,#a89878);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;font-size:var(--text-xs);">' + _meInit + '</div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(_meContact.name || 'Me') + '</div>';
      var _meSub = [];
      if (_meContact.title) _meSub.push(escapeHtml(_meContact.title));
      if (_meContact.company) _meSub.push(escapeHtml(_meContact.company));
      if (_meContact.email) _meSub.push(escapeHtml(_meContact.email));
      if (_meSub.length > 0) html += '<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _meSub.join(' &middot; ') + '</div>';
      html += '</div>';
      html += '<span style="font-size:10px;color:var(--accent,#a89878);padding:2px 6px;border:1px solid var(--accent,#a89878);border-radius:4px;">Me</span>';
      html += '</div>';
    }
  }
  allClients.forEach(function(c) {
    // Group headers
    if (showGroupHeaders) {
      var groupKey = sortVal === 'stage' ? (c.stage || 'lead') : (c.category || '');
      var groupLabel = sortVal === 'stage' ? (typeof getStageLabel === 'function' ? getStageLabel(groupKey) : groupKey) : (typeof getCategoryLabel === 'function' ? getCategoryLabel(groupKey) : groupKey);
      var groupColor = sortVal === 'stage' ? (typeof getStageColor === 'function' ? getStageColor(groupKey) : 'var(--text-muted)') : (typeof getCategoryColor === 'function' ? getCategoryColor(groupKey) : 'var(--text-muted)');
      if (groupKey !== lastGroup) {
        lastGroup = groupKey;
        html += '<div style="padding:8px 12px;margin-top:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:' + groupColor + ';">' + escapeHtml(groupLabel || 'Uncategorized') + '</div>';
      }
    }
    var initials = (c.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    var stageColor = typeof getStageColor === 'function' ? getStageColor(c.stage || 'lead') : '#94a3b8';
    var stageLabel = typeof getStageLabel === 'function' ? getStageLabel(c.stage || 'lead') : '';
    html += '<div class="client-row" onclick="openClientDetail(\'' + c.id + '\')" style="padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);cursor:pointer;">';
    // Avatar
    if (c.logo) {
      html += '<img src="' + c.logo + '" style="width:32px;height:32px;border-radius:var(--radius-sm);object-fit:contain;flex-shrink:0;" alt="">';
    } else {
      html += '<div style="width:32px;height:32px;border-radius:var(--radius-sm);background:' + stageColor + '18;color:' + stageColor + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;font-size:var(--text-xs);">' + initials + '</div>';
    }
    // Name + subtitle
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(c.name) + '</div>';
    var sub = [];
    if (c.role) sub.push(escapeHtml(c.role));
    if (c.company) sub.push(escapeHtml(c.company));
    if (c.email) sub.push(escapeHtml(c.email));
    if (sub.length > 0) html += '<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sub.join(' &middot; ') + '</div>';
    html += '</div>';
    // Stage badge
    html += '<span style="font-size:10px;color:' + stageColor + ';padding:2px 6px;border:1px solid ' + stageColor + '30;border-radius:4px;white-space:nowrap;">' + stageLabel + '</span>';
    // Priority
    if (c.priority && c.priority !== 'low') {
      html += '<span class="client-priority-dot client-priority-' + c.priority + '" title="' + (c.priority === 'high' ? 'High' : 'Medium') + ' priority"></span>';
    }
    // Chevron
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

var _abFilterMode = 'all';
function setAbFilter(mode) {
  _abFilterMode = mode;
  var chips = ['abFilterAll','abFilterClients','abFilterRecent','abFilterBook'];
  chips.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.remove('active'); });
  var activeEl = document.getElementById('abFilter' + mode.charAt(0).toUpperCase() + mode.slice(1));
  if (activeEl) activeEl.classList.add('active');
  renderClientsAddressBook();
}
function renderClientsAddressBook() {
  var container = document.getElementById('clientsAbList');
  if (!container) return;
  var contacts = mailGetAllContacts();
  // v24.9: Filter by mode
  if (_abFilterMode === 'clients') {
    contacts = contacts.filter(function(c) { return c.source === 'Client' || c.source === 'Team' || c.source === 'Report' || c.category === 'owner'; }); // v25.3: Include all person types
  } else if (_abFilterMode === 'recent') {
    var thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    contacts = contacts.filter(function(c) {
      return c.source === 'Previous' || (c.lastContacted && new Date(c.lastContacted).getTime() > thirtyDaysAgo);
    });
  } else if (_abFilterMode === 'book') {
    contacts = contacts.filter(function(c) { return c.source === 'Address Book'; });
  }
  var searchTerm = (document.getElementById('clientsAbSearch') || {}).value || '';
  if (searchTerm) {
    var term = searchTerm.toLowerCase();
    contacts = contacts.filter(function(c) {
      return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
             (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
             (c.company && c.company.toLowerCase().indexOf(term) !== -1);
    });
  }
  if (contacts.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">No contacts found</div>';
    return;
  }
  // Check which emails are already clients + build client ID lookup
  var clientByEmail = {};
  try { getClients().forEach(function(c) { if (c.email) clientByEmail[c.email.toLowerCase()] = c.id; }); } catch(e) {}
  var html = '<div style="display:flex;flex-direction:column;gap:6px;">';
  contacts.forEach(function(c) {
    var initials = (c.name || c.email.split('@')[0]).split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    var clientId = clientByEmail[c.email.toLowerCase()];
    var isClient = !!clientId;
    // v23.10: Clicking a contact opens client detail (if client) or add-client modal
    var clickAction = isClient ? 'openClientDetail(\'' + clientId + '\')' : 'addClientFromContact(\'' + escapeHtml(c.email.replace(/'/g, "\\'")) + '\', \'' + escapeHtml((c.name || '').replace(/'/g, "\\'")) + '\', \'' + escapeHtml((c.company || '').replace(/'/g, "\\'")) + '\')';
    html += '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);cursor:pointer;flex-wrap:wrap;" onclick="' + clickAction + '">';
    html += '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);color:#000;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">' + initials + '</div>';
    html += '<div style="flex:1;min-width:120px;">';
    html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(c.name || c.email.split('@')[0]) + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(c.email) + '</div>';
    if (c.company) html += '<div style="font-size:10px;color:var(--text-muted);opacity:0.7;">' + escapeHtml(c.company) + '</div>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">';
    html += '<span style="font-size:10px;color:var(--text-muted);padding:2px 6px;border:1px solid var(--border-color);border-radius:4px;white-space:nowrap;">' + c.source + '</span>';
    if (isClient) {
      html += '<span style="font-size:10px;color:#4ade80;padding:2px 6px;border:1px solid rgba(74,222,128,0.3);border-radius:4px;white-space:nowrap;">Client</span>';
    } else {
      html += '<button onclick="event.stopPropagation();addClientFromContact(\'' + escapeHtml(c.email.replace(/'/g, "\\'")) + '\', \'' + escapeHtml((c.name || '').replace(/'/g, "\\'")) + '\', \'' + escapeHtml((c.company || '').replace(/'/g, "\\'")) + '\')" style="padding:4px 10px;font-size:11px;border:1px solid var(--accent);background:none;color:var(--accent);border-radius:var(--radius-md);cursor:pointer;white-space:nowrap;font-weight:600;">+ Client</button>';
    }
    // v23.10: Remove button for Address Book AND Previous (recents) contacts
    if (c.source === 'Address Book') {
      html += '<button onclick="event.stopPropagation();mailRemoveContact(\'' + escapeHtml(c.email) + '\');renderClientsAddressBook();" style="border:none;background:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Remove"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
    } else if (c.source === 'Previous') {
      html += '<button onclick="event.stopPropagation();mailRemoveRecent(\'' + escapeHtml(c.email) + '\');renderClientsAddressBook();" style="border:none;background:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Remove recent"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
    }
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function clientsAbAddContact() {
  var nameEl = document.getElementById('clientsAbNewName');
  var emailEl = document.getElementById('clientsAbNewEmail');
  var companyEl = document.getElementById('clientsAbNewCompany');
  var name = nameEl ? nameEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  var company = companyEl ? companyEl.value.trim() : '';
  if (!email || email.indexOf('@') === -1) { showToast('Valid email required', 'error'); return; }
  var book = getMailAddressBook();
  var exists = book.some(function(c) { return c.email.toLowerCase() === email.toLowerCase(); });
  if (exists) { showToast('Contact already exists', 'warning'); return; }
  book.push({ name: name, email: email, company: company, createdAt: new Date().toISOString() });
  saveMailAddressBook(book);
  if (nameEl) nameEl.value = '';
  if (emailEl) emailEl.value = '';
  if (companyEl) companyEl.value = '';
  renderClientsAddressBook();
  showToast('Contact added', 'success');
}

// v23.10: Derive a proper name from an email username (marcus.thorne -> Marcus Thorne)
function deriveNameFromEmail(email) {
  if (!email) return '';
  var username = email.split('@')[0];
  // Replace dots, underscores, hyphens with spaces, then title-case
  return username.replace(/[._-]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

// v23.10: Find related emails for the same person (same name or same domain with similar username)
function findRelatedEmails(email, name) {
  var allContacts = mailGetAllContacts();
  var domain = email.split('@')[1] || '';
  var related = [];
  allContacts.forEach(function(c) {
    if (c.email.toLowerCase() === email.toLowerCase()) return; // Skip self
    var cDomain = c.email.split('@')[1] || '';
    // Same name match (if name is provided and matches)
    if (name && c.name && c.name.toLowerCase() === name.toLowerCase()) {
      related.push(c.email);
    }
    // Same domain match (company emails)
    else if (domain && cDomain === domain) {
      related.push(c.email);
    }
  });
  return related;
}

function addClientFromContact(email, name, company) {
  // v23.10: Derive name from email if not provided
  if (!name || name === email.split('@')[0]) {
    name = deriveNameFromEmail(email);
  }
  // v23.10: Check for related emails (same person/domain)
  var relatedEmails = findRelatedEmails(email, name);
  if (relatedEmails.length > 0) {
    // Show email picker before opening modal
    showEmailPickerForClient(email, relatedEmails, name, company);
    return;
  }
  // Single email — open modal directly
  _openClientModalWithData(email, '', name, company);
}

// v23.10: Show picker when multiple emails found for same person
function showEmailPickerForClient(primaryEmail, otherEmails, name, company) {
  var allEmails = [primaryEmail].concat(otherEmails);
  var overlay = document.createElement('div');
  overlay.id = 'emailPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
  var card = '<div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:20px;max-width:400px;width:90%;">';
  card += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Multiple emails found</div>';
  card += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Choose how to add emails for ' + escapeHtml(name) + '</div>';
  // Option 1: Use clicked email as primary, others as secondary
  card += '<div style="display:flex;flex-direction:column;gap:8px;">';
  card += '<button onclick="selectEmailPickerOption(\'primary_with_secondary\',\'' + escapeHtml(primaryEmail) + '\',\'' + escapeHtml(otherEmails.join(',')) + '\',\'' + escapeHtml(name.replace(/'/g, "\\'")) + '\',\'' + escapeHtml((company || '').replace(/'/g, "\\'")) + '\')" style="text-align:left;padding:12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);cursor:pointer;color:var(--text-primary);font-size:13px;">';
  card += '<div style="font-weight:600;margin-bottom:2px;">Use both emails</div>';
  card += '<div style="font-size:11px;color:var(--text-muted);">Primary: ' + escapeHtml(primaryEmail) + '</div>';
  card += '<div style="font-size:11px;color:var(--text-muted);">Secondary: ' + escapeHtml(otherEmails.join(', ')) + '</div>';
  card += '</button>';
  // Option 2: Just the clicked email
  card += '<button onclick="selectEmailPickerOption(\'single\',\'' + escapeHtml(primaryEmail) + '\',\'\',\'' + escapeHtml(name.replace(/'/g, "\\'")) + '\',\'' + escapeHtml((company || '').replace(/'/g, "\\'")) + '\')" style="text-align:left;padding:12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);cursor:pointer;color:var(--text-primary);font-size:13px;">';
  card += '<div style="font-weight:600;margin-bottom:2px;">Only ' + escapeHtml(primaryEmail) + '</div>';
  card += '<div style="font-size:11px;color:var(--text-muted);">Add as the only email</div>';
  card += '</button>';
  // If there are other emails, offer them individually as primary
  otherEmails.forEach(function(oe) {
    card += '<button onclick="selectEmailPickerOption(\'single\',\'' + escapeHtml(oe) + '\',\'\',\'' + escapeHtml(name.replace(/'/g, "\\'")) + '\',\'' + escapeHtml((company || '').replace(/'/g, "\\'")) + '\')" style="text-align:left;padding:12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);cursor:pointer;color:var(--text-primary);font-size:13px;">';
    card += '<div style="font-weight:600;margin-bottom:2px;">Only ' + escapeHtml(oe) + '</div>';
    card += '<div style="font-size:11px;color:var(--text-muted);">Add as the only email</div>';
    card += '</button>';
  });
  card += '</div>';
  card += '<button onclick="document.getElementById(\'emailPickerOverlay\').remove()" style="width:100%;margin-top:12px;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:none;color:var(--text-muted);cursor:pointer;font-size:13px;">Cancel</button>';
  card += '</div>';
  overlay.innerHTML = card;
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function selectEmailPickerOption(mode, primary, secondaryStr, name, company) {
  var overlay = document.getElementById('emailPickerOverlay');
  if (overlay) overlay.remove();
  var secondary = secondaryStr ? secondaryStr.split(',') : [];
  _openClientModalWithData(primary, secondary.join(', '), name, company);
}

function _openClientModalWithData(email, secondaryEmails, name, company) {
  openClientModal();
  setTimeout(function() {
    var nameEl = document.getElementById('clientName');
    var emailEl = document.getElementById('clientEmail');
    var companyEl = document.getElementById('clientCompany');
    var secondaryEl = document.getElementById('clientSecondaryEmails');
    if (nameEl && name) nameEl.value = name;
    if (emailEl && email) emailEl.value = email;
    if (companyEl && company) companyEl.value = company;
    if (secondaryEl && secondaryEmails) secondaryEl.value = secondaryEmails;
  }, 100);
}

// v23.9: After sending email, prompt to add unknown recipient as client
function mailPromptAddUnknownRecipient(to, subject, body) {
  if (!to) return;
  var toLower = to.toLowerCase();
  // Check if already a client
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].email && clients[i].email.toLowerCase() === toLower) return; // Already a client
  }
  // Check if in address book
  var book = getMailAddressBook();
  var inBook = book.some(function(c) { return c.email.toLowerCase() === toLower; });
  // Extract name from email prefix
  var namePart = to.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  // Show prompt
  var promptHtml = '<div id="mailAddClientPrompt" style="position:fixed;bottom:20px;right:20px;z-index:99999;background:var(--bg-secondary);border:1px solid var(--accent);border-radius:var(--radius-lg);padding:16px 20px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:fadeIn 0.3s ease;">';
  promptHtml += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">';
  promptHtml += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
  promptHtml += '<span style="font-weight:600;font-size:14px;color:var(--text-primary);">Add to Clients?</span>';
  promptHtml += '<button onclick="document.getElementById(\'mailAddClientPrompt\').remove()" style="margin-left:auto;border:none;background:none;color:var(--text-muted);cursor:pointer;padding:2px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
  promptHtml += '</div>';
  promptHtml += '<p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"><strong>' + escapeHtml(to) + '</strong> is not in your client list.' + (!inBook ? ' They will also be added to your address book.' : '') + '</p>';
  promptHtml += '<div style="display:flex;gap:8px;">';
  promptHtml += '<button onclick="mailAcceptAddClient(\'' + escapeHtml(to.replace(/'/g, "\\'")) + '\', \'' + escapeHtml(namePart.replace(/'/g, "\\'")) + '\', \'' + escapeHtml((subject || '').replace(/'/g, "\\'")) + '\')" style="flex:1;padding:8px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-md);font-weight:600;font-size:13px;cursor:pointer;">Add as Client</button>';
  promptHtml += '<button onclick="document.getElementById(\'mailAddClientPrompt\').remove()" style="flex:1;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:13px;cursor:pointer;">Skip</button>';
  promptHtml += '</div>';
  promptHtml += '</div>';
  // Remove any existing prompt
  var existing = document.getElementById('mailAddClientPrompt');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', promptHtml);
  // Auto-dismiss after 15 seconds
  setTimeout(function() {
    var el = document.getElementById('mailAddClientPrompt');
    if (el) el.remove();
  }, 15000);
}

function mailAcceptAddClient(email, name, subject) {
  var prompt = document.getElementById('mailAddClientPrompt');
  if (prompt) prompt.remove();
  // Add to address book if not already there
  var book = getMailAddressBook();
  var inBook = book.some(function(c) { return c.email.toLowerCase() === email.toLowerCase(); });
  if (!inBook) {
    book.push({ name: name, email: email, company: '', createdAt: new Date().toISOString() });
    saveMailAddressBook(book);
  }
  // Open client modal pre-filled
  addClientFromContact(email, name, '');
}

/**
 * v23.5: Sprint 6 — Invoicing & Financial
 * 6.1: Spreadsheet import for invoices
 * 6.2: AI-generated invoice from documents
 * 6.3: Smart duplicate detection
 */

// 6.1: Spreadsheet Import
var _invoiceImportData = null;
var _invoiceColMapping = {};

function openInvoiceImport() {
  var existing = document.getElementById('invoiceImportOverlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'invoiceImportOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:16px;padding:28px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div style="font-size:16px;font-weight:600;color:var(--text-primary);">Import from Spreadsheet</div>' +
    '<button onclick="closeInvoiceImport()" style="border:none;background:none;color:var(--text-muted);cursor:pointer;padding:4px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>' +
    '<div class="invoice-import-zone" id="invoiceDropZone" onclick="document.getElementById(\'invoiceFileInput\').click()">' +
    '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
    '<div class="import-label">Drop spreadsheet here or click to browse</div>' +
    '<div class="import-hint">.xlsx, .csv, .xls supported</div>' +
    '</div>' +
    '<input type="file" id="invoiceFileInput" accept=".xlsx,.csv,.xls" style="display:none;" onchange="handleInvoiceFileUpload(this)">' +
    '<div id="invoiceImportPreview"></div>' +
    '<div id="invoiceImportMapping" style="display:none;"></div>' +
    '<div id="invoiceImportActions" style="display:none;margin-top:16px;display:none;flex-direction:row;gap:10px;justify-content:flex-end;">' +
    '<button onclick="closeInvoiceImport()" class="btn btn-secondary" style="padding:8px 16px;font-size:12px;">Cancel</button>' +
    '<button onclick="applyInvoiceImport()" class="btn" style="padding:8px 20px;font-size:12px;background:var(--brand-accent,#a89878);color:#fff;border-color:var(--brand-accent,#a89878);">Create Invoice</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  overlay.onclick = function(e) { if (e.target === overlay) closeInvoiceImport(); };
  // Drag and drop
  var dropZone = document.getElementById('invoiceDropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault(); dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) parseInvoiceSpreadsheet(e.dataTransfer.files[0]);
    });
  }
}

function closeInvoiceImport() {
  var overlay = document.getElementById('invoiceImportOverlay');
  if (overlay) overlay.remove();
  _invoiceImportData = null;
  _invoiceColMapping = {};
}

function handleInvoiceFileUpload(input) {
  if (!input.files || !input.files[0]) return;
  parseInvoiceSpreadsheet(input.files[0]);
}

function parseInvoiceSpreadsheet(file) {
  if (!window.XLSX) { showToast('Spreadsheet library not loaded. Please refresh.', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var workbook = XLSX.read(e.target.result, { type: 'array' });
      var sheetNames = workbook.SheetNames;
      if (sheetNames.length === 0) { showToast('No sheets found in file', 'error'); return; }
      // If multiple sheets, let user pick
      var sheetName = sheetNames[0];
      if (sheetNames.length > 1) {
        var sheetSelector = '<div style="margin-bottom:12px;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Select Sheet</label><select id="invoiceSheetSelect" class="form-control" style="padding:6px 10px;font-size:12px;" onchange="switchInvoiceSheet()">';
        sheetNames.forEach(function(n) { sheetSelector += '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>'; });
        sheetSelector += '</select></div>';
        var previewEl = document.getElementById('invoiceImportPreview');
        if (previewEl) previewEl.innerHTML = sheetSelector;
      }
      window._invoiceWorkbook = workbook;
      renderInvoiceSheetPreview(sheetName);
    } catch(err) {
      showToast('Failed to parse spreadsheet: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function switchInvoiceSheet() {
  var sel = document.getElementById('invoiceSheetSelect');
  if (sel) renderInvoiceSheetPreview(sel.value);
}

function renderInvoiceSheetPreview(sheetName) {
  var wb = window._invoiceWorkbook;
  if (!wb) return;
  var sheet = wb.Sheets[sheetName];
  var data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (data.length < 2) { showToast('Sheet has insufficient data', 'warning'); return; }
  _invoiceImportData = data;
  var headers = data[0] || [];
  // Preview table
  var previewEl = document.getElementById('invoiceImportPreview');
  var html = (previewEl && previewEl.innerHTML.indexOf('invoiceSheetSelect') !== -1) ? previewEl.querySelector('div') ? previewEl.innerHTML.split('</div>')[0] + '</div>' : '' : '';
  html += '<div class="invoice-preview-sheet"><table><thead><tr>';
  headers.forEach(function(h) { html += '<th>' + escapeHtml(String(h || '')) + '</th>'; });
  html += '</tr></thead><tbody>';
  var previewRows = Math.min(data.length, 6);
  for (var r = 1; r < previewRows; r++) {
    html += '<tr>';
    for (var c = 0; c < headers.length; c++) {
      html += '<td>' + escapeHtml(String((data[r] && data[r][c]) || '')) + '</td>';
    }
    html += '</tr>';
  }
  if (data.length > 6) html += '<tr><td colspan="' + headers.length + '" style="text-align:center;color:var(--text-muted);font-style:italic;">... ' + (data.length - 6) + ' more rows</td></tr>';
  html += '</tbody></table></div>';
  if (previewEl) previewEl.innerHTML = html;
  // Auto-detect column mapping
  autoDetectInvoiceColumns(headers);
}

function autoDetectInvoiceColumns(headers) {
  var fields = [
    { key: 'description', label: 'Description', patterns: ['desc', 'item', 'service', 'product', 'name', 'detail'] },
    { key: 'quantity', label: 'Quantity', patterns: ['qty', 'quantity', 'units', 'count', 'amount'] },
    { key: 'rate', label: 'Unit Price', patterns: ['rate', 'price', 'unit', 'cost', 'each'] },
    { key: 'total', label: 'Total', patterns: ['total', 'sum', 'subtotal', 'line total'] },
    { key: 'date', label: 'Date', patterns: ['date', 'day', 'when', 'period'] },
    { key: 'notes', label: 'Notes', patterns: ['note', 'memo', 'comment', 'remark'] }
  ];
  _invoiceColMapping = {};
  fields.forEach(function(f) {
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').toLowerCase();
      for (var p = 0; p < f.patterns.length; p++) {
        if (h.indexOf(f.patterns[p]) !== -1 && !isColAlreadyMapped(i)) {
          _invoiceColMapping[f.key] = i;
          break;
        }
      }
      if (_invoiceColMapping[f.key] !== undefined) break;
    }
  });
  // Render mapping UI
  var mappingEl = document.getElementById('invoiceImportMapping');
  if (!mappingEl) return;
  var html = '<div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Column Mapping</div>';
  fields.forEach(function(f) {
    html += '<div class="invoice-col-mapping">';
    html += '<select class="col-source" onchange="updateInvoiceColMapping(\'' + f.key + '\', this.value)">';
    html += '<option value="">-- Skip --</option>';
    headers.forEach(function(h, idx) {
      var selected = _invoiceColMapping[f.key] === idx ? ' selected' : '';
      html += '<option value="' + idx + '"' + selected + '>' + escapeHtml(String(h || 'Column ' + (idx + 1))) + '</option>';
    });
    html += '</select>';
    html += '<span class="col-arrow">&#8594;</span>';
    html += '<span style="font-size:12px;color:var(--text-primary);font-weight:500;">' + f.label + '</span>';
    html += '</div>';
  });
  mappingEl.innerHTML = html;
  mappingEl.style.display = 'block';
  var actionsEl = document.getElementById('invoiceImportActions');
  if (actionsEl) actionsEl.style.display = 'flex';
}

function isColAlreadyMapped(colIdx) {
  for (var k in _invoiceColMapping) {
    if (_invoiceColMapping[k] === colIdx) return true;
  }
  return false;
}

function updateInvoiceColMapping(field, colIdx) {
  if (colIdx === '') delete _invoiceColMapping[field];
  else _invoiceColMapping[field] = parseInt(colIdx);
}

function applyInvoiceImport() {
  if (!_invoiceImportData || _invoiceImportData.length < 2) { showToast('No data to import', 'error'); return; }
  if (_invoiceColMapping.description === undefined) { showToast('Please map the Description column', 'warning'); return; }
  closeInvoiceImport();
  // Parse rows into line items
  var lineItems = [];
  for (var r = 1; r < _invoiceImportData.length; r++) {
    var row = _invoiceImportData[r];
    if (!row) continue;
    var desc = _invoiceColMapping.description !== undefined ? String(row[_invoiceColMapping.description] || '').trim() : '';
    if (!desc) continue;
    var qty = _invoiceColMapping.quantity !== undefined ? parseFloat(row[_invoiceColMapping.quantity]) || 1 : 1;
    var rate = _invoiceColMapping.rate !== undefined ? parseFloat(row[_invoiceColMapping.rate]) || 0 : 0;
    var total = _invoiceColMapping.total !== undefined ? parseFloat(row[_invoiceColMapping.total]) || 0 : 0;
    if (rate === 0 && total > 0 && qty > 0) rate = total / qty;
    if (rate === 0 && total === 0) continue;
    lineItems.push({ description: desc, quantity: qty, rate: rate, amount: qty * rate });
  }
  if (lineItems.length === 0) { showToast('No valid line items found', 'warning'); return; }
  // Open invoice builder pre-populated
  openInvoiceBuilderWithItems(lineItems);
}

function openInvoiceBuilderWithItems(lineItems) {
  openInvoiceBuilder();
  // Wait for DOM then populate
  setTimeout(function() {
    var list = document.getElementById('invoiceItemsList');
    if (!list) return;
    list.innerHTML = '';
    lineItems.forEach(function(item) {
      addInvoiceLineItem();
      var lastRow = list.lastElementChild;
      if (!lastRow) return;
      var descInput = lastRow.querySelector('.invoice-item-desc');
      var qtyInput = lastRow.querySelector('.invoice-item-qty');
      var rateInput = lastRow.querySelector('.invoice-item-rate');
      if (descInput) descInput.value = item.description;
      if (qtyInput) qtyInput.value = item.quantity;
      if (rateInput) rateInput.value = item.rate.toFixed(2);
    });
    updateInvoiceTotal();
    // 6.3: Check for duplicates
    checkInvoiceDuplicates();
  }, 100);
}

// 6.2: AI-Generated Invoice from Document
function openAiInvoiceGenerator() {
  var existing = document.getElementById('aiInvoiceOverlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'aiInvoiceOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:16px;padding:28px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">' +
    '<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">AI Invoice Generator</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Upload any document and AI will extract invoice data</div>' +
    '<div class="invoice-import-zone" id="aiInvoiceDropZone" onclick="document.getElementById(\'aiInvoiceFileInput\').click()">' +
    '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>' +
    '<div class="import-label">Drop document here or click to browse</div>' +
    '<div class="import-hint">PDF, spreadsheet, text, or image</div>' +
    '</div>' +
    '<input type="file" id="aiInvoiceFileInput" accept=".pdf,.xlsx,.csv,.xls,.txt,.md,.jpg,.jpeg,.png,.webp" style="display:none;" onchange="handleAiInvoiceUpload(this)">' +
    '<div style="margin-top:12px;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Or paste text content:</label>' +
    '<textarea id="aiInvoiceTextInput" placeholder="Paste invoice content, email, or any text with billing information..." class="form-control" style="padding:10px;font-size:12px;min-height:80px;resize:vertical;"></textarea></div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">' +
    '<button onclick="closeAiInvoiceGenerator()" class="btn btn-secondary" style="padding:8px 16px;font-size:12px;">Cancel</button>' +
    '<button onclick="runAiInvoiceGeneration()" id="aiInvoiceGenerateBtn" class="btn" style="padding:8px 20px;font-size:12px;background:var(--brand-accent,#a89878);color:#fff;border-color:var(--brand-accent,#a89878);">Generate Invoice</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  overlay.onclick = function(e) { if (e.target === overlay) closeAiInvoiceGenerator(); };
  var dropZone = document.getElementById('aiInvoiceDropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault(); dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleAiInvoiceUpload({ files: e.dataTransfer.files });
    });
  }
}

function closeAiInvoiceGenerator() {
  var overlay = document.getElementById('aiInvoiceOverlay');
  if (overlay) overlay.remove();
}

var _aiInvoiceFileContent = '';
function handleAiInvoiceUpload(input) {
  var file = input.files ? input.files[0] : null;
  if (!file) return;
  var zone = document.getElementById('aiInvoiceDropZone');
  if (zone) zone.querySelector('.import-label').textContent = file.name;
  var ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'csv' || ext === 'xls') {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'array' });
        var data = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        _aiInvoiceFileContent = data;
      } catch(err) { showToast('Failed to read spreadsheet', 'error'); }
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'txt' || ext === 'md') {
    var reader2 = new FileReader();
    reader2.onload = function(e) { _aiInvoiceFileContent = e.target.result; };
    reader2.readAsText(file);
  } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') {
    var reader3 = new FileReader();
    reader3.onload = function(e) { _aiInvoiceFileContent = '[IMAGE:' + e.target.result + ']'; };
    reader3.readAsDataURL(file);
  } else if (ext === 'pdf') {
    // Use PDF.js to extract text
    var reader4 = new FileReader();
    reader4.onload = function(e) {
      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise.then(function(pdf) {
          var allText = '';
          var promises = [];
          for (var p = 1; p <= Math.min(pdf.numPages, 10); p++) {
            promises.push(pdf.getPage(p).then(function(page) {
              return page.getTextContent().then(function(tc) {
                return tc.items.map(function(i) { return i.str; }).join(' ');
              });
            }));
          }
          Promise.all(promises).then(function(pages) {
            _aiInvoiceFileContent = pages.join('\n\n');
          });
        });
      } else {
        showToast('PDF reader not available', 'error');
      }
    };
    reader4.readAsArrayBuffer(file);
  }
}

function runAiInvoiceGeneration() {
  var textInput = document.getElementById('aiInvoiceTextInput');
  var content = _aiInvoiceFileContent || (textInput ? textInput.value.trim() : '');
  if (!content) { showToast('Please upload a file or paste text', 'warning'); return; }
  var btn = document.getElementById('aiInvoiceGenerateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
  // Build AI prompt
  var prompt = 'Extract invoice data from the following document. Return a JSON object with these fields:\n' +
    '{"clientName": "string", "clientEmail": "string", "lineItems": [{"description": "string", "quantity": number, "rate": number}], "date": "YYYY-MM-DD", "notes": "string", "ambiguous": ["list of fields you are unsure about"]}\n\n' +
    'Rules:\n- If quantity is not specified, default to 1\n- If rate/price is missing, set to 0 and add to ambiguous list\n- Extract ALL line items you can find\n- Return ONLY valid JSON, no markdown\n\nDocument content:\n' + content.substring(0, 8000);
  // Determine provider/key
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : { provider: 'anthropic', model: 'claude-sonnet-4-6' };
  var provider = settings.provider || 'anthropic';
  var model = settings.model || 'claude-sonnet-4-6';
  // Check for image content — use multimodal if available
  var isImage = content.indexOf('[IMAGE:') === 0;
  var messages = [];
  if (isImage) {
    var base64Data = content.replace('[IMAGE:', '').replace(/\]$/, '');
    messages = [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data.split(',')[1] || base64Data } },
      { type: 'text', text: prompt.replace(content.substring(0, 8000), '(see image above)') }
    ]}];
  } else {
    messages = [{ role: 'user', content: prompt }];
  }
  (async function() {
    try {
      var apiKey = typeof getApiKey === 'function' ? await getApiKey(provider) : '';
      if (!apiKey) { showToast('API key not configured for ' + provider, 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Generate Invoice'; } return; }
      var fullResponse = '';
      var streamFn = provider === 'openai' ? callOpenAIStreaming : (provider === 'google' ? callGoogleStreaming : callAnthropicStreaming);
      streamFn(model, apiKey, messages, 'You are an invoice data extraction assistant. Always return valid JSON only.', function(chunk) {
        fullResponse += chunk;
      }, function() {
        try {
          // Extract JSON from response
          var jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON found in AI response');
          var parsed = JSON.parse(jsonMatch[0]);
          closeAiInvoiceGenerator();
          // Show ambiguous fields
          if (parsed.ambiguous && parsed.ambiguous.length > 0) {
            showToast('AI flagged: ' + parsed.ambiguous.join(', '), 'warning');
          }
          // Pre-populate invoice builder
          var items = (parsed.lineItems || []).map(function(li) {
            return { description: li.description || '', quantity: li.quantity || 1, rate: li.rate || 0, amount: (li.quantity || 1) * (li.rate || 0) };
          });
          openInvoiceBuilderWithItems(items);
          // Set client and date
          setTimeout(function() {
            if (parsed.clientName) {
              var clientSel = document.getElementById('invoiceClient');
              if (clientSel) {
                // Try to match existing client
                var options = clientSel.options;
                var matched = false;
                for (var i = 0; i < options.length; i++) {
                  if (options[i].value.toLowerCase() === parsed.clientName.toLowerCase()) {
                    clientSel.value = options[i].value; matched = true; break;
                  }
                }
                if (!matched) {
                  var opt = document.createElement('option');
                  opt.value = parsed.clientName;
                  opt.textContent = parsed.clientName + ' (new)';
                  clientSel.insertBefore(opt, clientSel.lastElementChild);
                  clientSel.value = parsed.clientName;
                }
              }
            }
            if (parsed.date) {
              var dateEl = document.getElementById('invoiceDate');
              if (dateEl) dateEl.value = parsed.date;
            }
            if (parsed.notes) {
              var descEl = document.getElementById('invoiceDescription');
              if (descEl) descEl.value = parsed.notes;
            }
          }, 200);
        } catch(parseErr) {
          showToast('AI response could not be parsed: ' + parseErr.message, 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Generate Invoice'; }
        }
      }, function(err) {
        showToast('AI error: ' + (err.message || err), 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Generate Invoice'; }
      });
    } catch(e) {
      showToast('Error: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Generate Invoice'; }
    }
  })();
}

// 6.3: Smart Duplicate Detection
function checkInvoiceDuplicates() {
  var clientSel = document.getElementById('invoiceClient');
  var clientName = clientSel ? clientSel.value : '';
  if (!clientName) return;
  var existingInvoices = getInvoices().filter(function(inv) { return inv.clientName === clientName; });
  if (existingInvoices.length === 0) return;
  // Build index of previously invoiced items
  var prevItems = [];
  existingInvoices.forEach(function(inv) {
    (inv.lineItems || []).forEach(function(li) {
      prevItems.push({ description: li.description, amount: li.amount, invoiceId: inv.id, invoiceNum: inv.number, invoiceDate: inv.date });
    });
  });
  if (prevItems.length === 0) return;
  // Check current line items against previous
  var itemsList = document.getElementById('invoiceItemsList');
  if (!itemsList) return;
  var rows = Array.prototype.slice.call(itemsList.children);
  var newCount = 0;
  var dupCount = 0;
  rows.forEach(function(row) {
    var descInput = row.querySelector('.invoice-item-desc');
    if (!descInput) return;
    var desc = descInput.value.trim().toLowerCase();
    if (!desc) return;
    var match = findDuplicateItem(desc, prevItems);
    if (match) {
      dupCount++;
      row.classList.add('previously-invoiced');
      // Add tag if not already present
      if (!row.querySelector('.invoice-dup-tag')) {
        var tag = document.createElement('span');
        tag.className = 'invoice-dup-tag';
        tag.title = 'Invoiced on ' + (match.invoiceDate || 'unknown') + ' (#' + (match.invoiceNum || '') + ')';
        tag.textContent = 'Previously Invoiced';
        tag.onclick = function(e) {
          e.stopPropagation();
          if (confirm('This item was invoiced on ' + (match.invoiceDate || 'unknown') + ' (#' + (match.invoiceNum || '') + '). Include anyway?')) {
            row.classList.remove('previously-invoiced');
            tag.remove();
          }
        };
        row.appendChild(tag);
      }
    } else {
      newCount++;
    }
  });
  if (dupCount > 0) {
    showToast(rows.length + ' items detected. ' + dupCount + ' already invoiced. ' + newCount + ' new.', 'info');
  }
}

function findDuplicateItem(desc, prevItems) {
  // Fuzzy match — Levenshtein-like similarity
  for (var i = 0; i < prevItems.length; i++) {
    var prevDesc = (prevItems[i].description || '').toLowerCase();
    if (prevDesc === desc) return prevItems[i];
    if (desc.length > 3 && prevDesc.length > 3) {
      var similarity = calcSimilarity(desc, prevDesc);
      if (similarity > 0.8) return prevItems[i];
    }
  }
  return null;
}

function calcSimilarity(a, b) {
  if (a === b) return 1;
  var longer = a.length > b.length ? a : b;
  var shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  // Simple word overlap
  var aWords = a.split(/\s+/);
  var bWords = b.split(/\s+/);
  var matches = 0;
  aWords.forEach(function(w) { if (bWords.indexOf(w) !== -1) matches++; });
  return matches / Math.max(aWords.length, bWords.length);
}

// Attach duplicate check on client change
(function() {
  var origOpen = openInvoiceBuilder;
  openInvoiceBuilder = function() {
    origOpen.apply(this, arguments);
    setTimeout(function() {
      var clientSel = document.getElementById('invoiceClient');
      if (clientSel) {
        clientSel.addEventListener('change', function() { checkInvoiceDuplicates(); });
      }
    }, 100);
  };
})();

/**
 * v23.5: Sprint 7 — AI Model Management
 * 7.1: Model Tier Restriction
 */

var MODEL_TIERS = {
  pro: {
    label: 'Pro Only',
    desc: 'Highest-tier models only',
    models: {
      anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6'],
      openai: ['gpt-5.4-pro', 'gpt-5.4', 'gpt-5.4-thinking'],
      google: ['gemini-3.1-pro-preview']
    }
  },
  balanced: {
    label: 'Balanced',
    desc: 'Pro for complex, standard for simple',
    models: {
      anthropic: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
      openai: ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-thinking'],
      google: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview']
    }
  },
  economy: {
    label: 'Economy',
    desc: 'Faster, cheaper models',
    models: {
      anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
      openai: ['gpt-5.4'],
      google: ['gemini-3-flash-preview', 'gemini-3.1-pro-preview']
    }
  }
};

function getModelTierPreference() {
  try { return localStorage.getItem('roweos_model_tier') || 'balanced'; } catch(e) { return 'balanced'; }
}

function saveModelTierPreference(tier) {
  localStorage.setItem('roweos_model_tier', tier);
  writeDB('profile/main', { modelTier: tier }); // v25.1
  renderModelTierCards();
  // v24.10: Re-render API routing panel so Effective Routing reflects new tier
  if (typeof renderApiRoutingPanel === 'function') renderApiRoutingPanel();
}

// v23.5: Track last model used for transparency
var _lastModelUsed = { provider: '', model: '', timestamp: 0 };

function setLastModelUsed(provider, model) {
  _lastModelUsed = { provider: provider, model: model, timestamp: Date.now() };
  // Update indicator if visible
  var el = document.getElementById('modelLastUsedIndicator');
  if (el) {
    el.innerHTML = '<span class="model-last-used"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>Last: ' + escapeHtml(model) + ' (' + provider + ')</span>';
  }
}

// v23.5: Filter model by tier preference
function getModelForTier(provider, requestedModel) {
  // v26.3: Always validate model matches provider (prevent cross-provider model IDs)
  var mismatch = false;
  if (provider === 'google' && !requestedModel.startsWith('gemini-') && !requestedModel.startsWith('models/')) mismatch = true;
  else if (provider === 'anthropic' && !requestedModel.startsWith('claude-')) mismatch = true;
  else if (provider === 'openai' && !requestedModel.startsWith('gpt-') && !requestedModel.startsWith('o')) mismatch = true;

  var tier = getModelTierPreference();
  var tierConfig = MODEL_TIERS[tier];

  if (mismatch) {
    console.warn('[ModelTier] Model/provider mismatch: ' + requestedModel + ' on ' + provider);
    if (tierConfig && tierConfig.models[provider]) return tierConfig.models[provider][0];
    if (provider === 'google') return 'gemini-3.1-pro-preview';
    if (provider === 'anthropic') return 'claude-sonnet-4-6';
    if (provider === 'openai') return 'gpt-5.4';
  }

  if (tier === 'balanced') return requestedModel; // No filtering in balanced mode
  if (!tierConfig || !tierConfig.models[provider]) return requestedModel;
  var allowed = tierConfig.models[provider];
  // If the requested model is in the allowed list, use it
  if (allowed.indexOf(requestedModel) !== -1) return requestedModel;
  // Otherwise, use the first allowed model for this provider
  return allowed[0] || requestedModel;
}

function renderModelTierCards() {
  var container = document.getElementById('modelTierCards');
  if (!container) return;
  var currentTier = getModelTierPreference();
  var html = '';
  var tierKeys = ['pro', 'balanced', 'economy'];
  tierKeys.forEach(function(key) {
    var t = MODEL_TIERS[key];
    var active = key === currentTier ? ' active' : '';
    html += '<div class="model-tier-card' + active + '" onclick="saveModelTierPreference(\'' + key + '\')">';
    html += '<div class="tier-label">' + t.label + '</div>';
    html += '<div class="tier-desc">' + t.desc + '</div>';
    html += '</div>';
  });
  container.innerHTML = html;
  // Show active models
  var activeModelsEl = document.getElementById('modelTierActiveModels');
  if (activeModelsEl) {
    var tierConfig = MODEL_TIERS[currentTier];
    var modelList = [];
    if (tierConfig) {
      for (var p in tierConfig.models) {
        tierConfig.models[p].forEach(function(m) { modelList.push(m); });
      }
    }
    activeModelsEl.innerHTML = 'Active rotation: ' + modelList.join(', ');
  }
  // Update last used indicator
  if (_lastModelUsed.model) {
    var lastEl = document.getElementById('modelLastUsedIndicator');
    if (lastEl) {
      lastEl.innerHTML = '<span class="model-last-used"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>Last: ' + escapeHtml(_lastModelUsed.model) + ' (' + _lastModelUsed.provider + ')</span>';
    }
  }
}

/**
 * v23.5: Sprint 8 — UX, Accessibility & ADHD Optimization
 * 8.1 ADHD Usability, 8.2 Recommended/Default/Advanced, 8.3 Advanced Tools Toggle,
 * 8.4 First-Time Users, 8.5 Section Help, 8.6 Guided Tours
 */

// ── 8.5: Section Help Content ──
var SECTION_HELP = {
  agent: {
    title: 'Chat',
    purpose: 'Have conversations with AI agents tailored to your brand or life profile.',
    items: [
      'Select a brand or life profile to set the AI context',
      'Type a message or attach files to start a conversation',
      'Switch between agents (Strategy, Marketing, Operations, Documents, Intelligence)',
      'Conversations are saved automatically to History',
      'Use deep research mode for complex questions'
    ]
  },
  studio: {
    title: 'Agent Studio',
    purpose: 'Run AI-powered operations to generate content, documents, and media.',
    items: [
      'Choose an operation from the sidebar list',
      'Enter your prompt and any additional context',
      'Click Generate to run the operation',
      'Export results as PDF, copy, or save to Library',
      'Use pipelines to chain multiple operations together'
    ]
  },
  signal: {
    title: 'Focus',
    purpose: 'Your daily command center for tasks, calendar, notes, and streaks.',
    items: [
      'View your calendar events and upcoming schedule',
      'Create and manage tasks with priorities',
      'Track daily streaks and habits',
      'See automation activity at a glance',
      'Quick-add notes that sync across devices'
    ]
  },
  pulse: {
    title: 'Pulse',
    purpose: 'Monitor brand health, analytics, and performance insights.',
    items: [
      'View real-time brand performance metrics',
      'Track engagement and growth trends',
      'AI-generated insights about your brand',
      'Compare metrics across time periods',
      'Export reports as PDF'
    ]
  },
  bloom: {
    title: 'Bloom',
    purpose: 'Discover and browse your generated content feed.',
    items: [
      'Browse content seeds from your Studio sessions',
      'Filter by media type (text, image, video)',
      'Click any card to expand and view full content',
      'Navigate back to the Studio operation that created it',
      'Refresh to generate new content suggestions'
    ]
  },
  rhythm: {
    title: 'Rhythm',
    purpose: 'Calendar, events, tasks, and time management.',
    items: [
      'Sync with Google Calendar, iCloud, or Outlook',
      'View events in day, week, or month format',
      'Create events and set reminders',
      'Drag to reschedule events',
      'Track task deadlines alongside calendar'
    ]
  },
  library: {
    title: 'Library',
    purpose: 'Store and organize notes, documents, uploads, and brand resources.',
    items: [
      'Create text notes or upload files',
      'Organize with folders and tags',
      'Search across all your documents',
      'Attach files to conversations or emails',
      'Export any item as PDF'
    ]
  },
  automations: {
    title: 'Automations',
    purpose: 'Schedule and automate recurring AI tasks.',
    items: [
      'Create scheduled tasks that run automatically',
      'Build multi-step pipelines with triggers',
      'Use workflow presets for common automations',
      'View execution history and results',
      'Set custom schedules (daily, weekly, custom)'
    ]
  },
  mail: {
    title: 'Mail',
    purpose: 'Compose, send, and manage emails with AI assistance.',
    items: [
      'Compose emails with AI-generated content',
      'Manage your outbox and sent messages',
      'Connect Gmail or Outlook for inbox access',
      'Use brand voice in email writing',
      'Attach files and manage your address book'
    ]
  },
  memory: {
    title: 'Identity',
    purpose: 'Define your brand essence, voice, and visual identity.',
    items: [
      'Set brand name, tagline, and description',
      'Configure voice, tone, and messaging style',
      'Upload logos and visual assets',
      'AI uses this context in all operations',
      'Share brand configurations with team members'
    ]
  },
  tuning: {
    title: 'History',
    purpose: 'Browse and search your past conversations.',
    items: [
      'View all past chat and studio sessions',
      'Search by keyword or date',
      'Resume any previous conversation',
      'Delete individual entries or clear history',
      'Conversations sync across devices with Cloud Sync'
    ]
  },
  clients: {
    title: 'Clients',
    purpose: 'Manage client relationships, contacts, and project details.',
    items: [
      'Add clients with contact info and categories',
      'Set priority levels and track interactions',
      'Attach Studio sessions to client profiles',
      'Export client profiles as PDF',
      'Sync contacts with your address book'
    ]
  },
  commerce: {
    title: 'Analytics',
    purpose: 'Track business metrics, revenue, and performance data.',
    items: [
      'View revenue and growth dashboards',
      'Track key performance indicators',
      'AI-generated business insights',
      'Compare metrics across brands',
      'Export analytics reports'
    ]
  },
  inventory: {
    title: 'Inventory',
    purpose: 'Manage products, services, and pricing for your brands.',
    items: [
      'Add products and services with pricing',
      'Organize by category and brand',
      'Track stock levels and availability',
      'Link inventory to invoices',
      'Bulk import from spreadsheets'
    ]
  },
  settings: {
    title: 'System',
    purpose: 'Configure API keys, sync, appearance, and all platform preferences.',
    items: [
      'Set up AI provider API keys (Anthropic, OpenAI, Google)',
      'Configure Cloud Sync and Firebase connection',
      'Customize appearance, theme, and brand colors',
      'Connect social media accounts and calendars',
      'Manage data, backups, and storage'
    ]
  },
  // v24.25: Missing section help entries
  guardrails: {
    title: 'Guardrails',
    purpose: 'Set content safety rules and approval workflows for AI-generated content.',
    items: [
      'Configure content review preferences',
      'Set approval requirements for automated posts',
      'Define AI response boundaries and tone limits',
      'Manage social media posting rules',
      'Review flagged content before publishing'
    ]
  },
  folio: {
    title: 'Folio',
    purpose: 'Create, save, and evolve interactive visual artifacts with AI.',
    items: [
      'Use Chat to describe any visual and AI builds it live',
      'Save visuals to your Gallery for later',
      'Edit with AI to iterate on existing visuals',
      'Track version history and restore previous versions',
      'Add notes and comments to your creations'
    ]
  },
  sync: {
    title: 'Sync',
    purpose: 'Manage cloud synchronization and cross-device data.',
    items: [
      'Connect Firebase for real-time cloud sync',
      'View sync status for all data categories',
      'Force sync or resolve conflicts manually',
      'See last sync timestamps per category',
      'Manage connected devices and sessions'
    ]
  }
};

// ── 8.5: Section Help Functions ──
function getSectionVisited(sectionId) {
  try {
    var visited = JSON.parse(localStorage.getItem('roweos_sections_visited') || '{}');
    return !!visited[sectionId];
  } catch(e) { return false; }
}

function markSectionVisited(sectionId) {
  try {
    var visited = JSON.parse(localStorage.getItem('roweos_sections_visited') || '{}');
    visited[sectionId] = Date.now();
    localStorage.setItem('roweos_sections_visited', JSON.stringify(visited));
  } catch(e) {}
}

function isSectionHelpDismissed(sectionId) {
  try {
    var dismissed = JSON.parse(localStorage.getItem('roweos_help_dismissed') || '{}');
    return !!dismissed[sectionId];
  } catch(e) { return false; }
}

function dismissSectionHelp(sectionId) {
  try {
    var dismissed = JSON.parse(localStorage.getItem('roweos_help_dismissed') || '{}');
    dismissed[sectionId] = true;
    localStorage.setItem('roweos_help_dismissed', JSON.stringify(dismissed));
  } catch(e) {}
}

// v26.2: Per-section preferences
function getSectionPrefs(viewId) {
  try {
    var all = JSON.parse(localStorage.getItem('roweos_section_prefs') || '{}');
    return all[viewId] || {};
  } catch(e) { return {}; }
}

function setSectionPref(viewId, key, value) {
  try {
    var all = JSON.parse(localStorage.getItem('roweos_section_prefs') || '{}');
    if (!all[viewId]) all[viewId] = {};
    all[viewId][key] = value;
    localStorage.setItem('roweos_section_prefs', JSON.stringify(all));
  } catch(e) {}
}

// v26.2: Section help dropdown (replaces modal)
function showSectionHelp(sectionId) {
  // Find the ? button that was clicked
  var btn = event ? event.currentTarget || event.target : null;
  if (!btn) return;
  showSectionHelpDropdown(btn, sectionId);
}

function showSectionHelpDropdown(btn, sectionId) {
  // Close any existing dropdown
  closeSectionHelpDropdown();

  var sectionToArea = {
    'signal': 'focus', 'memory': 'identity',
    'tuning': 'memory', 'commerce': 'analytics'
  };
  var feedbackArea = sectionToArea[sectionId] || sectionId;
  var hasTour = GUIDED_TOURS && GUIDED_TOURS[sectionId] && GUIDED_TOURS[sectionId].length > 0;
  var config = _pageLandingConfigs[sectionId];
  var sidebarMode = localStorage.getItem('roweos_sidebar_mode') || 'grouped';
  var showPrefs = !!config; // v26.3: Show skip landing prefs in all sidebar modes
  var prefs = getSectionPrefs(sectionId);

  // Position dropdown relative to button
  var wrapper = btn.parentElement;
  if (wrapper) wrapper.style.position = 'relative';

  var dd = document.createElement('div');
  dd.className = 'section-help-dropdown';
  dd.id = 'sectionHelpDropdown';

  var html = '';

  // Tour
  if (hasTour) {
    html += '<div class="section-help-dropdown-item" onclick="closeSectionHelpDropdown(); if(typeof startGuidedTour===\'function\') startGuidedTour(\'' + escapeHtml(sectionId) + '\')">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    html += 'Take a Tour</div>';
  }

  // Feedback
  html += '<div class="section-help-dropdown-item" onclick="closeSectionHelpDropdown(); if(typeof openFeedbackModal===\'function\') openFeedbackModal(\'' + escapeHtml(feedbackArea) + '\')">';
  html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  html += 'Send Feedback</div>';

  // Section preferences (only in expanded mode with landing config)
  if (showPrefs) {
    html += '<div class="section-help-dropdown-divider"></div>';

    // Skip Landing toggle
    var isSkip = prefs.skipLanding ? true : false;
    html += '<div class="section-help-dropdown-toggle" onclick="toggleSectionSkipLanding(\'' + escapeHtml(sectionId) + '\', this)">';
    html += '<span>Skip landing</span>';
    html += '<div class="section-help-toggle' + (isSkip ? ' on' : '') + '"><div class="section-help-toggle-knob"></div></div>';
    html += '</div>';

    // Open to picker
    var defaultPill = prefs.defaultPill || config.features[0].id;
    var defaultLabel = defaultPill;
    for (var i = 0; i < config.features.length; i++) {
      if (config.features[i].id === defaultPill) { defaultLabel = config.features[i].label; break; }
    }
    html += '<div class="section-help-dropdown-toggle" onclick="toggleSectionOpenTo(this, \'' + escapeHtml(sectionId) + '\')">';
    html += '<span>Open to</span>';
    html += '<span style="color:var(--brand-accent, #a89878);font-size:11px;" id="sectionOpenToLabel">' + escapeHtml(defaultLabel) + ' &#9662;</span>';
    html += '</div>';

    // Sub-list (hidden initially)
    html += '<div class="section-help-dropdown-sublist" id="sectionOpenToList" style="display:none;">';
    for (var j = 0; j < config.features.length; j++) {
      var f = config.features[j];
      var isDefault = f.id === defaultPill;
      html += '<div class="section-help-dropdown-sublist-item' + (isDefault ? ' active' : '') + '" onclick="selectSectionDefaultPill(\'' + escapeHtml(sectionId) + '\', \'' + escapeHtml(f.id) + '\', \'' + escapeHtml(f.label) + '\')">' + escapeHtml(f.label) + '</div>';
    }
    html += '</div>';

    // v26.3: Reorder tabs option
    html += '<div class="section-help-dropdown-item" onclick="closeSectionHelpDropdown(); enablePillReorder(\'' + escapeHtml(sectionId) + '\')">';
    html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><polyline points="8 5 4 9 8 13"/><polyline points="16 11 20 15 16 19"/></svg>';
    html += 'Reorder tabs</div>';
  }

  dd.innerHTML = html;
  wrapper.appendChild(dd);

  // Close on click outside
  setTimeout(function() {
    document.addEventListener('click', _closeSectionHelpOnOutsideClick);
  }, 10);

  // Close on Escape
  document.addEventListener('keydown', _closeSectionHelpOnEscape);
}

function _closeSectionHelpOnOutsideClick(e) {
  var dd = document.getElementById('sectionHelpDropdown');
  if (dd && !dd.contains(e.target) && !e.target.classList.contains('section-help-btn')) {
    closeSectionHelpDropdown();
  }
}

function _closeSectionHelpOnEscape(e) {
  if (e.key === 'Escape') { closeSectionHelpDropdown(); return; }
  // v26.2: Arrow key navigation for dropdown
  var dd = document.getElementById('sectionHelpDropdown');
  if (!dd) return;
  var items = dd.querySelectorAll('.section-help-dropdown-item, .section-help-dropdown-toggle');
  if (items.length === 0) return;
  var focused = -1;
  for (var i = 0; i < items.length; i++) {
    if (items[i] === document.activeElement || items[i].classList.contains('focused')) { focused = i; break; }
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    var next = focused < items.length - 1 ? focused + 1 : 0;
    items[next].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    var prev = focused > 0 ? focused - 1 : items.length - 1;
    items[prev].focus();
  } else if (e.key === 'Enter' && focused >= 0) {
    e.preventDefault();
    items[focused].click();
  }
}

function closeSectionHelpDropdown() {
  var dd = document.getElementById('sectionHelpDropdown');
  if (dd && dd.parentNode) dd.parentNode.removeChild(dd);
  document.removeEventListener('click', _closeSectionHelpOnOutsideClick);
  document.removeEventListener('keydown', _closeSectionHelpOnEscape);
}

// v26.3: Pill reorder mode
function enablePillReorder(viewId) {
  // Find the pill nav container for this view
  var containerId = null;
  if (window._pillNavViewMap) {
    for (var key in window._pillNavViewMap) {
      if (window._pillNavViewMap[key] === viewId) { containerId = key; break; }
    }
  }
  if (!containerId) return;

  var container = document.getElementById(containerId);
  if (!container) return;
  var pillNav = container.querySelector('.pill-nav');
  if (!pillNav) return;

  pillNav.classList.add('pill-reorder-mode');

  // Make pills draggable
  var pills = pillNav.querySelectorAll('.pill-nav-item');
  for (var i = 0; i < pills.length; i++) {
    pills[i].setAttribute('draggable', 'true');
    pills[i].addEventListener('dragstart', handlePillDragStart);
    pills[i].addEventListener('dragend', handlePillDragEnd);
    pills[i].addEventListener('dragover', handlePillDragOver);
    pills[i].addEventListener('drop', function(e) { handlePillDrop(e, viewId); });
  }

  // Add Done button
  var doneBtn = document.createElement('button');
  doneBtn.className = 'pill-reorder-done-btn';
  doneBtn.textContent = 'Done';
  doneBtn.onclick = function() {
    pillNav.classList.remove('pill-reorder-mode');
    for (var j = 0; j < pills.length; j++) {
      pills[j].setAttribute('draggable', 'false');
    }
    doneBtn.parentNode.removeChild(doneBtn);
  };
  pillNav.appendChild(doneBtn);
}

var _pillDragId = null;

function handlePillDragStart(e) {
  _pillDragId = e.target.getAttribute('data-pill-id');
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _pillDragId);
}

function handlePillDragEnd(e) {
  e.target.classList.remove('dragging');
  _pillDragId = null;
}

function handlePillDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handlePillDrop(e, viewId) {
  e.preventDefault();
  if (!_pillDragId) return;

  var targetId = e.target.getAttribute('data-pill-id');
  if (!targetId || targetId === _pillDragId) return;

  // Get current pill order from the DOM
  var pillNav = e.target.closest('.pill-nav');
  if (!pillNav) return;
  var pills = pillNav.querySelectorAll('.pill-nav-item');
  var order = [];
  for (var i = 0; i < pills.length; i++) {
    var pid = pills[i].getAttribute('data-pill-id');
    if (pid) order.push(pid);
  }

  // Move dragged item to target position
  var fromIdx = order.indexOf(_pillDragId);
  var toIdx = order.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  order.splice(fromIdx, 1);
  order.splice(toIdx, 0, _pillDragId);

  // Save
  setSectionPref(viewId, 'pillOrder', order);

  // Re-render the pill nav to reflect new order
  // For immediate feedback, reorder DOM elements
  var fragment = document.createDocumentFragment();
  for (var j = 0; j < order.length; j++) {
    for (var k = 0; k < pills.length; k++) {
      if (pills[k].getAttribute('data-pill-id') === order[j]) {
        fragment.appendChild(pills[k]);
        break;
      }
    }
  }
  // Re-append Done button
  var doneBtn = pillNav.querySelector('.pill-reorder-done-btn');
  pillNav.innerHTML = '';
  pillNav.appendChild(fragment);
  if (doneBtn) pillNav.appendChild(doneBtn);
}

function toggleSectionSkipLanding(sectionId, el) {
  var toggle = el.querySelector('.section-help-toggle');
  if (!toggle) return;
  var isOn = toggle.classList.contains('on');
  toggle.classList.toggle('on', !isOn);
  setSectionPref(sectionId, 'skipLanding', !isOn);
}

function toggleSectionOpenTo(el, sectionId) {
  var list = document.getElementById('sectionOpenToList');
  if (list) list.style.display = list.style.display === 'none' ? '' : 'none';
}

function selectSectionDefaultPill(sectionId, pillId, label) {
  setSectionPref(sectionId, 'defaultPill', pillId);
  var labelEl = document.getElementById('sectionOpenToLabel');
  if (labelEl) labelEl.innerHTML = escapeHtml(label) + ' &#9662;';
  // Update active state in sub-list
  var items = document.querySelectorAll('.section-help-dropdown-sublist-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }
  if (event && event.target) event.target.classList.add('active');
  // Collapse sub-list
  var list = document.getElementById('sectionOpenToList');
  if (list) list.style.display = 'none';
}

// v27.0: Global landing pages toggle
function toggleGlobalLandingPages(el) {
  var toggle = el.classList ? el : el.querySelector('.section-help-toggle');
  if (!toggle) return;
  var isOn = toggle.classList.contains('on');
  toggle.classList.toggle('on', !isOn);
  // Toggle is "on" = landing pages enabled; "off" = disabled
  localStorage.setItem('roweos_landing_pages_disabled', isOn ? 'true' : 'false');
}

function initLandingPagesToggle() {
  var toggle = document.getElementById('landingPagesToggle');
  if (!toggle) return;
  var disabled = localStorage.getItem('roweos_landing_pages_disabled') === 'true';
  // Toggle "on" means landing pages are enabled (not disabled)
  toggle.classList.toggle('on', !disabled);
}

function checkFirstVisitHelp(sectionId) {
  // First-visit auto-open disabled — ? button now opens feedback modal directly
  if (!SECTION_HELP[sectionId]) return;
  markSectionVisited(sectionId);
}

// ── 8.3: Advanced Mode Toggle ──
function isAdvancedMode() {
  try { return localStorage.getItem('roweos_advanced_mode') === 'true'; } catch(e) { return false; }
}

function toggleAdvancedMode() {
  var current = isAdvancedMode();
  localStorage.setItem('roweos_advanced_mode', current ? 'false' : 'true');
  writeDB('profile/main', { advancedMode: !current }); // v25.1
  renderAdvancedModeToggle();
  // Refresh current view to apply changes
  var currentView = document.querySelector('.nav-item.active');
  if (currentView) {
    var view = currentView.getAttribute('data-view');
    if (view) showView(view);
  }
  showToast(current ? 'Simplified mode enabled' : 'Advanced tools enabled', 'success');
}

function renderAdvancedModeToggle() {
  var container = document.getElementById('advancedModeToggleContainer');
  if (!container) return;
  var isOn = isAdvancedMode();
  container.innerHTML = '<div class="advanced-mode-toggle">' +
    '<div class="toggle-info">' +
      '<span class="toggle-label">Advanced Tools</span>' +
      '<span class="toggle-desc">' + (isOn ? 'All features and options visible' : 'Simplified interface with guided defaults') + '</span>' +
    '</div>' +
    '<label class="toggle-switch" style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">' +
      '<input type="checkbox" ' + (isOn ? 'checked' : '') + ' onchange="toggleAdvancedMode()" style="opacity:0;width:0;height:0;">' +
      '<span style="position:absolute;inset:0;background:' + (isOn ? 'var(--brand-accent, #a89878)' : 'var(--bg-tertiary)') + ';border-radius:22px;transition:background 0.2s;border:1px solid var(--border-color);">' +
        '<span style="position:absolute;top:2px;' + (isOn ? 'right:2px' : 'left:2px') + ';width:16px;height:16px;background:#fff;border-radius:50%;transition:all 0.2s;"></span>' +
      '</span>' +
    '</label>' +
  '</div>';
}

// ── 8.2: Show/Hide Advanced Sections ──
function toggleAdvancedSection(btn, sectionId) {
  var section = document.getElementById(sectionId);
  if (!section) return;
  var isVisible = section.classList.contains('visible');
  section.classList.toggle('visible', !isVisible);
  btn.classList.toggle('expanded', !isVisible);
  btn.querySelector('span').textContent = isVisible ? 'Show Advanced' : 'Hide Advanced';
}

// ── 8.6: Guided Tour Engine ──
var GUIDED_TOURS = {
  studio: [
    { selector: '#studioTitle', title: 'Agent Studio', text: 'This is your AI operations hub. Choose operations from the list to generate content, documents, and media.' },
    { selector: '#studioOpsSearch', title: 'Find Operations', text: 'Search or browse operations by category. Each operation is tuned for a specific task.' },
    { selector: '#studioPromptArea', title: 'Enter Your Prompt', text: 'Type your instructions here. Be specific about what you need - the AI uses your brand context automatically.' },
    { selector: '#studioRunBtn', title: 'Generate', text: 'Click to run the operation. You can stop generation at any time.' },
    { selector: '#studioOutputArea', title: 'View Results', text: 'Your generated content appears here. Copy, save to Library, or export as PDF.' }
  ],
  agent: [
    { selector: '#agentBrand', title: 'Select Brand', text: 'Choose which brand context the AI should use for this conversation.' },
    { selector: '#followupCommand', title: 'Chat Input', text: 'Type your message here. Attach files with the paperclip icon for multimodal AI analysis.' },
    { selector: '#followupBtn', title: 'Send Message', text: 'Send your message to the AI. Responses stream in real-time.' },
    { selector: '#conversationThread', title: 'Conversation', text: 'Your conversation history. Messages are saved automatically.' }
  ],
  mail: [
    { selector: '[data-mail-tab="compose"]', title: 'Compose', text: 'Create new emails. Use "Write with AI" to generate content in your brand voice.' },
    { selector: '[data-mail-tab="outbox"]', title: 'Outbox', text: 'Review emails before sending. Edit, approve, or schedule delivery.' },
    { selector: '[data-mail-tab="sent"]', title: 'Sent', text: 'View your sent email history and delivery status.' },
    { selector: '[data-mail-tab="addressbook"]', title: 'Address Book', text: 'Manage contacts. Sync entries with your client profiles.' }
  ],
  clients: [
    { selector: '#addClientBtn', title: 'Add Client', text: 'Create a new client profile with contact info, categories, and priority.' },
    { selector: '#clientSearchInput', title: 'Search Clients', text: 'Find clients by name, email, or category.' },
    { selector: '#clientListContainer', title: 'Client List', text: 'Click any client to view details, attach sessions, or export their profile.' }
  ],
  settings: [
    { selector: '[data-settings-id="appearance"]', title: 'Appearance', text: 'Set your theme (dark/light), brand colors, and logo.' },
    { selector: '[data-settings-id="ai"]', title: 'AI & Models', text: 'Configure API keys for Anthropic, OpenAI, and Google. Set model preferences.' },
    { selector: '[data-settings-id="cloud"]', title: 'Cloud & Sync', text: 'Connect Firebase for cross-device sync, scheduled tasks, and push notifications.' },
    { selector: '[data-settings-id="connections"]', title: 'Connections', text: 'Link social media accounts, calendars, and email services.' }
  ],
  // v24.25: Additional guided tours
  bloom: [
    { selector: '.bloom-feed', title: 'Content Feed', text: 'Browse AI-generated content from Studio, chat, and automations. Scroll to discover.' },
    { selector: '.bloom-filters', title: 'Filters', text: 'Filter by content type, date, category, or source.' },
    { selector: '.bloom-card', title: 'Content Cards', text: 'Click any card to expand. Save favorites, copy text, or regenerate.' }
  ],
  pulse: [
    { selector: '#pulseGoalsList', title: 'Your Goals', text: 'Active goals with progress bars. Click any goal to update progress or edit details.' },
    { selector: '#addGoalBtn', title: 'Add Goal', text: 'Create short-term or long-term goals. Set deadlines and milestones.' },
    { selector: '#pulseJournal', title: 'Journal', text: 'Daily journal entries. Reflect on progress, wins, and challenges.' }
  ],
  rhythm: [
    { selector: '.rhythm-calendar', title: 'Calendar', text: 'View events by day, week, or month. Click any slot to create an event.' },
    { selector: '.rhythm-connections', title: 'Connections', text: 'Sync with Google Calendar, iCloud, or Outlook for unified scheduling.' }
  ],
  inventory: [
    { selector: '#inventoryList', title: 'Your Items', text: 'Track possessions, assets, and valuables. Organize by category.' },
    { selector: '#addInventoryBtn', title: 'Add Item', text: 'Add items with photos, purchase info, warranty details, and notes.' }
  ],
  commerce: [
    { selector: '#apiCostSummaryCards', title: 'Cost Summary', text: 'Track spending across Claude, GPT, and Gemini. See remaining budgets.' },
    { selector: '.analytics-chart', title: 'Usage Charts', text: 'Visual breakdown of API usage by provider, model, and time period.' }
  ],
  guardrails: [
    { selector: '.guardrails-content', title: 'Content Rules', text: 'Set content safety preferences and approval workflows for AI-generated content.' }
  ],
  tuning: [
    { selector: '.tuning-conversations', title: 'Conversation History', text: 'Browse and search past conversations. Click to resume any conversation.' }
  ],
  folio: [
    { selector: '#folioTabBar', title: 'Gallery & Chat', text: 'Switch between Gallery (your saved visuals) and Chat (create new ones with AI).' },
    { selector: '#folioChatInput', title: 'Describe a Visual', text: 'Type what you want to create. Dashboards, charts, diagrams, interactive tools, pitch decks, and more.' },
    { selector: '#folioGalleryGrid', title: 'Your Gallery', text: 'Saved visuals appear here as cards. Click to open, edit with AI, view versions, or add notes.' }
  ],
  research: [
    { selector: '#researchUrlInput', title: 'Start a Search', text: 'Enter any URL to analyze. RoweOS will crawl the site, search the web for context, and build a complete profile.' },
    { selector: '#researchGraphCanvas', title: 'Visual Network Graph', text: 'Watch pages being discovered and analyzed in real-time. Each node represents a page or web source.' },
    { selector: '#researchCardsContainer', title: 'Identity Cards', text: 'Results appear as identity section cards. Each shows AI-synthesized intelligence from all sources.' },
    { selector: '#researchActionsBar', title: 'Use Your Results', text: 'Save to a brand or life identity, send to an agent chat, save to Library, add to Folio, or copy as markdown.' },
    { selector: '#researchHistoryGrid', title: 'Research History', text: 'Past researches are saved here. Click any card to re-view results without running the search again.' }
  ]
};

var _tourState = { active: false, sectionId: null, stepIndex: 0, steps: [] };

function startGuidedTour(sectionId) {
  var steps = GUIDED_TOURS[sectionId];
  if (!steps || steps.length === 0) {
    showToast('No guided tour available for this section yet', 'info');
    return;
  }
  _tourState = { active: true, sectionId: sectionId, stepIndex: 0, steps: steps };
  showTourStep(0);
}

function showTourStep(index) {
  // Remove previous tour elements
  var prevBackdrop = document.querySelector('.tour-backdrop');
  var prevTooltip = document.querySelector('.tour-tooltip');
  var prevSpotlight = document.querySelector('.tour-spotlight');
  if (prevBackdrop) prevBackdrop.remove();
  if (prevTooltip) prevTooltip.remove();
  if (prevSpotlight) prevSpotlight.remove();

  if (index < 0 || index >= _tourState.steps.length) {
    endGuidedTour();
    return;
  }

  _tourState.stepIndex = index;
  var step = _tourState.steps[index];
  var el = document.querySelector(step.selector);

  // Create backdrop
  var backdrop = document.createElement('div');
  backdrop.className = 'tour-backdrop';
  backdrop.onclick = function() { endGuidedTour(); };
  document.body.appendChild(backdrop);

  // Position tooltip
  var tooltip = document.createElement('div');
  tooltip.className = 'tour-tooltip';
  var isLast = index === _tourState.steps.length - 1;
  tooltip.innerHTML = '<h4>' + escapeHtml(step.title) + '</h4>' +
    '<p>' + escapeHtml(step.text) + '</p>' +
    '<div class="tour-tooltip-nav">' +
      '<span class="tour-tooltip-progress">Step ' + (index + 1) + ' of ' + _tourState.steps.length + '</span>' +
      '<div class="tour-tooltip-btns">' +
        '<button class="tour-tooltip-skip" onclick="endGuidedTour()">Skip</button>' +
        (index > 0 ? '<button class="tour-tooltip-prev" onclick="showTourStep(' + (index - 1) + ')">Back</button>' : '') +
        '<button class="tour-tooltip-next" onclick="' + (isLast ? 'endGuidedTour()' : 'showTourStep(' + (index + 1) + ')') + '">' + (isLast ? 'Done' : 'Next') + '</button>' +
      '</div>' +
    '</div>';

  if (el) {
    var rect = el.getBoundingClientRect();
    // Create spotlight
    var spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';
    spotlight.style.top = (rect.top - 4) + 'px';
    spotlight.style.left = (rect.left - 4) + 'px';
    spotlight.style.width = (rect.width + 8) + 'px';
    spotlight.style.height = (rect.height + 8) + 'px';
    document.body.appendChild(spotlight);

    // Position tooltip below or above element
    var tooltipTop = rect.bottom + 12;
    if (tooltipTop + 200 > window.innerHeight) {
      tooltipTop = rect.top - 200;
    }
    tooltip.style.top = Math.max(8, tooltipTop) + 'px';
    tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 340)) + 'px';
  } else {
    // Element not found, center the tooltip
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
  }

  document.body.appendChild(tooltip);
}

function endGuidedTour() {
  _tourState.active = false;
  var backdrop = document.querySelector('.tour-backdrop');
  var tooltip = document.querySelector('.tour-tooltip');
  var spotlight = document.querySelector('.tour-spotlight');
  if (backdrop) backdrop.remove();
  if (tooltip) tooltip.remove();
  if (spotlight) spotlight.remove();
}

// ── 8.4: First-Run Banner ──
function showFirstRunBanner(containerId, sectionId, title, desc, actionLabel, actionFn) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var bannerKey = 'roweos_firstrun_' + sectionId;
  try { if (localStorage.getItem(bannerKey) === 'dismissed') return; } catch(e) {}

  var banner = document.createElement('div');
  banner.className = 'first-run-banner';
  banner.id = 'firstRunBanner_' + sectionId;
  banner.innerHTML = '<div class="banner-text">' +
      '<div class="banner-title">' + escapeHtml(title) + '</div>' +
      '<div class="banner-desc">' + escapeHtml(desc) + '</div>' +
    '</div>' +
    (actionLabel ? '<button class="banner-btn" onclick="' + actionFn + '">' + escapeHtml(actionLabel) + '</button>' : '') +
    '<button class="banner-close" onclick="this.parentElement.remove();try{localStorage.setItem(\'' + bannerKey + '\',\'dismissed\')}catch(e){}">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
    '</button>';
  container.insertBefore(banner, container.firstChild);
}

// ── 8.1: ADHD — Success flash on element ──
function flashSuccess(elementOrId) {
  var el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el) return;
  el.classList.remove('success-flash');
  void el.offsetWidth; // force reflow
  el.classList.add('success-flash');
  setTimeout(function() { el.classList.remove('success-flash'); }, 700);
}

// ── 8.1: ADHD — Better toast for common errors ──
var FRIENDLY_ERRORS = {
  'Failed to fetch': 'Network error - check your internet connection and try again.',
  'NetworkError': 'Network error - check your internet connection and try again.',
  'AbortError': 'Request was cancelled.',
  'rate_limit': 'Rate limited - wait a moment and try again.',
  'overloaded': 'The AI service is busy - try again in a few seconds.',
  '401': 'API key is invalid or expired. Check your key in Settings.',
  '403': 'Access denied. Your API key may not have permission for this model.',
  '429': 'Too many requests - wait a moment and try again.',
  '500': 'The AI service had an internal error. Try again.',
  '503': 'The AI service is temporarily unavailable. Try again shortly.'
};

function friendlyError(errorMsg) {
  if (!errorMsg || typeof errorMsg !== 'string') return errorMsg;
  for (var pattern in FRIENDLY_ERRORS) {
    if (errorMsg.indexOf(pattern) !== -1) return FRIENDLY_ERRORS[pattern];
  }
  return errorMsg;
}

/**
 * v15.4: Budget Dashboard for LifeAI Finances
 * Shows monthly budget tracking, expense categories, and spending insights
 */
function renderBudgetDashboard() {
  var container = document.getElementById('budgetDashboardContainer');
  if (!container) return;

  var budget = JSON.parse(localStorage.getItem('roweos_life_budget') || '{}');
  var expenses = JSON.parse(localStorage.getItem('roweos_life_expenses') || '[]');
  var monthlyBudget = budget.monthly || 0;

  // Filter expenses to current month
  var now = new Date();
  var currentMonth = now.getMonth();
  var currentYear = now.getFullYear();
  var monthExpenses = expenses.filter(function(e) {
    var d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  var totalSpent = monthExpenses.reduce(function(sum, e) { return sum + (e.amount || 0); }, 0);
  var remaining = monthlyBudget - totalSpent;
  var percentUsed = monthlyBudget > 0 ? Math.min((totalSpent / monthlyBudget) * 100, 100) : 0;

  // Category breakdown
  var categories = {};
  monthExpenses.forEach(function(e) {
    var cat = e.category || 'Other';
    if (!categories[cat]) categories[cat] = 0;
    categories[cat] += e.amount || 0;
  });

  var catColors = {
    'Housing': '#8b5cf6',
    'Food': '#22c55e',
    'Transport': '#3b82f6',
    'Entertainment': '#f59e0b',
    'Shopping': '#ec4899',
    'Health': '#14b8a6',
    'Bills': '#ef4444',
    'Other': '#6b7280'
  };

  var html = '';

  // Monthly budget setup (if not set)
  html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">';
  html += '  <div style="font-size: var(--text-lg); font-weight: 600;">Monthly Budget</div>';
  html += '  <div style="display: flex; align-items: center; gap: var(--space-2);">';
  html += '    <span style="color: var(--text-muted);">$</span>';
  html += '    <input type="number" id="monthlyBudgetInput" value="' + monthlyBudget + '" onchange="saveMonthlyBudget(this.value)" style="width: 100px; padding: 6px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-base); text-align: right;" placeholder="0">';
  html += '    <span style="color: var(--text-muted); font-size: var(--text-sm);">/month</span>';
  html += '  </div>';
  html += '</div>';

  // Budget progress bar
  var barColor = percentUsed > 90 ? '#ef4444' : percentUsed > 70 ? '#f59e0b' : 'var(--brand-accent, var(--accent))';
  html += '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-5); margin-bottom: var(--space-4);">';
  html += '  <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-3);">';
  html += '    <span style="font-size: var(--text-2xl); font-weight: 600; color: var(--text-primary);">$' + totalSpent.toFixed(2) + '</span>';
  html += '    <span style="font-size: var(--text-sm); color: var(--text-muted);">';
  if (monthlyBudget > 0) {
    html += remaining >= 0 ? ('$' + remaining.toFixed(2) + ' remaining') : ('$' + Math.abs(remaining).toFixed(2) + ' over budget');
  } else {
    html += 'Set a budget above';
  }
  html += '</span></div>';
  html += '  <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">';
  html += '    <div style="height: 100%; width: ' + percentUsed + '%; background: ' + barColor + '; border-radius: 4px; transition: width 0.3s;"></div>';
  html += '  </div>';
  if (monthlyBudget > 0) {
    html += '  <div style="text-align: right; font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px;">' + percentUsed.toFixed(0) + '% used</div>';
  }
  html += '</div>';

  // Summary cards
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-5);">';
  html += '  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">';
  html += '    <div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: 4px;">This Month</div>';
  html += '    <div style="font-size: var(--text-xl); font-weight: 600; color: var(--text-primary);">' + monthExpenses.length + '</div>';
  html += '    <div style="font-size: var(--text-xs); color: var(--text-muted);">transactions</div>';
  html += '  </div>';
  html += '  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">';
  html += '    <div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: 4px;">Daily Avg</div>';
  var daysInMonth = now.getDate();
  var dailyAvg = daysInMonth > 0 ? totalSpent / daysInMonth : 0;
  html += '    <div style="font-size: var(--text-xl); font-weight: 600; color: var(--text-primary);">$' + dailyAvg.toFixed(2) + '</div>';
  html += '    <div style="font-size: var(--text-xs); color: var(--text-muted);">per day</div>';
  html += '  </div>';
  html += '  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">';
  html += '    <div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: 4px;">Categories</div>';
  html += '    <div style="font-size: var(--text-xl); font-weight: 600; color: var(--text-primary);">' + Object.keys(categories).length + '</div>';
  html += '    <div style="font-size: var(--text-xs); color: var(--text-muted);">active</div>';
  html += '  </div>';
  html += '</div>';

  // Category breakdown
  var sortedCats = Object.keys(categories).sort(function(a, b) { return categories[b] - categories[a]; });
  if (sortedCats.length > 0) {
    html += '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-5); margin-bottom: var(--space-5);">';
    html += '  <div style="font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-4);">Spending by Category</div>';
    sortedCats.forEach(function(cat) {
      var amount = categories[cat];
      var pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
      var color = catColors[cat] || '#6b7280';
      html += '<div style="margin-bottom: var(--space-3);">';
      html += '  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
      html += '    <span style="font-size: var(--text-sm); color: var(--text-primary);">' + escapeHtml(cat) + '</span>';
      html += '    <span style="font-size: var(--text-sm); color: var(--text-secondary);">$' + amount.toFixed(2) + '</span>';
      html += '  </div>';
      html += '  <div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">';
      html += '    <div style="height: 100%; width: ' + pct + '%; background: ' + color + '; border-radius: 3px;"></div>';
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Add expense form
  html += '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-5); margin-bottom: var(--space-5);">';
  html += '  <div style="font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-4);">Add Expense</div>';
  html += '  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">';
  html += '    <input type="text" id="expenseDescription" placeholder="Description" class="form-control" style="padding: 8px 12px;">';
  html += '    <input type="number" id="expenseAmount" placeholder="Amount" class="form-control" style="padding: 8px 12px;" step="0.01">';
  html += '  </div>';
  html += '  <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--space-3);">';
  html += '    <select id="expenseCategory" class="form-control" style="padding: 8px 12px;">';
  html += '      <option value="Housing">Housing</option>';
  html += '      <option value="Food">Food</option>';
  html += '      <option value="Transport">Transport</option>';
  html += '      <option value="Entertainment">Entertainment</option>';
  html += '      <option value="Shopping">Shopping</option>';
  html += '      <option value="Health">Health</option>';
  html += '      <option value="Bills">Bills</option>';
  html += '      <option value="Other">Other</option>';
  html += '    </select>';
  html += '    <input type="date" id="expenseDate" class="form-control" style="padding: 8px 12px;" value="' + now.toISOString().split('T')[0] + '">';
  html += '    <button onclick="addLifeExpense()" class="btn btn-primary" style="padding: 8px 16px; white-space: nowrap;">Add</button>';
  html += '  </div>';
  html += '</div>';

  // Recent expenses
  var recent = monthExpenses.sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 15);
  if (recent.length > 0) {
    html += '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-5);">';
    html += '  <div style="font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-4);">Recent Expenses</div>';
    recent.forEach(function(e) {
      var color = catColors[e.category] || '#6b7280';
      html += '<div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">';
      html += '  <div style="display: flex; align-items: center; gap: var(--space-3);">';
      html += '    <div style="width: 8px; height: 8px; border-radius: 50%; background: ' + color + ';"></div>';
      html += '    <div>';
      html += '      <div style="font-size: var(--text-sm); color: var(--text-primary);">' + escapeHtml(e.description || 'Unnamed') + '</div>';
      html += '      <div style="font-size: var(--text-xs); color: var(--text-muted);">' + escapeHtml(e.category || 'Other') + ' &middot; ' + (e.date || '') + '</div>';
      html += '    </div>';
      html += '  </div>';
      html += '  <div style="display: flex; align-items: center; gap: var(--space-2);">';
      html += '    <span style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">$' + (e.amount || 0).toFixed(2) + '</span>';
      html += '    <button onclick="deleteLifeExpense(\'' + (e.id || '') + '\')" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px;" title="Delete">';
      html += '      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      html += '    </button>';
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align: center; padding: 40px; color: var(--text-tertiary);">';
    html += '  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: var(--space-3); opacity: 0.4;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
    html += '  <div>No expenses this month. Add one above to start tracking.</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

function saveMonthlyBudget(value) {
  var budget = JSON.parse(localStorage.getItem('roweos_life_budget') || '{}');
  budget.monthly = parseFloat(value) || 0;
  localStorage.setItem('roweos_life_budget', JSON.stringify(budget));
  renderBudgetDashboard();
}

function addLifeExpense() {
  var desc = document.getElementById('expenseDescription');
  var amount = document.getElementById('expenseAmount');
  var category = document.getElementById('expenseCategory');
  var date = document.getElementById('expenseDate');

  if (!desc || !amount || !desc.value.trim() || !amount.value) {
    showToast('Please enter description and amount', 'warning');
    return;
  }

  var expenses = JSON.parse(localStorage.getItem('roweos_life_expenses') || '[]');
  expenses.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    description: desc.value.trim(),
    amount: parseFloat(amount.value) || 0,
    category: category ? category.value : 'Other',
    date: date ? date.value : new Date().toISOString().split('T')[0]
  });
  localStorage.setItem('roweos_life_expenses', JSON.stringify(expenses));

  desc.value = '';
  amount.value = '';
  renderBudgetDashboard();
  showToast('Expense added', 'success');
}

function deleteLifeExpense(id) {
  if (!id) return;
  var expenses = JSON.parse(localStorage.getItem('roweos_life_expenses') || '[]');
  expenses = expenses.filter(function(e) { return e.id !== id; });
  localStorage.setItem('roweos_life_expenses', JSON.stringify(expenses));
  renderBudgetDashboard();
  showToast('Expense removed', 'success');
}

// Schedule Calendar Functions
function renderScheduleCalendar() {
  var now = new Date();
  var currentMonth = now.getMonth();
  var currentYear = now.getFullYear();
  
  // Store in global for navigation
  window.calendarMonth = currentMonth;
  window.calendarYear = currentYear;
  
  updateCalendarDisplay(currentYear, currentMonth);
  renderScheduledTasksList();
}

function updateCalendarDisplay(year, month) {
  var monthEl = document.getElementById('currentMonth');
  if (monthEl) {
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
    monthEl.textContent = monthNames[month] + ' ' + year;
  }
  
  generateCalendarDays(year, month);
}

function generateCalendarDays(year, month) {
  var container = document.getElementById('calendarGrid');
  if (!container) return;
  
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = new Date();
  
  // Clear existing calendar days (keep headers)
  var children = Array.from(container.children);
  children.slice(7).forEach(function(child) { child.remove(); });
  
  // Empty cells before first day
  for (var i = 0; i < firstDay; i++) {
    var empty = document.createElement('div');
    empty.className = 'schedule-day-empty';
    container.appendChild(empty);
  }
  
  // Calendar days
  for (var day = 1; day <= daysInMonth; day++) {
    var isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    var hasTasks = hasTasksOnDate(year, month, day);
    
    var dayCell = document.createElement('div');
    dayCell.className = 'schedule-day-cell' + (isToday ? ' is-today' : '');
    
    if (isToday) dayCell.dataset.isToday = 'true';
    
    (function(y, m, d) {
      dayCell.onclick = function() { selectCalendarDay(y, m, d); };
    })(year, month, day);
    
    var dayNum = document.createElement('span');
    dayNum.textContent = day;
    dayCell.appendChild(dayNum);
    
    if (hasTasks) {
      var dot = document.createElement('div');
      dot.className = 'task-indicator';
      dayCell.appendChild(dot);
    }
    
    container.appendChild(dayCell);
  }
}

function hasTasksOnDate(year, month, day) {
  var tasks = getScheduledTasks();
  var targetDate = new Date(year, month, day).toDateString();
  
  return tasks.some(function(task) {
    if (task.frequency === 'once') {
      return new Date(task.scheduledDate).toDateString() === targetDate;
    }
    // For recurring, check if it falls on this date
    return checkRecurringTask(task, year, month, day);
  });
}

function checkRecurringTask(task, year, month, day) {
  var taskDate = new Date(task.scheduledDate);
  var checkDate = new Date(year, month, day);
  
  if (checkDate < taskDate) return false;
  
  if (task.frequency === 'daily') return true;
  if (task.frequency === 'weekly') {
    var daysDiff = Math.floor((checkDate - taskDate) / (1000 * 60 * 60 * 24));
    return daysDiff % 7 === 0;
  }
  if (task.frequency === 'monthly') {
    return checkDate.getDate() === taskDate.getDate();
  }
  
  return false;
}

function selectCalendarDay(year, month, day) {
  var date = new Date(year, month, day);
  var dateStr = date.toDateString();
  
  // Get tasks for this day
  var tasks = getScheduledTasks();
  var tasksOnDate = tasks.filter(function(task) {
    if (task.frequency === 'once') {
      return new Date(task.scheduledDate).toDateString() === dateStr;
    }
    return checkRecurringTask(task, year, month, day);
  });
  
  if (tasksOnDate.length > 0) {
    showToast(tasksOnDate.length + ' task(s) on ' + date.toLocaleDateString(), 'success');
    // Scroll to task list
    var taskList = document.getElementById('scheduledTasksList');
    if (taskList) {
      taskList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else {
    showToast('No tasks on ' + date.toLocaleDateString(), 'info');
  }
}

function previousMonth() {
  window.calendarMonth--;
  if (window.calendarMonth < 0) {
    window.calendarMonth = 11;
    window.calendarYear--;
  }
  updateCalendarDisplay(window.calendarYear, window.calendarMonth);
}

function nextMonth() {
  window.calendarMonth++;
  if (window.calendarMonth > 11) {
    window.calendarMonth = 0;
    window.calendarYear++;
  }
  updateCalendarDisplay(window.calendarYear, window.calendarMonth);
}

function renderScheduledTasksList() {
  var container = document.getElementById('scheduledTasksList');
  if (!container) return;
  
  var tasks = getScheduledTasks();
  
  if (tasks.length === 0) {
    container.innerHTML = '<div style=\"padding: var(--space-6); color: var(--text-tertiary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg);\">No scheduled tasks yet. Click \"+ New Task\" to create your first automation.</div>';
    return;
  }
  
  // v15.23: Use user's accent color instead of hardcoded green
  var accentColor = getAccentFallback();
  var html = '<div style="display: flex; flex-direction: column; gap: var(--space-3);">';
  tasks.forEach(function(task, idx) {
    var statusColor = task.enabled ? accentColor : '#888';
    var taskColor = task.color || '#6366f1';
    var taskTime = task.time || '09:00';
    var nextRun = getNextRunTime(task);
    
    html += '<div style="display: flex; justify-content: between; align-items: center; padding: var(--space-4); background: var(--bg-tertiary); border-radius: var(--radius-md); border-left: 3px solid ' + taskColor + ';">';
    html += '<div style="flex: 1;">';
    html += '<div style="font-weight: 600; font-size: var(--text-base); margin-bottom: var(--space-1); display: flex; align-items: center; gap: var(--space-2);">';
    html += '<span>' + task.name + '</span>';
    if (task.brand) {
      // v10.5.25: Show "Life" instead of "_life"
      // v15.23: Use accent color for badge instead of hardcoded gold
      var brandDisplay = task.brand === '_life' ? 'Life' : task.brand;
      html += '<span style="font-size: var(--text-xs); padding: 3px 8px; background: ' + accentColor + '22; color: ' + accentColor + '; border-radius: var(--radius-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">' + brandDisplay + '</span>';
    }
    html += '</div>';
    html += '<div style="font-size: var(--text-sm); color: var(--text-tertiary);">' + task.description + '</div>';
    html += '<div style="font-size: var(--text-sm); color: var(--text-secondary); margin-top: var(--space-2);">';
    html += formatFrequency(task.frequency) + ' at ' + (typeof formatTimeDisplay === 'function' ? formatTimeDisplay(taskTime) : taskTime) + ' • Next: ' + nextRun;
    html += '</div>';
    html += '</div>';
    html += '<div style="display: flex; gap: var(--space-3); align-items: center;">';
    
    // Toggle switch
    html += '<label style="position: relative; display: inline-block; width: 48px; height: 24px; cursor: pointer;">';
    html += '<input type="checkbox" ' + (task.enabled ? 'checked' : '') + ' onchange="toggleTask(' + idx + ')" style="opacity: 0; width: 0; height: 0;">';
    html += '<span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ' + (task.enabled ? accentColor : '#555') + '; transition: 0.3s; border-radius: var(--radius-2xl);"></span>';
    html += '<span style="position: absolute; content: \'\'; height: 18px; width: 18px; left: ' + (task.enabled ? '27px' : '3px') + '; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>';
    html += '</label>';
    
    html += '<button class="btn btn-primary btn-small" onclick="runTaskNow(' + idx + ')" title="Run this task immediately">▶ Run</button>';
    html += '<button class="btn btn-secondary btn-small" onclick="editTask(' + idx + ')">Edit</button>';
    html += '<button class="btn btn-secondary btn-small" onclick="deleteTask(' + idx + ')">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  
  container.innerHTML = html;
}

function getScheduledTasks() {
  var data = localStorage.getItem('roweos_scheduled_tasks');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveScheduledTasks(tasks) {
  localStorage.setItem('roweos_scheduled_tasks', JSON.stringify(tasks));
  // v25.1: Also update roweos_automations (dual storage) and write each automation to Firestore
  var allAutos = [];
  try { allAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}

  // v25.2: Write ALL automation types to Firestore (not just workflow/pipeline)
  // so Cloud Scheduler can find and execute them overnight
  tasks.forEach(function(t) {
    writeDBAutomation(t);
    var found = false;
    for (var i = 0; i < allAutos.length; i++) {
      if (String(allAutos[i].id) === String(t.id)) { allAutos[i] = t; found = true; break; }
    }
    if (!found) allAutos.push(t);
  });
  localStorage.setItem('roweos_automations', JSON.stringify(allAutos));
  stampLocalSave();
}

// v9.1.14: Run a scheduled task manually
function runScheduledTask(taskId) {
  var tasks = getScheduledTasks();
  // v9.1.14: Convert to string for comparison (IDs may be numbers or strings)
  var taskIdStr = String(taskId);
  var taskIdx = tasks.findIndex(function(t) { return String(t.id) === taskIdStr; });
  
  if (taskIdx === -1) {
    showToast('Task not found', 'error');
    return;
  }
  
  var task = tasks[taskIdx];
  showToast('Running: ' + task.name, 'info');
  
  // Execute the task
  executeScheduledTask(task, taskIdx).then(function() {
    showToast('Completed: ' + task.name, 'success');
    // Re-render the task list
    if (typeof renderScheduledTasksList === 'function') renderScheduledTasksList();
    if (typeof renderRhythmDayAutomations === 'function') renderRhythmDayAutomations();
  }).catch(function(err) {
    showToast('Failed: ' + (err.message || 'Unknown error'), 'error');
  });
}

// v9.1.14: Delete a scheduled task
function deleteScheduledTask(taskId) {
  if (!confirm('Are you sure you want to delete this automation?')) return;

  var tasks = getScheduledTasks();
  // v9.1.14: Convert to string for comparison (IDs may be numbers or strings)
  var taskIdStr = String(taskId);
  var taskIdx = tasks.findIndex(function(t) { return String(t.id) === taskIdStr; });

  if (taskIdx === -1) {
    console.error('[deleteScheduledTask] Task not found. Looking for:', taskId, 'Type:', typeof taskId);
    console.error('[deleteScheduledTask] Available IDs:', tasks.map(function(t) { return t.id + ' (' + typeof t.id + ')'; }));
    showToast('Task not found', 'error');
    return;
  }

  var taskName = tasks[taskIdx].name;

  // Remove from scheduled tasks
  tasks.splice(taskIdx, 1);
  saveScheduledTasks(tasks);

  // v25.1: Also remove from roweos_automations (dual storage)
  try {
    var automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    automations = automations.filter(function(a) { return String(a.id) !== taskIdStr; });
    localStorage.setItem('roweos_automations', JSON.stringify(automations));
  } catch(e) {}

  // v25.1: Delete from Firestore via write-through
  deleteDBDoc('automations', taskIdStr, 'automations');

  showToast('Deleted: ' + taskName, 'success');

  // Re-render the task list
  if (typeof renderScheduledTasksList === 'function') renderScheduledTasksList();
  if (typeof renderRhythmDayAutomations === 'function') renderRhythmDayAutomations();
  if (typeof renderNotificationCenter === 'function') renderNotificationCenter();
  if (typeof renderNCWidgets === 'function') try { renderNCWidgets(); } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// v9.1.14: AUTOMATION NOTIFICATION CENTER
// ═══════════════════════════════════════════════════════════════════════════════

var completedAutomations = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]');
var notificationCenterCollapsed = false;

function saveCompletedAutomations() {
  // Keep only last 20 completed automations
  if (completedAutomations.length > 20) {
    completedAutomations = completedAutomations.slice(-20);
  }
  localStorage.setItem('roweos_completed_automations', JSON.stringify(completedAutomations));
}

function addCompletedAutomation(task, success) {
  completedAutomations.push({
    id: task.id,
    name: task.name,
    brand: task.brand || 'General',
    completedAt: new Date().toISOString(),
    success: success
  });
  saveCompletedAutomations();
  renderNotificationCenter();
  if (typeof updateSidebarBadges === 'function') updateSidebarBadges(); // v24.13
  // v15.3: Toast notification when automation completes
  // v25.1: Clickable toast — click to view result modal
  // v28.7: Deduplicate — skip if a toast with the same message already exists
  var _a1Msg = (success ? 'Automation completed: ' : 'Automation failed: ') + escapeHtml(task.name || 'Unknown');
  var _a1Existing = document.getElementById('toastContainer');
  if (_a1Existing) {
    var _a1Dupes = _a1Existing.querySelectorAll('.toast-message');
    for (var _a1i = 0; _a1i < _a1Dupes.length; _a1i++) {
      if (_a1Dupes[_a1i].textContent === _a1Msg) return; // already showing this toast
    }
  }
  if (success) {
    var _a1TaskId = task.id;
    var _a1El = document.createElement('div');
    _a1El.className = 'toast success show';
    _a1El.style.cssText = 'cursor:pointer;';
    _a1El.innerHTML = '<svg class="toast-icon" style="color:var(--success);" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none"/></svg>' +
      '<div class="toast-content"><div class="toast-message">' + _a1Msg + '</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;">Tap to view result</div></div>';
    _a1El.onclick = function() {
      _a1El.remove();
      viewCompletedAutomation(_a1TaskId);
    };
    var _a1Container = document.getElementById('toastContainer');
    if (!_a1Container) { _a1Container = document.createElement('div'); _a1Container.id = 'toastContainer'; _a1Container.className = 'toast-container'; document.body.appendChild(_a1Container); }
    _a1Container.appendChild(_a1El);
    setTimeout(function() { _a1El.classList.remove('show'); setTimeout(function() { if (_a1El.parentNode) _a1El.parentNode.removeChild(_a1El); }, 300); }, 5000);
  } else {
    var _a1FailId = task.id;
    var _a1FailEl = document.createElement('div');
    _a1FailEl.className = 'toast error show';
    _a1FailEl.style.cssText = 'cursor:pointer;';
    _a1FailEl.innerHTML = '<svg class="toast-icon" style="color:var(--error);" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none"/></svg>' +
      '<div class="toast-content"><div class="toast-message">' + _a1Msg + '</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;">Tap to view error</div></div>';
    _a1FailEl.onclick = function() {
      _a1FailEl.remove();
      viewCompletedAutomation(_a1FailId);
    };
    var _a1FC = document.getElementById('toastContainer');
    if (!_a1FC) { _a1FC = document.createElement('div'); _a1FC.id = 'toastContainer'; _a1FC.className = 'toast-container'; document.body.appendChild(_a1FC); }
    _a1FC.appendChild(_a1FailEl);
    setTimeout(function() { _a1FailEl.classList.remove('show'); setTimeout(function() { if (_a1FailEl.parentNode) _a1FailEl.parentNode.removeChild(_a1FailEl); }, 300); }, 5000);
  }
}

function toggleNotificationCenter() {
  var content = document.getElementById('notificationCenterContent');
  var toggleText = document.getElementById('notificationCenterToggleText');
  
  if (!content) return;
  
  notificationCenterCollapsed = !notificationCenterCollapsed;
  content.style.display = notificationCenterCollapsed ? 'none' : 'grid';
  if (toggleText) {
    toggleText.textContent = notificationCenterCollapsed ? 'Show' : 'Hide';
  }
}

function renderNotificationCenter() {
  var scheduledList = document.getElementById('notificationScheduledList');
  var completedList = document.getElementById('notificationCompletedList');
  var emptyEl = document.getElementById('rhythmActivityEmpty');

  if (!scheduledList || !completedList) return;

  var tasks = getScheduledTasks();
  var hasContent = tasks.length > 0 || completedAutomations.length > 0;

  // v22.39: Show/hide empty state in Activity column
  if (emptyEl) emptyEl.style.display = hasContent ? 'none' : '';
  
  // Render scheduled automations
  if (tasks.length === 0) {
    scheduledList.innerHTML = '<div class="notification-empty">No scheduled automations</div>';
  } else {
    var scheduledHtml = '';
    // Show up to 5 upcoming
    tasks.slice(0, 5).forEach(function(task) {
      var nextRun = task.frequency === 'once' ? task.scheduledDate : getNextRunDate(task);
      var timeStr = task.time || '09:00';
      // v10.5.25: Make clickable to edit/view
      // v10.5.25: Show "Life" instead of "_life"
      var brandDisplay = task.brand === '_life' ? 'Life' : task.brand;
      scheduledHtml += '<div class="notification-item scheduled" onclick="editScheduledAutomation(\'' + task.id + '\')" style="cursor: pointer;">' +
        '<div class="notification-item-name">' + escapeHtml(task.name) + '</div>' +
        '<div class="notification-item-time">' + timeStr + '</div>' +
        (task.brand ? '<div class="notification-item-brand">' + escapeHtml(brandDisplay) + '</div>' : '') +
        '</div>';
    });
    scheduledList.innerHTML = scheduledHtml;
  }
  
  // Render completed automations (most recent first)
  if (completedAutomations.length === 0) {
    completedList.innerHTML = '<div class="notification-empty">No recent completions</div>';
  } else {
    var completedHtml = '';
    // Show last 5 completed
    completedAutomations.slice(-5).reverse().forEach(function(item) {
      var completedDate = new Date(item.completedAt);
      var timeAgo = getTimeAgo(completedDate);
      // v10.5.25: Make clickable to view result
      completedHtml += '<div class="notification-item completed" onclick="viewCompletedAutomation(\'' + item.id + '\')" style="cursor: pointer;">' +
        '<div class="notification-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div class="notification-item-time">' + timeAgo + '</div>' +
        (item.brand ? '<div class="notification-item-brand">' + escapeHtml(item.brand) + '</div>' : '') +
        '</div>';
    });
    completedList.innerHTML = completedHtml;
  }
}

function getNextRunDate(task) {
  // Simplified - just return frequency info
  if (task.frequency === 'daily') return 'Daily';
  if (task.frequency === 'weekly') return 'Weekly';
  if (task.frequency === 'monthly') return 'Monthly';
  return task.scheduledDate || 'Scheduled';
}

// v12.0.0: getTimeAgo moved to utils.timeAgo (alias at top of JS section)

// v10.5.25: View completed automation result with rich text
// v20.6: Show automation result with failure reason and link to Executions
function viewCompletedAutomation(taskId) {
  var taskIdStr = String(taskId);

  // Get history to find result
  var history = JSON.parse(localStorage.getItem('roweos_task_history') || '[]');
  var historyItem = history.find(function(h) { return String(h.taskId) === taskIdStr; });

  // v18.6: Fallback to roweos_auto_lab_history if roweos_task_history has no match
  var labMatch = null;
  if (!historyItem || !historyItem.result) {
    try {
      var autoLabHist = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]');
      for (var _lhi = autoLabHist.length - 1; _lhi >= 0; _lhi--) {
        if (String(autoLabHist[_lhi].id) === taskIdStr && autoLabHist[_lhi].result) {
          labMatch = autoLabHist[_lhi]; break;
        }
      }
      if (labMatch) {
        historyItem = { taskId: taskIdStr, taskName: labMatch.name || 'Automation', result: labMatch.result, timestamp: labMatch.timestamp, brand: '', success: labMatch.success };
      }
    } catch(e) {}
  }

  if (!historyItem || !historyItem.result) {
    // v24.24: Show toast and navigate to automations view directly
    showView('automations');
    showToast('No result saved for this automation', 'info');
    return;
  }

  // v20.6: Detect if this was a failure
  var isFailed = false;
  if (historyItem.success === false || (labMatch && labMatch.success === false)) {
    isFailed = true;
  } else if (historyItem.result && (historyItem.result.indexOf('failed') !== -1 || historyItem.result.indexOf('error') !== -1 || historyItem.result.indexOf('0/') !== -1)) {
    isFailed = true;
  }

  // Format result with rich text (markdown-style)
  var formattedResult = formatMessageContent(historyItem.result);

  // v20.6: Add failure banner if failed
  var failureBanner = '';
  if (isFailed) {
    failureBanner = '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:flex-start;gap:8px;">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<div style="font-size:13px;color:#ef4444;line-height:1.5;">' + escapeHtml(historyItem.result).substring(0, 300) + '</div></div>';
  }

  // Show result in modal
  var modal = document.createElement('div');
  modal.className = 'api-key-modal active';
  modal.id = 'automationResultModal';
  modal.onclick = function() { modal.remove(); };
  modal.innerHTML =
    '<div class="api-key-modal-content" onclick="event.stopPropagation()" style="max-width: 700px; max-height: 80vh;">' +
      '<h3 class="api-key-modal-title">' + escapeHtml(historyItem.taskName) + '</h3>' +
      '<p class="api-key-modal-desc">' +
        (historyItem.brand ? 'Brand: ' + escapeHtml(historyItem.brand) + ' · ' : '') +
        'Completed: ' + new Date(historyItem.timestamp).toLocaleString() +
      '</p>' +
      failureBanner +
      '<div class="automation-result-content" style="max-height: 60vh; overflow-y: auto; background: var(--bg-secondary); padding: var(--space-4); border-radius: var(--radius-md); margin: 16px 0; font-size: var(--text-base); line-height: 1.7;">' +
        formattedResult +
      '</div>' +
      '<div class="api-key-modal-actions" style="flex-wrap:wrap;">' +
        '<button class="api-key-modal-btn api-key-modal-btn-cancel" onclick="this.closest(\'.api-key-modal\').remove()">Close</button>' +
        '<button class="api-key-modal-btn" style="background: var(--bg-tertiary); border: 1px solid var(--border-color);" onclick="copyToClipboard(`' + historyItem.result.replace(/`/g, '\\`').replace(/\\/g, '\\\\') + '`); showToast(\'Copied to clipboard\', \'success\');">Copy</button>' +
        '<button class="api-key-modal-btn" style="background: var(--bg-tertiary); border: 1px solid var(--border-color);" onclick="this.closest(\'.api-key-modal\').remove(); showView(\'automations\'); setTimeout(function(){ showAutoLabTab(\'scheduler\');' + (labMatch ? ' setTimeout(function(){ var el=document.getElementById(\'autoLabHistoryEntry_' + (labMatch.id || '') + '\'); if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});el.style.outline=\'2px solid var(--brand-accent,#a89878)\';el.style.outlineOffset=\'2px\';setTimeout(function(){el.style.outline=\'none\';},3000);} },300);' : '') + ' }, 100);">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="10"/></svg>Go to Execution</button>' +
        '<button class="api-key-modal-btn api-key-modal-btn-save" onclick="saveAutomationResultToLibrary(\'' + taskIdStr + '\'); setTimeout(function(){ showView(\'library\'); showToast(\'Saved — viewing in Library\', \'success\'); }, 300);">See Full Output in Library</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

// v10.5.25: Save automation result to Library
function saveAutomationResultToLibrary(taskId) {
  var taskIdStr = String(taskId);
  
  // Get history to find result
  var history = JSON.parse(localStorage.getItem('roweos_task_history') || '[]');
  var historyItem = history.find(function(h) { return String(h.taskId) === taskIdStr; });
  
  if (!historyItem || !historyItem.result) {
    showToast('Result not found', 'warning');
    return;
  }
  
  // Find brand index
  var brandIdx = 0;
  if (historyItem.brand) {
    brands.forEach(function(b, i) {
      if (b.name === historyItem.brand) brandIdx = i;
    });
  }
  
  // Format content
  var formattedContent = formatMessageContent(historyItem.result);
  var content = '<div class="automation-output">' +
    '<div class="automation-header" style="margin-bottom: var(--space-4); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-color);">' +
      '<h2 style="margin: 0 0 4px 0; color: var(--text-primary);">' + escapeHtml(historyItem.taskName) + '</h2>' +
      '<p style="margin: 0; font-size: var(--text-sm); color: var(--text-muted);">' + 
        (historyItem.brand ? 'Brand: ' + escapeHtml(historyItem.brand) + ' · ' : '') +
        'Completed: ' + new Date(historyItem.timestamp).toLocaleString() + 
      '</p>' +
    '</div>' +
    '<div class="automation-body">' + formattedContent + '</div>' +
  '</div>';
  
  // Save to library in "Scheduled Outputs" folder
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib.files) lib.files = [];
  
  var newFile = {
    id: 'auto-' + Date.now(),
    name: historyItem.taskName + ' - ' + new Date(historyItem.timestamp).toLocaleDateString(),
    type: 'automation-output',
    content: content,
    folderId: 'scheduled-outputs',
    savedAt: historyItem.timestamp,
    brand: historyItem.brand
  };
  
  lib.files.push(newFile);
  saveLibrary();
  
  // Close the modal
  var modal = document.getElementById('automationResultModal');
  if (modal) modal.remove();
  
  showToast('Saved to Library (Scheduled Outputs)', 'success');
}

// v10.5.25: Edit scheduled automation
function editScheduledAutomation(taskId) {
  var tasks = getScheduledTasks();
  var taskIdStr = String(taskId);
  var task = tasks.find(function(t) { return String(t.id) === taskIdStr; });
  
  if (!task) {
    showToast('Task not found', 'error');
    return;
  }
  
  // Navigate to Rhythm view and scroll to automations section
  showView('rhythm');
  
  setTimeout(function() {
    // Scroll to automations section
    var section = document.getElementById('rhythmAutomationsSection');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // Highlight the task briefly
    showToast('Showing automation: ' + task.name, 'info');
  }, 200);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED TASK EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

var scheduledTasksInterval = null;
var _schedulerLastCheck = null;
var _schedulerClockInterval = null;

function initScheduledTasksEngine() {
  // Check for due tasks every minute
  if (scheduledTasksInterval) clearInterval(scheduledTasksInterval);
  scheduledTasksInterval = setInterval(function() {
    checkAndRunDueTasks();
    renderNCWidgets();
  }, 60000);
  // Also check immediately on load
  setTimeout(function() {
    checkAndRunDueTasks();
    renderNCWidgets();
  }, 5000);
  // v18.1: Re-check on tab focus (setInterval pauses in backgrounded tabs)
  // v20.11: Deduplicate — only add listener once
  if (!window._schedulerVisListenerAdded) {
    window._schedulerVisListenerAdded = true;
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        setTimeout(function() {
          checkAndRunDueTasks();
          renderNCWidgets();
        }, 2000);
      }
    });
  }
  // v20.11: Update scheduler clock countdown every 10 seconds
  if (_schedulerClockInterval) clearInterval(_schedulerClockInterval);
  _schedulerClockInterval = setInterval(function() {
    try {
      var clockVal = document.getElementById('ncClockValue');
      var clockSub = document.getElementById('ncClockSub');
      if (!clockVal) return;
      if (_schedulerLastCheck) {
        var secAgo = Math.floor((Date.now() - _schedulerLastCheck) / 1000);
        var secLeft = Math.max(0, 60 - secAgo);
        clockVal.textContent = secLeft + 's';
        if (clockSub) clockSub.textContent = 'until next check';
      }
    } catch(e) {}
  }, 10000);
  console.log('[Scheduler] Task execution engine initialized');

  // v25.6: Cloud Outbox Pickup — check for emails composed by Cloud Functions
  setTimeout(function() { processCloudOutbox(); }, 10000);
  setInterval(function() { processCloudOutbox(); }, 60000);
}

function checkAndRunDueTasks() {
  // v20.17: If cloud scheduler is enabled, skip client-side execution entirely
  // Cloud scheduler (Vercel cron) handles all execution; client just picks up results
  if (localStorage.getItem('roweos_cloud_scheduler') === 'true') {
    _schedulerLastCheck = Date.now();
    return;
  }
  // v28.4: Wait for first cloud sync before running tasks — prevents re-execution
  // on second device that hasn't pulled lastRun timestamps from Firestore yet
  if (typeof firebaseUser !== 'undefined' && firebaseUser && localStorage.getItem('roweos_first_sync_completed') !== 'true') {
    console.log('[Scheduler] Waiting for first cloud sync before checking tasks');
    _schedulerLastCheck = Date.now();
    return;
  }
  // v20.11: Track last check time for scheduler clock
  _schedulerLastCheck = Date.now();
  // v22.8: Use getMergedAutomations() — single source of truth with deletion filtering
  var tasks = getMergedAutomations();
  // v20.11: Sync merged list back to BOTH stores — prevents stale automations from overwriting on Firebase pull
  if (typeof saveScheduledTasks === 'function') {
    saveScheduledTasks(tasks);
  }
  // Also write automations back so lastRun timestamps stay in sync
  try {
    // v24.12: Write all tasks back (was filtering to workflow/pipeline only, deleting single-step automations)
    localStorage.setItem('roweos_automations', JSON.stringify(tasks));
  } catch(e) {}
  var now = new Date();
  var currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  // v24.18: Always log task count for scheduler diagnostics
  console.log('[Scheduler] Checking ' + tasks.length + ' tasks at ' + currentTime);
  tasks.forEach(function(task, idx) {
    if (!task.enabled) return;

    // v19.1: Skip if cloud function ran this task recently (within 10 minutes)
    if (task.lastExecutor === 'cloud' && task.lastRun) {
      var cloudRunAge = Date.now() - new Date(task.lastRun).getTime();
      if (cloudRunAge < 10 * 60 * 1000) return;
    }

    // v13.9: Unify frequency field — Automations Lab saves recurType, scheduler uses frequency
    var freq = task.frequency || task.recurType || 'none';

    // Check if task is due
    var taskTime = task.time || '09:00';
    var lastRun = task.lastRun ? new Date(task.lastRun) : null;
    var isDue = false;

    // v18.1: Widen time window to 0-30 min forward (catches missed background tabs)
    var timeDiff = timeToMinutes(currentTime) - timeToMinutes(taskTime);
    // v23.17: For never-run tasks, accept any time AFTER the scheduled time today (not just 30-min window)
    var _neverRun = !lastRun;
    var _timePassedToday = timeDiff >= 0;
    var _inWindow = timeDiff >= 0 && timeDiff <= 30;
    // v18.8: Custom recurrence uses pure interval math — bypass time window for sub-day intervals
    if (freq === 'custom') {
      var cInterval = task.recurInterval || 1;
      var cUnit = task.recurUnit || 'days';
      if (_neverRun) {
        // v23.17: First run — accept any time after scheduled time (not just 30-min window)
        if (_timePassedToday) isDue = true;
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
    } else if (freq === 'once' || freq === 'none') {
      // v24.18: One-time tasks get their own top-level check (not nested inside time window)
      // This ensures they fire reliably even if the 30-min window was missed
      if (task.scheduledDate) {
        var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        var schedDateOnly = (task.scheduledDate || '').split('T')[0];
        isDue = !lastRun && schedDateOnly === todayStr && _timePassedToday;
      } else {
        // No date set — fire once time has passed (or immediately if no time set)
        isDue = !lastRun && _timePassedToday;
      }
    } else if (_inWindow || (_neverRun && _timePassedToday)) {
      // v23.17: Never-run tasks fire at any time after scheduled time (catches missed windows)
      if (freq === 'daily') {
        isDue = !lastRun || !isSameDay(lastRun, now);
      } else if (freq === 'weekly') {
        isDue = !lastRun || daysSince(lastRun) >= 7;
      } else if (freq === 'monthly') {
        isDue = !lastRun || (now.getMonth() !== lastRun.getMonth() || now.getFullYear() !== lastRun.getFullYear());
      }
    }

    // v24.18: Log why tasks are/aren't firing for diagnostics
    if (!isDue && _neverRun && (freq === 'none' || freq === 'once' || freq === 'daily' || freq === 'weekly' || freq === 'monthly')) {
      console.log('[Scheduler] Task "' + (task.name || task.id) + '" not due: freq=' + freq + ' time=' + taskTime + ' diff=' + timeDiff + ' inWindow=' + _inWindow + ' neverRun=' + _neverRun + ' timePassed=' + _timePassedToday + (task.scheduledDate ? ' date=' + task.scheduledDate : '') + ' type=' + (task.type || 'unknown'));
    }

    if (isDue) {
      // v22.8: 5-minute re-execution guard — prevents rapid re-firing even if merge corrupts lastRun
      if (lastRun && (Date.now() - lastRun.getTime()) < 5 * 60 * 1000) {
        console.log('[Scheduler] Skipping task (ran <5min ago):', task.name);
        return;
      }
      console.log('[Scheduler] Task due:', task.name, 'freq:', freq, 'type:', task.type || 'unknown', 'action:', task.action || 'unknown');
      executeScheduledTask(task, idx);
    }
  });

  // v15.14: Also check scheduled prompts (Adaptive Operations)
  checkAndRunDueScheduledPrompts(now, currentTime);
}

// v15.14: Auto-execute scheduled prompts at their scheduled time
function checkAndRunDueScheduledPrompts(now, currentTime) {
  if (!scheduledPrompts || !Array.isArray(scheduledPrompts) || scheduledPrompts.length === 0) return;
  var dayOfWeek = now.getDay();

  scheduledPrompts.forEach(function(sp) {
    if (!sp.enabled) return;

    var freq = sp.frequency || 'weekly';
    var spTime = sp.time || '09:00';
    var lastRun = sp.lastRun ? new Date(sp.lastRun) : null;
    var isDue = false;

    // Check time window (within 2 minutes)
    if (Math.abs(timeToMinutes(currentTime) - timeToMinutes(spTime)) <= 2) {
      if (freq === 'daily') {
        isDue = !lastRun || !isSameDay(lastRun, now);
      } else if (freq === 'weekly') {
        // Check if today is one of the selected days
        var isSelectedDay = (sp.days || []).indexOf(dayOfWeek) !== -1;
        isDue = isSelectedDay && (!lastRun || !isSameDay(lastRun, now));
      } else if (freq === 'biweekly') {
        var isSelectedDay2 = (sp.days || []).indexOf(dayOfWeek) !== -1;
        isDue = isSelectedDay2 && (!lastRun || (daysSince(lastRun) >= 13 && !isSameDay(lastRun, now)));
      } else if (freq === 'monthly') {
        isDue = !lastRun || (now.getMonth() !== lastRun.getMonth() || now.getFullYear() !== lastRun.getFullYear());
      }
    }

    if (isDue) {
      console.log('[Scheduler] Scheduled prompt due:', sp.name, 'freq:', freq);
      executeScheduledPromptAuto(sp);
    }
  });
}

// v15.14: Execute a scheduled prompt automatically via API
async function executeScheduledPromptAuto(sp) {
  showToast('Running: ' + sp.name, 'info');

  // Find brand
  var brandIdx = brands.findIndex(function(b) { return b.name === sp.brand; });
  if (brandIdx === -1) brandIdx = 0;
  var brand = brands[brandIdx] || brands[0];
  if (!brand) {
    showToast('No brand found for "' + sp.name + '"', 'error');
    return;
  }

  // Build prompt
  var promptText = sp.customPrompt || 'Create a ' + sp.operation + ' for ' + (brand.shortName || brand.name);

  // v15.14: Determine model — use sp.model if set, else fall back to brand settings
  var provider, model;
  if (sp.model) {
    model = sp.model;
    if (model.indexOf('claude') !== -1) provider = 'anthropic';
    else if (model.indexOf('gpt') !== -1) provider = 'openai';
    else if (model.indexOf('gemini') !== -1) provider = 'google';
    else provider = 'anthropic';
  } else {
    var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    var _vprovs = ['anthropic', 'openai', 'google'];
    provider = (settings.provider && _vprovs.indexOf(settings.provider) !== -1) ? settings.provider : 'anthropic';
    model = settings.model || 'claude-sonnet-4-6';
  }
  // v20.10: Resolve 'auto' smart routing to actual provider/model
  if (model === 'auto' || provider === 'roweos') {
    var _resolved3 = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: promptText }) : null;
    if (_resolved3) { provider = _resolved3.provider; model = _resolved3.model; }
    else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
  }

  try {
    var apiKey = await getApiKey(provider);
    if (!apiKey) {
      showToast('No API key for ' + provider + '. Skipping "' + sp.name + '"', 'error');
      return;
    }

    // v18.5: Use rich system prompt matching Studio/Chat quality
    var systemPrompt = '';
    if (typeof buildBrandSystemPrompt === 'function') {
      systemPrompt = buildBrandSystemPrompt(brand, null);
    } else {
      systemPrompt = 'You are a brand assistant for ' + (brand.shortName || brand.name) + '. ';
      if (brand.desc) systemPrompt += brand.desc;
    }

    // v18.5: Wrap user prompt with automation directive
    var wrappedPrompt = '[AUTOMATED TASK: Produce direct output only. Do NOT ask questions or add meta-commentary.]\n\n' + promptText + '\n\nBegin your output now.';

    var response = await makeScheduledTaskAPICall(provider, model, apiKey, systemPrompt, wrappedPrompt);

    if (response) {
      // Update last run
      sp.lastRun = Date.now();
      sp.lastResult = response.substring(0, 500);
      saveScheduledPrompts();

      // Track in automation history
      if (typeof addAutoLabHistory === 'function') {
        addAutoLabHistory({ name: sp.name, action: 'prompt' }, true, response.substring(0, 200));
      }
      if (typeof addCompletedAutomation === 'function') {
        addCompletedAutomation({ name: sp.name }, true);
      }

      showToast('"' + sp.name + '" completed', 'success');
      console.log('[Scheduler] Scheduled prompt result:', sp.name, response.substring(0, 100));
    }
  } catch (error) {
    console.error('[Scheduler] Scheduled prompt error:', error);
    showToast('"' + sp.name + '" failed: ' + error.message, 'error');
    if (typeof addAutoLabHistory === 'function') {
      addAutoLabHistory({ name: sp.name, action: 'prompt' }, false, error.message);
    }
  }
}

function timeToMinutes(timeStr) {
  var parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getDate() === d2.getDate();
}

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

async function executeScheduledTask(task, idx) {
  // v24.25: Flag so pipeline outbox steps auto-send emails instead of just queuing
  window._runningFromScheduler = true;
  setTimeout(function() { window._runningFromScheduler = false; }, 120000); // safety clear after 2min
  // v20.14: Write lastRun IMMEDIATELY to prevent double-execution from concurrent scheduler checks
  writeLastRunById(task.id, new Date().toISOString());
  console.log('[Scheduler] Executing task:', task.name, 'Action:', task.action);

  // v23.11: Check if stopped before even starting
  if (task.id && typeof isAutomationStopped === 'function' && isAutomationStopped(task.id)) {
    markAutomationDone(task.id);
    showToast('Automation was stopped', 'warning');
    return;
  }

  // v19.2: Resolve brand EARLY — before image/pipeline/post early-return paths
  var brandIdx = task.brandIdx !== undefined && task.brandIdx !== '' ? parseInt(task.brandIdx) : 0;
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : (typeof brands !== 'undefined' ? brands[0] : { name: 'Brand' });
  task.brand = brand.shortName || brand.name;

  // v13.9: Handle image generation action
  if (task.action === 'image') {
    var imgPrompt = (task.target && task.target.text) ? task.target.text : (task.name || 'Generate an image');
    showToast('Generating image: ' + task.name, 'info');
    try {
      // v18.8: Pass reference image + provider/model from config
      var _imgOpts = {};
      if (task.config && task.config.referenceImage) _imgOpts.referenceImages = [task.config.referenceImage];
      else if (task.target && task.target.referenceImage) _imgOpts.referenceImages = [task.target.referenceImage];
      else if (window._wfRefImages && window._wfRefImages[String(task.id)]) _imgOpts.referenceImages = [window._wfRefImages[String(task.id)]];
      if (task.config && task.config.provider) _imgOpts.provider = task.config.provider;
      if (task.config && task.config.imageModel) _imgOpts.model = task.config.imageModel;
      var imgResult = await generateImageWithNanobanana(imgPrompt, _imgOpts);
      // v13.9: Fix image data extraction - Nanobanana returns {images:[{base64,mimeType}]}
      var imgDataUrl = '';
      if (imgResult && imgResult.images && imgResult.images[0] && imgResult.images[0].base64) {
        imgDataUrl = 'data:' + (imgResult.images[0].mimeType || 'image/png') + ';base64,' + imgResult.images[0].base64;
      } else if (imgResult && imgResult.imageData) imgDataUrl = 'data:image/png;base64,' + imgResult.imageData;
      else if (imgResult && imgResult.base64) imgDataUrl = 'data:image/png;base64,' + imgResult.base64;
      // Save to image gallery
      var labImages = [];
      try { labImages = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
      labImages.push({ prompt: imgPrompt, model: 'auto', dataUrl: imgDataUrl, createdAt: new Date().toISOString() });
      if (labImages.length > 50) labImages = labImages.slice(-50);
      localStorage.setItem('roweos_auto_lab_images', JSON.stringify(labImages));
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, 'Image generated', { imageUrl: imgDataUrl || '' });
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
      // v18.6: Save to task history so Focus can find it
      if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, imgDataUrl || 'Image generated');
      // v20.11: Write lastRun by ID (not index) to prevent wrong-task updates
      writeLastRunById(task.id, new Date().toISOString());
      showToast('Image generated: ' + task.name, 'success');
    } catch (imgErr) {
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, imgErr.message);
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      // v20.11: Write lastRun even on failure to prevent infinite retry loop
      writeLastRunById(task.id, new Date().toISOString());
      showToast('Image generation failed: ' + imgErr.message, 'error');
    }
    return;
  }

  // v21.15: Handle video generation action
  if (task.action === 'video') {
    var vidPrompt = (task.target && task.target.text) ? task.target.text : (task.name || 'Generate a video');
    showToast('Generating video: ' + task.name, 'info');
    try {
      var _vidOpts = {};
      if (task.config && task.config.videoModel) _vidOpts.model = task.config.videoModel;
      if (task.config && task.config.videoDuration) _vidOpts.duration = parseInt(task.config.videoDuration);
      if (task.config && task.config.videoResolution) _vidOpts.resolution = task.config.videoResolution;
      if (task.config && task.config.videoAspect) _vidOpts.aspectRatio = task.config.videoAspect;
      var vidResult = await generateVideoWithVeo(vidPrompt, _vidOpts);
      var vidSummary = 'Video generated: ' + (vidResult.duration || 8) + 's, ' + (vidResult.model || 'veo') + ', ' + (vidResult.generationTime || 0) + 's generation time';
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, vidSummary);
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
      if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, vidSummary);
      writeLastRunById(task.id, new Date().toISOString());
      showToast('Video generated: ' + task.name, 'success');
    } catch (vidErr) {
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, vidErr.message);
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      writeLastRunById(task.id, new Date().toISOString());
      showToast('Video generation failed: ' + vidErr.message, 'error');
    }
    return;
  }

  // v17.4: Handle pipeline type — execute all steps via workflow engine
  // v18.1: BUG 6 — Use result.failedSteps for accurate history
  if (task.type === 'pipeline' && task.steps && task.steps.length > 0) {
    showToast('Running pipeline: ' + task.name, 'info');
    try {
      var pipeResult = await executeWorkflow(task);
      var failCount = pipeResult && pipeResult.failedSteps ? pipeResult.failedSteps.length : 0;
      var okCount = pipeResult && pipeResult.completedSteps ? pipeResult.completedSteps.length : task.steps.length;
      var pipeSuccess = failCount === 0;
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, pipeSuccess);
      // v20.6: Notification Center — pipeline completion with failure details
      try {
        var pipeNotifMsg = (task.name || 'Pipeline') + ' (' + okCount + '/' + task.steps.length + ' steps)';
        if (!pipeSuccess && pipeResult && pipeResult.failedSteps && pipeResult.failedSteps.length > 0) {
          var firstErr = pipeResult.failedSteps[0];
          var errText = firstErr.error ? firstErr.error.substring(0, 150) : 'Unknown error';
          pipeNotifMsg += ': ' + errText;
        }
        addNotification('pipeline',
          pipeSuccess ? 'Pipeline Completed' : 'Pipeline Failed',
          pipeNotifMsg,
          { workflowName: task.name, completedSteps: okCount, failedSteps: failCount,
            totalSteps: task.steps.length, taskId: task.id });
      } catch(e) {}
      // v20.6: Build richer pipeline summary with step results + failure details
      var historySummary = failCount === 0
        ? 'Pipeline completed (' + task.steps.length + ' steps)'
        : 'Pipeline completed with errors (' + okCount + '/' + task.steps.length + ' steps succeeded)';
      // v20.6: Include failure reasons
      if (pipeResult && pipeResult.failedSteps && pipeResult.failedSteps.length > 0) {
        historySummary += '\n\n**Failed Steps:**';
        pipeResult.failedSteps.forEach(function(fs) {
          var stepName = fs.step ? (fs.step.action || fs.step.stepId || 'Unknown') : 'Unknown';
          historySummary += '\n- **' + stepName + ':** ' + (fs.error || 'Unknown error').substring(0, 300);
        });
      }
      if (pipeResult && pipeResult.context) {
        var _ctxK = Object.keys(pipeResult.context);
        for (var _ci = 0; _ci < _ctxK.length; _ci++) {
          var _cv = pipeResult.context[_ctxK[_ci]];
          if (typeof _cv === 'string' && _cv.length > 0 && _cv.indexOf('data:image') !== 0 && _ctxK[_ci] !== 'brandName') {
            historySummary += '\n\n**' + _ctxK[_ci] + ':**\n' + _cv.substring(0, 3000);
          }
        }
      }
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, pipeSuccess, historySummary);
      // v18.6: Save to task history so Focus can find it
      if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, historySummary);
      // v20.11: Write lastRun by ID (not index)
      writeLastRunById(task.id, new Date().toISOString());
    } catch(plErr) {
      console.error('[Scheduler] Pipeline error:', plErr);
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, plErr.message);
      showToast('Pipeline "' + task.name + '" failed: ' + plErr.message, 'error');
      // v22.56: Write lastRun on failure to prevent infinite retry loop
      writeLastRunById(task.id, new Date().toISOString());
    }
    return;
  }

  // v18.5: Handle "post" action — bypass AI and directly post to social media
  if (task.action === 'post') {
    var postContent = task.target && task.target.text ? task.target.text : (task.description || '');
    var postPlatforms = task.target && task.target.platforms ? task.target.platforms : [];
    if (!postContent) {
      showToast('No content for social post', 'error');
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, 'No content provided');
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      return;
    }
    if (postPlatforms.length === 0) {
      showToast('No platforms selected for post', 'error');
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, 'No platforms selected');
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      return;
    }
    showToast('Posting to social: ' + task.name, 'info');
    var _postImageUrl = null;
    if (task.target.uploadedImage && typeof task.target.uploadedImage === 'string' && task.target.uploadedImage.indexOf('data:image') === 0) {
      _postImageUrl = task.target.uploadedImage;
    }
    if (!_postImageUrl && task.target._hasUploadedImage && window._wfUploadedImages) {
      var _stKeys = Object.keys(window._wfUploadedImages);
      if (_stKeys.length > 0) _postImageUrl = window._wfUploadedImages[_stKeys[_stKeys.length - 1]];
    }
    var _postFailures = [];
    var _postUrls = []; // v18.8: Track post URLs for "View Post" buttons
    var _postPromises = postPlatforms.map(function(platform) {
      if (platform === 'tiktok') {
        if (typeof saveSocialPost === 'function') saveSocialPost(platform, formatForPlatform(postContent, platform), null, 'copied');
        return Promise.resolve(postContent);
      }
      if (typeof isSocialConnected === 'function' && !isSocialConnected(platform)) {
        showToast((typeof SOCIAL_PLATFORM_NAMES !== 'undefined' ? SOCIAL_PLATFORM_NAMES[platform] : platform) + ' not connected, skipping', 'warning');
        _postFailures.push(platform + ': not connected');
        return Promise.resolve(postContent);
      }
      var formatted = typeof formatForPlatform === 'function' ? formatForPlatform(postContent, platform) : postContent;
      return (typeof getSocialToken === 'function' ? getSocialToken(platform) : Promise.resolve(null)).then(function(tokenData) {
        if (!tokenData || !tokenData.accessToken) {
          _postFailures.push(platform + ': no token');
          return postContent;
        }
        // v20.8: Auto-refresh expired tokens before posting
        return typeof refreshSocialTokenIfNeeded === 'function' ? refreshSocialTokenIfNeeded(platform, tokenData) : Promise.resolve(tokenData);
      }).then(function(tokenData) {
        if (!tokenData || !tokenData.accessToken) {
          _postFailures.push(platform + ': no token after refresh');
          return postContent;
        }
        var _mediaPromise = Promise.resolve([]);
        if (_postImageUrl && platform === 'x') {
          _mediaPromise = fetch('/api/social-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'x', accessToken: tokenData.accessToken, imageBase64: _postImageUrl })
          }).then(function(r) { return r.json(); }).then(function(d) { return d.mediaId ? [d.mediaId] : []; }).catch(function() { return []; });
        }
        return _mediaPromise.then(function(mIds) {
          var _postBody = {
            platform: platform,
            accessToken: tokenData.accessToken,
            content: formatted,
            mediaIds: mIds,
            userId: tokenData.userId || ''
          };
          if (_postImageUrl && (platform === 'threads' || platform === 'instagram')) {
            _postBody.imageBase64 = _postImageUrl;
          }
          return fetch('/api/social-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(_postBody)
          }).then(function(r) { return r.json(); }).then(function(data) {
            var pName = typeof SOCIAL_PLATFORM_NAMES !== 'undefined' ? SOCIAL_PLATFORM_NAMES[platform] : platform;
            if (data.error) {
              // v18.6: Surface full API error detail
              var _errDetail = data.error;
              if (data.detail) {
                var _detailStr = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
                if (_detailStr.length < 200) _errDetail += ' (' + _detailStr + ')';
              }
              showToast('Post to ' + pName + ' failed: ' + _errDetail, 'error');
              if (typeof saveSocialPost === 'function') saveSocialPost(platform, formatted, null, 'failed');
              _postFailures.push(platform + ': ' + _errDetail);
            } else {
              showToast('Posted to ' + pName + '!', 'success');
              if (typeof saveSocialPost === 'function') saveSocialPost(platform, formatted, data.postUrl || null, 'posted');
              // v18.8: Capture post URL for View Post button
              if (data.postUrl) _postUrls.push({ platform: platform, url: data.postUrl });
            }
            return formatted;
          });
        });
      }).catch(function(err) {
        _postFailures.push(platform + ': ' + (err.message || 'Unknown error'));
        return postContent;
      });
    });
    Promise.all(_postPromises).then(function() {
      var _pTs = new Date().toISOString();
      var _pSuccess = _postFailures.length === 0;
      // v18.6: Rich post result — include actual posted content + platform list
      var _pMsg = _pSuccess
        ? 'Posted to ' + postPlatforms.join(', ') + '\n\n**Content:**\n' + postContent.substring(0, 2000)
        : 'Post failed: ' + _postFailures.join('; ') + '\n\n**Attempted content:**\n' + postContent.substring(0, 500);
      if (_postImageUrl) _pMsg += '\n\n[Image attached]';
      // v18.8: Append post URLs as markdown links for View Post buttons
      if (_postUrls.length > 0) {
        _pMsg += '\n\n**Post Links:**\n';
        var _plNames = typeof SOCIAL_PLATFORM_NAMES !== 'undefined' ? SOCIAL_PLATFORM_NAMES : {};
        _postUrls.forEach(function(pu) { _pMsg += '- [View on ' + (_plNames[pu.platform] || pu.platform) + '](' + pu.url + ')\n'; });
      }
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, _pSuccess);
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, _pSuccess, _pMsg, { imageUrl: _postImageUrl || '' });
      // v18.6: Save to task history so Focus can find it
      if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, _pMsg);
      // v20.11: Write lastRun by ID (not index)
      writeLastRunById(task.id, _pTs);
      // v18.5: Show results panel for single workflow
      showSingleWorkflowResultsPanel(task, _pSuccess, _pMsg);
    });
    return;
  }

  // v22.9: Handle "email" action — send email via Resend API
  if (task.action === 'email') {
    var emailTo = (task.target && task.target.emailTo) ? task.target.emailTo : '';
    var emailSubject = (task.target && task.target.emailSubject) ? task.target.emailSubject : task.name || 'RoweOS Email';
    var emailBody = (task.target && task.target.emailBody) ? task.target.emailBody : '';
    var emailCc = (task.target && task.target.emailCc) ? task.target.emailCc.split(',').map(function(e) { return e.trim(); }).filter(Boolean) : [];
    var emailBcc = (task.target && task.target.emailBcc) ? task.target.emailBcc.split(',').map(function(e) { return e.trim(); }).filter(Boolean) : [];
    var emailFrom = (task.target && task.target.emailFrom) || (task.config && task.config.emailFrom) || getDefaultFromAddress();
    var emailTemplate = (task.config && task.config.emailTemplate) || 'professional';
    if (!emailTo) {
      showToast('No recipient for email', 'error');
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, 'No recipient');
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      return;
    }
    showToast('Sending email: ' + emailSubject, 'info');
    try {
      var htmlBody = '';
      if (emailTemplate === 'plain') {
        htmlBody = '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><pre style="white-space:pre-wrap;font-family:inherit;">' + escapeHtml(emailBody) + '</pre></div>';
      } else if (emailTemplate === 'ai_custom') {
        // AI Custom — wrap in basic container, body is expected to be HTML or will be escaped
        htmlBody = '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' + escapeHtml(emailBody).replace(/\n/g, '<br>') + '</div>';
      } else {
        // Use branded template via generateBrandedEmail
        var brandName = brand.shortName || brand.name || 'Brand';
        var accent = '#a89878';
        try { accent = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878'; } catch(e) {}
        var logo = '';
        try { logo = localStorage.getItem('roweos_brand_' + brandIdx + '_logo') || ''; } catch(e) {}
        if (!logo) { try { var logoEl = document.querySelector('.brand-logo-img'); if (logoEl) logo = logoEl.src; } catch(e) {} }
        window._studioEmailContext = {
          contentHtml: '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">' + escapeHtml(emailBody).replace(/\n/g, '<br>') + '</div>',
          brandName: brandName,
          accentColor: accent,
          brandLogo: logo,
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        };
        htmlBody = generateBrandedEmail(emailTemplate);
      }
      var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
      // v23.10: Route through Gmail/Outlook API when from is a connected account
      var _schedFromAddr = emailFrom;
      var _schedUseGmail = false;
      var _schedUseOutlook = false;
      if (_schedFromAddr.indexOf('gmail:') === 0) { _schedFromAddr = _schedFromAddr.substring(6); _schedUseGmail = true; }
      else if (_schedFromAddr.indexOf('outlook:') === 0) { _schedFromAddr = _schedFromAddr.substring(8); _schedUseOutlook = true; }
      else {
        var _schedCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(_schedFromAddr) : null;
        if (_schedCreds && _schedCreds.provider === 'gmail' && _schedCreds.token) _schedUseGmail = true;
        else if (_schedCreds && _schedCreds.provider === 'outlook' && _schedCreds.token) _schedUseOutlook = true;
      }
      var emailResp;
      var emailData;
      if (_schedUseGmail) {
        var _sgCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(_schedFromAddr) : null;
        var _sgToken = _sgCreds ? _sgCreds.token : (getMailConfig().gmailToken || '');
        var _sgExpiresAt = _sgCreds ? (_sgCreds.expiresAt || 0) : (getMailConfig().gmailExpiresAt || 0);
        var _sgDisplayName = '';
        var _sgAccts = getMailGmailAccounts();
        for (var _sga = 0; _sga < _sgAccts.length; _sga++) {
          if (_sgAccts[_sga].email === _schedFromAddr && _sgAccts[_sga].displayName) { _sgDisplayName = _sgAccts[_sga].displayName; break; }
        }
        // v23.10: Proactive token refresh if expired or about to expire (within 5 min)
        if (_sgExpiresAt && Date.now() > (_sgExpiresAt - 300000)) {
          _sgToken = await new Promise(function(resolve, reject) {
            mailRefreshGmailToken(function(newToken) {
              if (newToken) resolve(newToken);
              else reject(new Error('Gmail token expired for ' + _schedFromAddr + '. Please reconnect in Mail settings.'));
            }, _schedFromAddr);
          });
        }
        emailResp = await fetch('/api/gmail-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', accessToken: _sgToken, to: emailTo, subject: emailSubject, html: htmlBody, from: _schedFromAddr, fromName: _sgDisplayName, cc: emailCc, bcc: emailBcc, uid: uid })
        });
        emailData = await emailResp.json();
        if (emailData.error) throw new Error('Gmail send failed: ' + emailData.error);
      } else if (_schedUseOutlook) {
        var _soCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(_schedFromAddr) : null;
        var _soToken = _soCreds ? _soCreds.token : (getMailConfig().outlookToken || '');
        var _soExpiresAt = _soCreds ? (_soCreds.expiresAt || 0) : 0;
        // v23.10: Proactive Outlook token refresh if expired or about to expire (within 5 min)
        if (_soExpiresAt && Date.now() > (_soExpiresAt - 300000)) {
          var _soAcct = { email: _schedFromAddr, token: _soToken, refreshToken: _soCreds ? _soCreds.refreshToken : '' };
          _soToken = await new Promise(function(resolve, reject) {
            mailRefreshOutlookTokenForAccount(_soAcct, function(newToken) {
              if (newToken) resolve(newToken);
              else reject(new Error('Outlook token expired for ' + _schedFromAddr + '. Please reconnect in Mail settings.'));
            });
          });
        }
        var _soPayload = {
          message: { subject: emailSubject, body: { contentType: 'HTML', content: htmlBody }, toRecipients: [{ emailAddress: { address: emailTo } }] },
          saveToSentItems: true
        };
        if (emailCc.length > 0) _soPayload.message.ccRecipients = emailCc.map(function(e) { return { emailAddress: { address: e } }; });
        if (emailBcc.length > 0) _soPayload.message.bccRecipients = emailBcc.map(function(e) { return { emailAddress: { address: e } }; });
        emailResp = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + _soToken, 'Content-Type': 'application/json' },
          body: JSON.stringify(_soPayload)
        });
        if (!emailResp.ok) throw new Error('Outlook send failed (HTTP ' + emailResp.status + ')');
        emailData = { messageId: '' };
      } else {
        emailResp = await fetch('/api/resend-welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailTo, subject: emailSubject, from: _schedFromAddr, html: htmlBody, cc: emailCc, bcc: emailBcc, uid: uid })
        });
        emailData = await emailResp.json();
        if (emailData.error) throw new Error(emailData.error);
      }
      if (typeof addToMailSent === 'function') {
        addToMailSent({ to: emailTo, from: _schedFromAddr, subject: emailSubject, html: htmlBody, body: emailBody, emailId: emailData.messageId || emailData.emailId || '', sentVia: _schedUseGmail ? 'gmail' : (_schedUseOutlook ? 'outlook' : 'resend') });
      }
      var emailResult = 'Email sent to ' + emailTo + (_schedUseGmail ? ' via Gmail' : (_schedUseOutlook ? ' via Outlook' : '')) + '\nSubject: ' + emailSubject + '\nTemplate: ' + emailTemplate + '\n\n' + emailBody.substring(0, 2000);
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, emailResult);
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
      if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, emailResult);
      writeLastRunById(task.id, new Date().toISOString());
      showToast('Email sent to ' + emailTo, 'success');
      showSingleWorkflowResultsPanel(task, true, emailResult);
    } catch (emailErr) {
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, emailErr.message);
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      writeLastRunById(task.id, new Date().toISOString());
      showToast('Email failed: ' + emailErr.message, 'error');
    }
    return;
  }

  // v19.3: Handle "create" action — directly create Focus todo, no AI call
  if (task.action === 'create') {
    var _ctText = (task.target && task.target.text) ? task.target.text : (task.name || 'Task');
    var _ctCat = (task.target && task.target.category) ? task.target.category : '';
    var _ctNotes = task.notes || '';
    var _ctBrand = brand.shortName || brand.name || '';
    var newTodo = {
      id: Date.now() + Math.random(),
      text: _ctText,
      brand: _ctBrand,
      category: _ctCat,
      completed: false,
      createdAt: new Date().toISOString(),
      notes: _ctNotes,
      dueDate: ''
    };
    if (typeof todos !== 'undefined') {
      todos.push(newTodo);
      if (typeof saveTodos === 'function') saveTodos();
      if (typeof renderFocus2Categories === 'function') renderFocus2Categories();
      if (typeof updateFocus2Stats === 'function') updateFocus2Stats();
    }
    var _ctTs = new Date().toISOString();
    var _ctResult = 'Created task: ' + _ctText + (_ctCat ? ' (category: ' + _ctCat + ')' : '');
    if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
    if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, _ctResult);
    if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, _ctResult);
    // v20.11: Write lastRun by ID (not index)
    writeLastRunById(task.id, _ctTs);
    showToast('Task created: ' + _ctText, 'success');
    showSingleWorkflowResultsPanel(task, true, _ctResult);
    return;
  }

  // v24.25: Handle "reminder" action — interactive popup notification
  if (task.action === 'reminder') {
    var _remTitle = (task.target && task.target.reminderTitle) ? task.target.reminderTitle : (task.name || 'Reminder');
    var _remText = (task.target && task.target.text) ? task.target.text : '';
    var _remConfig = task.config || {};
    showNotificationPopup({
      title: _remTitle,
      message: _remText,
      actionLabel: _remConfig.actionLabel || '',
      actionView: _remConfig.actionView || '',
      source: 'automation',
      taskId: task.id
    });
    saveReminderToHistory({ title: _remTitle, message: _remText, source: 'automation', taskId: task.id, timestamp: new Date().toISOString() });
    var _remTs = new Date().toISOString();
    if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
    if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, 'Reminder: ' + _remTitle);
    if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, 'Reminder: ' + _remTitle + (_remText ? ' - ' + _remText : ''));
    writeLastRunById(task.id, _remTs);
    return;
  }

  // v19.3: Handle "notify" action — just show toast, no AI call
  if (task.action === 'notify') {
    var _nfText = (task.target && task.target.text) ? task.target.text : (task.name || 'Reminder');
    showToast(_nfText, 'info');
    var _nfTs = new Date().toISOString();
    if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
    if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, 'Notification: ' + _nfText);
    if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, 'Notification: ' + _nfText);
    // v20.11: Write lastRun by ID (not index)
    writeLastRunById(task.id, _nfTs);
    return;
  }

  // v24.9: Handle "pulse" action — AI generates tasks for goal based on instructions
  if (task.action === 'pulse') {
    var _pgGoalId = task.target && task.target.goalId ? task.target.goalId : '';
    var _pgResult = 'Goal update triggered';
    if (_pgGoalId && typeof pulseGoals !== 'undefined') {
      var _pgGoal = pulseGoals.find(function(g) { return String(g.id) === String(_pgGoalId); });
      if (_pgGoal) {
        var _pgInstructions = (task.target && task.target.contextRef) ? task.target.contextRef : (task.description || '');
        if (_pgInstructions) {
          // Use AI to generate actionable tasks for the goal
          var _pgExisting = (_pgGoal.items || []).map(function(i) { return i.text; }).join(', ');
          var _pgIsLife = _pgGoal.source === 'lifeai';
          var _pgContext = _pgIsLife ? (typeof getLifeIdentityContextForGoals === 'function' ? getLifeIdentityContextForGoals() : '') : (typeof getBrandContextForGoals === 'function' ? getBrandContextForGoals() : '');
          var _pgSysPrompt = 'You are a goal planning assistant. Given a goal and specific instructions, generate actionable tasks. Return ONLY a JSON array of strings, no other text. Each task should be concise and actionable. Never use em-dashes.';
          var _pgUserPrompt = 'Goal: "' + _pgGoal.title + '"';
          if (_pgExisting) _pgUserPrompt += '\nExisting tasks: ' + _pgExisting;
          _pgUserPrompt += '\nInstructions: ' + _pgInstructions;
          if (_pgContext) _pgUserPrompt += _pgContext;
          _pgUserPrompt += '\n\nReturn a JSON array of 3-8 recommended task strings based on the instructions.';
          try {
            await new Promise(function(resolve) {
              callLifeAIForGoal(
                _pgSysPrompt,
                _pgUserPrompt,
                function(responseText) {
                  var tasks = [];
                  try { tasks = JSON.parse(responseText); } catch(e) {
                    var jsonMatch = responseText.match(/\[[\s\S]*?\]/);
                    if (jsonMatch) { try { tasks = JSON.parse(jsonMatch[0]); } catch(e2) {} }
                  }
                  if (Array.isArray(tasks) && tasks.length > 0) {
                    if (!_pgGoal.items) _pgGoal.items = [];
                    var _pgCount = 0;
                    tasks.forEach(function(taskText, tIdx) {
                      if (typeof taskText === 'string' && taskText.trim()) {
                        _pgGoal.items.push({ id: 'item_' + Date.now() + '_' + tIdx, text: taskText.trim(), completed: false, completedAt: null });
                        _pgCount++;
                      }
                    });
                    _pgGoal.lastUpdated = new Date().toISOString();
                    savePulseGoals();
                    if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
                    if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
                    _pgResult = 'Added ' + _pgCount + ' AI tasks to "' + _pgGoal.title + '"';
                  } else {
                    _pgResult = 'Could not parse AI task suggestions for "' + _pgGoal.title + '"';
                  }
                  resolve();
                },
                function(err) {
                  _pgResult = 'AI task generation failed for "' + _pgGoal.title + '": ' + (err || 'Unknown');
                  resolve();
                }
              );
            });
          } catch(e) {
            _pgResult = 'Error generating tasks: ' + e.message;
          }
        } else {
          // No instructions — just mark as updated
          _pgGoal.lastUpdated = new Date().toISOString();
          savePulseGoals();
          if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
          _pgResult = 'Goal "' + _pgGoal.title + '" marked as updated (no instructions provided)';
        }
      } else {
        _pgResult = 'Goal not found (ID: ' + _pgGoalId + ')';
      }
    }
    var _pgTs = new Date().toISOString();
    if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
    if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, _pgResult);
    if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, _pgResult);
    // v20.11: Write lastRun by ID (not index)
    writeLastRunById(task.id, _pgTs);
    showToast(_pgResult, 'success');
    return;
  }

  // v28.4: Handle "create_goal" action — create a new Pulse goal from automation
  if (task.action === 'create_goal') {
    var _cgResult = 'Goal creation triggered';
    var _cgTitle = (task.target && task.target.goalTitle) ? task.target.goalTitle : (task.name || 'Untitled Goal');
    var _cgDesc = (task.target && task.target.goalDescription) ? task.target.goalDescription : (task.description || '');
    var _cgItems = (task.target && task.target.goalItems) ? task.target.goalItems : [];
    // If instructions provided but no items, use AI to generate tasks
    var _cgInstructions = (task.target && task.target.contextRef) ? task.target.contextRef : '';
    if (_cgInstructions && (!_cgItems || _cgItems.length === 0)) {
      var _cgIsLife = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
      var _cgContext = _cgIsLife ? (typeof getLifeIdentityContextForGoals === 'function' ? getLifeIdentityContextForGoals() : '') : (typeof getBrandContextForGoals === 'function' ? getBrandContextForGoals() : '');
      var _cgSysPrompt = 'You are a goal planning assistant. Given a goal title and instructions, generate actionable tasks. Return ONLY a JSON array of strings, no other text. Each task should be concise and actionable. Never use em-dashes.';
      var _cgUserPrompt = 'Goal: "' + _cgTitle + '"';
      if (_cgDesc) _cgUserPrompt += '\nDescription: ' + _cgDesc;
      _cgUserPrompt += '\nInstructions: ' + _cgInstructions;
      if (_cgContext) _cgUserPrompt += _cgContext;
      _cgUserPrompt += '\n\nReturn a JSON array of 3-8 recommended task strings.';
      try {
        await new Promise(function(resolve) {
          callLifeAIForGoal(
            _cgSysPrompt,
            _cgUserPrompt,
            function(responseText) {
              var tasks = [];
              try { tasks = JSON.parse(responseText); } catch(e) {
                var jsonMatch = responseText.match(/\[[\s\S]*?\]/);
                if (jsonMatch) { try { tasks = JSON.parse(jsonMatch[0]); } catch(e2) {} }
              }
              if (Array.isArray(tasks) && tasks.length > 0) {
                _cgItems = tasks.filter(function(t) { return typeof t === 'string' && t.trim(); });
              }
              resolve();
            },
            function(err) {
              console.warn('[Scheduler] AI task gen for create_goal failed:', err);
              resolve();
            }
          );
        });
      } catch(e) {
        console.warn('[Scheduler] create_goal AI error:', e.message);
      }
    }
    if (typeof createPulseGoalFromAutomation === 'function') {
      var _cgGoalId = createPulseGoalFromAutomation({ title: _cgTitle, description: _cgDesc, items: _cgItems });
      if (_cgGoalId) {
        _cgResult = 'Created goal "' + _cgTitle + '" with ' + _cgItems.length + ' task(s)';
      } else {
        _cgResult = 'Failed to create goal "' + _cgTitle + '"';
      }
    } else {
      _cgResult = 'createPulseGoalFromAutomation not available';
    }
    var _cgTs = new Date().toISOString();
    if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
    if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, _cgResult);
    if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, _cgResult);
    writeLastRunById(task.id, _cgTs);
    showToast(_cgResult, 'success');
    return;
  }

  // v22.56: Handle "research" action — Deep Research via Google Interactions API
  if (task.action === 'research') {
    var _drQuery = (task.target && task.target.researchQuery) ? task.target.researchQuery : (task.description || task.name || '');
    if (!_drQuery) {
      showToast('No research query provided', 'error');
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, 'No research query');
      writeLastRunById(task.id, new Date().toISOString());
      return;
    }
    // Enrich with brand context
    var _drBrand = brand.shortName || brand.name || '';
    if (_drBrand) {
      _drQuery = 'Business context: ' + _drBrand + (brand.tagline ? ' - ' + brand.tagline : '') + '.\n\nResearch request: ' + _drQuery;
    }
    showToast('Starting Deep Research: ' + task.name, 'info');
    if (typeof markAutomationRunning === 'function') markAutomationRunning(task.id, 'research');
    try {
      var _drResult = await runDeepResearchFull(_drQuery, function(progress) {
        console.log('[Scheduler] Deep Research progress:', progress);
      }, 3);
      var _drText = _drResult.text || '';
      var _drTs = new Date().toISOString();
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, _drText.substring(0, 200));
      if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, _drText);
      writeLastRunById(task.id, _drTs, { lastResult: _drText.substring(0, 500) });
      showToast('Deep Research completed! (' + (_drResult.elapsed || 0) + 's)', 'success');
      showSingleWorkflowResultsPanel(task, true, _drText);
    } catch (_drErr) {
      var _drErrMsg = typeof _drErr === 'string' ? _drErr : (_drErr.message || 'Deep Research failed');
      console.error('[Scheduler] Deep Research error:', _drErrMsg);
      showToast('Deep Research failed: ' + _drErrMsg, 'error');
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, _drErrMsg);
      writeLastRunById(task.id, new Date().toISOString());
      showSingleWorkflowResultsPanel(task, false, _drErrMsg);
    }
    if (typeof markAutomationDone === 'function') markAutomationDone(task.id);
    return;
  }

  // v18.5: Handle "image" action — direct image generation, no extra AI call
  if (task.action === 'image') {
    var imgPrompt = task.target && task.target.text ? task.target.text : (task.description || '');
    if (!imgPrompt) {
      showToast('No image prompt provided', 'error');
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, 'No image prompt');
      return;
    }
    showToast('Generating image: ' + task.name, 'info');
    try {
      // v18.8: Pass reference image + provider/model from config
      var _imgOpts2 = {};
      if (task.config && task.config.referenceImage) _imgOpts2.referenceImages = [task.config.referenceImage];
      else if (task.target && task.target.referenceImage) _imgOpts2.referenceImages = [task.target.referenceImage];
      else if (window._wfRefImages && window._wfRefImages[String(task.id)]) _imgOpts2.referenceImages = [window._wfRefImages[String(task.id)]];
      if (task.config && task.config.provider) _imgOpts2.provider = task.config.provider;
      if (task.config && task.config.imageModel) _imgOpts2.model = task.config.imageModel;
      var imgResult = await generateImageWithNanobanana(imgPrompt, _imgOpts2);
      var _imgTs = new Date().toISOString();
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, true);
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, 'Image generated', { imageUrl: typeof imgResult === 'string' && imgResult.indexOf('data:image') === 0 ? imgResult : null });
      // v18.6: Save to task history so Focus can find it
      if (typeof saveTaskResult === 'function') saveTaskResult(task, idx, typeof imgResult === 'string' ? imgResult : 'Image generated');
      // v20.11: Write lastRun by ID (not index)
      writeLastRunById(task.id, _imgTs);
      showToast('Image generated!', 'success');
      showSingleWorkflowResultsPanel(task, true, typeof imgResult === 'string' ? imgResult : 'Image generated');
    } catch(imgErr2) {
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, imgErr2.message);
      if (typeof addCompletedAutomation === 'function') addCompletedAutomation(task, false);
      showToast('Image generation failed: ' + imgErr2.message, 'error');
    }
    return;
  }

  // Build prompt based on action type
  var prompt = buildTaskPrompt(task);

  // v9.1.14: Handle reminder-only tasks (no AI action)
  if (prompt === null) {
    showToast('Reminder: ' + task.name, 'info');

    // v20.11: Write lastRun by ID (not index)
    var remTs = new Date().toISOString();
    writeLastRunById(task.id, remTs);

    // Track in notification center
    if (typeof addCompletedAutomation === 'function') {
      addCompletedAutomation(task, true);
    }
    // v13.9: Track in Automations Lab history
    if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, 'Reminder sent');
    return;
  }

  showToast('Running scheduled task: ' + task.name, 'info');

  // v19.2: brandIdx and brand already resolved at top of function

  try {
    // Get API key and settings
    var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    var _validSchedProvs = ['anthropic', 'openai', 'google'];
    var provider = (settings.provider && _validSchedProvs.indexOf(settings.provider) !== -1) ? settings.provider : 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    // v18.7: Per-automation config overrides for provider/model
    // v20.9: Validate provider — AI proposals sometimes set brand name as provider
    if (task.config && task.config.provider && _validSchedProvs.indexOf(task.config.provider) !== -1) {
      provider = task.config.provider;
      if (provider === 'anthropic') model = 'claude-sonnet-4-6';
      else if (provider === 'openai') model = 'gpt-5.4';
      else if (provider === 'google') model = 'gemini-2.0-flash';
    }
    if (task.config && task.config.model) model = task.config.model;
    // v20.10: Resolve 'auto' smart routing to actual provider/model
    if (model === 'auto' || provider === 'roweos') {
      var _resolved2 = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: prompt }) : null;
      if (_resolved2) { provider = _resolved2.provider; model = _resolved2.model; }
      else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
    }
    // v18.7: Append length instruction to prompt
    if (task.config && task.config.length && task.config.length !== 'standard') {
      var _tLen = task.config.length;
      if (_tLen === 'brief') prompt += '\n\nKeep response concise and brief, under 200 words.';
      else if (_tLen === 'comprehensive') prompt += '\n\nProvide a thorough, comprehensive response.';
      else if (_tLen.indexOf('social-') === 0) {
        var _tCharLimit = _tLen.replace('social-', '');
        prompt += '\n\nOutput must be under ' + _tCharLimit + ' characters. This is for social media posting.';
      }
    }
    var apiKey = await getApiKey(provider); // v10.5.25: Must await async function

    if (!apiKey) {
      showToast('No API key for ' + provider + '. Task skipped.', 'error');
      // v22.56: Write lastRun even on skip to prevent infinite retry loop
      writeLastRunById(task.id, new Date().toISOString());
      return;
    }

    // v17.4: Build rich system prompt matching Studio/Chat quality
    // v18.5: Check if operation has isRawOutput flag for minimal system prompt
    var _taskOp = task.operationId ? findOperationById(task.operationId) : null;
    if (!_taskOp && task.target && task.target.operationId) _taskOp = findOperationById(task.target.operationId);
    var systemPrompt = '';
    if (_taskOp && _taskOp.isRawOutput) {
      var _bn = brand.shortName || brand.name || 'Brand';
      systemPrompt = 'You are a social media copywriter for ' + _bn + '. ' + (brand.desc ? brand.desc + ' ' : '') + 'Your ONLY job is to write the actual post text. Output NOTHING except the exact caption/post that will be published. No titles, no labels, no headers, no sections, no analysis, no publishing notes, no character counts, no engagement strategy, no hashtag advice, no tone descriptions, no markdown formatting. NEVER use em-dashes or en-dashes in your writing. Just the raw post text and nothing else.';
    } else {
      var taskMode = task.mode || 'brand';
      if (taskMode === 'life' && typeof buildLifeAISystemPromptForCategory === 'function') {
        var lifeAgentType = (task.target && task.target.agentId) ? task.target.agentId : 'coach';
        systemPrompt = buildLifeAISystemPromptForCategory(lifeAgentType);
      } else if (typeof buildBrandSystemPrompt === 'function') {
        // Resolve agent from task target or operation category
        var activeAgent = null;
        var agentId = task.target && task.target.agentId ? task.target.agentId : null;
        if (!agentId && task.operationId) {
          var taskOp2 = findOperationById(task.operationId);
          if (taskOp2) agentId = taskOp2.category;
        }
        if (agentId && typeof agents !== 'undefined') {
          activeAgent = agents.find(function(a) { return a.id === agentId || a.category === agentId; });
        }
        systemPrompt = buildBrandSystemPrompt(brand, activeAgent);
      } else {
        systemPrompt = 'You are a brand assistant for ' + brand.name + '. ' + (brand.desc || '');
      }
    }

    // v24.8: Inject user contact card and automation memory into automation prompts
    var _ucAutoPrompt = typeof getUserContactPrompt === 'function' ? getUserContactPrompt() : '';
    if (_ucAutoPrompt) systemPrompt += '\n\n' + _ucAutoPrompt;
    var _amAutoPrompt = typeof getAutomationMemoryPrompt === 'function' ? getAutomationMemoryPrompt() : '';
    if (_amAutoPrompt) systemPrompt += '\n\n' + _amAutoPrompt;

    // v19.1: Append automation directive to ALL scheduled task system prompts
    // Prevents AI from asking clarifying questions or responding conversationally
    systemPrompt += '\n\nIMPORTANT INSTRUCTION: This is a scheduled automation task running unattended. You MUST produce DIRECT, COMPLETE OUTPUT only. Do NOT ask questions, seek clarification, list what you could do, or add meta-commentary. Do NOT say you lack context or need more information. Work with what you have and produce actionable content immediately. Begin your output now.';

    // Make API call
    var response = await makeScheduledTaskAPICall(provider, model, apiKey, systemPrompt, prompt);

    if (response) {
      // Save result
      saveTaskResult(task, idx, response);
      showToast('Task "' + task.name + '" completed!', 'success');

      // v9.1.14: Track completion in notification center
      if (typeof addCompletedAutomation === 'function') {
        addCompletedAutomation(task, true);
      }
      // v13.9: Track in Automations Lab history
      if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, true, response.substring(0, 200));

      // v20.11: Write lastRun by ID (not index) — also store result preview
      var apiTs = new Date().toISOString();
      writeLastRunById(task.id, apiTs, { lastResult: response.substring(0, 500) });

      // v18.5: Show results panel for single workflow
      showSingleWorkflowResultsPanel(task, true, response);
    }
  } catch (error) {
    console.error('[Scheduler] Task execution error:', error);
    showToast('Task "' + task.name + '" failed: ' + error.message, 'error');

    // v9.1.14: Track failure in notification center
    if (typeof addCompletedAutomation === 'function') {
      addCompletedAutomation(task, false);
    }
    // v13.9: Track in Automations Lab history
    if (typeof addAutoLabHistory === 'function') addAutoLabHistory(task, false, error.message);
    // v22.56: Write lastRun on failure to prevent infinite retry loop
    writeLastRunById(task.id, new Date().toISOString());
    // v18.5: Show failure results panel
    showSingleWorkflowResultsPanel(task, false, error.message);
  }
}

function buildTaskPrompt(task) {
  // v14.2: Handle 'studio' action — resolve operationId from task.target
  if (task.action === 'studio' && task.target && task.target.operationId) {
    task = Object.assign({}, task, { action: 'run_operation', operationId: task.target.operationId });
  }
  // v17.4: Unified operation lookup via findOperationById
  if (task.action === 'run_operation' && task.operationId) {
    var operation = findOperationById(task.operationId);

    if (operation) {
      // v18.5: Directive FIRST to prevent AI refusal
      var opPrompt = '[AUTOMATED TASK: You MUST produce direct output only. Do NOT ask questions, seek clarification, or add meta-commentary. Do NOT say you cannot execute operations. Just produce the requested content immediately.]\n\n';
      opPrompt += 'TASK: ' + operation.name + '\n';
      if (operation.desc) opPrompt += operation.desc + '\n';
      // v18.5: Raw output mode — skip deliverables list, add strict output-only directive
      if (operation.isRawOutput) {
        opPrompt += '\nCRITICAL OUTPUT RULE: Your ENTIRE response must be ONLY the final content text. No titles, no headers, no section labels, no analysis, no brand voice scores, no tone analysis, no posting time suggestions, no markdown formatting (no #, no **, no |), no explanations, no preamble. Output the raw text exactly as it should be published.\n';
      } else if (operation.outputs) {
        opPrompt += '\nRequired Deliverables:\n';
        operation.outputs.forEach(function(output) {
          opPrompt += '- ' + output + '\n';
        });
      }
      // v18.5: Include context from workflow form or description
      var _taskContext = (task.target && task.target.contextRef) || task.description || '';
      if (_taskContext) {
        opPrompt += '\nAdditional Context: ' + _taskContext;
      }
      // v17.4: Include reference document if present
      if (task.target && task.target.referenceDoc && task.target.referenceDoc.content) {
        opPrompt += '\n\nReference Document (' + (task.target.referenceDoc.name || 'Attached') + '):\n' + task.target.referenceDoc.content;
      }
      opPrompt += '\n\nBegin your output now.';
      return opPrompt;
    } else {
      console.warn('[Scheduler] Operation not found for id:', task.operationId, '— falling through to description-based prompt');
    }
  }
  
  // v18.6: Enhanced message action — include brand context + direct instruction directive
  if (task.action === 'message') {
    var _msgText = (task.target && task.target.text) || task.description || '';
    var _msgBrandIdx = task.brandIdx !== undefined && task.brandIdx !== '' ? parseInt(task.brandIdx) : 0;
    var _msgBrand = (typeof brands !== 'undefined' && brands[_msgBrandIdx]) ? brands[_msgBrandIdx] : null;
    var _msgPrompt = '[AUTOMATED TASK: You MUST produce direct output only. Do NOT ask questions or add meta-commentary.]\n\n';
    if (_msgBrand) {
      _msgPrompt += 'Brand: ' + (_msgBrand.shortName || _msgBrand.name) + '\n';
      if (_msgBrand.desc) _msgPrompt += 'Description: ' + _msgBrand.desc + '\n';
      if (_msgBrand.voice) _msgPrompt += 'Voice: ' + _msgBrand.voice + '\n';
      if (_msgBrand.positioning) _msgPrompt += 'Positioning: ' + _msgBrand.positioning + '\n';
    }
    _msgPrompt += '\nINSTRUCTION: ' + _msgText;
    _msgPrompt += '\n\nProduce your response now. Be thorough and actionable.';
    return _msgPrompt;
  }

  var prompts = {
    'generate_report': 'Generate a comprehensive brand performance report. Include key metrics, insights, and recommendations for improvement. Format with clear sections.',
    'generate_content': 'Generate engaging social media content and blog post ideas for the brand. Include 3 social posts and 1 blog outline with compelling hooks.',
    'consistency_check': 'Review and analyze brand voice consistency. Provide a checklist of brand guidelines compliance and suggest improvements.',
    'competitor_analysis': 'Analyze top competitors and provide strategic insights on positioning, messaging, and opportunities.',
    'audience_insights': 'Generate detailed audience insights including demographics, preferences, and engagement patterns.',
    'custom': task.description || task.name || 'Provide a helpful response for this brand task.',
    'none': null // Reminder only, no AI action
  };

  if (task.action === 'none') return null; // Skip AI call for reminders

  var basePrompt = prompts[task.action] || prompts['custom'];

  // v19.3: Include task name as context when it differs from description
  if (task.name && task.name !== basePrompt) {
    basePrompt = 'Task: ' + task.name + '\n\n' + basePrompt;
  }

  if (task.description && task.action !== 'custom') {
    basePrompt += '\n\nAdditional context: ' + task.description;
  }

  return basePrompt;
}

// v17.4: Unified operation lookup across all op arrays
function findOperationById(operationId) {
  if (!operationId) return null;
  var idStr = String(operationId);
  var sources = [
    typeof ops !== 'undefined' ? ops : [],
    typeof generatedBrandOps !== 'undefined' ? generatedBrandOps : [],
    typeof window.lifeOps !== 'undefined' ? window.lifeOps : [],
    typeof generatedLifeOps !== 'undefined' ? generatedLifeOps : []
  ];
  // Also check custom operations
  try {
    var customOps = JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]');
    if (customOps.length) sources.push(customOps);
  } catch(e) {}
  for (var i = 0; i < sources.length; i++) {
    for (var j = 0; j < sources[i].length; j++) {
      if (String(sources[i][j].id) === idStr) return sources[i][j];
    }
  }
  return null;
}

async function makeScheduledTaskAPICall(provider, model, apiKey, systemPrompt, userPrompt, _retryCount, _maxTokens) {
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12
  var _retry = _retryCount || 0;
  var _tokLimit = _maxTokens || 4096; // v22.37: Configurable token limit
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
      max_tokens: _tokLimit,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/responses'; // v22.18: Responses API
    headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    // v22.22: Use streaming for OpenAI (matches chat path, prevents timeout with thinking models)
    var actualOAIModel = (typeof resolveOpenAIModel === 'function') ? resolveOpenAIModel(model) : model;
    var oaiBody = {
      model: actualOAIModel,
      instructions: systemPrompt || undefined,
      input: [{ role: 'user', content: userPrompt }],
      max_output_tokens: _tokLimit,
      stream: true,
      store: false
    };
    if (typeof isOpenAIThinkingModel === 'function' && isOpenAIThinkingModel(model)) {
      oaiBody.reasoning = { effort: 'high', summary: 'auto' };
      oaiBody.max_output_tokens = Math.max(_tokLimit, 16384);
    }
    // v31.0: web_search_preview supported on gpt-5.5* and legacy gpt-5.4* models
    if (typeof _modelSupportsWebSearch === 'function' ? _modelSupportsWebSearch(model) : (model && (model.indexOf('gpt-5.5') === 0 || model.indexOf('gpt-5.4') === 0))) {
      oaiBody.tools = [{ type: 'web_search_preview' }];
    }
    // Stream and collect full response (same as callOpenAIStreaming)
    var oaiResp;
    try {
      oaiResp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }, body: JSON.stringify(oaiBody) });
    } catch(fetchErr) {
      console.warn('[Pipeline API] OpenAI fetch failed:', fetchErr.message, 'Model:', model, 'Retry:', _retry);
      if (_retry < 2 && (fetchErr.message || '').indexOf('Load failed') !== -1) {
        await new Promise(function(r) { setTimeout(r, 2000 + _retry * 3000); });
        return makeScheduledTaskAPICall(provider, model, apiKey, systemPrompt.replace('\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.', ''), userPrompt, _retry + 1, _maxTokens);
      }
      throw new Error('Network error calling openai: ' + (fetchErr.message || 'Load failed') + '. Model: ' + model);
    }
    if (!oaiResp.ok) {
      var oaiErr = {};
      try { oaiErr = await oaiResp.json(); } catch(e) {}
      throw new Error('API error: ' + ((oaiErr.error && oaiErr.error.message) || 'HTTP ' + oaiResp.status));
    }
    var oaiReader = oaiResp.body.getReader();
    var oaiDecoder = new TextDecoder();
    var oaiFullText = '';
    var oaiBuf = '';
    var oaiUsage = null; // v24.18: Capture usage for tracking
    while (true) {
      var oaiChunk = await oaiReader.read();
      if (oaiChunk.done) break;
      oaiBuf += oaiDecoder.decode(oaiChunk.value, { stream: true });
      var oaiLines = oaiBuf.split('\n');
      oaiBuf = oaiLines.pop() || '';
      for (var li = 0; li < oaiLines.length; li++) {
        var ln = oaiLines[li].trim();
        if (ln.startsWith('data: ')) {
          var js = ln.slice(6);
          if (js === '[DONE]') continue;
          try {
            var ev = JSON.parse(js);
            if (ev.type === 'response.output_text.delta' && ev.delta) {
              oaiFullText += ev.delta;
            }
            // v24.18: Capture usage from response.completed event
            if (ev.type === 'response.completed' && ev.response && ev.response.usage) {
              oaiUsage = ev.response.usage;
            }
          } catch(e) {}
        }
      }
    }
    // v24.18: Track OpenAI automation usage
    if (oaiUsage && typeof trackAPIUsage === 'function') {
      trackAPIUsage('openai', actualOAIModel, oaiUsage.input_tokens || 0, oaiUsage.output_tokens || 0, false, false, 'automation');
    }
    return oaiFullText || '';
  } else if (provider === 'google') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
      generationConfig: { maxOutputTokens: _tokLimit }
    });
  }
  
  // v22.28: Retry on "Load failed" (Safari background tab kills fetch)
  var response, data;
  try {
    response = await fetch(url, { method: 'POST', headers: headers, body: body });
  } catch(fetchErr) {
    console.warn('[Pipeline API] Fetch failed:', fetchErr.message, 'Provider:', provider, 'Model:', model, 'Retry:', _retry);
    if (_retry < 2 && (fetchErr.message || '').indexOf('Load failed') !== -1) {
      await new Promise(function(r) { setTimeout(r, 2000 + _retry * 3000); });
      return makeScheduledTaskAPICall(provider, model, apiKey, systemPrompt.replace('\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.', ''), userPrompt, _retry + 1, _maxTokens);
    }
    throw new Error('Network error calling ' + provider + ': ' + (fetchErr.message || 'Load failed') + '. Model: ' + model);
  }
  try {
    data = await response.json();
  } catch(jsonErr) {
    throw new Error('Invalid response from ' + provider + ' (HTTP ' + response.status + ')');
  }

  // v20.10: Check for API errors
  if (!response.ok) {
    var errMsg = (data && data.error && data.error.message) || (data && data.error) || ('HTTP ' + response.status);
    console.warn('[Pipeline API] Error:', errMsg);
    throw new Error('API error: ' + errMsg);
  }

  var result = null;
  if (provider === 'anthropic') {
    result = data.content && data.content[0] && data.content[0].text;
    // v24.18: Track Anthropic automation usage
    if (data.usage && typeof trackAPIUsage === 'function') {
      trackAPIUsage('anthropic', model, data.usage.input_tokens || 0, data.usage.output_tokens || 0, false, false, 'automation');
    }
  } else if (provider === 'openai') {
    // v22.22: Robust extraction for Responses API (handles reasoning models)
    // output_text is the convenience field; fallback to scanning output array for message content
    result = data.output_text || '';
    if (!result && data.output && Array.isArray(data.output)) {
      for (var oi = 0; oi < data.output.length; oi++) {
        var outItem = data.output[oi];
        if (outItem.type === 'message' && outItem.content && Array.isArray(outItem.content)) {
          for (var ci = 0; ci < outItem.content.length; ci++) {
            if (outItem.content[ci].type === 'output_text' && outItem.content[ci].text) {
              result = outItem.content[ci].text;
              break;
            }
          }
          if (result) break;
        }
      }
    }
    if (!result) {
      console.warn('[Pipeline API] OpenAI response had no extractable text. Keys:', Object.keys(data), 'output:', JSON.stringify(data.output || data).substring(0, 500));
    }
    // v24.18: Track OpenAI automation usage (non-streaming fallback path)
    if (data.usage && typeof trackAPIUsage === 'function') {
      trackAPIUsage('openai', model, data.usage.input_tokens || 0, data.usage.output_tokens || 0, false, false, 'automation');
    }
  } else if (provider === 'google') {
    result = data.candidates && data.candidates[0] && data.candidates[0].content &&
           data.candidates[0].content.parts ? extractGeminiResponseText(data.candidates[0].content.parts) : '';
    // v24.18: Track Google automation usage
    if (data.usageMetadata && typeof trackAPIUsage === 'function') {
      trackAPIUsage('google', model, data.usageMetadata.promptTokenCount || 0, data.usageMetadata.candidatesTokenCount || 0, false, false, 'automation');
    }
  }
  return result || '';
}

function saveTaskResult(task, idx, result) {
  // Save to task history
  var historyKey = 'roweos_task_history';
  var history = [];
  try { history = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch(e) {}

  // v18.7: Strip base64 images from result to prevent quota issues
  var cleanResult = result;
  if (typeof cleanResult === 'string' && cleanResult.indexOf('data:image') === 0) {
    cleanResult = '[Image generated]';
  }
  // v22.29: Increased from 5K to 50K to show full execution output
  if (typeof cleanResult === 'string' && cleanResult.length > 50000) {
    cleanResult = cleanResult.substring(0, 50000);
  }

  var historyEntry = {
    taskId: task.id,
    taskName: task.name,
    brand: task.brand,
    action: task.action,
    timestamp: new Date().toISOString(),
    result: cleanResult
  };

  history.unshift(historyEntry);

  // Keep only last 30 results (was 50)
  if (history.length > 30) history = history.slice(0, 30);

  // v18.7: Wrap in try/catch to prevent QuotaExceededError
  try {
    localStorage.setItem(historyKey, JSON.stringify(history));
  } catch(e) {
    if (typeof clearExpendableStorageData === 'function') clearExpendableStorageData();
    history = history.slice(0, 10);
    try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch(e2) {}
  }
  
  // v10.5.25: Save to brand's Library (Scheduled Outputs folder) with rich text
  if (task.brand && result) {
    // Find brand index
    var brandIdx = brands.findIndex(function(b) { return b.name === task.brand; });
    if (brandIdx === -1) brandIdx = 0;
    
    // Get the brand's library
    var lib = getLibraryForBrandIndex(brandIdx);
    if (!lib.files) lib.files = [];
    
    // v10.5.25: Show "Life" instead of "_life"
    var brandDisplay = task.brand === '_life' ? 'Life' : task.brand;
    
    // Format content with rich text
    var formattedContent = typeof formatMessageContent === 'function' ? formatMessageContent(result) : result;
    var content = '<div class="automation-output">' +
      '<div class="automation-header" style="margin-bottom: var(--space-4); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-color);">' +
        '<h2 style="margin: 0 0 4px 0; color: var(--text-primary);">' + escapeHtml(task.name) + '</h2>' +
        '<p style="margin: 0; font-size: var(--text-sm); color: var(--text-muted);">' + 
          'Brand: ' + escapeHtml(brandDisplay) + ' · ' +
          'Completed: ' + new Date().toLocaleString() + 
        '</p>' +
      '</div>' +
      '<div class="automation-body">' + formattedContent + '</div>' +
    '</div>';
    
    // Create library file entry in the correct folder
    var newFile = {
      id: 'scheduled-' + Date.now(),
      name: task.name + ' - ' + new Date().toLocaleDateString(),
      type: 'automation-output',
      content: content,
      folderId: 'scheduled-outputs',
      savedAt: new Date().toISOString(),
      brand: task.brand,
      metadata: {
        taskId: task.id,
        action: task.action,
        frequency: task.frequency
      }
    };
    
    lib.files.push(newFile);
    saveLibrary();
    
    console.log('[Scheduler] Saved result to Library for brand:', task.brand);
  }
}

// Manual run button handler
function runTaskNow(idx) {
  var tasks = getScheduledTasks();
  if (tasks[idx]) {
    executeScheduledTask(tasks[idx], idx);
  }
}

function getNextRunTime(task) {
  if (!task.enabled) return 'Paused';

  var next = new Date(task.scheduledDate);
  var now = new Date();
  var freq = task.frequency || task.recurType || 'once';

  if (freq === 'once') {
    return next > now ? next.toLocaleDateString() : 'Completed';
  }

  // v13.9: Use math instead of day-by-day loop to prevent hang with old dates
  if (next < now) {
    var diffMs = now.getTime() - next.getTime();
    var diffDays = Math.ceil(diffMs / 86400000);
    if (freq === 'daily') {
      next.setDate(next.getDate() + diffDays);
    } else if (freq === 'weekly') {
      var diffWeeks = Math.ceil(diffDays / 7);
      next.setDate(next.getDate() + diffWeeks * 7);
    } else if (freq === 'monthly') {
      var diffMonths = Math.ceil(diffDays / 28);
      next.setMonth(next.getMonth() + diffMonths);
    }
    // One final check in case we landed just before now
    if (next < now) {
      if (freq === 'daily') next.setDate(next.getDate() + 1);
      else if (freq === 'weekly') next.setDate(next.getDate() + 7);
      else if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
    }
  }

  return next.toLocaleDateString();
}

function formatFrequency(freq) {
  var map = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', once: 'One-time' };
  return map[freq] || freq;
}

var taskEditIndex = null; // Track which task we're editing

function createScheduledTask() {
  taskEditIndex = null; // Clear edit mode
  document.getElementById('taskModalTitle').textContent = 'Create Automation';
  document.getElementById('saveTaskBtn').textContent = 'Create Automation';
  
  // Clear inputs
  document.getElementById('taskNameInput').value = '';
  document.getElementById('taskDescriptionInput').value = '';
  document.getElementById('taskActionInput').value = 'none';
  
  // v9.1.14: Set date picker to today or selected date
  var dateInput = document.getElementById('taskDateInput');
  if (dateInput) {
    dateInput.value = rhythmSelectedDate || new Date().toISOString().slice(0, 10);
  }
  
  // v9.1.14: Reset recurring toggle
  var recurringCheckbox = document.getElementById('taskRecurringInput');
  var recurringOptions = document.getElementById('recurringOptions');
  if (recurringCheckbox) recurringCheckbox.checked = false;
  if (recurringOptions) recurringOptions.style.display = 'none';
  document.getElementById('taskFrequencyInput').value = 'daily';
  
  // Reset color selection
  document.getElementById('taskColorInput').value = '#a89878';
  document.querySelectorAll('.task-color-option').forEach(function(btn) {
    btn.style.borderColor = btn.dataset.color === '#a89878' ? 'var(--accent)' : 'transparent';
  });
  
  // Show modal
  openTaskModal();
}

function viewTaskHistory() {
  var history = JSON.parse(localStorage.getItem('roweos_task_history') || '[]');
  
  if (history.length === 0) {
    showToast('No task execution history yet. Run a task to see results here.', 'info');
    return;
  }
  
  // Create modal content
  var html = '<div style="max-height: 500px; overflow-y: auto;">';
  history.forEach(function(entry, idx) {
    var date = new Date(entry.timestamp).toLocaleString();
    html += '<div style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-3);">';
    html += '<div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">';
    html += '<span style="font-weight: 600;">' + entry.taskName + '</span>';
    if (entry.brand) {
      html += '<span style="font-size: var(--text-xs); padding: 3px 8px; background: rgba(184, 152, 106, 0.15); color: #b8986a; border-radius: var(--radius-sm);">' + entry.brand + '</span>';
    }
    html += '</div>';
    html += '<div style="font-size: var(--text-sm); color: var(--text-tertiary); margin-bottom: var(--space-2);">' + date + '</div>';
    html += '<div style="font-size: var(--text-base); color: var(--text-secondary); white-space: pre-wrap; max-height: 200px; overflow-y: auto; background: var(--bg-secondary); padding: var(--space-3); border-radius: var(--radius-sm);">' + (entry.result || 'No result recorded').substring(0, 1000) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  
  // Show in a simple alert-style modal (reuse existing modal system)
  var modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.id = 'taskHistoryModal';
  modal.innerHTML = '<div class="modal" style="max-width: 700px;"><div class="modal-header"><span class="modal-title">Task Execution History</span><button class="modal-close" onclick="document.getElementById(\'taskHistoryModal\').remove()">×</button></div><div class="modal-body">' + html + '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="clearTaskHistory()">Clear History</button><button class="btn btn-primary" onclick="document.getElementById(\'taskHistoryModal\').remove()">Close</button></div></div>';
  document.body.appendChild(modal);
}

function clearTaskHistory() {
  if (confirm('Clear all task execution history?')) {
    localStorage.removeItem('roweos_task_history');
    document.getElementById('taskHistoryModal').remove();
    showToast('Task history cleared', 'success');
  }
}

function quickSchedule(type) {
  var templates = {
    'daily-report': {
      name: 'Daily Brand Report',
      description: 'Comprehensive brand performance report generated every morning',
      frequency: 'daily',
      scheduledDate: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
      enabled: true,
      action: 'generate_report'
    },
    'content-generation': {
      name: 'Weekly Content Generation',
      description: 'Automated social media and blog content creation',
      frequency: 'weekly',
      scheduledDate: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
      enabled: true,
      action: 'generate_content'
    },
    'consistency-check': {
      name: 'Brand Consistency Check',
      description: 'Review brand guidelines and voice compliance',
      frequency: 'weekly',
      scheduledDate: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
      enabled: true,
      action: 'consistency_check'
    }
  };
  
  var template = templates[type];
  if (!template) return;
  
  var tasks = getScheduledTasks();
  tasks.push(template);
  saveScheduledTasks(tasks);
  
  showToast('Task "' + template.name + '" scheduled successfully!', 'success');
  renderScheduledTasksList();
  generateCalendarDays(window.calendarYear, window.calendarMonth);
}

function toggleTask(idx) {
  var tasks = getScheduledTasks();
  if (tasks[idx]) {
    tasks[idx].enabled = !tasks[idx].enabled;
    saveScheduledTasks(tasks);
    renderScheduledTasksList();
    showToast('Task ' + (tasks[idx].enabled ? 'resumed' : 'paused'), 'success');
  }
}

function editTask(idx) {
  var tasks = getScheduledTasks();
  var task = tasks[idx];
  if (!task) return;
  
  taskEditIndex = idx; // Set edit mode
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('saveTaskBtn').textContent = 'Save Changes';
  
  // Fill inputs with current values
  document.getElementById('taskNameInput').value = task.name || '';
  document.getElementById('taskDescriptionInput').value = task.description || '';
  document.getElementById('taskFrequencyInput').value = task.frequency || 'daily';
  document.getElementById('taskActionInput').value = task.action || 'generate_report';
  document.getElementById('taskColorInput').value = task.color || '#6366f1';
  document.getElementById('taskTimeInput').value = task.time || '09:00';
  document.getElementById('taskEnabledInput').checked = task.enabled !== false;
  
  // Show modal (this will populate brand selector)
  openTaskModal();
  
  // Set brand value after modal opens
  setTimeout(function() {
    if (task.brandIdx !== undefined && task.brandIdx !== '') {
      document.getElementById('taskBrandInput').value = task.brandIdx;
    }
    // Set color selection visual
    if (task.color) {
      selectTaskColor(task.color);
    }
  }, 50);
}

function deleteTask(idx) {
  var tasks = getScheduledTasks();
  if (tasks[idx] && confirm('Delete task "' + tasks[idx].name + '"?')) {
    tasks.splice(idx, 1);
    saveScheduledTasks(tasks);
    renderScheduledTasksList();
    generateCalendarDays(window.calendarYear, window.calendarMonth);
    showToast('Task deleted', 'success');
  }
}

function openTaskModal() {
  var modal = document.getElementById('taskModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    
    // Populate brand selector
    var brandSelect = document.getElementById('taskBrandInput');
    if (brandSelect && brands && brands.length > 0) {
      brandSelect.innerHTML = '<option value="">All Brands</option>';
      brands.forEach(function(brand, idx) {
        var option = document.createElement('option');
        option.value = idx;
        option.textContent = brand.name;
        brandSelect.appendChild(option);
      });
    }
    
    // Focus first input
    setTimeout(function() {
      document.getElementById('taskNameInput').focus();
    }, 100);
  }
}

function closeTaskModal() {
  var modal = document.getElementById('taskModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
  taskEditIndex = null;
}

function selectTaskColor(color) {
  // Update hidden input
  document.getElementById('taskColorInput').value = color;
  
  // Update visual selection
  document.querySelectorAll('.task-color-option').forEach(function(btn) {
    if (btn.dataset.color === color) {
      btn.style.borderColor = color;
      btn.style.boxShadow = '0 0 0 2px ' + color + '40';
    } else {
      btn.style.borderColor = 'transparent';
      btn.style.boxShadow = 'none';
    }
  });
}

function saveTaskFromModal() {
  var name = document.getElementById('taskNameInput').value.trim();
  var description = document.getElementById('taskDescriptionInput').value.trim();
  var action = document.getElementById('taskActionInput').value;
  var color = document.getElementById('taskColorInput').value || '#a89878';
  var time = document.getElementById('taskTimeInput').value || '09:00';
  var brandIdx = document.getElementById('taskBrandInput').value;
  var brandName = '';
  if (brandIdx !== '' && brands[parseInt(brandIdx)]) {
    brandName = brands[parseInt(brandIdx)].name;
  }
  
  // v9.1.14: Get date and recurring options
  var dateInput = document.getElementById('taskDateInput');
  var selectedDate = dateInput ? dateInput.value : new Date().toISOString().slice(0, 10);
  var isRecurring = document.getElementById('taskRecurringInput').checked;
  var frequency = isRecurring ? document.getElementById('taskFrequencyInput').value : 'once';
  
  if (!name) {
    showToast('Please enter an automation name', 'error');
    return;
  }
  
  var tasks = getScheduledTasks();
  
  if (taskEditIndex !== null) {
    // Edit existing task
    if (tasks[taskEditIndex]) {
      tasks[taskEditIndex].name = name;
      tasks[taskEditIndex].description = description;
      tasks[taskEditIndex].frequency = frequency;
      tasks[taskEditIndex].action = action;
      tasks[taskEditIndex].color = color;
      tasks[taskEditIndex].time = time;
      tasks[taskEditIndex].enabled = true;
      tasks[taskEditIndex].brand = brandName;
      tasks[taskEditIndex].brandIdx = brandIdx;
      tasks[taskEditIndex].scheduledDate = selectedDate + 'T' + time + ':00';
      showToast('Automation updated!', 'success');
    }
  } else {
    // Create new task
    var newTask = {
      id: Date.now(),
      name: name,
      description: description,
      frequency: frequency,
      scheduledDate: selectedDate + 'T' + time + ':00',
      enabled: true,
      action: action,
      color: color,
      time: time,
      brand: brandName,
      brandIdx: brandIdx
    };
    tasks.push(newTask);
    showToast('Automation "' + name + '" created!', 'success');
  }
  
  saveScheduledTasks(tasks);
  renderScheduledTasksList();
  renderRhythmAutomations();
  renderCalendar();
  if (rhythmSelectedDate) renderRhythmDayAutomations();
  closeTaskModal();
}

// v12.0.0: formatTimeAgo moved to utils.timeAgo (alias at top of JS section)

window.onload = init;
