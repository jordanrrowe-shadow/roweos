// v30.1: Admin Email Management
// Client-side logic for the Emails tab in the Admin panel

// v30.5: Sort state for user list
var _adminEmailSortBy = 'name';
// v31.2: Sort direction (asc|desc) and Select Mode (checkboxes hidden by default)
var _adminEmailSortDir = 'asc';
var _adminEmailSelectMode = false;
// v31.2: Default fixed column widths (px) + per-user overrides persisted in localStorage
var _adminColDefaults = { name: 130, email: 200, status: 80, lastActive: 90, signup: 64, lastEmail: 160, responses: 90 };
// v31.3: Column order — used to find adjacent column for redistribute-on-resize
var _adminColOrder = ['name', 'email', 'status', 'lastActive', 'signup', 'lastEmail', 'responses'];
var _adminColMin = 48;
var _adminColWidths = (function() {
  try { return JSON.parse(localStorage.getItem('roweos_admin_email_col_widths_v2') || '{}'); }
  catch (e) { return {}; }
})();
function _adminColW(col) {
  return _adminColWidths[col] || _adminColDefaults[col] || 100;
}
function _adminApplyColW(col, w) {
  var hdrCells = document.querySelectorAll('.em-hdr-col[data-col="' + col + '"]');
  var dataCells = document.querySelectorAll('.em-data-cell[data-col="' + col + '"]');
  var apply = function(el) { el.style.width = w + 'px'; el.style.minWidth = w + 'px'; el.style.maxWidth = w + 'px'; };
  for (var i = 0; i < hdrCells.length; i++) apply(hdrCells[i]);
  for (var j = 0; j < dataCells.length; j++) apply(dataCells[j]);
}
// v31.3: Resize REDISTRIBUTES width between this column and the next adjacent column.
// Total table width never changes, so the table stays inside its grey container — never escapes either edge.
function adminStartColResize(e, col) {
  e.preventDefault(); e.stopPropagation();
  var idx = _adminColOrder.indexOf(col);
  var nextCol = _adminColOrder[idx + 1];
  if (!nextCol) return; // last column has no neighbor to take from
  var startX = e.clientX;
  var startW = _adminColW(col);
  var startNextW = _adminColW(nextCol);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  function onMove(ev) {
    var delta = ev.clientX - startX;
    // Cap delta so neither this column nor the next goes below the minimum
    var maxGrow = startNextW - _adminColMin;     // next column can shrink at most this much
    var maxShrink = startW - _adminColMin;        // this column can shrink at most this much
    if (delta > maxGrow) delta = maxGrow;
    if (delta < -maxShrink) delta = -maxShrink;
    var newW = Math.round(startW + delta);
    var newNextW = Math.round(startNextW - delta);
    _adminColWidths[col] = newW;
    _adminColWidths[nextCol] = newNextW;
    _adminApplyColW(col, newW);
    _adminApplyColW(nextCol, newNextW);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try { localStorage.setItem('roweos_admin_email_col_widths_v2', JSON.stringify(_adminColWidths)); } catch (e) {}
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ---- Helpers ----

function formatTemplateName(template) {
  if (!template) return '';
  return template.split('_').map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function formatRelativeTime(isoDateString) {
  if (!isoDateString) return '';
  var now = Date.now();
  var then = new Date(isoDateString).getTime();
  if (isNaN(then)) return '';
  var diffMs = now - then;
  var diffSec = Math.floor(diffMs / 1000);
  var diffMin = Math.floor(diffSec / 60);
  var diffHr = Math.floor(diffMin / 60);
  var diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  if (diffHr < 24) return diffHr + 'h ago';
  if (diffDay < 7) return diffDay + 'd ago';
  // Older than a week: show date
  var d = new Date(isoDateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- Internal helpers for Firestore REST ----

function _adminFirestoreGet(collection) {
  var user = firebase.auth().currentUser;
  if (!user) return Promise.reject(new Error('Not authenticated'));
  return user.getIdToken().then(function(idToken) {
    var projectId = 'roweos';
    var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/' + collection;
    return fetch(url, { headers: { 'Authorization': 'Bearer ' + idToken } });
  }).then(function(resp) {
    if (!resp.ok) throw new Error('Firestore fetch failed: ' + resp.status);
    return resp.json();
  });
}

function _adminFirestoreGetDoc(path) {
  var user = firebase.auth().currentUser;
  if (!user) return Promise.reject(new Error('Not authenticated'));
  return user.getIdToken().then(function(idToken) {
    var projectId = 'roweos';
    var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/' + path;
    return fetch(url, { headers: { 'Authorization': 'Bearer ' + idToken } });
  }).then(function(resp) {
    if (!resp.ok) throw new Error('Firestore doc fetch failed: ' + resp.status);
    return resp.json();
  });
}

function _adminFirestorePatch(path, fields, updateMask) {
  var user = firebase.auth().currentUser;
  if (!user) return Promise.reject(new Error('Not authenticated'));
  return user.getIdToken().then(function(idToken) {
    var projectId = 'roweos';
    var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/' + path;
    if (updateMask && updateMask.length) {
      url += '?' + updateMask.map(function(f) { return 'updateMask.fieldPaths=' + encodeURIComponent(f); }).join('&');
    }
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + idToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: fields })
    });
  }).then(function(resp) {
    if (!resp.ok) throw new Error('Firestore patch failed: ' + resp.status);
    return resp.json();
  });
}

// Parse Firestore REST doc value to JS
function _fsVal(fieldObj) {
  if (!fieldObj) return null;
  if (fieldObj.stringValue !== undefined) return fieldObj.stringValue;
  if (fieldObj.integerValue !== undefined) return parseInt(fieldObj.integerValue, 10);
  if (fieldObj.doubleValue !== undefined) return fieldObj.doubleValue;
  if (fieldObj.booleanValue !== undefined) return fieldObj.booleanValue;
  if (fieldObj.timestampValue !== undefined) return fieldObj.timestampValue;
  if (fieldObj.nullValue !== undefined) return null;
  if (fieldObj.mapValue && fieldObj.mapValue.fields) {
    var obj = {};
    var keys = Object.keys(fieldObj.mapValue.fields);
    for (var i = 0; i < keys.length; i++) {
      obj[keys[i]] = _fsVal(fieldObj.mapValue.fields[keys[i]]);
    }
    return obj;
  }
  if (fieldObj.arrayValue) {
    if (!fieldObj.arrayValue.values) return [];
    return fieldObj.arrayValue.values.map(function(v) { return _fsVal(v); });
  }
  return null;
}

// Extract doc ID from Firestore REST document name
function _fsDocId(doc) {
  if (!doc || !doc.name) return '';
  var parts = doc.name.split('/');
  return parts[parts.length - 1];
}

// ---- Main Functions ----

function adminLoadEmailData() {
  if (!isAdmin() || !firebase) return;
  var contentEl = document.getElementById('adminEmailContent');
  var statsEl = document.getElementById('adminEmailStats');
  if (contentEl) contentEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;">Loading email data...</div>';
  if (statsEl) statsEl.innerHTML = '';

  var db = firebase.firestore();

  // v30.1: Use Firebase client SDK. Each query wrapped in catch so one missing collection doesn't break all.
  // v31.2: Pull roweos_users (lastActiveAt) + access_keys (tier + trial state) for status columns
  var signupsP = db.collection('newsletter_subscribers').orderBy('subscribedAt', 'desc').limit(200).get().catch(function(e) { console.warn('[Admin Emails] signups query failed:', e.message); return null; });
  var emailLogP = db.collection('email_log').limit(2000).get().catch(function(e) { console.warn('[Admin Emails] email_log query failed:', e.message); return null; });
  var responsesP = db.collectionGroup('responses').limit(500).get().catch(function(e) { console.warn('[Admin Emails] responses query failed:', e.message); return null; });
  var usersP = db.collection('roweos_users').limit(500).get().catch(function(e) { console.warn('[Admin Emails] roweos_users query failed:', e.message); return null; });
  var keysP = db.collection('access_keys').limit(500).get().catch(function(e) { console.warn('[Admin Emails] access_keys query failed:', e.message); return null; });
  // v31.3: Per-user campaign click attribution (writes from /api/track-click)
  var clicksP = db.collectionGroup('clicks').limit(500).get().catch(function(e) { console.warn('[Admin Emails] clicks query failed:', e.message); return null; });

  Promise.all([signupsP, emailLogP, responsesP, usersP, keysP, clicksP]).then(function(results) {
    var signupSnap = results[0];
    var emailLogSnap = results[1];
    var responseSnap = results[2];
    var usersSnap = results[3];
    var keysSnap = results[4];
    var clicksSnap = results[5];

    // v31.3: Build per-recipient click map. recipient = email or uid (sanitized in doc id, real value in `recipient` field).
    var _clicksByRecipient = {};
    if (clicksSnap && clicksSnap.docs) {
      clicksSnap.docs.forEach(function(doc) {
        var d = doc.data() || {};
        var recipient = (d.recipient || '').toLowerCase();
        if (!recipient) return;
        if (!_clicksByRecipient[recipient]) _clicksByRecipient[recipient] = [];
        var lastClick = 0;
        if (d.lastClickAt) {
          lastClick = d.lastClickAt.toDate ? d.lastClickAt.toDate().getTime() : new Date(d.lastClickAt).getTime();
        }
        _clicksByRecipient[recipient].push({
          campaign: d.campaign || '',
          clickCount: d.clickCount || 1,
          lastClickAt: lastClick
        });
      });
    }
    window._adminCampaignClicksByRecipient = _clicksByRecipient;

    // v31.2: Build lookup maps - by uid AND lowercased email
    var _userMetaByUid = {};
    var _userMetaByEmail = {};
    if (usersSnap && usersSnap.docs) {
      usersSnap.docs.forEach(function(doc) {
        var d = doc.data() || {};
        var meta = {
          uid: doc.id,
          email: (d.email || '').toLowerCase(),
          lastActiveAt: d.lastActiveAt && d.lastActiveAt.toDate ? d.lastActiveAt.toDate().getTime() : (d.lastActiveAt ? new Date(d.lastActiveAt).getTime() : 0),
          tier: d.tier || '',
          subscriptionStatus: d.subscriptionStatus || d.status || '',
          stripeTrialEnd: d.stripeTrialEnd || d.trialEnd || '',
          adminNotes: d.adminNotes || '',
          signupSource: d.signupSource || ''
        };
        _userMetaByUid[doc.id] = meta;
        if (meta.email) _userMetaByEmail[meta.email] = meta;
      });
    }
    var _keyByEmail = {};
    var _keyByUid = {};
    if (keysSnap && keysSnap.docs) {
      keysSnap.docs.forEach(function(doc) {
        var d = doc.data() || {};
        var trialActivatedAt = 0;
        if (d.trialActivatedAt) {
          trialActivatedAt = d.trialActivatedAt.toDate ? d.trialActivatedAt.toDate().getTime() : new Date(d.trialActivatedAt).getTime();
        }
        var keyMeta = {
          tier: d.tier || '',
          status: d.status || '',
          trialActivatedAt: trialActivatedAt,
          assignedTo: (d.email || d.assignedToEmail || '').toLowerCase(),
          assignedUid: d.uid || d.assignedToUid || ''
        };
        if (keyMeta.assignedTo) _keyByEmail[keyMeta.assignedTo] = keyMeta;
        if (keyMeta.assignedUid) _keyByUid[keyMeta.assignedUid] = keyMeta;
      });
    }
    window._adminUserMetaByUid = _userMetaByUid;
    window._adminUserMetaByEmail = _userMetaByEmail;
    window._adminKeyByUid = _keyByUid;
    window._adminKeyByEmail = _keyByEmail;

    // Parse signups into user objects
    var users = [];
    if (signupSnap && signupSnap.docs) {
      signupSnap.docs.forEach(function(doc) {
        var d = doc.data();
        var emailL = (d.email || '').toLowerCase();
        var meta = _userMetaByUid[d.uid] || _userMetaByEmail[emailL] || {};
        var keyMeta = _keyByUid[d.uid] || _keyByEmail[emailL] || {};
        users.push({
          uid: d.uid || doc.id,
          email: d.email || '',
          name: d.name || d.displayName || '',
          signupDate: d.subscribedAt || d.createdAt || d.signupDate || '',
          signupSource: d.source || d.signupSource || meta.signupSource || '',
          lastActiveAt: meta.lastActiveAt || 0,
          tier: keyMeta.tier || meta.tier || '',
          subscriptionStatus: meta.subscriptionStatus || '',
          trialActivatedAt: keyMeta.trialActivatedAt || 0,
          keyStatus: keyMeta.status || ''
        });
      });
    }

    // Parse email logs
    var emailLogs = [];
    console.log('[Admin Emails] email_log snap:', emailLogSnap ? (emailLogSnap.docs ? emailLogSnap.docs.length + ' docs' : 'no docs array') : 'null');
    if (emailLogSnap && emailLogSnap.docs) {
      emailLogSnap.docs.forEach(function(doc) {
        var d = doc.data();
        console.log('[Admin Emails] email_log entry:', d.userEmail, d.template, d.sentAt);
        emailLogs.push({
          id: doc.id,
          userId: d.userId || '',
          userEmail: d.userEmail || d.email || '',
          template: d.template || '',
          subject: d.subject || '',
          sentAt: d.sentAt || d.createdAt || '',
          status: d.status || 'sent'
        });
      });
    }

    // Parse responses (may not exist yet)
    var responses = [];
    if (responseSnap && responseSnap.docs) {
      responseSnap.docs.forEach(function(doc) {
        var d = doc.data();
        responses.push({
          id: doc.id,
          userId: doc.ref.parent.parent ? doc.ref.parent.parent.id : '',
          userEmail: d.userEmail || d.email || '',
          question: d.question || d.field || '',
          answer: d.answer || d.value || d.response || '',
          template: d.email_template || d.template || d.source || '',
          timestamp: d.timestamp || d.createdAt || d.submittedAt || ''
        });
      });
    }

    // v30.1: Merge in any users from email_log who aren't in newsletter_subscribers
    var existingEmails = {};
    for (var eu = 0; eu < users.length; eu++) {
      if (users[eu].email) existingEmails[users[eu].email.toLowerCase()] = true;
    }
    if (emailLogs && emailLogs.length) {
      emailLogs.forEach(function(log) {
        var logEmail = (log.userEmail || '').toLowerCase();
        if (logEmail && !existingEmails[logEmail]) {
          existingEmails[logEmail] = true;
          var _logMeta = _userMetaByUid[log.userId] || _userMetaByEmail[logEmail] || {};
          var _logKey = _keyByUid[log.userId] || _keyByEmail[logEmail] || {};
          users.push({
            uid: log.userId || '',
            email: log.userEmail || '',
            name: '',
            signupDate: log.sentAt || '',
            signupSource: _logMeta.signupSource || '',
            lastActiveAt: _logMeta.lastActiveAt || 0,
            tier: _logKey.tier || _logMeta.tier || '',
            subscriptionStatus: _logMeta.subscriptionStatus || '',
            trialActivatedAt: _logKey.trialActivatedAt || 0,
            keyStatus: _logKey.status || ''
          });
        }
      });
    }

    adminRenderEmailUserList(users, emailLogs, responses);
    adminRenderEmailStats(responses);

    // Load auto-send settings too
    adminLoadAutoSendSettings();
  }).catch(function(err) {
    if (contentEl) contentEl.innerHTML = '<div style="color:#f87171;padding:8px 0;">Error loading email data: ' + escapeHtml(err.message) + '</div>';
    console.error('[Admin Emails] Load error:', err);
  });
}

function adminRenderEmailUserList(users, emailLogs, responses) {
  var contentEl = document.getElementById('adminEmailContent');
  if (!contentEl) return;
  // v30.1: Clear detail user context
  window._adminEmailDetailUser = null;

  // Store data globally so detail view can use it
  window._adminEmailUsers = users;
  window._adminEmailLogs = emailLogs;
  window._adminEmailResponses = responses;

  if (!users || !users.length) {
    contentEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;">No signups found</div>';
    return;
  }

  // v31.2: Build lookup maps for sort + render (lastEmail times, response counts)
  var _lastSentMap = {};
  if (emailLogs && emailLogs.length) {
    for (var li = 0; li < emailLogs.length; li++) {
      var _log = emailLogs[li];
      var _lKey = _log.userId || _log.userEmail;
      if (!_lKey) continue;
      var _lTime = _log.sentAt ? new Date(_log.sentAt).getTime() : 0;
      if (!_lastSentMap[_lKey] || _lTime > _lastSentMap[_lKey]) {
        _lastSentMap[_lKey] = _lTime;
      }
    }
  }
  var _respCountMap = {};
  if (responses && responses.length) {
    for (var ri = 0; ri < responses.length; ri++) {
      var rKey = responses[ri].userId || responses[ri].userEmail;
      if (rKey) _respCountMap[rKey] = (_respCountMap[rKey] || 0) + 1;
    }
  }

  // v31.2: Generic sort by column with direction
  var _dir = _adminEmailSortDir === 'desc' ? -1 : 1;
  users.sort(function(a, b) {
    var va, vb;
    if (_adminEmailSortBy === 'lastEmail') {
      va = _lastSentMap[a.uid] || _lastSentMap[a.email] || 0;
      vb = _lastSentMap[b.uid] || _lastSentMap[b.email] || 0;
      return (vb - va) * _dir;
    } else if (_adminEmailSortBy === 'signup') {
      va = a.signupDate ? new Date(a.signupDate).getTime() : 0;
      vb = b.signupDate ? new Date(b.signupDate).getTime() : 0;
      return (vb - va) * _dir;
    } else if (_adminEmailSortBy === 'responses') {
      va = (_respCountMap[a.uid] || 0) + (a.uid !== a.email ? (_respCountMap[a.email] || 0) : 0);
      vb = (_respCountMap[b.uid] || 0) + (b.uid !== b.email ? (_respCountMap[b.email] || 0) : 0);
      return (vb - va) * _dir;
    } else if (_adminEmailSortBy === 'lastActive') {
      va = a.lastActiveAt || 0;
      vb = b.lastActiveAt || 0;
      return (vb - va) * _dir;
    } else if (_adminEmailSortBy === 'source') {
      va = (a.signupSource || '').toLowerCase();
      vb = (b.signupSource || '').toLowerCase();
      return (va < vb ? -1 : (va > vb ? 1 : 0)) * _dir;
    } else if (_adminEmailSortBy === 'status') {
      // Active(3) > Trial(2) > Signup(1) > Expired(0)
      var rank = function(u) {
        var s = _adminComputeUserStatus(u);
        if (s.label === 'Active') return 3;
        if (s.label === 'Trial') return 2;
        if (s.label === 'Signup') return 1;
        return 0;
      };
      return (rank(b) - rank(a)) * _dir;
    } else if (_adminEmailSortBy === 'email') {
      va = (a.email || '').toLowerCase();
      vb = (b.email || '').toLowerCase();
      return (va < vb ? -1 : (va > vb ? 1 : 0)) * _dir;
    }
    va = (a.name || '').toLowerCase();
    vb = (b.name || '').toLowerCase();
    return (va < vb ? -1 : (va > vb ? 1 : 0)) * _dir;
  });

  // Build response counts per user
  var responseCounts = {};
  if (responses && responses.length) {
    responses.forEach(function(r) {
      var key = r.userId || r.userEmail;
      if (!key) return;
      responseCounts[key] = (responseCounts[key] || 0) + 1;
    });
  }

  // Build last email per user
  var lastEmails = {};
  if (emailLogs && emailLogs.length) {
    emailLogs.forEach(function(log) {
      var key = log.userId || log.userEmail;
      if (!key) return;
      var existing = lastEmails[key];
      if (!existing || (log.sentAt && (!existing.sentAt || new Date(log.sentAt) > new Date(existing.sentAt)))) {
        lastEmails[key] = log;
      }
    });
  }

  var html = '';

  // v31.2: Scoped styles — fixed px columns, horizontal scroll if overflow, resize handle, mobile stacked cards
  html += '<style>';
  html += '#adminEmailContent { max-width: 100%; }';
  html += '#adminEmailContent .em-scroll { max-width: 100%; overflow-x: hidden; overflow-y: visible; }';
  html += '#adminEmailContent .em-table { position: relative; width: 100%; }';
  html += '#adminEmailContent .em-row { display: flex; align-items: center; box-sizing: border-box; }';
  html += '#adminEmailContent .em-row > div { box-sizing: border-box; padding-right: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }';
  html += '#adminEmailContent .em-hdr-col { position: relative; }';
  html += '#adminEmailContent .em-resize-handle { position: absolute; right: -2px; top: 4px; bottom: 4px; width: 4px; cursor: col-resize; background: rgba(168,152,120,0.18); border-radius: 2px; z-index: 5; transition: background 0.15s; }';
  html += '#adminEmailContent .em-resize-handle:hover { background: var(--accent, #a89878); }';
  html += '@media (max-width: 768px) {';
  html += '  #adminEmailContent .em-scroll { overflow-x: visible; }';
  html += '  #adminEmailContent .em-table { min-width: 0; }';
  html += '  #adminEmailContent .em-hdr { display: none !important; }';
  html += '  #adminEmailContent .em-row.em-data { flex-direction: column !important; align-items: stretch !important; padding: 14px 12px !important; gap: 4px; border-radius: 8px; margin-bottom: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); }';
  html += '  #adminEmailContent .em-row.em-data > div { width: auto !important; max-width: none !important; min-width: 0 !important; padding-right: 0 !important; text-align: left !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }';
  html += '  #adminEmailContent .em-row.em-data .em-mobile-label { display: inline-block !important; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; margin-right: 6px; min-width: 78px; }';
  html += '  #adminEmailContent .em-resize-handle { display: none !important; }';
  html += '  #adminEmailContent .em-row.em-data > div:nth-child(1) { font-size: 15px !important; font-weight: 600; margin-bottom: 2px; }';
  html += '  #adminEmailContent .em-row.em-data > div:nth-child(2) { font-size: 13px !important; margin-bottom: 8px; }';
  html += '}';
  html += '#adminEmailContent .em-mobile-label { display: none; }';
  html += '</style>';

  // v31.2: Top action bar - Select mode toggle + Select All + selected count
  var _selBtnLabel = _adminEmailSelectMode ? 'Cancel' : 'Select';
  var _selBtnStyle = _adminEmailSelectMode
    ? 'padding:6px 14px;background:rgba(168,152,120,0.15);border:1px solid var(--accent);border-radius:6px;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.3px;'
    : 'padding:6px 14px;background:transparent;border:1px solid var(--border-color);border-radius:6px;color:var(--text-secondary);font-size:12px;font-weight:500;cursor:pointer;letter-spacing:0.3px;transition:all 0.15s;';
  var _allBtnStyle = 'padding:6px 14px;background:var(--accent);border:1px solid var(--accent);border-radius:6px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.3px;margin-right:6px;';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0 12px 0;">';
  html += '<span id="adminEmailSelectedCount" style="font-size:12px;color:var(--text-muted);font-weight:500;">' + (_adminEmailSelectMode ? 'Select rows to send to' : '') + '</span>';
  html += '<div style="display:flex;align-items:center;">';
  if (_adminEmailSelectMode) {
    html += '<button type="button" onclick="adminEmailSelectAllUsers()" style="' + _allBtnStyle + '">Select All (' + users.length + ')</button>';
  }
  html += '<button type="button" onclick="adminToggleEmailSelectMode()" style="' + _selBtnStyle + '">' + _selBtnLabel + '</button>';
  html += '</div>';
  html += '</div>';

  // v31.2: Sortable column headers (click to sort, click again to flip direction)
  var _sortIcon = function(col) {
    if (_adminEmailSortBy !== col) return '<span style="opacity:0.25;margin-left:4px;font-size:9px;">&#9660;</span>';
    return '<span style="color:var(--accent);margin-left:4px;font-size:9px;">' + (_adminEmailSortDir === 'desc' ? '&#9660;' : '&#9650;') + '</span>';
  };
  var _hdrStyle = 'cursor:pointer;user-select:none;transition:color 0.15s;';
  var _hdrActiveColor = 'color:var(--accent);';
  var _hdrCol = function(col, label, extraStyle) {
    var active = _adminEmailSortBy === col;
    var w = _adminColW(col);
    var style = 'width:' + w + 'px;min-width:' + w + 'px;max-width:' + w + 'px;flex:none;' + (extraStyle || '') + _hdrStyle + (active ? _hdrActiveColor : '');
    var idx = _adminColOrder.indexOf(col);
    var hasNext = idx >= 0 && idx < _adminColOrder.length - 1;
    var handle = hasNext ? '<span class="em-resize-handle" onmousedown="adminStartColResize(event,\'' + col + '\')" onclick="event.stopPropagation()" title="Drag to resize"></span>' : '';
    return '<div class="em-hdr-col" data-col="' + col + '" style="' + style + '" onclick="adminSortEmailUsersBy(\'' + col + '\')" onmouseenter="if(!this.dataset.active)this.style.color=\'var(--text-primary)\'" onmouseleave="if(!this.dataset.active)this.style.color=\'\'" ' + (active ? 'data-active="1"' : '') + '>' + label + _sortIcon(col) + handle + '</div>';
  };
  // Helper to render a data cell with the same fixed px width
  var _cellW = function(col, extra) {
    var w = _adminColW(col);
    return 'width:' + w + 'px;min-width:' + w + 'px;max-width:' + w + 'px;flex:none;' + (extra || '');
  };

  html += '<div class="em-scroll"><div class="em-table">';
  html += '<div class="em-row em-hdr" style="padding:8px 0;border-bottom:1px solid var(--border-color);font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">';
  if (_adminEmailSelectMode) {
    html += '<div style="width:30px;flex-shrink:0;padding-right:0;"><input type="checkbox" id="adminEmailSelectAll" onchange="adminToggleAllEmailUsers(this.checked);adminUpdateSelectedCount();" style="accent-color:var(--accent);"></div>';
  }
  // v31.2: Fixed px column widths with drag-resize handles
  html += _hdrCol('name', 'Name');
  html += _hdrCol('email', 'Email');
  html += _hdrCol('status', 'Status');
  html += _hdrCol('lastActive', 'Last Active');
  html += _hdrCol('signup', 'Signup');
  html += _hdrCol('lastEmail', 'Last Email');
  html += _hdrCol('responses', 'Responses', 'text-align:center;');
  html += '</div>';

  users.forEach(function(u) {
    var userKey = u.uid || u.email;
    var respCount = (responseCounts[u.uid] || 0) + (u.uid !== u.email ? (responseCounts[u.email] || 0) : 0);
    var lastEmail = lastEmails[u.uid] || lastEmails[u.email] || null;
    var lastEmailText = '';
    if (lastEmail) {
      lastEmailText = formatTemplateName(lastEmail.template);
      if (lastEmail.sentAt) {
        lastEmailText += ' <span style="color:var(--text-muted);">' + formatRelativeTime(lastEmail.sentAt) + '</span>';
      }
    } else {
      lastEmailText = '<span style="color:var(--text-muted);">None</span>';
    }

    var signupFormatted = '';
    if (u.signupDate) {
      try {
        signupFormatted = new Date(u.signupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch (e) {
        signupFormatted = '';
      }
    }

    html += '<div class="admin-email-row em-row em-data" style="padding:10px 0;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.15s;" ';
    html += 'onmouseenter="this.style.background=\'var(--bg-secondary)\'" onmouseleave="this.style.background=\'transparent\'">';
    if (_adminEmailSelectMode) {
      html += '<div style="width:30px;flex-shrink:0;padding-right:0;" onclick="event.stopPropagation();">';
      html += '<input type="checkbox" class="admin-email-user-cb" data-uid="' + escapeHtml(u.uid) + '" data-email="' + escapeHtml(u.email) + '" data-name="' + escapeHtml(u.name) + '" style="accent-color:var(--accent);" onchange="adminUpdateSelectedCount()">';
      html += '</div>';
    }
    var _detailClick = 'onclick="adminShowEmailUserDetail(\'' + escapeHtml(u.uid) + '\',\'' + escapeHtml(u.name).replace(/'/g, "\\'") + '\',\'' + escapeHtml(u.email).replace(/'/g, "\\'") + '\')"';
    html += '<div class="em-data-cell" data-col="name" style="' + _cellW('name', 'color:var(--text-primary);font-weight:500;font-size:13px;') + '" ' + _detailClick + '><span class="em-mobile-label">Name</span>' + escapeHtml(u.name || 'Unknown') + '</div>';
    html += '<div class="em-data-cell" data-col="email" style="' + _cellW('email', 'color:var(--text-secondary);font-size:12px;') + '" ' + _detailClick + ' title="' + escapeHtml(u.email) + '"><span class="em-mobile-label">Email</span>' + escapeHtml(u.email) + '</div>';
    var _status = _adminComputeUserStatus(u);
    html += '<div class="em-data-cell" data-col="status" style="' + _cellW('status') + '">';
    html += '<span class="em-mobile-label">Status</span>';
    html += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:600;letter-spacing:0.3px;background:' + _status.bg + ';border:1px solid ' + _status.border + ';color:' + _status.color + ';">' + _status.label + '</span>';
    html += '</div>';
    html += '<div class="em-data-cell" data-col="lastActive" style="' + _cellW('lastActive', 'color:var(--text-muted);font-size:12px;') + '"><span class="em-mobile-label">Last Active</span>' + (u.lastActiveAt ? formatRelativeTime(new Date(u.lastActiveAt).toISOString()) : '<span style="opacity:0.5;">Never</span>') + '</div>';
    html += '<div class="em-data-cell" data-col="signup" style="' + _cellW('signup', 'color:var(--text-muted);font-size:12px;') + '"><span class="em-mobile-label">Signup</span>' + escapeHtml(signupFormatted) + '</div>';
    html += '<div class="em-data-cell" data-col="lastEmail" style="' + _cellW('lastEmail', 'font-size:12px;') + '"><span class="em-mobile-label">Last Email</span>' + lastEmailText + '</div>';
    html += '<div class="em-data-cell" data-col="responses" style="' + _cellW('responses', 'text-align:center;') + '"><span class="em-mobile-label">Responses</span>';
    if (respCount > 0) {
      html += '<span style="display:inline-block;padding:2px 8px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);border-radius:4px;font-size:11px;font-weight:600;color:#4ade80;">' + respCount + '</span>';
    } else {
      html += '<span style="color:var(--text-muted);font-size:11px;">0</span>';
    }
    html += '</div>';
    html += '</div>';
  });
  html += '</div></div>'; // .em-table + .em-scroll close

  contentEl.innerHTML = html;
}

function adminToggleAllEmailUsers(checked) {
  var cbs = document.querySelectorAll('.admin-email-user-cb');
  for (var i = 0; i < cbs.length; i++) {
    cbs[i].checked = checked;
  }
}

// v31.2: Map signup source codes to human-friendly labels.
function _adminFormatSignupSource(src) {
  if (!src) return '—';
  var s = String(src).toLowerCase();
  if (s === 'info' || s === 'info_page' || s === 'roweos.com/info') return 'Info Page';
  if (s === 'app_signup' || s === 'welcome' || s === 'auth_gate' || s === 'roweos.com') return 'Welcome Page';
  if (s === 'newsletter' || s === 'newsletter_form') return 'Newsletter';
  if (s === 'founder_offer' || s === 'founder_email' || s === 'founder100 email') return 'Founder100 Email';
  if (s === 'founder_apikey' || s === 'founder100 api pack') return 'Founder100 API Pack';
  if (s === 'admin' || s === 'admin_invite') return 'Admin Invite';
  if (s === 'stripe' || s === 'checkout') return 'Stripe Checkout';
  // Fallback: title-case the raw string
  return s.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

// v31.2: Derive subscription status badge from a user record.
// Active = Stripe says active/paid. Trial = trial activated and within 14 days. Expired = past trial without paid sub. Signup = nothing yet.
function _adminComputeUserStatus(u) {
  var sub = (u.subscriptionStatus || '').toLowerCase();
  if (sub === 'active' || sub === 'paid' || sub === 'trialing') {
    return { label: sub === 'trialing' ? 'Trial' : 'Active', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.32)' };
  }
  if (sub === 'canceled' || sub === 'cancelled' || sub === 'past_due' || sub === 'expired' || sub === 'incomplete_expired') {
    return { label: 'Expired', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.32)' };
  }
  if (u.trialActivatedAt) {
    var elapsed = Date.now() - u.trialActivatedAt;
    var fourteenDays = 14 * 24 * 60 * 60 * 1000;
    if (elapsed < fourteenDays) {
      return { label: 'Trial', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.32)' };
    }
    return { label: 'Expired', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.32)' };
  }
  return { label: 'Signup', color: 'var(--text-muted)', bg: 'transparent', border: 'var(--border-color)' };
}

// v31.2: Sort by clicking column headers (toggles direction on second click)
function adminSortEmailUsersBy(col) {
  if (_adminEmailSortBy === col) {
    _adminEmailSortDir = _adminEmailSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _adminEmailSortBy = col;
    _adminEmailSortDir = 'asc';
  }
  if (typeof adminRenderEmailUserList === 'function') {
    adminRenderEmailUserList(window._adminEmailUsers, window._adminEmailLogs, window._adminEmailResponses);
  }
}

// v31.2: Toggle Select Mode - shows/hides checkbox column
function adminToggleEmailSelectMode() {
  _adminEmailSelectMode = !_adminEmailSelectMode;
  if (typeof adminRenderEmailUserList === 'function') {
    adminRenderEmailUserList(window._adminEmailUsers, window._adminEmailLogs, window._adminEmailResponses);
  }
}

// v31.2: Select All button - checks every visible row's checkbox
function adminEmailSelectAllUsers() {
  var cbs = document.querySelectorAll('.admin-email-user-cb');
  for (var i = 0; i < cbs.length; i++) cbs[i].checked = true;
  var headerAll = document.getElementById('adminEmailSelectAll');
  if (headerAll) headerAll.checked = true;
  adminUpdateSelectedCount();
}

// v30.5: Update selected count badge
function adminUpdateSelectedCount() {
  var countEl = document.getElementById('adminEmailSelectedCount');
  if (!countEl) return;
  var cbs = document.querySelectorAll('.admin-email-user-cb:checked');
  var n = cbs ? cbs.length : 0;
  if (n > 0) {
    countEl.textContent = '(' + n + ' selected)';
    countEl.style.color = 'var(--accent)';
  } else {
    countEl.textContent = '';
  }
}

function adminShowEmailUserDetail(uid, userName, userEmail) {
  if (!isAdmin()) return;
  var contentEl = document.getElementById('adminEmailContent');
  if (!contentEl) return;
  // v30.1: Track current user for "Send to Selected" context
  window._adminEmailDetailUser = userEmail;

  var emailLogs = window._adminEmailLogs || [];
  var responses = window._adminEmailResponses || [];
  var users = window._adminEmailUsers || [];

  // Find user signup date
  var userObj = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].uid === uid || users[i].email === userEmail) {
      userObj = users[i];
      break;
    }
  }

  // Filter logs for this user
  var userLogs = emailLogs.filter(function(log) {
    return log.userId === uid || log.userEmail === userEmail;
  }).sort(function(a, b) {
    var ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    var tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return tb - ta;
  });

  // Filter responses for this user
  var userResponses = responses.filter(function(r) {
    return r.userId === uid || r.userEmail === userEmail;
  }).sort(function(a, b) {
    var ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    var tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  var html = '';

  // Back button
  html += '<div style="margin-bottom:16px;">';
  html += '<button onclick="adminLoadEmailData()" style="padding:6px 14px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:var(--text-xs);font-weight:500;transition:all 0.15s;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
  html += 'Back to Users';
  html += '</button>';
  html += '</div>';

  // v31.2: Profile header - status, tier, key, last active in one card
  var profileMeta = (window._adminUserMetaByUid || {})[uid] || (window._adminUserMetaByEmail || {})[(userEmail || '').toLowerCase()] || {};
  var profileKey = (window._adminKeyByUid || {})[uid] || (window._adminKeyByEmail || {})[(userEmail || '').toLowerCase()] || {};
  var profileStatus = userObj ? _adminComputeUserStatus(userObj) : { label: 'Signup', color: 'var(--text-muted)', bg: 'transparent', border: 'var(--border-color)' };

  html += '<div style="padding:18px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:16px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">';
  html += '<div style="flex:1;min-width:200px;">';
  // v31.2: Inline editable name - click to add/update
  var displayName = userName && userName !== 'Unknown' ? userName : '';
  html += '<div id="adminUserNameDisplay" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
  html += '<span style="font-weight:600;color:' + (displayName ? 'var(--text-primary)' : 'var(--text-muted)') + ';font-size:16px;font-style:' + (displayName ? 'normal' : 'italic') + ';">' + escapeHtml(displayName || 'Unknown') + '</span>';
  html += '<button onclick="adminStartEditUserName(\'' + escapeHtml(uid) + '\',\'' + escapeHtml(userEmail).replace(/'/g, "\\'") + '\',' + JSON.stringify(displayName) + ')" style="padding:3px 8px;background:transparent;border:1px solid var(--border-color);border-radius:4px;color:var(--text-muted);cursor:pointer;font-size:10.5px;font-weight:500;letter-spacing:0.3px;" title="Edit name">' + (displayName ? 'Edit' : '+ Name') + '</button>';
  html += '</div>';
  html += '<div style="color:var(--text-secondary);font-size:13px;margin-bottom:4px;">' + escapeHtml(userEmail) + '</div>';
  if (userObj && userObj.signupDate) {
    try {
      var signupFmt = new Date(userObj.signupDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      html += '<div style="color:var(--text-muted);font-size:12px;">Signed up: ' + escapeHtml(signupFmt) + '</div>';
    } catch (e) { /* skip */ }
  }
  // v31.2: Show signup source in profile (replaces table column)
  if (userObj && userObj.signupSource) {
    html += '<div style="color:var(--text-muted);font-size:12px;margin-top:2px;">Source: <span style="color:var(--text-secondary);">' + escapeHtml(_adminFormatSignupSource(userObj.signupSource)) + '</span></div>';
  }
  html += '</div>';
  html += '<div style="text-align:right;flex-shrink:0;">';
  html += '<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10.5px;font-weight:600;letter-spacing:0.3px;background:' + profileStatus.bg + ';border:1px solid ' + profileStatus.border + ';color:' + profileStatus.color + ';margin-bottom:6px;">' + profileStatus.label + '</span>';
  if (profileKey.tier) {
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Tier: <strong style="color:var(--text-primary);text-transform:capitalize;">' + escapeHtml(profileKey.tier) + '</strong></div>';
  }
  if (profileMeta.lastActiveAt) {
    html += '<div style="font-size:11px;color:var(--text-muted);">Last active: ' + escapeHtml(formatRelativeTime(new Date(profileMeta.lastActiveAt).toISOString())) + '</div>';
  }
  html += '</div>';
  html += '</div>';
  // Access key row (if present)
  if (profileKey && Object.keys(profileKey).length > 0) {
    var keyId = '';
    var keyEntries = window._adminKeyByEmail ? Object.entries(window._adminKeyByEmail) : [];
    for (var ke = 0; ke < keyEntries.length; ke++) {
      if (keyEntries[ke][1] === profileKey) { keyId = keyEntries[ke][0]; break; }
    }
    html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);font-size:12px;color:var(--text-muted);">';
    html += '<span style="color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-size:10px;font-weight:600;">Access Key</span>';
    html += '<div style="font-family:monospace;color:var(--text-primary);font-size:12px;margin-top:3px;">' + escapeHtml(profileKey.assignedTo || keyId || '(linked)') + '</div>';
    html += '</div>';
  }
  html += '</div>';

  // v31.2: Admin notes - free-form text saved to roweos_users/{uid}.adminNotes
  var existingNote = profileMeta.adminNotes || '';
  html += '<div style="margin-bottom:16px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:13px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  html += 'Notes';
  html += '</div>';
  html += '<button onclick="adminSaveUserNote(\'' + escapeHtml(uid) + '\')" style="padding:4px 12px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:11px;font-weight:600;">Save</button>';
  html += '</div>';
  html += '<textarea id="adminUserNoteInput" placeholder="Add private notes about this user (visible to admins only)..." style="width:100%;min-height:70px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit;font-size:13px;line-height:1.5;resize:vertical;outline:none;" oninput="this.style.borderColor=\'var(--accent)\'">' + escapeHtml(existingNote) + '</textarea>';
  html += '<div id="adminUserNoteStatus" style="font-size:11px;color:var(--text-muted);margin-top:4px;min-height:14px;"></div>';
  html += '</div>';

  // Email History section
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:13px;margin-bottom:10px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
  html += 'Email History (' + userLogs.length + ')';
  html += '</div>';

  if (userLogs.length === 0) {
    html += '<div style="padding:10px 14px;color:var(--text-muted);font-size:12px;margin-bottom:16px;">No emails sent to this user yet.</div>';
  } else {
    userLogs.forEach(function(log) {
      var statusColor = log.status === 'failed' ? '#f87171' : '#4ade80';
      var statusLabel = log.status === 'failed' ? 'Failed' : 'Sent';
      var sentDate = '';
      if (log.sentAt) {
        try {
          sentDate = new Date(log.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date(log.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch (e) { /* skip */ }
      }

      html += '<div style="padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:6px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      html += '<div style="font-weight:500;color:var(--text-primary);font-size:13px;">' + escapeHtml(formatTemplateName(log.template)) + '</div>';
      html += '<span style="display:inline-block;padding:2px 8px;background:' + statusColor + '22;border:1px solid ' + statusColor + '44;border-radius:4px;font-size:10px;font-weight:600;color:' + statusColor + ';text-transform:uppercase;letter-spacing:0.5px;">' + statusLabel + '</span>';
      html += '</div>';
      if (log.subject) {
        html += '<div style="color:var(--text-secondary);font-size:12px;margin-bottom:2px;">' + escapeHtml(log.subject) + '</div>';
      }
      if (sentDate) {
        html += '<div style="color:var(--text-muted);font-size:11px;">' + escapeHtml(sentDate) + '</div>';
      }
      html += '</div>';
    });
  }

  // v31.3: Campaign Clicks section - per-user attribution from /api/track-click
  var clicksMap = window._adminCampaignClicksByRecipient || {};
  var userClicks = (clicksMap[(userEmail || '').toLowerCase()] || []).concat(clicksMap[(uid || '').toLowerCase()] || []);
  // Dedupe by campaign (sum click counts, keep latest lastClickAt)
  var clicksByCampaign = {};
  userClicks.forEach(function(c) {
    if (!clicksByCampaign[c.campaign]) {
      clicksByCampaign[c.campaign] = { campaign: c.campaign, clickCount: 0, lastClickAt: 0 };
    }
    clicksByCampaign[c.campaign].clickCount += c.clickCount;
    if (c.lastClickAt > clicksByCampaign[c.campaign].lastClickAt) clicksByCampaign[c.campaign].lastClickAt = c.lastClickAt;
  });
  var clicksList = Object.keys(clicksByCampaign).map(function(k) { return clicksByCampaign[k]; })
    .sort(function(a, b) { return b.lastClickAt - a.lastClickAt; });

  if (clicksList.length > 0) {
    html += '<div style="font-weight:600;color:var(--text-primary);font-size:13px;margin-top:16px;margin-bottom:10px;">';
    html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.51 0 4.78 1.02 6.43 2.68"/></svg>';
    html += 'Campaign Clicks (' + clicksList.length + ')';
    html += '</div>';
    clicksList.forEach(function(c) {
      var when = c.lastClickAt ? formatRelativeTime(new Date(c.lastClickAt).toISOString()) : '';
      html += '<div style="padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">';
      html += '<div>';
      html += '<div style="font-weight:500;color:var(--text-primary);font-size:13px;">' + escapeHtml(formatTemplateName(c.campaign)) + '</div>';
      if (when) html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + escapeHtml(when) + '</div>';
      html += '</div>';
      html += '<span style="display:inline-block;padding:2px 10px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);border-radius:4px;font-size:11px;font-weight:600;color:#4ade80;">' + c.clickCount + ' click' + (c.clickCount === 1 ? '' : 's') + '</span>';
      html += '</div>';
    });
  }

  // Responses section
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:13px;margin-top:16px;margin-bottom:10px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  html += 'Responses (' + userResponses.length + ')';
  html += '</div>';

  if (userResponses.length === 0) {
    html += '<div style="padding:10px 14px;color:var(--text-muted);font-size:12px;margin-bottom:16px;">No responses from this user yet.</div>';
  } else {
    userResponses.forEach(function(r) {
      var respDate = '';
      if (r.timestamp) {
        try {
          respDate = new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date(r.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch (e) { /* skip */ }
      }

      html += '<div style="padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:6px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      html += '<div style="font-weight:500;color:var(--text-primary);font-size:13px;">' + escapeHtml(formatTemplateName(r.question)) + '</div>';
      if (r.template) {
        html += '<span style="font-size:10px;color:var(--text-muted);">from ' + escapeHtml(formatTemplateName(r.template)) + '</span>';
      }
      html += '</div>';
      html += '<div style="color:var(--text-secondary);font-size:12px;margin-bottom:2px;">' + escapeHtml(r.answer || '') + '</div>';
      if (respDate) {
        html += '<div style="color:var(--text-muted);font-size:11px;">' + escapeHtml(respDate) + '</div>';
      }
      html += '</div>';
    });
  }

  // Quick Actions
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:13px;margin-top:16px;margin-bottom:10px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
  html += 'Quick Actions';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';

  // v31.2: Added Founder Lifetime Offer (Founder100) to Quick Actions
  // v31.3: Added Welcome (new signup welcome message)
  var templateMap = {
    'founder_lifetime_offer': 'founder_lifetime_offer',
    'welcome': 'welcome',
    'onboarding_survey': 'onboarding_survey',
    'reengagement': 'reengagement',
    'feature_announcement': 'feature_announcement',
    'access_key_delivery': 'default',
    'checkin': 'checkin_new',
    'subscription_info': 'subscription_info'
  };
  var templateLabels = {
    'founder_lifetime_offer': 'Founder Lifetime Offer'
  };
  var templates = ['founder_lifetime_offer', 'welcome', 'onboarding_survey', 'reengagement', 'feature_announcement', 'access_key_delivery', 'checkin', 'subscription_info'];
  templates.forEach(function(tmpl) {
    var composerTmpl = templateMap[tmpl] || tmpl;
    var isFeatured = tmpl === 'founder_lifetime_offer';
    var btnStyle = isFeatured
      ? 'padding:6px 12px;background:linear-gradient(135deg,var(--accent,#a89878),#8a7758);border:1px solid var(--accent,#a89878);border-radius:var(--radius-sm);color:#fff;cursor:pointer;font-size:var(--text-xs);font-weight:600;transition:all 0.15s;letter-spacing:0.2px;'
      : 'padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:var(--text-xs);font-weight:500;transition:all 0.15s;';
    html += '<button onclick="adminOpenComposerForUser(\'' + escapeHtml(composerTmpl) + '\',\'' + escapeHtml(userEmail).replace(/'/g, "\\'") + '\',\'' + escapeHtml(userName).replace(/'/g, "\\'") + '\')" style="' + btnStyle + '">';
    html += escapeHtml(templateLabels[tmpl] || formatTemplateName(tmpl));
    html += '</button>';
  });
  html += '</div>';

  // v31.2: Danger zone - delete user from EVERY system (Auth + all Firestore collections)
  html += '<div style="margin-top:32px;padding:18px;background:rgba(248,113,113,0.04);border:1px solid rgba(248,113,113,0.18);border-radius:var(--radius-md);">';
  html += '<div style="font-weight:600;color:#f87171;font-size:13px;margin-bottom:6px;">Danger Zone</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;line-height:1.5;">Permanently removes this user from Firebase Auth, all signups, all access keys, all Firestore data, and email history. This cannot be undone.</div>';
  html += '<button onclick="adminDeleteUserEverywhere(\'' + escapeHtml(userEmail).replace(/'/g, "\\'") + '\',\'' + escapeHtml(uid) + '\')" style="padding:8px 16px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.4);border-radius:6px;color:#f87171;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:0.3px;">Delete User Everywhere</button>';
  html += '</div>';

  contentEl.innerHTML = html;
}

// v31.2: Inline edit user display name. Writes to roweos_users/{uid}.displayName
// AND any matching newsletter_subscribers doc so it shows up consistently across
// Emails, Signups, and the user list.
function adminStartEditUserName(uid, email, currentName) {
  var container = document.getElementById('adminUserNameDisplay');
  if (!container) return;
  var safeName = (currentName || '').replace(/"/g, '&quot;');
  container.innerHTML =
    '<input id="adminUserNameInput" type="text" value="' + safeName + '" placeholder="Full name" '
    + 'style="flex:1;min-width:0;padding:6px 10px;font-size:15px;font-weight:500;background:var(--bg-primary);border:1px solid var(--accent);border-radius:6px;color:var(--text-primary);outline:none;" '
    + 'onkeydown="if(event.key===\'Enter\')adminSaveUserName(\'' + escapeHtml(uid) + '\',\'' + escapeHtml(email).replace(/'/g, "\\'") + '\');if(event.key===\'Escape\')adminShowEmailUserDetail(\'' + escapeHtml(uid) + '\',\'' + escapeHtml(currentName || 'Unknown').replace(/'/g, "\\'") + '\',\'' + escapeHtml(email).replace(/'/g, "\\'") + '\')">'
    + '<button onclick="adminSaveUserName(\'' + escapeHtml(uid) + '\',\'' + escapeHtml(email).replace(/'/g, "\\'") + '\')" style="padding:6px 12px;background:var(--accent);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:11px;font-weight:600;">Save</button>'
    + '<button onclick="adminShowEmailUserDetail(\'' + escapeHtml(uid) + '\',\'' + escapeHtml(currentName || 'Unknown').replace(/'/g, "\\'") + '\',\'' + escapeHtml(email).replace(/'/g, "\\'") + '\')" style="padding:6px 10px;background:transparent;border:1px solid var(--border-color);border-radius:6px;color:var(--text-muted);cursor:pointer;font-size:11px;">Cancel</button>';
  var input = document.getElementById('adminUserNameInput');
  if (input) { input.focus(); input.select(); }
}

function adminSaveUserName(uid, email) {
  if (!isAdmin() || !firebase) return;
  var input = document.getElementById('adminUserNameInput');
  if (!input) return;
  var name = input.value.trim();
  var db = firebase.firestore();
  var promises = [];
  // 1. roweos_users doc (creates if missing)
  if (uid) {
    promises.push(db.collection('roweos_users').doc(uid).set({
      displayName: name,
      adminLabel: name
    }, { merge: true }));
  }
  // 2. newsletter_subscribers doc(s) by email
  if (email) {
    promises.push(
      db.collection('newsletter_subscribers').where('email', '==', email).get().then(function(snap) {
        if (snap.empty) return;
        var batch = db.batch();
        snap.docs.forEach(function(d) { batch.update(d.ref, { name: name }); });
        return batch.commit();
      })
    );
  }
  showToast('Saving name...', 'info');
  Promise.all(promises).then(function() {
    // Update local cache so the UI reflects without a full reload round-trip
    if (window._adminEmailUsers) {
      for (var i = 0; i < window._adminEmailUsers.length; i++) {
        var u = window._adminEmailUsers[i];
        if (u.uid === uid || u.email === email) u.name = name;
      }
    }
    showToast('Name saved', 'success');
    // Re-render the detail view with the new name
    adminShowEmailUserDetail(uid, name || 'Unknown', email);
  }).catch(function(err) {
    showToast('Save failed: ' + err.message, 'error');
  });
}

// v31.2: Save admin notes to roweos_users/{uid}.adminNotes
function adminSaveUserNote(uid) {
  if (!isAdmin() || !firebase) return;
  var input = document.getElementById('adminUserNoteInput');
  var status = document.getElementById('adminUserNoteStatus');
  if (!input) return;
  var note = input.value.trim();
  if (status) { status.style.color = 'var(--text-muted)'; status.textContent = 'Saving...'; }
  firebase.firestore().collection('roweos_users').doc(uid).set({
    adminNotes: note,
    adminNotesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function() {
    if (status) { status.style.color = '#4ade80'; status.textContent = 'Saved.'; }
    // Update cache so re-render shows the note
    if (window._adminUserMetaByUid && window._adminUserMetaByUid[uid]) {
      window._adminUserMetaByUid[uid].adminNotes = note;
    }
    setTimeout(function() { if (status) status.textContent = ''; }, 2200);
  }).catch(function(err) {
    if (status) { status.style.color = '#f87171'; status.textContent = 'Failed: ' + err.message; }
  });
}

// v31.2: Universal delete - calls /api/admin-delete-user which removes from
// Firebase Auth AND every Firestore collection. Refreshes all admin tabs.
function adminDeleteUserEverywhere(email, uid) {
  if (!isAdmin()) return;
  if (!email && !uid) return;
  var label = email || uid;
  if (!confirm('Permanently delete ' + label + ' from EVERYWHERE?\n\nThis removes:\n  - Firebase Auth account\n  - roweos_users doc + subcollections\n  - All signups (newsletter_subscribers, signups, info_leads)\n  - All access_keys assigned to this email\n  - All email_log entries\n  - All onboarding_responses\n  - admin_notifications\n\nCannot be undone.')) return;

  var callerUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : '';
  showToast('Deleting ' + label + ' everywhere...', 'info');
  fetch('/api/admin-delete-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, uid: uid, callerUid: callerUid })
  }).then(function(resp) {
    return resp.json().then(function(data) { return { ok: resp.ok, data: data }; });
  }).then(function(result) {
    if (!result.ok) {
      showToast('Delete failed: ' + (result.data && result.data.error || 'unknown'), 'error');
      return;
    }
    var rep = result.data.report || {};
    var msg = 'Deleted ' + label;
    if (rep.authDeleted) msg += ' (Auth + ' + (rep.firestoreDeleted || 0) + ' docs)';
    else msg += ' (' + (rep.firestoreDeleted || 0) + ' docs, no Auth user found)';
    showToast(msg, 'success');
    // Invalidate caches so all tabs reload fresh
    window._adminEmailUsers = null;
    window._adminEmailLogs = null;
    window._adminEmailResponses = null;
    window._adminUserMetaByUid = null;
    window._adminUserMetaByEmail = null;
    window._adminKeyByUid = null;
    window._adminKeyByEmail = null;
    window._adminCampaignClicks = null;
    // Refresh every admin section that might show the user
    setTimeout(function() {
      if (typeof adminLoadEmailData === 'function') adminLoadEmailData();
      if (typeof adminLoadUsers === 'function') adminLoadUsers();
      if (typeof adminLoadKeys === 'function') adminLoadKeys();
      if (typeof adminLoadSignups === 'function') adminLoadSignups();
      if (typeof adminLoadApiKeyPool === 'function') adminLoadApiKeyPool();
    }, 600);
  }).catch(function(err) {
    showToast('Delete failed: ' + err.message, 'error');
  });
}

function adminRenderEmailStats(responses) {
  var statsEl = document.getElementById('adminEmailStats');
  if (!statsEl) return;

  if (!responses || !responses.length) {
    statsEl.innerHTML = '';
    return;
  }

  // Aggregate by question type
  var heardCounts = {};
  var experienceCounts = {};
  var apiKeyCounts = { Yes: 0, No: 0, Unsure: 0 };
  var ratingCounts = {};

  responses.forEach(function(r) {
    var q = (r.question || '').toLowerCase();
    var a = r.answer || '';

    if (q.indexOf('heard') !== -1 || q.indexOf('source') !== -1 || q.indexOf('how_did') !== -1 || q.indexOf('referral') !== -1) {
      heardCounts[a] = (heardCounts[a] || 0) + 1;
    } else if (q.indexOf('experience') !== -1 || q.indexOf('skill') !== -1 || q.indexOf('level') !== -1) {
      experienceCounts[a] = (experienceCounts[a] || 0) + 1;
    } else if (q.indexOf('api_key') !== -1 || q.indexOf('apikey') !== -1 || q.indexOf('api') !== -1) {
      var norm = a.charAt(0).toUpperCase() + a.slice(1).toLowerCase();
      if (norm === 'Yes' || norm === 'No' || norm === 'Unsure') {
        apiKeyCounts[norm] = (apiKeyCounts[norm] || 0) + 1;
      } else {
        apiKeyCounts[a] = (apiKeyCounts[a] || 0) + 1;
      }
    } else if (q.indexOf('rating') !== -1 || q.indexOf('checkin') !== -1 || q.indexOf('check_in') !== -1 || q.indexOf('satisfaction') !== -1) {
      ratingCounts[a] = (ratingCounts[a] || 0) + 1;
    }
  });

  var cardStyle = 'padding:14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);';

  // Card 1: How They Heard
  var topSource = '';
  var topSourceCount = 0;
  var heardKeys = Object.keys(heardCounts);
  heardKeys.forEach(function(k) {
    if (heardCounts[k] > topSourceCount) {
      topSourceCount = heardCounts[k];
      topSource = k;
    }
  });
  var heardHtml = '<div style="' + cardStyle + '">';
  heardHtml += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">How They Heard</div>';
  if (topSource) {
    heardHtml += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);">' + escapeHtml(topSource) + ': ' + topSourceCount + '</div>';
    if (heardKeys.length > 1) {
      heardHtml += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + heardKeys.length + ' sources total</div>';
    }
  } else {
    heardHtml += '<div style="font-size:12px;color:var(--text-muted);">No data</div>';
  }
  heardHtml += '</div>';

  // Card 2: Experience
  var expKeys = Object.keys(experienceCounts);
  var expHtml = '<div style="' + cardStyle + '">';
  expHtml += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Experience</div>';
  if (expKeys.length > 0) {
    var expParts = [];
    expKeys.forEach(function(k) {
      expParts.push(escapeHtml(k) + ': ' + experienceCounts[k]);
    });
    expHtml += '<div style="font-size:12px;color:var(--text-primary);line-height:1.5;">' + expParts.join('<br>') + '</div>';
  } else {
    expHtml += '<div style="font-size:12px;color:var(--text-muted);">No data</div>';
  }
  expHtml += '</div>';

  // Card 3: API Key Needs
  var apiHtml = '<div style="' + cardStyle + '">';
  apiHtml += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">API Key Needs</div>';
  var apiTotal = apiKeyCounts.Yes + apiKeyCounts.No + apiKeyCounts.Unsure;
  if (apiTotal > 0) {
    apiHtml += '<div style="font-size:12px;color:var(--text-primary);line-height:1.5;">';
    apiHtml += '<span style="color:#4ade80;">Yes: ' + apiKeyCounts.Yes + '</span> / ';
    apiHtml += '<span style="color:#f87171;">No: ' + apiKeyCounts.No + '</span> / ';
    apiHtml += '<span style="color:#fbbf24;">Unsure: ' + apiKeyCounts.Unsure + '</span>';
    apiHtml += '</div>';
  } else {
    apiHtml += '<div style="font-size:12px;color:var(--text-muted);">No data</div>';
  }
  apiHtml += '</div>';

  // Card 4: Check-in Ratings
  var ratingKeys = Object.keys(ratingCounts);
  var ratingHtml = '<div style="' + cardStyle + '">';
  ratingHtml += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Check-in Ratings</div>';
  if (ratingKeys.length > 0) {
    var ratingParts = [];
    ratingKeys.sort();
    ratingKeys.forEach(function(k) {
      ratingParts.push(escapeHtml(k) + ': ' + ratingCounts[k]);
    });
    ratingHtml += '<div style="font-size:12px;color:var(--text-primary);line-height:1.5;">' + ratingParts.join('<br>') + '</div>';
  } else {
    ratingHtml += '<div style="font-size:12px;color:var(--text-muted);">No data</div>';
  }
  ratingHtml += '</div>';

  statsEl.innerHTML = heardHtml + expHtml + apiHtml + ratingHtml;
}

// v30.1: Open Compose Email modal pre-filled with a template and recipient
function adminOpenComposerForUser(templateName, recipientEmail, recipientName) {
  // Set key and tier for templates that need them
  window._composerKey = window._composerKey || 'ROWE-XXXX-XXXX';
  window._composerTier = window._composerTier || 'founder';
  // v30.1: Store recipient name for template auto-fill
  window._composerRecipientName = recipientName || '';
  // Pre-fill To field and template
  var toEl = document.getElementById('composerTo');
  var templateSelect = document.getElementById('composerTemplate');
  var fromEl = document.getElementById('composerFrom');
  if (toEl) toEl.value = recipientEmail || '';
  if (fromEl && typeof buildFromOptionsHtml === 'function') {
    var _defFrom = (typeof getDefaultFromAddress === 'function' ? getDefaultFromAddress() : '');
    fromEl.innerHTML = buildFromOptionsHtml(_defFrom);
    fromEl.value = _defFrom;
  }
  // Set the template dropdown and load it
  if (templateSelect) {
    templateSelect.value = templateName || 'default';
  }
  if (typeof loadComposerTemplate === 'function') {
    loadComposerTemplate(templateName || 'default');
  }
  if (typeof openModal === 'function') {
    openModal('betaEmailPreviewModal');
  }
}

function adminSendSelectedTemplate() {
  if (!isAdmin()) return;
  var templateEl = document.getElementById('adminEmailTemplate');
  if (!templateEl) return;
  var template = templateEl.value;
  if (!template) {
    showToast('Select a template first', 'error');
    return;
  }

  // v30.1: If inside user detail view, use that user's info
  var detailEmail = window._adminEmailDetailUser;
  var checkboxes = document.querySelectorAll('.admin-email-user-cb:checked');

  if (detailEmail) {
    // Inside user detail view, open composer for this user
    var composerTemplate = template;
    if (template === 'access_key_delivery') composerTemplate = 'default';
    if (template === 'checkin') composerTemplate = 'checkin_new';
    adminOpenComposerForUser(composerTemplate, detailEmail);
    return;
  }

  if (!checkboxes || checkboxes.length === 0) {
    showToast('Select at least one user', 'error');
    return;
  }

  var targets = [];
  for (var i = 0; i < checkboxes.length; i++) {
    targets.push({
      uid: checkboxes[i].getAttribute('data-uid') || '',
      email: checkboxes[i].getAttribute('data-email') || '',
      name: checkboxes[i].getAttribute('data-name') || ''
    });
  }

  // v30.5: Show progress toast with user count
  showToast('Sending to ' + targets.length + ' users...', 'info');

  // v31.3: Serial send with 350ms gap to avoid Resend rate limits (~3/sec safe on Pro, well under
  // the 2/sec free tier limit for small batches). Each call is silent — only the aggregate toast shows.
  var sent = 0;
  var failed = 0;
  var idx = 0;
  function sendNext() {
    if (idx >= targets.length) {
      if (failed > 0) {
        showToast('Sent to ' + sent + ', Failed: ' + failed, 'warning');
      } else {
        showToast('Sent to ' + sent + ' users successfully', 'success');
      }
      setTimeout(function() { adminLoadEmailData(); }, 1500);
      return;
    }
    var t = targets[idx++];
    adminSendTemplateToUser(template, t.uid, t.email, t.name, null, true).then(function(ok) {
      if (ok) sent++; else failed++;
      setTimeout(sendNext, 350);
    });
  }
  sendNext();
}

// v31.3: Resend a single failed email_log entry. Called from the Recent Sends list in the
// Campaigns tab. After a successful send we delete the prior 'failed' email_log doc so the
// dashboard counters reflect reality (and the failed row stops bubbling to the top).
function adminResendFailed(template, userId, userEmail, userName, btnEl) {
  if (!isAdmin() || !template || !userEmail) return;
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'Sending...';
    btnEl.style.opacity = '0.7';
    btnEl.style.cursor = 'wait';
  }
  adminSendTemplateToUser(template, userId, userEmail, userName, null, true).then(function(ok) {
    if (!ok) {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = 'Retry';
        btnEl.style.opacity = '1';
        btnEl.style.cursor = 'pointer';
      }
      showToast('Resend failed for ' + userEmail, 'error');
      return;
    }
    // Delete the prior failed email_log doc(s) for this template+recipient so the dashboard refreshes clean
    try {
      var db = firebase.firestore();
      db.collection('email_log')
        .where('userEmail', '==', userEmail)
        .where('template', '==', template)
        .where('status', '==', 'failed')
        .get()
        .then(function(snap) {
          var batch = db.batch();
          snap.docs.forEach(function(d) { batch.delete(d.ref); });
          if (snap.docs.length > 0) batch.commit();
        });
    } catch (e) { console.warn('[Admin Emails] Failed-log cleanup error:', e); }
    showToast('Resent to ' + userEmail, 'success');
    // Reload dashboard so the failed row is replaced by the new sent row
    setTimeout(function() {
      window._adminCampaignClicks = null;
      window._adminCampaignClickRecipients = null;
      if (typeof adminLoadEmailData === 'function') adminLoadEmailData();
      if (typeof adminRenderCampaigns === 'function') adminRenderCampaigns();
    }, 1500);
  });
}

function adminSendTemplateToUser(template, userId, userEmail, userName, metadata, silent) {
  if (!isAdmin()) return Promise.resolve(false);
  var callerUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : '';

  return fetch('/api/send-template-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: template,
      userId: userId,
      userEmail: userEmail,
      userName: userName,
      callerUid: callerUid,
      metadata: metadata || {}
    })
  }).then(function(resp) {
    if (!resp.ok) throw new Error('Send failed: ' + resp.status);
    return resp.json();
  }).then(function(data) {
    // v31.3: Server writes email_log authoritatively. Client-side duplicate write removed
    // to prevent two entries per send.
    return true;
  }).catch(function(err) {
    console.error('[Admin Emails] Send error:', err);
    if (!silent) {
      // v31.3: Use a message that won't get rewritten to "AI service had internal error" by friendlyError
      showToast('Email send failed for ' + (userEmail || userId), 'error');
    }
    return false;
  });
}

function adminToggleAutoSend(enabled) {
  if (!isAdmin() || !firebase) return;
  firebase.firestore().collection('email_settings').doc('config').set(
    { autoSendEnabled: !!enabled },
    { merge: true }
  ).then(function() {
    showToast('Auto-send ' + (enabled ? 'enabled' : 'disabled'), 'success');
  }).catch(function(err) {
    showToast('Failed to toggle auto-send: ' + err.message, 'error');
    console.error('[Admin Emails] Toggle error:', err);
    var toggle = document.getElementById('adminAutoSendToggle');
    if (toggle) toggle.checked = !enabled;
  });
}

function adminSaveAutoSendSettings() {
  if (!isAdmin() || !firebase) return;
  var toggleEl = document.getElementById('adminAutoSendToggle');
  var onboardEl = document.getElementById('autoSendOnboardDays');
  var reengageEl = document.getElementById('autoSendReengageDays');
  var checkinEl = document.getElementById('autoSendCheckinDays');
  var repeatEl = document.getElementById('autoSendRepeatDays');

  var settings = {
    autoSendEnabled: !!(toggleEl && toggleEl.checked),
    onboardingSurveyDays: onboardEl ? parseInt(onboardEl.value, 10) || 3 : 3,
    reEngagementDays: reengageEl ? parseInt(reengageEl.value, 10) || 7 : 7,
    checkInDays: checkinEl ? parseInt(checkinEl.value, 10) || 14 : 14,
    checkInRepeatDays: repeatEl ? parseInt(repeatEl.value, 10) || 30 : 30
  };

  firebase.firestore().collection('email_settings').doc('config').set(settings, { merge: true }).then(function() {
    showToast('Auto-send settings saved', 'success');
  }).catch(function(err) {
    showToast('Failed to save settings: ' + err.message, 'error');
    console.error('[Admin Emails] Save settings error:', err);
  });
}

function adminLoadAutoSendSettings() {
  if (!isAdmin() || !firebase) return;
  firebase.firestore().collection('email_settings').doc('config').get().then(function(doc) {
    if (!doc.exists) return;
    var d = doc.data();

    var toggleEl = document.getElementById('adminAutoSendToggle');
    var onboardEl = document.getElementById('autoSendOnboardDays');
    var reengageEl = document.getElementById('autoSendReengageDays');
    var checkinEl = document.getElementById('autoSendCheckinDays');
    var repeatEl = document.getElementById('autoSendRepeatDays');

    if (toggleEl && d.autoSendEnabled !== undefined) toggleEl.checked = !!d.autoSendEnabled;
    if (onboardEl && d.onboardingSurveyDays) onboardEl.value = d.onboardingSurveyDays;
    if (reengageEl && d.reEngagementDays) reengageEl.value = d.reEngagementDays;
    if (checkinEl && d.checkInDays) checkinEl.value = d.checkInDays;
    if (repeatEl && d.checkInRepeatDays) repeatEl.value = d.checkInRepeatDays;
  }).catch(function(err) {
    console.log('[Admin Emails] No auto-send settings found (may need first save):', err.message);
  });
}

// v30.5: Campaigns dashboard - full redesign with stats bar, expandable rows, response charts
// v31.1: Open the admin email composer pre-loaded with a campaign template.
// Used by the Compose button on each campaign row in the Campaigns dashboard.
function adminComposeFromCampaign(templateName) {
  if (!templateName) return;
  if (typeof openEmailComposer !== 'function') {
    if (typeof showToast === 'function') showToast('Composer not available', 'error');
    return;
  }
  // Founder100 + most campaigns aren't tied to a single access key, so use a
  // placeholder. The Send flow will still work because the template body
  // (e.g. generateFounderLifetimeOfferPreview) doesn't reference window._composerKey.
  openEmailComposer('CAMPAIGN-' + templateName.toUpperCase(), 'founder', '');
  setTimeout(function() {
    var sel = document.getElementById('composerTemplate');
    if (sel) {
      sel.value = templateName;
    }
    if (typeof loadComposerTemplate === 'function') {
      loadComposerTemplate(templateName);
    }
  }, 120);
}

function adminRenderCampaigns() {
  var panel = document.getElementById('adminTabCampaigns');
  if (!panel) return;

  // v31.2: Pull click-through counters once, cache on window for re-renders
  // v31.3: Also pull per-recipient click subcollections so dashboard can show unique-clickers and conversion lists
  if (!window._adminCampaignClicks && firebase) {
    var db = firebase.firestore();
    Promise.all([
      db.collection('campaign_clicks').get(),
      db.collectionGroup('clicks').limit(500).get().catch(function(e) { console.warn('[Campaigns] clicks subgroup query failed:', e.message); return null; })
    ]).then(function(snaps) {
      var snap = snaps[0];
      var clickSnap = snaps[1];
      window._adminCampaignClicks = {};
      window._adminCampaignClickRecipients = {}; // { campaignId: [recipient,...] }
      snap.docs.forEach(function(doc) {
        var d = doc.data() || {};
        window._adminCampaignClicks[doc.id] = d.totalClicks || 0;
      });
      if (clickSnap && clickSnap.docs) {
        clickSnap.docs.forEach(function(doc) {
          var d = doc.data() || {};
          if (!d.campaign) return;
          if (!window._adminCampaignClickRecipients[d.campaign]) window._adminCampaignClickRecipients[d.campaign] = [];
          window._adminCampaignClickRecipients[d.campaign].push({
            recipient: d.recipient || '',
            clickCount: d.clickCount || 1,
            lastClickAt: d.lastClickAt && d.lastClickAt.toDate ? d.lastClickAt.toDate().getTime() : 0
          });
        });
      }
      adminRenderCampaigns();
    }).catch(function(err) {
      console.warn('[Campaigns] Could not load click counts:', err.message);
      window._adminCampaignClicks = {};
      window._adminCampaignClickRecipients = {};
    });
  }

  var emailLogs = window._adminEmailLogs;
  var users = window._adminEmailUsers;
  var responses = window._adminEmailResponses;

  // If data not loaded yet, load it first then re-render
  if (!emailLogs && typeof adminLoadEmailData === 'function') {
    panel.innerHTML = '<div style="color:var(--text-muted);padding:40px 0;text-align:center;font-size:13px;">Loading campaign data...</div>';
    window._adminCampaignsPending = true;
    adminLoadEmailData();
    var _pollCount = 0;
    var _pollTimer = setInterval(function() {
      _pollCount++;
      if (window._adminEmailLogs || _pollCount > 20) {
        clearInterval(_pollTimer);
        window._adminCampaignsPending = false;
        adminRenderCampaigns();
      }
    }, 250);
    return;
  }

  emailLogs = emailLogs || [];
  users = users || [];
  responses = responses || [];

  // v31.1: Template display names and descriptions (added founder_lifetime_offer + welcome)
  // v31.2: Map campaign IDs to track-click counters for click-through engagement
  // v31.4: extraCounters supports any number of additional tracked CTAs (footer plans/apikeys etc).
  // Founder uses body CTAs (founder_offer/_apikey) + per-template footer (founder_lifetime_offer_plans/_apikeys).
  // Welcome uses welcome_open (Open RoweOS) + welcome_signin + welcome_<plans|apikeys>.
  var templateMeta = {
    'founder_lifetime_offer': {
      name: 'Founder · Lifetime 50% Discount',
      desc: 'Founder100 code · 50% off forever for first 100 users',
      clickCounter: 'founder_offer',
      clickLabel: 'Activate Trial',
      secondaryClickCounter: 'founder_apikey',
      secondaryClickLabel: 'API Pack',
      extraCounters: [
        { counter: 'founder_apikey', label: 'API Pack' },
        { counter: 'founder_lifetime_offer_plans', label: 'Footer · Plans' },
        { counter: 'founder_lifetime_offer_apikeys', label: 'Footer · API Keys' }
      ],
      conversionSources: ['founder_offer', 'founder100 email', 'founder email', 'founder_apikey', 'founder100 api pack']
    },
    'welcome': {
      name: 'Welcome',
      desc: 'New signup welcome message',
      clickCounter: 'welcome_open',
      clickLabel: 'Open RoweOS',
      secondaryClickCounter: 'welcome_plans',
      secondaryClickLabel: 'Plans',
      extraCounters: [
        { counter: 'welcome_plans', label: 'Footer · View Plans' },
        { counter: 'welcome_apikeys', label: 'Footer · Get API Keys' },
        { counter: 'welcome_signin', label: 'Inline · Sign In' }
      ]
    },
    'onboarding_survey': { name: 'Onboarding Survey', desc: 'New user experience feedback' },
    'reengagement': {
      name: 'Re-engagement', desc: 'Win back inactive users',
      clickCounter: 'reengagement_open', clickLabel: 'Open RoweOS',
      extraCounters: [
        { counter: 'reengagement_plans', label: 'Footer · Plans' },
        { counter: 'reengagement_apikeys', label: 'Footer · API Keys' }
      ]
    },
    'feature_announcement': {
      name: 'Feature Announcement', desc: 'Announce new capabilities',
      clickCounter: 'feature_announcement_open', clickLabel: 'Try it now',
      extraCounters: [
        { counter: 'feature_announcement_plans', label: 'Footer · Plans' },
        { counter: 'feature_announcement_apikeys', label: 'Footer · API Keys' }
      ]
    },
    'checkin': { name: 'Check-in', desc: 'Ongoing satisfaction pulse' },
    'access_key_delivery': {
      name: 'Access Key Delivery', desc: 'Welcome and activation',
      clickCounter: 'access_key_open', clickLabel: 'Activate Key',
      extraCounters: [
        { counter: 'access_key_delivery_plans', label: 'Footer · Plans' },
        { counter: 'access_key_delivery_apikeys', label: 'Footer · API Keys' }
      ]
    },
    'subscription_info': {
      name: 'Subscription Info', desc: 'Plans, pricing, and API keys',
      clickCounter: 'subscription_choose', clickLabel: 'Choose Plan',
      secondaryClickCounter: 'subscription_apikeys', secondaryClickLabel: 'API Keys',
      extraCounters: [
        { counter: 'subscription_apikeys', label: 'API Keys' },
        { counter: 'subscription_info_plans', label: 'Footer · Plans' },
        { counter: 'subscription_info_apikeys', label: 'Footer · API Keys' }
      ]
    }
  };

  // Templates that expect responses
  var responseTemplates = { 'onboarding_survey': true, 'checkin': true };

  // ---- Compute top-level stats ----
  var totalUsers = users.length;

  // Count signups within last 7 days
  var now = Date.now();
  var weekAgo = now - (7 * 24 * 60 * 60 * 1000);
  var newThisWeek = 0;
  for (var ui = 0; ui < users.length; ui++) {
    var sd = users[ui].signupDate;
    if (sd) {
      var signupTime = new Date(sd).getTime();
      if (!isNaN(signupTime) && signupTime >= weekAgo) {
        newThisWeek++;
      }
    }
  }

  var totalEmailsSent = emailLogs.length;

  // Response rate: responses / emails sent for response-capable templates
  var responseCapableSends = 0;
  var totalResponseUsers = 0;
  for (var ei = 0; ei < emailLogs.length; ei++) {
    if (responseTemplates[emailLogs[ei].template]) {
      responseCapableSends++;
    }
  }
  // Count unique users who responded
  var _allRespondents = {};
  for (var rri = 0; rri < responses.length; rri++) {
    var rKey = (responses[rri].userEmail || responses[rri].userId || '').toLowerCase();
    if (rKey) _allRespondents[rKey] = true;
  }
  totalResponseUsers = Object.keys(_allRespondents).length;
  var overallResponseRate = responseCapableSends > 0 ? Math.round((totalResponseUsers / responseCapableSends) * 100) : 0;
  if (overallResponseRate > 100) overallResponseRate = 100;

  // Active campaigns: unique templates that have been sent
  // v31.2: Active campaigns = total available templates (not just sent ones)
  var sentTemplates = {};
  for (var si = 0; si < emailLogs.length; si++) {
    if (emailLogs[si].template) sentTemplates[emailLogs[si].template] = true;
  }
  // v31.2: Count from templateMeta (all known campaigns) so the stat reflects the full library, not just what's been sent
  var activeCampaigns = Object.keys(templateMeta).length;

  // ---- Group email logs by template ----
  var campaignMap = {};
  for (var i = 0; i < emailLogs.length; i++) {
    var log = emailLogs[i];
    var tmpl = log.template || 'unknown';
    if (!campaignMap[tmpl]) {
      campaignMap[tmpl] = { logs: [], successCount: 0, failedCount: 0, recipients: {}, earliest: null, latest: null };
    }
    var c = campaignMap[tmpl];
    c.logs.push(log);
    if (log.status === 'failed') {
      c.failedCount++;
    } else {
      c.successCount++;
    }
    if (log.userEmail) {
      c.recipients[log.userEmail.toLowerCase()] = true;
    }
    var sentTime = log.sentAt ? new Date(log.sentAt).getTime() : 0;
    if (sentTime && (!c.earliest || sentTime < c.earliest)) c.earliest = sentTime;
    if (sentTime && (!c.latest || sentTime > c.latest)) c.latest = sentTime;
  }

  // Sort logs within each campaign by sentAt descending
  var campaignKeys = Object.keys(campaignMap);
  for (var ck = 0; ck < campaignKeys.length; ck++) {
    campaignMap[campaignKeys[ck]].logs.sort(function(a, b) {
      var ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      var tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return tb - ta;
    });
  }

  // Count responses per template
  var responsesByTemplate = {};
  for (var r = 0; r < responses.length; r++) {
    var resp = responses[r];
    var rTmpl = resp.template || '';
    if (!responsesByTemplate[rTmpl]) responsesByTemplate[rTmpl] = [];
    responsesByTemplate[rTmpl].push(resp);
  }

  // ---- Build HTML ----
  var html = '';

  // Scoped styles for responsive layout and interactions
  html += '<style>';
  html += '.cmpn-stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:32px; }';
  html += '.cmpn-row { transition: background 0.15s ease; cursor:pointer; }';
  html += '.cmpn-row:hover { background: var(--bg-secondary); }';
  html += '.cmpn-detail { overflow:hidden; transition: max-height 0.25s ease, opacity 0.2s ease; max-height:0; opacity:0; }';
  html += '.cmpn-detail.cmpn-open { max-height:2000px; opacity:1; }';
  html += '.cmpn-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }';
  html += '.cmpn-bar-track { width:100%; height:4px; background:var(--border-color); border-radius:2px; overflow:hidden; }';
  html += '.cmpn-bar-fill { height:100%; border-radius:2px; transition: width 0.3s ease; }';
  html += '@media (max-width: 768px) {';
  html += '  .cmpn-stats-grid { grid-template-columns: 1fr; }';
  html += '  .cmpn-row-cols { flex-direction:column; gap:8px; }';
  html += '  .cmpn-row-cols > div { width:100% !important; text-align:left !important; }';
  html += '  .cmpn-col-name { margin-bottom:4px; }';
  html += '  .cmpn-detail-cols { flex-direction:column; }';
  html += '  .cmpn-detail-cols > div { width:100% !important; }';
  html += '}';
  html += '</style>';

  // v31.3: Total clicks across all campaigns (every track-click counter combined)
  var totalAllClicks = 0;
  var allClicks = window._adminCampaignClicks || {};
  Object.keys(allClicks).forEach(function(k) { totalAllClicks += allClicks[k] || 0; });

  // v31.3: Total signups attributed specifically to a TRACKED email campaign click.
  // "Info Page Lead" is excluded because the Info page is its own funnel (not an email).
  // Only count sources set by /api/track-click → /?source=<campaign>.
  var _campaignSourceSet = {
    'founder_offer': 1, 'founder100 email': 1, 'founder email': 1,
    'founder_apikey': 1, 'founder100 api pack': 1
  };
  var totalAttributedSignups = 0;
  for (var su = 0; su < users.length; su++) {
    var srcRaw = (users[su].signupSource || '').toLowerCase();
    if (_campaignSourceSet[srcRaw]) totalAttributedSignups++;
  }

  // ---- Top Stats Bar ----
  html += '<div class="cmpn-stats-grid">';

  // Stat 1: New RoweOS Users
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:24px;">';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;margin-bottom:8px;">New RoweOS Users</div>';
  html += '<div style="display:flex;align-items:baseline;gap:12px;">';
  html += '<div style="font-size:36px;font-weight:700;color:var(--text-primary);line-height:1;">' + totalUsers + '</div>';
  if (newThisWeek > 0) {
    html += '<div style="font-size:13px;color:#22c55e;font-weight:500;">+' + newThisWeek + ' this week</div>';
  } else {
    html += '<div style="font-size:13px;color:var(--text-muted);">No new signups this week</div>';
  }
  html += '</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">' + activeCampaigns + ' active campaigns</div>';
  html += '</div>';

  // Stat 2 (v31.3): Email Engagement — total clicks across all campaigns + total signups attributed to email
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:24px;">';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;margin-bottom:8px;">Email Engagement</div>';
  html += '<div style="display:flex;align-items:baseline;gap:12px;">';
  html += '<div style="font-size:36px;font-weight:700;color:var(--text-primary);line-height:1;">' + totalAllClicks + '</div>';
  // v31.3: Replace "X from emails" sub-stat with click-through rate, which is meaningful even when zero attributions exist.
  var overallCtr = totalEmailsSent > 0 ? Math.round((totalAllClicks / totalEmailsSent) * 100) : 0;
  if (overallCtr > 100) overallCtr = 100;
  html += '<div style="font-size:13px;color:var(--accent, #a89878);font-weight:500;">' + overallCtr + '% CTR</div>';
  html += '</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">' + totalEmailsSent + ' total sends across all campaigns</div>';
  html += '</div>';

  html += '</div>'; // stats grid

  // ---- Campaign Cards Section ----
  html += '<div style="margin-bottom:8px;">';
  html += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Campaigns</div>';
  html += '<div style="height:1px;background:var(--border-color);margin-bottom:16px;"></div>';
  html += '</div>';

  // v31.1: Inject ALL known templates into campaignMap so they appear even with 0 sends
  // (gives admin a "ready to send" entry per template, including new Founder100 campaign)
  var allKnownTemplates = Object.keys(templateMeta);
  for (var ki = 0; ki < allKnownTemplates.length; ki++) {
    var kKey = allKnownTemplates[ki];
    if (!campaignMap[kKey]) {
      campaignMap[kKey] = { logs: [], successCount: 0, failedCount: 0, recipients: {}, earliest: null, latest: null };
    }
  }

  // Sort templates: Founder100 first (active campaign), then known ones, then unknowns
  var knownOrder = ['founder_lifetime_offer', 'welcome', 'onboarding_survey', 'reengagement', 'feature_announcement', 'checkin', 'access_key_delivery', 'subscription_info'];
  var templateKeys = Object.keys(campaignMap);
  templateKeys.sort(function(a, b) {
    var ia = knownOrder.indexOf(a);
    var ib = knownOrder.indexOf(b);
    if (ia === -1) ia = 999;
    if (ib === -1) ib = 999;
    return ia - ib;
  });

  if (templateKeys.length === 0) {
    html += '<div style="color:var(--text-muted);padding:40px 0;font-size:13px;text-align:center;">No campaign data available yet. Send some emails to see metrics here.</div>';
    panel.innerHTML = html;
    return;
  }

  // Table header row (v31.2: added Clicks column for engagement tracking)
  html += '<div style="display:flex;align-items:center;padding:8px 16px;font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;" class="cmpn-row-cols">';
  html += '<div style="flex:2;min-width:180px;">Campaign</div>';
  html += '<div style="width:90px;text-align:center;">Sends</div>';
  html += '<div style="width:90px;text-align:center;">Recipients</div>';
  html += '<div style="width:120px;text-align:center;">Response Rate</div>';
  html += '<div style="width:80px;text-align:center;">Clicks</div>';
  html += '<div style="width:100px;text-align:right;">Last Sent</div>';
  html += '<div style="width:110px;text-align:right;">Action</div>';
  html += '</div>';
  html += '<div style="height:1px;background:var(--border-color);"></div>';

  // Campaign rows
  for (var t = 0; t < templateKeys.length; t++) {
    var key = templateKeys[t];
    var campaign = campaignMap[key];
    var meta = templateMeta[key] || { name: formatTemplateName(key), desc: '' };
    var totalSends = campaign.successCount + campaign.failedCount;
    var uniqueRecipients = Object.keys(campaign.recipients).length;

    // Response rate for this campaign
    var campResponseRate = 0;
    var campResponseCount = 0;
    if (responseTemplates[key]) {
      var tResps = responsesByTemplate[key] || [];
      var respondedUsers = {};
      for (var ri = 0; ri < tResps.length; ri++) {
        var rUser = (tResps[ri].userEmail || tResps[ri].userId || '').toLowerCase();
        if (rUser) respondedUsers[rUser] = true;
      }
      campResponseCount = Object.keys(respondedUsers).length;
      if (uniqueRecipients > 0) {
        campResponseRate = Math.round((campResponseCount / uniqueRecipients) * 100);
        if (campResponseRate > 100) campResponseRate = 100;
      }
    }

    // Last sent
    var lastSentText = '';
    if (campaign.latest) {
      lastSentText = formatRelativeTime(new Date(campaign.latest).toISOString());
    }

    var rowId = '_cmpn_row_' + t;

    // Main row (clickable)
    html += '<div class="cmpn-row cmpn-row-cols" style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border-color);" onclick="var d=document.getElementById(\'' + rowId + '\');if(d){d.classList.toggle(\'cmpn-open\');}">';

    // Campaign name + description
    html += '<div style="flex:2;min-width:180px;" class="cmpn-col-name">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);">' + escapeHtml(meta.name) + '</div>';
    if (meta.desc) {
      html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(meta.desc) + '</div>';
    }
    html += '</div>';

    // Total sends
    html += '<div style="width:90px;text-align:center;">';
    html += '<span style="font-size:14px;font-weight:600;color:var(--text-primary);">' + totalSends + '</span>';
    if (campaign.failedCount > 0) {
      html += '<span style="font-size:11px;color:#f87171;margin-left:4px;">(' + campaign.failedCount + ' failed)</span>';
    }
    html += '</div>';

    // Recipients
    html += '<div style="width:90px;text-align:center;font-size:14px;font-weight:600;color:var(--text-primary);">' + uniqueRecipients + '</div>';

    // Response rate with bar
    html += '<div style="width:120px;text-align:center;">';
    if (responseTemplates[key]) {
      html += '<div style="font-size:14px;font-weight:600;color:var(--accent, #a89878);margin-bottom:4px;">' + campResponseRate + '%</div>';
      html += '<div class="cmpn-bar-track">';
      html += '<div class="cmpn-bar-fill" style="width:' + campResponseRate + '%;background:var(--accent, #a89878);"></div>';
      html += '</div>';
    } else {
      html += '<span style="font-size:11px;color:var(--text-muted);">N/A</span>';
    }
    html += '</div>';

    // v31.2/3: Click-throughs (primary CTA + optional secondary, e.g. API Pack)
    var clicksHtml = '';
    if (meta.clickCounter) {
      var clickCount = (window._adminCampaignClicks || {})[meta.clickCounter] || 0;
      var clickRate = uniqueRecipients > 0 ? Math.round((clickCount / uniqueRecipients) * 100) : 0;
      if (clickRate > 100) clickRate = 100;
      clicksHtml = '<div style="font-size:13px;font-weight:600;color:var(--accent, #a89878);">' + clickCount + '</div>'
        + '<div style="font-size:10px;color:var(--text-muted);margin-top:1px;">' + clickRate + '% CTR</div>';
      if (meta.secondaryClickCounter) {
        var secCount = (window._adminCampaignClicks || {})[meta.secondaryClickCounter] || 0;
        clicksHtml += '<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">+' + secCount + ' ' + escapeHtml(meta.secondaryClickLabel || '') + '</div>';
      }
    } else {
      clicksHtml = '<span style="font-size:11px;color:var(--text-muted);opacity:0.4;">--</span>';
    }
    html += '<div style="width:80px;text-align:center;">' + clicksHtml + '</div>';

    // Last sent
    html += '<div style="width:100px;text-align:right;font-size:12px;color:var(--text-muted);">' + escapeHtml(lastSentText || (totalSends === 0 ? 'Ready' : '')) + '</div>';

    // v31.1: Compose action - opens admin email composer pre-loaded with this template
    html += '<div style="width:110px;text-align:right;" onclick="event.stopPropagation();">';
    html += '<button onclick="event.stopPropagation();adminComposeFromCampaign(\'' + escapeHtml(key) + '\')" style="padding:6px 12px;background:var(--accent, #a89878);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:0.3px;">Compose</button>';
    html += '</div>';

    html += '</div>'; // row

    // ---- Expandable detail panel ----
    html += '<div id="' + rowId + '" class="cmpn-detail" style="border-bottom:1px solid var(--border-color);background:var(--bg-secondary);">';
    html += '<div style="padding:20px 16px;">';

    // Two-column layout: timeline + response breakdown
    html += '<div style="display:flex;gap:24px;" class="cmpn-detail-cols">';

    // Left column: Send timeline
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Recent Sends</div>';

    // v31.3: Look up names from users array so failed sends are easy to identify
    var _nameByEmail = {};
    for (var nu = 0; nu < users.length; nu++) {
      if (users[nu].email) _nameByEmail[users[nu].email.toLowerCase()] = users[nu].name || '';
    }
    // v31.3: Show EVERY failed entry (no cap) so admin can resend all of them, then up to 8 recent successful sends
    var failedLogs = [];
    var sentLogs = [];
    for (var sli = 0; sli < campaign.logs.length; sli++) {
      if (campaign.logs[sli].status === 'failed') failedLogs.push(campaign.logs[sli]);
      else sentLogs.push(campaign.logs[sli]);
    }
    var _byTimeDesc = function(a, b) {
      var ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      var tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return tb - ta;
    };
    failedLogs.sort(_byTimeDesc);
    sentLogs.sort(_byTimeDesc);
    var visibleSent = sentLogs.slice(0, 8);
    var recentLogs = failedLogs.concat(visibleSent);
    var hiddenSentCount = sentLogs.length - visibleSent.length;
    for (var li = 0; li < recentLogs.length; li++) {
      var sLog = recentLogs[li];
      var sDate = '';
      if (sLog.sentAt) {
        try {
          sDate = new Date(sLog.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(sLog.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch (e) { /* skip */ }
      }
      var sStatusColor = sLog.status === 'failed' ? '#f87171' : '#22c55e';
      var sStatusBg = sLog.status === 'failed' ? 'rgba(248,113,113,0.1)' : 'rgba(34,197,94,0.1)';
      var sStatusBorder = sLog.status === 'failed' ? 'rgba(248,113,113,0.25)' : 'rgba(34,197,94,0.25)';
      var sStatusLabel = sLog.status === 'failed' ? 'Failed' : 'Sent';
      var sName = _nameByEmail[(sLog.userEmail || '').toLowerCase()] || '';

      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;';
      if (li < recentLogs.length - 1) html += 'border-bottom:1px solid var(--border-color);';
      html += '">';
      html += '<div style="flex:1;min-width:0;">';
      // v31.3: Show name + email (name in primary color, email in muted) so failed rows are scannable
      if (sName) {
        html += '<div style="font-size:12px;color:var(--text-primary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(sName) + '</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(sLog.userEmail || '') + '</div>';
      } else {
        html += '<div style="font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(sLog.userEmail || 'Unknown') + '</div>';
      }
      if (sDate) {
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + escapeHtml(sDate) + '</div>';
      }
      html += '</div>';
      // v31.3: Right side — for FAILED rows show a Resend button beside the badge so the admin can retry inline
      html += '<div style="display:flex;align-items:center;gap:6px;margin-left:8px;flex-shrink:0;">';
      if (sLog.status === 'failed') {
        var _resendArgs = "'" + (sLog.template || key).replace(/'/g, "\\'")
          + "','" + (sLog.userId || '').replace(/'/g, "\\'")
          + "','" + (sLog.userEmail || '').replace(/'/g, "\\'")
          + "','" + (sName || '').replace(/'/g, "\\'") + "'";
        html += '<button type="button" onclick="adminResendFailed(' + _resendArgs + ',this)" style="padding:3px 10px;background:var(--accent, #a89878);color:#fff;border:none;border-radius:5px;font-size:10.5px;font-weight:600;cursor:pointer;letter-spacing:0.3px;">Resend</button>';
      }
      html += '<span class="cmpn-badge" style="background:' + sStatusBg + ';border:1px solid ' + sStatusBorder + ';color:' + sStatusColor + ';">' + sStatusLabel + '</span>';
      html += '</div>';
      html += '</div>';
    }
    if (hiddenSentCount > 0) {
      html += '<div style="font-size:11px;color:var(--text-muted);padding-top:8px;text-align:center;">and ' + hiddenSentCount + ' more sent</div>';
    }
    if (recentLogs.length === 0) {
      html += '<div style="font-size:12px;color:var(--text-muted);">No sends recorded.</div>';
    }
    html += '</div>'; // left column

    // v31.3/4: Right column for click-tracked templates — engagement & conversions
    if (!responseTemplates[key] && meta.clickCounter) {
      var allCounterDefs = [{ counter: meta.clickCounter, label: meta.clickLabel || 'CTA' }];
      if (meta.extraCounters && meta.extraCounters.length) {
        for (var ec = 0; ec < meta.extraCounters.length; ec++) {
          allCounterDefs.push(meta.extraCounters[ec]);
        }
      }

      // Conversions only when meta declares the source set (Founder). Welcome etc. omit it.
      var convertedUsers = [];
      if (meta.conversionSources && meta.conversionSources.length) {
        var srcSet = {};
        for (var csI = 0; csI < meta.conversionSources.length; csI++) {
          srcSet[String(meta.conversionSources[csI]).toLowerCase()] = true;
        }
        for (var cu = 0; cu < users.length; cu++) {
          var srcL = (users[cu].signupSource || '').toLowerCase();
          if (srcSet[srcL]) convertedUsers.push(users[cu]);
        }
      }

      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Engagement' + (meta.conversionSources ? ' & Conversions' : '') + '</div>';

      // Cards row: one card per tracked counter, plus optional Conversions card.
      // Aggregate can exceed unique-tracked when emails were sent BEFORE per-recipient
      // encoding (`&u=`) was added — those old clicks are anonymous and bump the
      // total but not the per-user list.
      html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;">';
      var grandTotalAcrossCards = 0;
      var perCounter = {}; // counter -> { recips, total }
      for (var cdI = 0; cdI < allCounterDefs.length; cdI++) {
        var cd = allCounterDefs[cdI];
        var cdRecips = (window._adminCampaignClickRecipients || {})[cd.counter] || [];
        var cdTotal = (window._adminCampaignClicks || {})[cd.counter] || 0;
        var cdAnon = Math.max(0, cdTotal - cdRecips.length);
        perCounter[cd.counter] = { recips: cdRecips, total: cdTotal, label: cd.label };
        grandTotalAcrossCards += cdTotal;

        html += '<div style="flex:1;min-width:140px;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;">';
        html += '<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">' + escapeHtml(cd.label) + '</div>';
        html += '<div style="font-size:18px;font-weight:600;color:var(--text-primary);">' + cdTotal + '</div>';
        html += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + cdRecips.length + ' tracked';
        if (cdAnon > 0) html += ' · ' + cdAnon + ' anon';
        html += '</div>';
        html += '</div>';
      }
      if (meta.conversionSources && meta.conversionSources.length) {
        html += '<div style="flex:1;min-width:140px;padding:10px 12px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);border-radius:8px;">';
        html += '<div style="font-size:10px;color:#4ade80;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Conversions</div>';
        html += '<div style="font-size:18px;font-weight:600;color:#4ade80;">' + convertedUsers.length + '</div>';
        html += '</div>';
      }
      html += '</div>';

      // Recent Clickers — aggregate per-recipient across every counter for this template
      var allClickers = {};
      Object.keys(perCounter).forEach(function(counterId) {
        var data = perCounter[counterId];
        data.recips.forEach(function(c) {
          var k = (c.recipient || '').toLowerCase();
          if (!k) return;
          if (!allClickers[k]) allClickers[k] = { recipient: c.recipient, breakdown: {}, last: 0 };
          allClickers[k].breakdown[counterId] = (allClickers[k].breakdown[counterId] || 0) + (c.clickCount || 0);
          if (c.lastClickAt > allClickers[k].last) allClickers[k].last = c.lastClickAt;
        });
      });
      var clickList = Object.keys(allClickers).map(function(k) { return allClickers[k]; })
        .sort(function(a, b) { return b.last - a.last; });

      html += '<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Recent Clickers</div>';
      if (clickList.length === 0) {
        if (grandTotalAcrossCards > 0) {
          html += '<div style="font-size:12px;color:var(--text-muted);">' + grandTotalAcrossCards + ' anonymous click' + (grandTotalAcrossCards === 1 ? '' : 's') + ' from sends made before per-recipient tracking was added. Future sends will attribute to individual users here.</div>';
        } else {
          html += '<div style="font-size:12px;color:var(--text-muted);">No clicks tracked yet. New sends will populate here.</div>';
        }
      } else {
        var topClickers = clickList.slice(0, 6);
        for (var tc = 0; tc < topClickers.length; tc++) {
          var cl = topClickers[tc];
          var clWhen = cl.last ? formatRelativeTime(new Date(cl.last).toISOString()) : '';
          html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;';
          if (tc < topClickers.length - 1) html += 'border-bottom:1px solid var(--border-color);';
          html += '">';
          html += '<div style="flex:1;min-width:0;">';
          html += '<div style="font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(cl.recipient) + '</div>';
          if (clWhen) html += '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + escapeHtml(clWhen) + '</div>';
          html += '</div>';
          // Breakdown badges per counter (e.g. "3 Open · 1 Plans")
          var bParts = [];
          Object.keys(cl.breakdown).forEach(function(counterId) {
            var n = cl.breakdown[counterId];
            if (!n) return;
            var lbl = (perCounter[counterId] && perCounter[counterId].label) || counterId;
            bParts.push(n + ' ' + lbl);
          });
          html += '<div style="font-size:11px;color:var(--accent, #a89878);font-weight:500;flex-shrink:0;margin-left:8px;text-align:right;max-width:55%;">' + escapeHtml(bParts.join(' · ')) + '</div>';
          html += '</div>';
        }
        if (clickList.length > 6) {
          html += '<div style="font-size:11px;color:var(--text-muted);padding-top:8px;text-align:center;">and ' + (clickList.length - 6) + ' more</div>';
        }
      }
      html += '</div>'; // right column
    }

    // Right column: Response breakdown (if applicable)
    if (responseTemplates[key]) {
      var tRespsAll = responsesByTemplate[key] || [];
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Response Breakdown</div>';

      if (tRespsAll.length > 0) {
        // Group responses by answer text
        var answerCounts = {};
        var answerTotal = 0;
        for (var ari = 0; ari < tRespsAll.length; ari++) {
          var aText = tRespsAll[ari].answer || '(no answer)';
          answerCounts[aText] = (answerCounts[aText] || 0) + 1;
          answerTotal++;
        }

        // Sort by count descending
        var aKeys = Object.keys(answerCounts);
        aKeys.sort(function(a, b) { return answerCounts[b] - answerCounts[a]; });

        for (var aki = 0; aki < aKeys.length; aki++) {
          var aLabel = aKeys[aki];
          var aCount = answerCounts[aLabel];
          var aPct = answerTotal > 0 ? Math.round((aCount / answerTotal) * 100) : 0;

          html += '<div style="margin-bottom:10px;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">';
          html += '<span style="font-size:12px;color:var(--text-primary);font-weight:500;">' + escapeHtml(aLabel) + '</span>';
          html += '<span style="font-size:11px;color:var(--text-muted);margin-left:8px;flex-shrink:0;">' + aCount + ' (' + aPct + '%)</span>';
          html += '</div>';
          // Horizontal bar
          html += '<div class="cmpn-bar-track" style="height:6px;">';
          html += '<div class="cmpn-bar-fill" style="width:' + aPct + '%;background:var(--accent, #a89878);height:100%;"></div>';
          html += '</div>';
          html += '</div>';
        }
      } else {
        html += '<div style="font-size:12px;color:var(--text-muted);">No responses yet.</div>';
      }

      html += '</div>'; // right column
    }

    html += '</div>'; // two-column layout
    html += '</div>'; // padding wrapper
    html += '</div>'; // detail panel
  }

  // ---- Full Response Breakdown Section ----
  if (responses.length > 0) {
    html += '<div style="margin-top:32px;">';
    html += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">';
    html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:8px;"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    html += 'Response Breakdown';
    html += '</div>';
    html += '<div style="color:var(--text-muted);font-size:12px;margin-bottom:4px;">Answer distribution across all survey and check-in responses.</div>';
    html += '<div style="height:1px;background:var(--border-color);margin-bottom:16px;"></div>';

    // Group responses by question
    var questionMap = {};
    for (var q = 0; q < responses.length; q++) {
      var rsp = responses[q];
      var qKey = rsp.question || 'Unknown';
      if (!questionMap[qKey]) questionMap[qKey] = {};
      var aKey = rsp.answer || '(no answer)';
      questionMap[qKey][aKey] = (questionMap[qKey][aKey] || 0) + 1;
    }

    var questionKeys = Object.keys(questionMap);
    for (var qi = 0; qi < questionKeys.length; qi++) {
      var question = questionKeys[qi];
      var answers = questionMap[question];
      var answerKeys = Object.keys(answers);

      answerKeys.sort(function(a, b) { return answers[b] - answers[a]; });

      var qTotal = 0;
      for (var ai = 0; ai < answerKeys.length; ai++) {
        qTotal += answers[answerKeys[ai]];
      }

      html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:20px;margin-bottom:12px;">';
      html += '<div style="font-weight:600;color:var(--text-primary);font-size:13px;margin-bottom:14px;">' + escapeHtml(formatTemplateName(question)) + '</div>';

      for (var aj = 0; aj < answerKeys.length; aj++) {
        var answer = answerKeys[aj];
        var count = answers[answer];
        var pct = qTotal > 0 ? Math.round((count / qTotal) * 100) : 0;

        html += '<div style="margin-bottom:10px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">';
        html += '<span style="font-size:13px;color:var(--text-primary);">' + escapeHtml(answer) + '</span>';
        html += '<span style="font-size:12px;color:var(--text-muted);margin-left:8px;flex-shrink:0;font-weight:600;">' + count + ' <span style="font-weight:400;">(' + pct + '%)</span></span>';
        html += '</div>';
        // Full-width bar
        html += '<div class="cmpn-bar-track" style="height:6px;">';
        html += '<div class="cmpn-bar-fill" style="width:' + pct + '%;background:var(--accent, #a89878);height:100%;"></div>';
        html += '</div>';
        html += '</div>';
      }

      // Total
      html += '<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border-color);font-size:12px;color:var(--text-muted);">';
      html += '<span style="font-weight:600;">Total</span>';
      html += '<span style="font-weight:600;">' + qTotal + '</span>';
      html += '</div>';

      html += '</div>'; // question card
    }

    html += '</div>'; // response breakdown section
  }

  panel.innerHTML = html;
}
