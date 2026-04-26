// v31.3: Admin > Sites tab — Vercel web analytics across multiple owned websites.
// Each saved site stores { name, projectId, teamId } in Firestore (admin_sites collection).
// Switching sites updates a global selector and re-fetches analytics for that Vercel project.

var _adminSites = [];
var _adminSelectedSiteId = null;
var _adminSitesLoaded = false;
var _adminSiteAnalytics = null;
var _adminSiteAnalyticsDays = 30;

function adminLoadSites() {
  if (!isAdmin() || !firebase) return Promise.resolve([]);
  return firebase.firestore().collection('admin_sites').get().then(function(snap) {
    _adminSites = [];
    snap.docs.forEach(function(doc) {
      var d = doc.data() || {};
      _adminSites.push({
        id: doc.id,
        name: d.name || doc.id,
        projectId: d.projectId || '',
        teamId: d.teamId || '',
        url: d.url || '',
        createdAt: d.createdAt || ''
      });
    });
    _adminSitesLoaded = true;
    if (!_adminSelectedSiteId && _adminSites.length > 0) {
      _adminSelectedSiteId = localStorage.getItem('roweos_admin_selected_site') || _adminSites[0].id;
    }
    return _adminSites;
  });
}

function adminRenderSites() {
  var panel = document.getElementById('adminTabSites');
  if (!panel) return;

  if (!_adminSitesLoaded) {
    panel.innerHTML = '<div style="color:var(--text-muted);padding:40px 0;text-align:center;font-size:13px;">Loading sites...</div>';
    adminLoadSites().then(function() { adminRenderSites(); });
    return;
  }

  var html = '';
  // v31.3: Mobile-friendly header — controls collapse to a single column under 640px
  html += '<style>'
    + '@media (max-width: 640px){'
    + '  #adminTabSites .sites-hdr{flex-direction:column;align-items:stretch !important;}'
    + '  #adminTabSites .sites-hdr-controls{flex-wrap:wrap;width:100%;}'
    + '  #adminTabSites .sites-hdr-controls > select,'
    + '  #adminTabSites .sites-hdr-controls > button{flex:1 1 calc(50% - 4px);min-width:0 !important;font-size:12.5px !important;padding:9px 10px !important;}'
    + '  #adminTabSites .sites-hdr-controls > #adminSiteSelect{flex-basis:100%;}'
    + '  #adminTabSites .sites-meta-row{flex-direction:column;align-items:flex-start !important;}'
    + '  #adminTabSites .sites-meta-row > div:last-child{width:100%;justify-content:flex-end;}'
    + '}'
    + '</style>';
  html += '<div class="sites-hdr" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;flex-wrap:wrap;">';
  html += '<div>';
  html += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Website Analytics</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);">Live Vercel Web Analytics across every site you own.</div>';
  html += '</div>';
  html += '<div class="sites-hdr-controls" style="display:flex;gap:8px;align-items:center;">';
  // Site picker
  if (_adminSites.length > 0) {
    html += '<select id="adminSiteSelect" onchange="adminSelectSite(this.value)" style="padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;min-width:200px;">';
    _adminSites.forEach(function(s) {
      var sel = s.id === _adminSelectedSiteId ? ' selected' : '';
      html += '<option value="' + escapeHtml(s.id) + '"' + sel + '>' + escapeHtml(s.name) + '</option>';
    });
    html += '</select>';
  }
  // Range picker
  html += '<select id="adminSiteRange" onchange="adminLoadSiteAnalytics()" style="padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;">';
  [7, 14, 30, 60, 90].forEach(function(d) {
    var sel = d === _adminSiteAnalyticsDays ? ' selected' : '';
    html += '<option value="' + d + '"' + sel + '>' + d + ' days</option>';
  });
  html += '</select>';
  html += '<button onclick="adminLoadSiteAnalytics()" title="Refresh" style="padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-secondary);cursor:pointer;font-size:13px;">Refresh</button>';
  html += '<button onclick="adminOpenSiteForm()" style="padding:8px 14px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;font-size:13px;">Add Site</button>';
  html += '</div>';
  html += '</div>';

  if (_adminSites.length === 0) {
    html += '<div style="padding:48px 24px;text-align:center;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;">';
    html += '<div style="font-size:14px;color:var(--text-primary);font-weight:600;margin-bottom:8px;">No sites configured yet.</div>';
    html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:18px;">Add a Vercel project to see its live web analytics here.</div>';
    html += '<button onclick="adminOpenSiteForm()" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">Add your first site</button>';
    html += '</div>';
    panel.innerHTML = html;
    return;
  }

  // Site detail card (selected site)
  var sel = _adminSites.filter(function(s) { return s.id === _adminSelectedSiteId; })[0] || _adminSites[0];
  if (sel) {
    html += '<div class="sites-meta-row" style="padding:16px 18px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">';
    html += '<div>';
    html += '<div style="font-size:13px;color:var(--text-primary);font-weight:600;">' + escapeHtml(sel.name) + '</div>';
    if (sel.url) {
      html += '<a href="' + escapeHtml(sel.url) + '" target="_blank" style="font-size:12px;color:var(--accent, #a89878);text-decoration:none;">' + escapeHtml(sel.url) + ' &rarr;</a>';
    }
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Project: ' + escapeHtml(sel.projectId) + (sel.teamId ? ' · Team: ' + escapeHtml(sel.teamId) : '') + '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;">';
    html += '<button onclick="adminEditSite(\'' + escapeHtml(sel.id) + '\')" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-secondary);cursor:pointer;font-size:11.5px;">Edit</button>';
    html += '<button onclick="adminDeleteSite(\'' + escapeHtml(sel.id) + '\')" style="padding:6px 12px;background:transparent;border:1px solid rgba(248,113,113,0.4);border-radius:6px;color:#f87171;cursor:pointer;font-size:11.5px;">Delete</button>';
    html += '</div>';
    html += '</div>';
  }

  // Analytics body container — gets filled by adminLoadSiteAnalytics
  html += '<div id="adminSiteAnalyticsBody"><div style="color:var(--text-muted);padding:40px 0;text-align:center;font-size:13px;">Loading analytics...</div></div>';

  panel.innerHTML = html;

  // Kick off analytics load
  adminLoadSiteAnalytics();
}

function adminSelectSite(siteId) {
  _adminSelectedSiteId = siteId;
  try { localStorage.setItem('roweos_admin_selected_site', siteId); } catch (e) {}
  adminRenderSites();
}

function adminLoadSiteAnalytics() {
  var rangeEl = document.getElementById('adminSiteRange');
  if (rangeEl) _adminSiteAnalyticsDays = parseInt(rangeEl.value, 10) || 30;

  var body = document.getElementById('adminSiteAnalyticsBody');
  if (!body) return;
  var sel = _adminSites.filter(function(s) { return s.id === _adminSelectedSiteId; })[0] || _adminSites[0];
  if (!sel || !sel.projectId) {
    body.innerHTML = '<div style="color:var(--text-muted);padding:40px 0;text-align:center;font-size:13px;">Select or add a site to view analytics.</div>';
    return;
  }
  body.innerHTML = '<div style="color:var(--text-muted);padding:40px 0;text-align:center;font-size:13px;">Loading analytics for ' + escapeHtml(sel.name) + '...</div>';

  var qs = 'days=' + _adminSiteAnalyticsDays + '&projectId=' + encodeURIComponent(sel.projectId);
  if (sel.teamId) qs += '&teamId=' + encodeURIComponent(sel.teamId);
  fetch('/api/analytics?' + qs)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        body.innerHTML = '<div style="padding:24px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);border-radius:10px;color:#f87171;font-size:13px;">'
          + escapeHtml(data.error) + (data.detail ? '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">' + escapeHtml(String(data.detail).substring(0, 300)) + '</div>' : '') + '</div>';
        return;
      }
      _adminSiteAnalytics = data;
      adminRenderSiteAnalytics(data, _adminSiteAnalyticsDays);
    })
    .catch(function(err) {
      body.innerHTML = '<div style="color:#f87171;padding:24px;font-size:13px;">Failed to load: ' + escapeHtml(err.message) + '</div>';
    });
}

function adminRenderSiteAnalytics(data, days) {
  var body = document.getElementById('adminSiteAnalyticsBody');
  if (!body) return;

  // Parse Vercel timeseries (matches loadWebAnalytics structure)
  var totalVisitors = 0, totalPageViews = 0, avgBounceRate = 0;
  var dailyData = [];
  var ts = data.timeseries || null;
  if (ts && ts.error) {
    body.innerHTML = '<div style="padding:24px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);border-radius:10px;color:#f87171;font-size:13px;">Vercel Web Analytics not available for this project. Make sure analytics is enabled in the Vercel project settings.</div>';
    return;
  }
  if (ts && ts.data && ts.data.groups && ts.data.groups.all) {
    var hourlyData = ts.data.groups.all;
    var dayMap = {};
    var bounceCount = 0, bounceEntries = 0;
    hourlyData.forEach(function(h) {
      var dayKey = (h.key || '').split('T')[0];
      if (!dayKey) return;
      if (!dayMap[dayKey]) dayMap[dayKey] = { views: 0, visitors: 0 };
      dayMap[dayKey].views += (h.total || 0);
      dayMap[dayKey].visitors += (h.devices || 0);
      totalPageViews += (h.total || 0);
      totalVisitors += (h.devices || 0);
      if (h.bounceRate > 0) { bounceCount += h.bounceRate; bounceEntries++; }
    });
    avgBounceRate = bounceEntries > 0 ? Math.round(bounceCount / bounceEntries) : 0;
    Object.keys(dayMap).sort().forEach(function(dk) {
      dailyData.push({ date: dk, views: dayMap[dk].views, visitors: dayMap[dk].visitors });
    });
  }
  var viewsPerVisitor = totalVisitors > 0 ? (totalPageViews / totalVisitors).toFixed(1) : '0';

  var html = '';
  // Stats grid
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px;">';
  html += _adminSiteStat('Unique Visitors', totalVisitors, days + ' day total', '#4ade80');
  html += _adminSiteStat('Page Views', totalPageViews, days + ' day total', '#60a5fa');
  html += _adminSiteStat('Views / Visitor', viewsPerVisitor, 'average', '#a78bfa');
  html += _adminSiteStat('Bounce Rate', avgBounceRate + '%', 'average', '#fbbf24');
  html += '</div>';

  // Daily chart
  if (dailyData.length > 0) {
    html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:18px;margin-bottom:16px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:14px;">Daily Traffic</div>';
    var maxViews = 1;
    dailyData.forEach(function(d) { if (d.views > maxViews) maxViews = d.views; });
    html += '<div style="display:flex;align-items:flex-end;gap:2px;height:120px;padding-bottom:24px;position:relative;">';
    dailyData.forEach(function(d) {
      var pct = Math.max(2, Math.round((d.views / maxViews) * 100));
      var dateLabel = d.date.split('-').slice(1).join('/');
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">';
      html += '<div style="font-size:9px;color:var(--text-muted);">' + d.views + '</div>';
      html += '<div style="width:100%;max-width:32px;height:' + pct + '%;background:var(--accent, #a89878);border-radius:3px 3px 0 0;min-height:2px;"></div>';
      html += '<div style="font-size:9px;color:var(--text-muted);position:absolute;bottom:0;transform:rotate(-45deg);white-space:nowrap;">' + dateLabel + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    // Daily breakdown table
    html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:18px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Daily Breakdown</div>';
    dailyData.slice().reverse().forEach(function(d) {
      var barPct = Math.round((d.views / maxViews) * 100);
      html += '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--border-color);">';
      html += '<div style="width:90px;font-size:12px;color:var(--text-muted);">' + d.date + '</div>';
      html += '<div style="flex:1;height:5px;border-radius:3px;background:var(--bg-tertiary);overflow:hidden;"><div style="height:100%;width:' + barPct + '%;background:var(--accent, #a89878);border-radius:3px;"></div></div>';
      html += '<div style="width:70px;text-align:right;font-size:12px;font-weight:600;color:var(--text-secondary);">' + d.views + ' / ' + d.visitors + '</div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="color:var(--text-muted);padding:40px 0;text-align:center;font-size:13px;">No traffic in the selected window.</div>';
  }

  body.innerHTML = html;
}

function _adminSiteStat(label, value, sub, color) {
  return '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:18px;">'
    + '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:6px;">' + escapeHtml(label) + '</div>'
    + '<div style="font-size:30px;font-weight:700;line-height:1;color:' + color + ';">' + value + '</div>'
    + '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">' + escapeHtml(sub) + '</div>'
    + '</div>';
}

// ─── Add / Edit / Delete site ─────────────────────────────────────────

function adminOpenSiteForm(existing) {
  var isEdit = existing && existing.id;
  var modal = document.createElement('div');
  modal.id = 'adminSiteFormModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100020;display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = '<div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:24px;max-width:480px;width:100%;color:var(--text-primary);">'
    + '<div style="font-size:15px;font-weight:600;margin-bottom:4px;">' + (isEdit ? 'Edit Site' : 'Add a Site') + '</div>'
    + '<div style="font-size:12px;color:var(--text-muted);margin-bottom:18px;">Find the Vercel Project ID at vercel.com/your-team/your-project/settings.</div>'
    + '<div style="display:flex;flex-direction:column;gap:12px;">'
    + '<label style="font-size:11.5px;color:var(--text-muted);">Display name<br><input id="adminSiteFormName" type="text" value="' + escapeHtml((existing && existing.name) || '') + '" placeholder="RoweOS" style="width:100%;margin-top:4px;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;"></label>'
    + '<label style="font-size:11.5px;color:var(--text-muted);">URL (optional)<br><input id="adminSiteFormUrl" type="text" value="' + escapeHtml((existing && existing.url) || '') + '" placeholder="https://roweos.com" style="width:100%;margin-top:4px;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;"></label>'
    + '<label style="font-size:11.5px;color:var(--text-muted);">Vercel Project ID<br><input id="adminSiteFormProjectId" type="text" value="' + escapeHtml((existing && existing.projectId) || '') + '" placeholder="prj_xxxxxxxxxxxx" style="width:100%;margin-top:4px;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;font-family:monospace;"></label>'
    + '<label style="font-size:11.5px;color:var(--text-muted);">Vercel Team ID (if project is in a team)<br><input id="adminSiteFormTeamId" type="text" value="' + escapeHtml((existing && existing.teamId) || '') + '" placeholder="team_xxxxxxxxxxxx" style="width:100%;margin-top:4px;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;font-family:monospace;"></label>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">'
    + '<button onclick="adminCloseSiteForm()" style="padding:8px 16px;background:transparent;border:1px solid var(--border-color);border-radius:6px;color:var(--text-secondary);cursor:pointer;font-size:13px;">Cancel</button>'
    + '<button onclick="adminSaveSite(' + (isEdit ? "'" + existing.id + "'" : 'null') + ')" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">' + (isEdit ? 'Save' : 'Add Site') + '</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
}

function adminCloseSiteForm() {
  var m = document.getElementById('adminSiteFormModal');
  if (m && m.parentNode) m.parentNode.removeChild(m);
}

function adminEditSite(siteId) {
  var s = _adminSites.filter(function(s) { return s.id === siteId; })[0];
  if (s) adminOpenSiteForm(s);
}

function adminSaveSite(existingId) {
  var name = (document.getElementById('adminSiteFormName').value || '').trim();
  var url = (document.getElementById('adminSiteFormUrl').value || '').trim();
  var projectId = (document.getElementById('adminSiteFormProjectId').value || '').trim();
  var teamId = (document.getElementById('adminSiteFormTeamId').value || '').trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  if (!projectId) { showToast('Vercel Project ID is required', 'error'); return; }

  var db = firebase.firestore();
  var data = {
    name: name,
    url: url,
    projectId: projectId,
    teamId: teamId,
    createdAt: existingId ? undefined : new Date().toISOString()
  };
  // Strip undefined
  Object.keys(data).forEach(function(k) { if (data[k] === undefined) delete data[k]; });

  var p = existingId
    ? db.collection('admin_sites').doc(existingId).set(data, { merge: true })
    : db.collection('admin_sites').add(data);

  p.then(function(ref) {
    showToast(existingId ? 'Site updated' : 'Site added', 'success');
    adminCloseSiteForm();
    if (!existingId && ref && ref.id) _adminSelectedSiteId = ref.id;
    _adminSitesLoaded = false;
    adminRenderSites();
  }).catch(function(err) {
    showToast('Save failed: ' + err.message, 'error');
  });
}

function adminDeleteSite(siteId) {
  if (!confirm('Delete this site? Analytics history stays in Vercel; only the saved configuration is removed.')) return;
  firebase.firestore().collection('admin_sites').doc(siteId).delete().then(function() {
    showToast('Site removed', 'success');
    if (_adminSelectedSiteId === siteId) _adminSelectedSiteId = null;
    _adminSitesLoaded = false;
    adminRenderSites();
  }).catch(function(err) {
    showToast('Delete failed: ' + err.message, 'error');
  });
}
