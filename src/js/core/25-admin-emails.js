// v30.1: Admin Email Management
// Client-side logic for the Emails tab in the Admin panel

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
    var projectId = 'roweos-app';
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
    var projectId = 'roweos-app';
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
    var projectId = 'roweos-app';
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
  var responsesP = db.collection('onboarding_responses').limit(500).get().catch(function(e) { console.warn('[Admin Emails] onboarding_responses query failed:', e.message); return null; });

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
    if (emailLogSnap && emailLogSnap.docs) {
      emailLogSnap.docs.forEach(function(doc) {
        var d = doc.data();
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
          userId: d.userId || '',
          userEmail: d.userEmail || d.email || '',
          question: d.question || d.field || '',
          answer: d.answer || d.value || d.response || '',
          template: d.template || d.source || '',
          timestamp: d.timestamp || d.createdAt || d.submittedAt || ''
        });
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

  // Sort users by signup date desc
  users.sort(function(a, b) {
    var ta = a.signupDate ? new Date(a.signupDate).getTime() : 0;
    var tb = b.signupDate ? new Date(b.signupDate).getTime() : 0;
    return tb - ta;
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
  // Header row
  html += '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">';
  html += '<div style="width:30px;flex-shrink:0;"><input type="checkbox" id="adminEmailSelectAll" onchange="adminToggleAllEmailUsers(this.checked)" style="accent-color:var(--accent);"></div>';
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
    html += '<input type="checkbox" class="admin-email-user-cb" data-uid="' + escapeHtml(u.uid) + '" data-email="' + escapeHtml(u.email) + '" data-name="' + escapeHtml(u.name) + '" style="accent-color:var(--accent);">';
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
    'checkin': 'checkin_new'
  };
  var templates = ['onboarding_survey', 'reengagement', 'feature_announcement', 'access_key_delivery', 'checkin'];
  templates.forEach(function(tmpl) {
    var composerTmpl = templateMap[tmpl] || tmpl;
    html += '<button onclick="adminOpenComposerForUser(\'' + escapeHtml(composerTmpl) + '\',\'' + escapeHtml(userEmail).replace(/'/g, "\\'") + '\')" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:var(--text-xs);font-weight:500;transition:all 0.15s;">';
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
function adminOpenComposerForUser(templateName, recipientEmail) {
  // Set a dummy key so openEmailComposer doesn't complain
  window._composerKey = window._composerKey || 'ROWE-XXXX-XXXX';
  window._composerTier = window._composerTier || 'founder';
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

  showToast('Sending ' + template + ' to ' + targets.length + ' user(s)...', 'info');

  var promises = targets.map(function(t) {
    return adminSendTemplateToUser(template, t.uid, t.email, t.name);
  });

  Promise.all(promises).then(function(results) {
    var sent = results.filter(function(r) { return r === true; }).length;
    var failed = results.length - sent;
    if (failed > 0) {
      showToast('Sent: ' + sent + ', Failed: ' + failed, 'warning');
    } else {
      showToast('Successfully sent to ' + sent + ' user(s)', 'success');
    }
    // Refresh data
    adminLoadEmailData();
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
  }).then(function() {
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
