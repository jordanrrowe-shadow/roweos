// v30.1: Admin Email Management
// Client-side logic for the Emails tab in the Admin panel

// v30.5: Sort state for user list
var _adminEmailSortBy = 'name';

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
  var signupsP = db.collection('newsletter_subscribers').orderBy('subscribedAt', 'desc').limit(200).get().catch(function(e) { console.warn('[Admin Emails] signups query failed:', e.message); return null; });
  var emailLogP = db.collection('email_log').limit(500).get().catch(function(e) { console.warn('[Admin Emails] email_log query failed:', e.message); return null; });
  var responsesP = db.collectionGroup('responses').limit(500).get().catch(function(e) { console.warn('[Admin Emails] responses query failed:', e.message); return null; });

  Promise.all([signupsP, emailLogP, responsesP]).then(function(results) {
    var signupSnap = results[0];
    var emailLogSnap = results[1];
    var responseSnap = results[2];

    // Parse signups into user objects
    var users = [];
    if (signupSnap && signupSnap.docs) {
      signupSnap.docs.forEach(function(doc) {
        var d = doc.data();
        users.push({
          uid: d.uid || doc.id,
          email: d.email || '',
          name: d.name || d.displayName || '',
          signupDate: d.subscribedAt || d.createdAt || d.signupDate || ''
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
          users.push({
            uid: log.userId || '',
            email: log.userEmail || '',
            name: '',
            signupDate: log.sentAt || ''
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

  // v30.5: Sort users based on _adminEmailSortBy
  if (_adminEmailSortBy === 'lastEmail') {
    // Build lookup of most recent sentAt per user
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
    users.sort(function(a, b) {
      var ta = _lastSentMap[a.uid] || _lastSentMap[a.email] || 0;
      var tb = _lastSentMap[b.uid] || _lastSentMap[b.email] || 0;
      return tb - ta;
    });
  } else {
    // Default: sort by name A-Z
    users.sort(function(a, b) {
      var na = (a.name || '').toLowerCase();
      var nb = (b.name || '').toLowerCase();
      return na < nb ? -1 : (na > nb ? 1 : 0);
    });
  }

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

  // v30.5: Sort controls bar
  var _nameActive = _adminEmailSortBy === 'name';
  var _lastActive = _adminEmailSortBy === 'lastEmail';
  var _pillBase = 'display:inline-block;padding:4px 12px;font-size:11px;font-weight:600;border-radius:20px;cursor:pointer;transition:all 0.15s;margin-right:6px;';
  var _pillActiveStyle = _pillBase + 'border:1px solid var(--accent);color:var(--accent);background:rgba(168,152,120,0.1);';
  var _pillInactiveStyle = _pillBase + 'border:1px solid var(--border-color);color:var(--text-muted);background:transparent;';

  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0 12px 0;">';
  html += '<div style="display:flex;align-items:center;">';
  html += '<span style="font-size:11px;color:var(--text-muted);margin-right:8px;font-weight:500;">Sort:</span>';
  html += '<span style="' + (_nameActive ? _pillActiveStyle : _pillInactiveStyle) + '" onclick="_adminEmailSortBy=\'name\';adminRenderEmailUserList(window._adminEmailUsers,window._adminEmailLogs,window._adminEmailResponses);">Name (A-Z)</span>';
  html += '<span style="' + (_lastActive ? _pillActiveStyle : _pillInactiveStyle) + '" onclick="_adminEmailSortBy=\'lastEmail\';adminRenderEmailUserList(window._adminEmailUsers,window._adminEmailLogs,window._adminEmailResponses);">Last Email</span>';
  html += '</div>';
  html += '<span id="adminEmailSelectedCount" style="font-size:11px;color:var(--text-muted);font-weight:500;"></span>';
  html += '</div>';

  // Header row
  html += '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">';
  html += '<div style="width:30px;flex-shrink:0;"><input type="checkbox" id="adminEmailSelectAll" onchange="adminToggleAllEmailUsers(this.checked);adminUpdateSelectedCount();" style="accent-color:var(--accent);"></div>';
  html += '<div style="flex:1;min-width:80px;">Name</div>';
  html += '<div style="flex:1.5;min-width:120px;">Email</div>';
  html += '<div style="width:100px;">Signup</div>';
  html += '<div style="flex:1;min-width:100px;">Last Email</div>';
  html += '<div style="width:80px;text-align:center;">Responses</div>';
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

    html += '<div class="admin-email-row" style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color);cursor:pointer;transition:background 0.15s;" ';
    html += 'onmouseenter="this.style.background=\'var(--bg-secondary)\'" onmouseleave="this.style.background=\'transparent\'">';
    html += '<div style="width:30px;flex-shrink:0;" onclick="event.stopPropagation();">';
    html += '<input type="checkbox" class="admin-email-user-cb" data-uid="' + escapeHtml(u.uid) + '" data-email="' + escapeHtml(u.email) + '" data-name="' + escapeHtml(u.name) + '" style="accent-color:var(--accent);" onchange="adminUpdateSelectedCount()">';
    html += '</div>';
    html += '<div style="flex:1;min-width:80px;color:var(--text-primary);font-weight:500;font-size:13px;" onclick="adminShowEmailUserDetail(\'' + escapeHtml(u.uid) + '\',\'' + escapeHtml(u.name).replace(/'/g, "\\'") + '\',\'' + escapeHtml(u.email).replace(/'/g, "\\'") + '\')">' + escapeHtml(u.name || 'Unknown') + '</div>';
    html += '<div style="flex:1.5;min-width:120px;color:var(--text-secondary);font-size:12px;" onclick="adminShowEmailUserDetail(\'' + escapeHtml(u.uid) + '\',\'' + escapeHtml(u.name).replace(/'/g, "\\'") + '\',\'' + escapeHtml(u.email).replace(/'/g, "\\'") + '\')">' + escapeHtml(u.email) + '</div>';
    html += '<div style="width:100px;color:var(--text-muted);font-size:12px;">' + escapeHtml(signupFormatted) + '</div>';
    html += '<div style="flex:1;min-width:100px;font-size:12px;">' + lastEmailText + '</div>';
    html += '<div style="width:80px;text-align:center;">';
    if (respCount > 0) {
      html += '<span style="display:inline-block;padding:2px 8px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);border-radius:4px;font-size:11px;font-weight:600;color:#4ade80;">' + respCount + '</span>';
    } else {
      html += '<span style="color:var(--text-muted);font-size:11px;">0</span>';
    }
    html += '</div>';
    html += '</div>';
  });

  contentEl.innerHTML = html;
}

function adminToggleAllEmailUsers(checked) {
  var cbs = document.querySelectorAll('.admin-email-user-cb');
  for (var i = 0; i < cbs.length; i++) {
    cbs[i].checked = checked;
  }
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

  // User header
  html += '<div style="padding:14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:16px;">';
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:15px;margin-bottom:4px;">' + escapeHtml(userName || 'Unknown') + '</div>';
  html += '<div style="color:var(--text-secondary);font-size:13px;margin-bottom:4px;">' + escapeHtml(userEmail) + '</div>';
  if (userObj && userObj.signupDate) {
    try {
      var signupFmt = new Date(userObj.signupDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      html += '<div style="color:var(--text-muted);font-size:12px;">Signed up: ' + escapeHtml(signupFmt) + '</div>';
    } catch (e) { /* skip */ }
  }
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

  var templateMap = {
    'onboarding_survey': 'onboarding_survey',
    'reengagement': 'reengagement',
    'feature_announcement': 'feature_announcement',
    'access_key_delivery': 'default',
    'checkin': 'checkin_new',
    'subscription_info': 'subscription_info'
  };
  var templates = ['onboarding_survey', 'reengagement', 'feature_announcement', 'access_key_delivery', 'checkin', 'subscription_info'];
  templates.forEach(function(tmpl) {
    var composerTmpl = templateMap[tmpl] || tmpl;
    html += '<button onclick="adminOpenComposerForUser(\'' + escapeHtml(composerTmpl) + '\',\'' + escapeHtml(userEmail).replace(/'/g, "\\'") + '\',\'' + escapeHtml(userName).replace(/'/g, "\\'") + '\')" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:var(--text-xs);font-weight:500;transition:all 0.15s;">';
    html += escapeHtml(formatTemplateName(tmpl));
    html += '</button>';
  });
  html += '</div>';

  contentEl.innerHTML = html;
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

  var promises = targets.map(function(t) {
    return adminSendTemplateToUser(template, t.uid, t.email, t.name);
  });

  Promise.all(promises).then(function(results) {
    var sent = results.filter(function(r) { return r === true; }).length;
    var failed = results.length - sent;
    if (failed > 0) {
      showToast('Sent to ' + sent + ', Failed: ' + failed, 'warning');
    } else {
      showToast('Sent to ' + sent + ' users successfully', 'success');
    }
    // v30.3: Delay refresh so client-side email_log writes have time to commit
    setTimeout(function() { adminLoadEmailData(); }, 1500);
  }).catch(function(err) {
    showToast('Error sending emails: ' + err.message, 'error');
  });
}

function adminSendTemplateToUser(template, userId, userEmail, userName, metadata) {
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
    // v30.4: Direct Firestore write - no helper function, no admin check, raw SDK call
    try {
      var _db = firebase.firestore();
      var _logData = {
        userId: userId || '',
        userEmail: userEmail || '',
        template: template || '',
        subject: (data && data.subject) || template || '',
        sentAt: new Date().toISOString(),
        status: 'sent',
        sentBy: 'admin'
      };
      console.log('[email_log] DIRECT WRITE:', JSON.stringify(_logData));
      _db.collection('email_log').add(_logData).then(function(ref) {
        console.log('[email_log] SUCCESS - doc ID:', ref.id);
      }).catch(function(writeErr) {
        console.error('[email_log] FIRESTORE WRITE FAILED:', writeErr.code, writeErr.message);
      });
    } catch(logErr) {
      console.error('[email_log] EXCEPTION:', logErr.message);
    }
    return true;
  }).catch(function(err) {
    console.error('[Admin Emails] Send error:', err);
    showToast('Failed to send to ' + (userEmail || userId) + ': ' + err.message, 'error');
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
function adminRenderCampaigns() {
  var panel = document.getElementById('adminTabCampaigns');
  if (!panel) return;

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

  // v30.5: Template display names and descriptions
  var templateMeta = {
    'onboarding_survey': { name: 'Onboarding Survey', desc: 'New user experience feedback' },
    'reengagement': { name: 'Re-engagement', desc: 'Win back inactive users' },
    'feature_announcement': { name: 'Feature Announcement', desc: 'Announce new capabilities' },
    'checkin': { name: 'Check-in', desc: 'Ongoing satisfaction pulse' },
    'access_key_delivery': { name: 'Access Key Delivery', desc: 'Welcome and activation' },
    'subscription_info': { name: 'Subscription Info', desc: 'Plans, pricing, and API keys' }
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
  var sentTemplates = {};
  for (var si = 0; si < emailLogs.length; si++) {
    if (emailLogs[si].template) sentTemplates[emailLogs[si].template] = true;
  }
  var activeCampaigns = Object.keys(sentTemplates).length;

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

  // ---- Top Stats Bar ----
  html += '<div class="cmpn-stats-grid">';

  // Stat 1: New RoweOS Users (full width feel with +new this week)
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

  // Stat 2: Active Trials (placeholder - can connect to Stripe/access_keys later)
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:24px;">';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;margin-bottom:8px;">Active Trials</div>';
  html += '<div style="display:flex;align-items:baseline;gap:12px;">';
  html += '<div style="font-size:36px;font-weight:700;color:var(--text-primary);line-height:1;">' + totalUsers + '</div>';
  html += '<div style="font-size:13px;color:var(--accent, #a89878);font-weight:500;">100% trial</div>';
  html += '</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">0 active subscriptions</div>';
  html += '</div>';

  html += '</div>'; // stats grid

  // ---- Campaign Cards Section ----
  html += '<div style="margin-bottom:8px;">';
  html += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Campaigns</div>';
  html += '<div style="height:1px;background:var(--border-color);margin-bottom:16px;"></div>';
  html += '</div>';

  // Sort templates: known ones first in order, then unknowns
  var knownOrder = ['onboarding_survey', 'reengagement', 'feature_announcement', 'checkin', 'access_key_delivery', 'subscription_info'];
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

  // Table header row
  html += '<div style="display:flex;align-items:center;padding:8px 16px;font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;" class="cmpn-row-cols">';
  html += '<div style="flex:2;min-width:180px;">Campaign</div>';
  html += '<div style="width:90px;text-align:center;">Sends</div>';
  html += '<div style="width:90px;text-align:center;">Recipients</div>';
  html += '<div style="width:120px;text-align:center;">Response Rate</div>';
  html += '<div style="width:100px;text-align:right;">Last Sent</div>';
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

    // Last sent
    html += '<div style="width:100px;text-align:right;font-size:12px;color:var(--text-muted);">' + escapeHtml(lastSentText) + '</div>';

    html += '</div>'; // row

    // ---- Expandable detail panel ----
    html += '<div id="' + rowId + '" class="cmpn-detail" style="border-bottom:1px solid var(--border-color);background:var(--bg-secondary);">';
    html += '<div style="padding:20px 16px;">';

    // Two-column layout: timeline + response breakdown
    html += '<div style="display:flex;gap:24px;" class="cmpn-detail-cols">';

    // Left column: Send timeline
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Recent Sends</div>';

    // Show up to 8 recent sends
    var recentLogs = campaign.logs.slice(0, 8);
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

      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;';
      if (li < recentLogs.length - 1) html += 'border-bottom:1px solid var(--border-color);';
      html += '">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(sLog.userEmail || 'Unknown') + '</div>';
      if (sDate) {
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + escapeHtml(sDate) + '</div>';
      }
      html += '</div>';
      html += '<span class="cmpn-badge" style="background:' + sStatusBg + ';border:1px solid ' + sStatusBorder + ';color:' + sStatusColor + ';margin-left:8px;flex-shrink:0;">' + sStatusLabel + '</span>';
      html += '</div>';
    }
    if (campaign.logs.length > 8) {
      html += '<div style="font-size:11px;color:var(--text-muted);padding-top:8px;text-align:center;">and ' + (campaign.logs.length - 8) + ' more</div>';
    }
    if (recentLogs.length === 0) {
      html += '<div style="font-size:12px;color:var(--text-muted);">No sends recorded.</div>';
    }
    html += '</div>'; // left column

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
