// v31.0: Admin Campaigns/Responses dashboard
// Aggregates email_log + collectionGroup('responses') + info_leads into a unified view

(function() {

  var _campaignsCache = null;

  window.adminLoadCampaigns = function() {
    if (typeof isAdmin === 'function' && !isAdmin()) return;
    if (typeof firebase === 'undefined' || !firebase) return;

    var statsEl = document.getElementById('campaignsStats');
    var contentEl = document.getElementById('campaignsContent');
    if (!statsEl || !contentEl) return;

    contentEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:13px">Loading…</div>';

    var db = firebase.firestore();
    var emailLogP = db.collection('email_log').limit(500).get().catch(function() { return null; });
    var responsesP = db.collectionGroup('responses').limit(1000).get().catch(function() { return null; });
    var leadsP = db.collection('info_leads').limit(500).get().catch(function() { return null; });

    Promise.all([emailLogP, responsesP, leadsP]).then(function(results) {
      var emailSnap = results[0];
      var responseSnap = results[1];
      var leadsSnap = results[2];

      var emails = [];
      if (emailSnap && emailSnap.docs) {
        emailSnap.docs.forEach(function(doc) {
          var d = doc.data();
          emails.push({
            id: doc.id,
            userEmail: d.userEmail || d.email || '',
            template: d.template || '',
            subject: d.subject || '',
            sentAt: d.sentAt || d.createdAt || '',
            status: d.status || 'sent'
          });
        });
      }

      var responses = [];
      if (responseSnap && responseSnap.docs) {
        responseSnap.docs.forEach(function(doc) {
          var d = doc.data();
          responses.push({
            userId: doc.ref.parent.parent ? doc.ref.parent.parent.id : '',
            question: d.question || d.field || '',
            answer: d.answer || d.value || d.response || '',
            template: d.email_template || d.template || d.source || '',
            timestamp: d.timestamp || d.createdAt || ''
          });
        });
      }

      var leads = [];
      if (leadsSnap && leadsSnap.docs) {
        leadsSnap.docs.forEach(function(doc) {
          var d = doc.data();
          leads.push({
            id: doc.id,
            email: d.email || '',
            name: d.name || '',
            utmSource: d.utmSource || '',
            utmCampaign: d.utmCampaign || '',
            referrer: d.referrer || '',
            createdAt: d.createdAt || '',
            status: d.status || 'new'
          });
        });
      }

      _campaignsCache = { emails: emails, responses: responses, leads: leads };
      _renderCampaignStats(emails, responses, leads);
      _populateTemplateFilter(emails, responses);

      var filter = (document.getElementById('campaignsTemplateFilter') || {}).value || '';
      _renderCampaignContent(emails, responses, leads, filter);
    });
  };

  function _renderCampaignStats(emails, responses, leads) {
    var statsEl = document.getElementById('campaignsStats');
    if (!statsEl) return;
    var responseRate = emails.length > 0
      ? Math.round((responses.length / emails.length) * 100)
      : 0;
    statsEl.innerHTML = ''
      + _statCard('Emails Sent', emails.length)
      + _statCard('Responses', responses.length)
      + _statCard('Response Rate', responseRate + '%')
      + _statCard('Info Leads', leads.length);
  }

  function _statCard(label, value) {
    return '<div style="padding:12px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px">'
      + '<div style="font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">' + escapeHtml(label) + '</div>'
      + '<div style="font-size:22px;color:var(--accent);font-weight:300">' + escapeHtml(String(value)) + '</div>'
      + '</div>';
  }

  function _populateTemplateFilter(emails, responses) {
    var sel = document.getElementById('campaignsTemplateFilter');
    if (!sel) return;
    var existing = sel.value;
    var templates = {};
    emails.forEach(function(e) { if (e.template) templates[e.template] = true; });
    responses.forEach(function(r) { if (r.template) templates[r.template] = true; });
    var opts = ['<option value="">All templates</option>'];
    Object.keys(templates).sort().forEach(function(t) {
      opts.push('<option value="' + escapeHtml(t) + '"' + (t === existing ? ' selected' : '') + '>' + escapeHtml(t) + '</option>');
    });
    sel.innerHTML = opts.join('');
  }

  function _renderCampaignContent(emails, responses, leads, filter) {
    var contentEl = document.getElementById('campaignsContent');
    if (!contentEl) return;

    var filteredEmails = filter ? emails.filter(function(e) { return e.template === filter; }) : emails;
    var filteredResponses = filter ? responses.filter(function(r) { return r.template === filter; }) : responses;

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0">';

    // Left: recent emails
    html += '<div style="border-right:1px solid var(--border)">';
    html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border)">Recent Emails (' + filteredEmails.length + ')</div>';
    html += '<div style="max-height:480px;overflow:auto">';
    filteredEmails.slice(0, 100).forEach(function(e) {
      html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:13px;color:var(--text)">' + escapeHtml(e.subject || '(no subject)') + '</div>'
        + '<div style="font-size:11px;color:var(--text-2);margin-top:2px">' + escapeHtml(e.userEmail) + ' \u00b7 ' + escapeHtml(e.template) + ' \u00b7 ' + _fmtDate(e.sentAt) + '</div>'
        + '</div>';
    });
    if (filteredEmails.length === 0) html += '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:12px">No emails</div>';
    html += '</div></div>';

    // Right: responses
    html += '<div>';
    html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border)">Responses (' + filteredResponses.length + ')</div>';
    html += '<div style="max-height:480px;overflow:auto">';
    filteredResponses.slice(0, 100).forEach(function(r) {
      html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:13px;color:var(--text)"><strong>Q:</strong> ' + escapeHtml(r.question) + '</div>'
        + '<div style="font-size:13px;color:var(--accent);margin-top:4px"><strong>A:</strong> ' + escapeHtml(r.answer) + '</div>'
        + '<div style="font-size:11px;color:var(--text-2);margin-top:4px">' + escapeHtml(r.userId) + ' \u00b7 ' + escapeHtml(r.template) + ' \u00b7 ' + _fmtDate(r.timestamp) + '</div>'
        + '</div>';
    });
    if (filteredResponses.length === 0) html += '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:12px">No responses</div>';
    html += '</div></div>';

    html += '</div>';

    // Bottom: info leads
    html += '<div style="border-top:1px solid var(--border)">';
    html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border)">Info Page Leads (' + leads.length + ')</div>';
    html += '<div style="max-height:300px;overflow:auto">';
    leads.forEach(function(l) {
      html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px">'
        + '<div><div style="font-size:13px;color:var(--text)">' + escapeHtml(l.name || '(no name)') + ' &lt;' + escapeHtml(l.email) + '&gt;</div>'
        + '<div style="font-size:11px;color:var(--text-2);margin-top:2px">' + escapeHtml(l.utmSource || 'direct') + ' \u00b7 ' + escapeHtml(l.utmCampaign || '') + ' \u00b7 ' + escapeHtml(l.referrer || '') + '</div></div>'
        + '<div style="font-size:11px;color:var(--text-2);align-self:center">' + _fmtDate(l.createdAt) + '</div>'
        + '</div>';
    });
    if (leads.length === 0) html += '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:12px">No leads yet</div>';
    html += '</div></div>';

    contentEl.innerHTML = html;
  }

  function _fmtDate(s) {
    if (!s) return '';
    try {
      var d = new Date(s);
      return d.toLocaleString();
    } catch (e) { return String(s); }
  }

  window.adminExportCampaignsCSV = function() {
    if (!_campaignsCache) { adminLoadCampaigns(); return; }
    var rows = [['type','timestamp','email','name','template','question','answer','utm_source','utm_campaign']];
    _campaignsCache.emails.forEach(function(e) {
      rows.push(['email_sent', e.sentAt, e.userEmail, '', e.template, e.subject, '', '', '']);
    });
    _campaignsCache.responses.forEach(function(r) {
      rows.push(['response', r.timestamp, '', '', r.template, r.question, r.answer, '', '']);
    });
    _campaignsCache.leads.forEach(function(l) {
      rows.push(['lead', l.createdAt, l.email, l.name, '', '', '', l.utmSource, l.utmCampaign]);
    });
    var csv = rows.map(function(r) {
      return r.map(function(c) {
        var s = String(c == null ? '' : c).replace(/"/g, '""');
        return '"' + s + '"';
      }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'roweos-campaigns-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

})();
