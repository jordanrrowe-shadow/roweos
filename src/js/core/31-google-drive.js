// ═══════════════════════════════════════════════════════════════
// v28.7: GOOGLE DRIVE — SAVE & AUTO-SYNC
// Extends the Drive browser in 12-library.js with:
//   - Save to Google Drive (from save modal)
//   - Auto-sync Library to roweOS/ folder in Drive
//   - Settings UI for Drive sync preferences
//   - File format conversion (PDF, DOCX, TXT, HTML, Google Docs)
// ═══════════════════════════════════════════════════════════════

// New state vars (OAuth + browse vars are in 12-library.js)
var GDRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
var _gdriveAutoSync = false;
var _gdriveDefaultFormat = null; // 'pdf', 'docx', 'txt', 'html', 'gdoc'
var _gdriveSyncMap = {}; // { libraryFileId: { driveFileId, folderId, lastSynced } }
var _gdriveRoweOSFolderId = null;
var _gdriveBrandFolderIds = {}; // { brandIdx: folderId }

try {
  _gdriveAutoSync = localStorage.getItem('roweos_gdrive_autosync') === 'true';
  _gdriveDefaultFormat = localStorage.getItem('roweos_gdrive_default_format') || null;
  _gdriveSyncMap = JSON.parse(localStorage.getItem('roweos_gdrive_sync_map') || '{}');
  _gdriveRoweOSFolderId = localStorage.getItem('roweos_gdrive_root_folder_id') || null;
  _gdriveBrandFolderIds = JSON.parse(localStorage.getItem('roweos_gdrive_brand_folder_ids') || '{}');
} catch(e) {}

// ─── Settings UI ────────────────────────────────────────────────────────────

function updateDriveIntegrationUI() {
  var connBtn = document.getElementById('gdriveConnectBtn');
  var connStatus = document.getElementById('gdriveConnStatus');
  var autoSyncRow = document.getElementById('gdriveAutoSyncRow');
  var formatRow = document.getElementById('gdriveFormatRow');
  var syncStatusRow = document.getElementById('gdriveSyncStatusRow');
  var autoSyncToggle = document.getElementById('gdriveAutoSyncToggle');
  var formatDesc = document.getElementById('gdriveFormatDesc');
  var lastSync = document.getElementById('gdriveLastSync');

  if (!connBtn) return;

  if (_gdriveConnected) {
    connBtn.textContent = 'Disconnect';
    connBtn.setAttribute('onclick', 'disconnectGoogleDrive()');
    connBtn.classList.add('btn-secondary');
    if (connStatus) connStatus.textContent = 'Connected';
    if (autoSyncRow) autoSyncRow.style.display = '';
    if (autoSyncToggle) autoSyncToggle.checked = _gdriveAutoSync;

    if (_gdriveAutoSync) {
      if (formatRow) formatRow.style.display = '';
      if (syncStatusRow) syncStatusRow.style.display = '';
      if (formatDesc) {
        var formatLabels = { pdf: 'PDF', docx: 'DOCX', txt: 'Plain Text', html: 'HTML', gdoc: 'Google Docs' };
        formatDesc.textContent = formatLabels[_gdriveDefaultFormat] || 'Not set';
      }
      var lastSyncTime = localStorage.getItem('roweos_gdrive_last_sync');
      if (lastSync) {
        if (lastSyncTime) {
          var ago = Math.round((Date.now() - parseInt(lastSyncTime)) / 60000);
          lastSync.textContent = ago < 1 ? 'Just now' : ago + ' min ago';
        } else {
          lastSync.textContent = 'Never';
        }
      }
    } else {
      if (formatRow) formatRow.style.display = 'none';
      if (syncStatusRow) syncStatusRow.style.display = 'none';
    }
  } else {
    connBtn.textContent = 'Connect';
    connBtn.setAttribute('onclick', 'connectGoogleDrive()');
    connBtn.classList.remove('btn-secondary');
    if (connStatus) connStatus.textContent = 'Not connected';
    if (autoSyncRow) autoSyncRow.style.display = 'none';
    if (formatRow) formatRow.style.display = 'none';
    if (syncStatusRow) syncStatusRow.style.display = 'none';
  }
}

function toggleGDriveAutoSync(enabled) {
  if (enabled && !_gdriveDefaultFormat) {
    openGDriveFormatPicker(function(format) {
      if (format) {
        _gdriveAutoSync = true;
        _gdriveDefaultFormat = format;
        localStorage.setItem('roweos_gdrive_autosync', 'true');
        localStorage.setItem('roweos_gdrive_default_format', format);
        writeDB('profile/main', { gdriveAutoSync: true, gdriveDefaultFormat: format });
        updateDriveIntegrationUI();
        showToast('Auto-sync enabled', 'success');
      } else {
        var toggle = document.getElementById('gdriveAutoSyncToggle');
        if (toggle) toggle.checked = false;
      }
    });
    return;
  }

  _gdriveAutoSync = enabled;
  localStorage.setItem('roweos_gdrive_autosync', enabled ? 'true' : 'false');
  writeDB('profile/main', { gdriveAutoSync: enabled });
  updateDriveIntegrationUI();
  showToast(enabled ? 'Auto-sync enabled' : 'Auto-sync disabled', 'info');
}

// ─── Format Picker ──────────────────────────────────────────────────────────

function openGDriveFormatPicker(callback) {
  var formats = [
    { id: 'gdoc', label: 'Google Docs', desc: 'Native, editable in Drive' },
    { id: 'pdf', label: 'PDF', desc: 'Professional, read-only' },
    { id: 'docx', label: 'DOCX', desc: 'Microsoft Word compatible' },
    { id: 'txt', label: 'Plain Text', desc: 'Simple, universal' },
    { id: 'html', label: 'HTML', desc: 'Preserves all formatting' }
  ];

  var html = '<div class="save-library-title">Choose Default Format</div>';
  html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-4);">';
  for (var i = 0; i < formats.length; i++) {
    var f = formats[i];
    var selected = f.id === (_gdriveDefaultFormat || 'pdf') ? ' style="border-color:var(--accent);background:var(--accent-10);"' : '';
    html += '<div class="gdrive-format-option" data-format="' + f.id + '" onclick="selectGDriveFormat(this)" ' + selected + '>' +
      '<div style="font-weight:500;color:var(--text-primary);">' + f.label + '</div>' +
      '<div style="font-size:var(--text-sm);color:var(--text-muted);">' + f.desc + '</div></div>';
  }
  html += '</div>';
  html += '<div class="save-library-actions">';
  html += '<button class="btn btn-secondary" onclick="closeGDriveFormatPicker(false)">Cancel</button>';
  html += '<button class="btn" onclick="closeGDriveFormatPicker(true)">Confirm</button>';
  html += '</div>';

  var overlay = document.getElementById('gdriveFormatPickerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gdriveFormatPickerOverlay';
    overlay.className = 'save-library-modal';
    overlay.innerHTML = '<div class="save-library-dialog">' + html + '</div>';
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('.save-library-dialog').innerHTML = html;
  }
  overlay.classList.add('open');
  window._gdriveFormatPickerCallback = callback || null;
  window._gdriveSelectedFormat = _gdriveDefaultFormat || 'pdf';
}

function selectGDriveFormat(el) {
  var options = el.parentNode.querySelectorAll('.gdrive-format-option');
  for (var i = 0; i < options.length; i++) {
    options[i].style.borderColor = '';
    options[i].style.background = '';
  }
  el.style.borderColor = 'var(--accent)';
  el.style.background = 'var(--accent-10)';
  window._gdriveSelectedFormat = el.getAttribute('data-format');
}

function closeGDriveFormatPicker(confirmed) {
  var overlay = document.getElementById('gdriveFormatPickerOverlay');
  if (overlay) overlay.classList.remove('open');

  if (confirmed && window._gdriveSelectedFormat) {
    _gdriveDefaultFormat = window._gdriveSelectedFormat;
    localStorage.setItem('roweos_gdrive_default_format', _gdriveDefaultFormat);
    writeDB('profile/main', { gdriveDefaultFormat: _gdriveDefaultFormat });
    updateDriveIntegrationUI();
    if (window._gdriveFormatPickerCallback) {
      window._gdriveFormatPickerCallback(_gdriveDefaultFormat);
    }
  } else {
    if (window._gdriveFormatPickerCallback) {
      window._gdriveFormatPickerCallback(null);
    }
  }
  window._gdriveFormatPickerCallback = null;
  window._gdriveSelectedFormat = null;
}

// ─── API Helpers (upload/create, extending browse in 12-library.js) ─────────

function gdriveFetch(url, options, callback) {
  if (!_gdriveAccessToken) {
    if (callback) callback(null, 'Not connected to Google Drive');
    return;
  }
  var opts = options || {};
  if (!opts.headers) opts.headers = {};
  opts.headers['Authorization'] = 'Bearer ' + _gdriveAccessToken;

  fetch(url, opts)
    .then(function(resp) {
      if (resp.status === 401) {
        _gdriveConnected = false;
        localStorage.removeItem('roweos_gdrive_connected');
        if (callback) callback(null, 'Token expired');
        return null;
      }
      if (!resp.ok) {
        if (callback) callback(null, 'HTTP ' + resp.status);
        return null;
      }
      return resp.json();
    })
    .then(function(data) {
      if (data && callback) callback(data, null);
    })
    .catch(function(err) {
      console.warn('[GDrive] API error:', err.message);
      if (callback) callback(null, err.message);
    });
}

function ensureRoweOSDriveFolder(callback) {
  if (_gdriveRoweOSFolderId) {
    if (callback) callback(_gdriveRoweOSFolderId);
    return;
  }
  var query = "name='roweOS' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false";
  gdriveFetch(GDRIVE_API_BASE + '/files?q=' + encodeURIComponent(query) + '&fields=files(id,name)', {}, function(data, err) {
    if (err || !data) { if (callback) callback(null); return; }
    if (data.files && data.files.length > 0) {
      _gdriveRoweOSFolderId = data.files[0].id;
      localStorage.setItem('roweos_gdrive_root_folder_id', _gdriveRoweOSFolderId);
      if (callback) callback(_gdriveRoweOSFolderId);
    } else {
      gdriveCreateFolder('roweOS', 'root', function(folder) {
        if (folder && folder.id) {
          _gdriveRoweOSFolderId = folder.id;
          localStorage.setItem('roweos_gdrive_root_folder_id', _gdriveRoweOSFolderId);
        }
        if (callback) callback(_gdriveRoweOSFolderId);
      });
    }
  });
}

function gdriveCreateFolder(name, parentId, callback) {
  var metadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId && parentId !== 'root') {
    metadata.parents = [parentId];
  } else if (parentId === 'root') {
    metadata.parents = ['root'];
  }
  gdriveFetch(GDRIVE_API_BASE + '/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  }, function(data, err) {
    if (callback) callback(err ? null : data);
  });
}

function gdriveListFolders(parentId, callback) {
  var parent = parentId || 'root';
  var query = "mimeType='application/vnd.google-apps.folder' and '" + parent + "' in parents and trashed=false";
  gdriveFetch(GDRIVE_API_BASE + '/files?q=' + encodeURIComponent(query) + '&fields=files(id,name,parents)&orderBy=name', {}, function(data, err) {
    if (callback) callback(err ? [] : (data && data.files ? data.files : []));
  });
}

function gdriveUploadFile(fileName, content, mimeType, parentId, callback) {
  var metadata = { name: fileName };
  if (parentId) metadata.parents = [parentId];

  var boundary = 'roweos_boundary_' + Date.now();
  var body = '--' + boundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    '--' + boundary + '\r\n' +
    'Content-Type: ' + mimeType + '\r\n\r\n' +
    content + '\r\n' +
    '--' + boundary + '--';

  fetch(GDRIVE_UPLOAD_BASE + '/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + _gdriveAccessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: body
  })
  .then(function(resp) { if (!resp.ok) { if (callback) callback(null, 'HTTP ' + resp.status); return null; } return resp.json(); })
  .then(function(data) { if (data && callback) callback(data, null); })
  .catch(function(err) { if (callback) callback(null, err.message); });
}

function gdriveUploadBinaryFile(fileName, blob, mimeType, parentId, callback) {
  var metadata = { name: fileName };
  if (parentId) metadata.parents = [parentId];

  var form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  fetch(GDRIVE_UPLOAD_BASE + '/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken },
    body: form
  })
  .then(function(resp) { if (!resp.ok) { if (callback) callback(null, 'HTTP ' + resp.status); return null; } return resp.json(); })
  .then(function(data) { if (data && callback) callback(data, null); })
  .catch(function(err) { if (callback) callback(null, err.message); });
}

function gdriveDeleteFile(fileId, callback) {
  fetch(GDRIVE_API_BASE + '/files/' + fileId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken }
  })
  .then(function() { if (callback) callback(true); })
  .catch(function() { if (callback) callback(false); });
}

// ─── File Format Conversion ─────────────────────────────────────────────────

function gdriveConvertContent(htmlContent, format, fileName, callback) {
  if (format === 'txt') {
    var tmp = document.createElement('div');
    tmp.innerHTML = htmlContent;
    var text = tmp.textContent || tmp.innerText || '';
    callback({ content: text, mimeType: 'text/plain', extension: '.txt', isBinary: false });
  } else if (format === 'html') {
    var wrapped = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      escapeHtml(fileName) + '</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333;line-height:1.6;}</style></head><body>' +
      htmlContent + '</body></html>';
    callback({ content: wrapped, mimeType: 'text/html', extension: '.html', isBinary: false });
  } else if (format === 'pdf') {
    if (typeof roweosPDF === 'function') {
      try {
        roweosPDF(htmlContent, { returnBlob: true, callback: function(blob) {
          callback({ blob: blob, mimeType: 'application/pdf', extension: '.pdf', isBinary: true });
        }});
      } catch(e) {
        if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
          var doc = new jspdf.jsPDF();
          var tmp2 = document.createElement('div');
          tmp2.innerHTML = htmlContent;
          var text2 = tmp2.textContent || tmp2.innerText || '';
          var lines = doc.splitTextToSize(text2, 170);
          doc.text(lines, 20, 20);
          var blob2 = doc.output('blob');
          callback({ blob: blob2, mimeType: 'application/pdf', extension: '.pdf', isBinary: true });
        } else {
          showToast('PDF generation failed', 'error');
          callback(null);
        }
      }
    } else {
      showToast('PDF export not available', 'error');
      callback(null);
    }
  } else if (format === 'docx') {
    gdriveGenerateDocx(htmlContent, fileName, function(blob) {
      if (blob) {
        callback({ blob: blob, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: '.docx', isBinary: true });
      } else {
        showToast('DOCX generation failed', 'error');
        callback(null);
      }
    });
  } else if (format === 'gdoc') {
    callback({ content: htmlContent, mimeType: 'text/html', extension: '', isBinary: false, convertToGDoc: true });
  } else {
    callback(null);
  }
}

function gdriveGenerateDocx(htmlContent, fileName, callback) {
  var tmp = document.createElement('div');
  tmp.innerHTML = htmlContent;
  var text = tmp.textContent || tmp.innerText || '';
  var paragraphs = text.split('\n').filter(function(p) { return p.trim(); });

  var docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>';
  for (var i = 0; i < paragraphs.length; i++) {
    docXml += '<w:p><w:r><w:t>' + escapeHtml(paragraphs[i].trim()) + '</w:t></w:r></w:p>';
  }
  docXml += '</w:body></w:document>';

  var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  var wordRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  if (typeof JSZip !== 'undefined') {
    var zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', rels);
    zip.file('word/document.xml', docXml);
    zip.file('word/_rels/document.xml.rels', wordRels);
    zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .then(function(blob) { callback(blob); })
      .catch(function() { callback(null); });
  } else {
    // Fallback: HTML with .docx extension (Word can open it)
    var htmlDoc = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + htmlContent + '</body></html>';
    var blob = new Blob([htmlDoc], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    callback(blob);
  }
}

// ─── Save Modal Tab Logic ───────────────────────────────────────────────────

function switchSaveTab(tab) {
  var tabs = document.querySelectorAll('.save-modal-tab');
  var contents = document.querySelectorAll('.save-tab-content');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  for (var j = 0; j < contents.length; j++) {
    contents[j].classList.remove('active');
  }
  var activeTab = document.querySelector('.save-modal-tab[data-tab="' + tab + '"]');
  if (activeTab) activeTab.classList.add('active');

  if (tab === 'library') {
    document.getElementById('saveTabLibrary').classList.add('active');
  } else if (tab === 'folio') {
    document.getElementById('saveTabFolio').classList.add('active');
    var libName = document.getElementById('saveFileName').value;
    var folioInput = document.getElementById('saveFolioFileName');
    if (folioInput) folioInput.value = libName;
  } else if (tab === 'gdrive') {
    document.getElementById('saveTabGDrive').classList.add('active');
    var libName2 = document.getElementById('saveFileName').value;
    var driveInput = document.getElementById('saveGDriveFileName');
    if (driveInput) driveInput.value = libName2;
    if (_gdriveConnected && _gdriveAccessToken) {
      gdriveSaveBrowseFolder('root');
    }
  }
}

function confirmSaveToFolioFromModal() {
  var name = document.getElementById('saveFolioFileName').value.trim();
  if (!name) {
    showToast('Please enter a canvas name', 'error');
    return;
  }
  closeSaveLibraryModal();
  if (window.pendingSaveContent) {
    saveToFolio(window.pendingSaveContent, name);
  } else if (typeof studioSaveToFolio === 'function') {
    studioSaveToFolio();
  }
}

// ─── Save-Modal Folder Browser (separate from Library Drive browser) ────────

var _gdriveSaveBrowsePath = [{ id: 'root', name: 'My Drive' }];
var _gdriveSaveSelectedFolderId = 'root';

function gdriveSaveBrowseFolder(folderId) {
  var browser = document.getElementById('gdriveFolderBrowser');
  if (!browser) return;
  browser.innerHTML = '<div style="text-align:center;padding:var(--space-4);color:var(--text-muted);">Loading...</div>';

  if (folderId === 'root') {
    _gdriveSaveBrowsePath = [{ id: 'root', name: 'My Drive' }];
  }
  _gdriveSaveSelectedFolderId = folderId;
  renderGDriveSaveBreadcrumb();

  gdriveListFolders(folderId, function(folders) {
    if (!folders || folders.length === 0) {
      browser.innerHTML = '<div style="text-align:center;padding:var(--space-4);color:var(--text-muted);font-size:var(--text-sm);">No subfolders</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < folders.length; i++) {
      var f = folders[i];
      html += '<div class="gdrive-folder-item" data-id="' + f.id + '" data-name="' + escapeHtml(f.name) + '" onclick="gdriveSaveFolderClick(this)" ondblclick="gdriveSaveFolderDblClick(this)">' +
        '<svg class="gdrive-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' +
        '<span>' + escapeHtml(f.name) + '</span></div>';
    }
    browser.innerHTML = html;
  });
}

function gdriveSaveFolderClick(el) {
  var items = el.parentNode.querySelectorAll('.gdrive-folder-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('selected');
  }
  el.classList.add('selected');
  _gdriveSaveSelectedFolderId = el.getAttribute('data-id');
}

function gdriveSaveFolderDblClick(el) {
  var folderId = el.getAttribute('data-id');
  var folderName = el.getAttribute('data-name');
  _gdriveSaveBrowsePath.push({ id: folderId, name: folderName });
  _gdriveSaveSelectedFolderId = folderId;
  gdriveSaveBrowseFolder(folderId);
}

function renderGDriveSaveBreadcrumb() {
  var container = document.getElementById('gdriveSaveBreadcrumb');
  if (!container) return;
  var html = '';
  for (var i = 0; i < _gdriveSaveBrowsePath.length; i++) {
    if (i > 0) html += '<span class="gdrive-crumb-sep">/</span>';
    if (i < _gdriveSaveBrowsePath.length - 1) {
      html += '<span class="gdrive-crumb" onclick="gdriveSaveBrowseToIndex(' + i + ')">' + escapeHtml(_gdriveSaveBrowsePath[i].name) + '</span>';
    } else {
      html += '<span style="color:var(--text-primary);">' + escapeHtml(_gdriveSaveBrowsePath[i].name) + '</span>';
    }
  }
  container.innerHTML = html;
}

function gdriveSaveBrowseToIndex(idx) {
  _gdriveSaveBrowsePath = _gdriveSaveBrowsePath.slice(0, idx + 1);
  _gdriveSaveSelectedFolderId = _gdriveSaveBrowsePath[idx].id;
  gdriveSaveBrowseFolder(_gdriveSaveSelectedFolderId);
}

function gdriveCreateFolderInBrowser() {
  var folderName = prompt('New folder name:');
  if (!folderName || !folderName.trim()) return;
  gdriveCreateFolder(folderName.trim(), _gdriveSaveSelectedFolderId, function(folder) {
    if (folder && folder.id) {
      showToast('Folder created: ' + folderName, 'success');
      gdriveSaveBrowseFolder(_gdriveSaveSelectedFolderId);
    } else {
      showToast('Failed to create folder', 'error');
    }
  });
}

function selectGDriveSaveFmt(el) {
  var pills = el.parentNode.querySelectorAll('.gdrive-fmt-pill');
  for (var i = 0; i < pills.length; i++) {
    pills[i].classList.remove('active');
  }
  el.classList.add('active');
}

// ─── Save to Google Drive ───────────────────────────────────────────────────

function confirmSaveToGDrive() {
  var fileName = document.getElementById('saveGDriveFileName').value.trim();
  if (!fileName) {
    showToast('Please enter a file name', 'error');
    return;
  }

  var activePill = document.querySelector('.gdrive-fmt-pill.active');
  var format = activePill ? activePill.getAttribute('data-fmt') : 'pdf';

  var content = '';
  if (window.pendingSaveContent) {
    content = window.pendingSaveContent;
  } else {
    var outputContent = document.getElementById('studioOutputContent');
    var canvas = outputContent ? outputContent.querySelector('.output-canvas') : null;
    content = canvas ? canvas.innerHTML : (outputContent ? outputContent.innerHTML : '');
  }

  if (!content) {
    showToast('No content to save', 'error');
    return;
  }

  if (window.pendingSaveSource === 'imagelab' && window.pendingImageLabSave) {
    gdriveUploadImageToFolder(window.pendingImageLabSave.dataUrl, fileName, _gdriveSaveSelectedFolderId);
    closeSaveLibraryModal();
    return;
  }

  showToast('Saving to Google Drive...', 'info');

  gdriveConvertContent(content, format, fileName, function(result) {
    if (!result) return;
    var fullFileName = fileName + result.extension;

    if (result.convertToGDoc) {
      var metadata = { name: fileName, mimeType: 'application/vnd.google-apps.document', parents: [_gdriveSaveSelectedFolderId] };
      var boundary = 'roweos_boundary_' + Date.now();
      var body = '--' + boundary + '\r\n' +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) + '\r\n' +
        '--' + boundary + '\r\n' +
        'Content-Type: text/html\r\n\r\n' +
        result.content + '\r\n' +
        '--' + boundary + '--';

      fetch(GDRIVE_UPLOAD_BASE + '/files?uploadType=multipart&convert=true&fields=id,name,webViewLink', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: body
      })
      .then(function(resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
      .then(function(data) { showToast('Saved to Google Drive: ' + fileName, 'success'); })
      .catch(function() { showToast('Failed to save to Google Drive', 'error'); });
    } else if (result.isBinary && result.blob) {
      gdriveUploadBinaryFile(fullFileName, result.blob, result.mimeType, _gdriveSaveSelectedFolderId, function(data, err) {
        showToast(data && data.id ? 'Saved to Google Drive: ' + fullFileName : 'Failed to save to Google Drive', data && data.id ? 'success' : 'error');
      });
    } else {
      gdriveUploadFile(fullFileName, result.content, result.mimeType, _gdriveSaveSelectedFolderId, function(data, err) {
        showToast(data && data.id ? 'Saved to Google Drive: ' + fullFileName : 'Failed to save to Google Drive', data && data.id ? 'success' : 'error');
      });
    }
  });

  window.pendingSaveContent = null;
  window.pendingSaveSource = null;
  window.pendingSaveBrandIdx = null;
  window.pendingSaveOperation = null;
  window.pendingSaveMode = null;
  window.pendingSaveConversation = null;
  closeSaveLibraryModal();
}

function gdriveUploadImageToFolder(dataUrl, fileName, folderId) {
  var parts = dataUrl.split(',');
  var mime = parts[0].match(/:(.*?);/)[1];
  var bstr = atob(parts[1]);
  var n = bstr.length;
  var u8arr = new Uint8Array(n);
  for (var i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  var blob = new Blob([u8arr], { type: mime });
  var ext = mime === 'image/png' ? '.png' : '.jpg';

  gdriveUploadBinaryFile(fileName + ext, blob, mime, folderId, function(data, err) {
    showToast(data && data.id ? 'Image saved to Google Drive: ' + fileName : 'Failed to save image to Google Drive', data && data.id ? 'success' : 'error');
  });
}

// ─── Auto-Sync Library Saves to Drive ───────────────────────────────────────

function gdriveAutoSyncFile(file, brandIdx) {
  if (!_gdriveAutoSync || !_gdriveConnected || !_gdriveAccessToken || !_gdriveDefaultFormat) return;
  if (!file || !file.content) return;

  ensureRoweOSDriveFolder(function(rootId) {
    if (!rootId) return;

    var brandName = 'General';
    if (brandIdx !== 'life' && typeof brands !== 'undefined' && brands[brandIdx]) {
      brandName = brands[brandIdx].shortName || brands[brandIdx].name || 'Brand ' + brandIdx;
    } else if (brandIdx === 'life') {
      brandName = 'LifeAI';
    }

    ensureGDriveBrandFolder(rootId, brandName, brandIdx, function(brandFolderId) {
      if (!brandFolderId) return;
      ensureGDriveSubfolder(brandFolderId, 'Library', function(libraryFolderId) {
        if (!libraryFolderId) return;
        if (file.folderId && file.folderId !== 'root') {
          mirrorLibraryFolderPath(file.folderId, libraryFolderId, brandIdx, function(mirroredFolderId) {
            uploadFileToSync(file, _gdriveDefaultFormat, mirroredFolderId || libraryFolderId);
          });
        } else {
          uploadFileToSync(file, _gdriveDefaultFormat, libraryFolderId);
        }
      });
    });
  });
}

function ensureGDriveBrandFolder(parentId, brandName, brandIdx, callback) {
  if (_gdriveBrandFolderIds[brandIdx]) {
    callback(_gdriveBrandFolderIds[brandIdx]);
    return;
  }
  var safeName = brandName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var query = "name='" + safeName + "' and mimeType='application/vnd.google-apps.folder' and '" + parentId + "' in parents and trashed=false";
  gdriveFetch(GDRIVE_API_BASE + '/files?q=' + encodeURIComponent(query) + '&fields=files(id,name)', {}, function(data, err) {
    if (data && data.files && data.files.length > 0) {
      _gdriveBrandFolderIds[brandIdx] = data.files[0].id;
      localStorage.setItem('roweos_gdrive_brand_folder_ids', JSON.stringify(_gdriveBrandFolderIds));
      callback(data.files[0].id);
    } else {
      gdriveCreateFolder(brandName, parentId, function(folder) {
        if (folder && folder.id) {
          _gdriveBrandFolderIds[brandIdx] = folder.id;
          localStorage.setItem('roweos_gdrive_brand_folder_ids', JSON.stringify(_gdriveBrandFolderIds));
          callback(folder.id);
        } else {
          callback(null);
        }
      });
    }
  });
}

function ensureGDriveSubfolder(parentId, name, callback) {
  var safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var query = "name='" + safeName + "' and mimeType='application/vnd.google-apps.folder' and '" + parentId + "' in parents and trashed=false";
  gdriveFetch(GDRIVE_API_BASE + '/files?q=' + encodeURIComponent(query) + '&fields=files(id,name)', {}, function(data, err) {
    if (data && data.files && data.files.length > 0) {
      callback(data.files[0].id);
    } else {
      gdriveCreateFolder(name, parentId, function(folder) {
        callback(folder ? folder.id : null);
      });
    }
  });
}

function mirrorLibraryFolderPath(folderId, driveFolderId, brandIdx, callback) {
  var lib = null;
  if (brandIdx === 'life') {
    lib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : null;
  } else {
    lib = typeof getLibraryForBrandIndex === 'function' ? getLibraryForBrandIndex(brandIdx) : null;
  }
  if (!lib || !lib.folders) { callback(driveFolderId); return; }

  var folder = null;
  for (var fi = 0; fi < lib.folders.length; fi++) {
    if (lib.folders[fi].id === folderId) { folder = lib.folders[fi]; break; }
  }
  if (!folder) { callback(driveFolderId); return; }

  var path = [];
  var current = folder;
  while (current && current.id !== 'root') {
    path.unshift(current.name);
    var parentId = current.parentId;
    current = null;
    for (var pi = 0; pi < lib.folders.length; pi++) {
      if (lib.folders[pi].id === parentId) { current = lib.folders[pi]; break; }
    }
  }

  var parentDriveId = driveFolderId;
  var idx = 0;
  function createNext() {
    if (idx >= path.length) { callback(parentDriveId); return; }
    ensureGDriveSubfolder(parentDriveId, path[idx], function(newId) {
      if (!newId) { callback(parentDriveId); return; }
      parentDriveId = newId;
      idx++;
      createNext();
    });
  }
  createNext();
}

function uploadFileToSync(file, format, driveFolderId) {
  gdriveConvertContent(file.content, format, file.name, function(result) {
    if (!result) return;
    var fullFileName = file.name + result.extension;

    function onUploaded(data, err) {
      if (data && data.id) {
        _gdriveSyncMap[file.id] = { driveFileId: data.id, folderId: driveFolderId, lastSynced: Date.now() };
        localStorage.setItem('roweos_gdrive_sync_map', JSON.stringify(_gdriveSyncMap));
        localStorage.setItem('roweos_gdrive_last_sync', String(Date.now()));
        writeDB('profile/main', { gdriveSyncMap: _gdriveSyncMap, gdriveLastSync: Date.now() });
        if (localStorage.getItem('roweos_debug') === 'true') console.log('[GDrive] Auto-synced:', file.name);
      } else {
        console.warn('[GDrive] Auto-sync failed for:', file.name);
      }
    }

    if (result.convertToGDoc) {
      var metadata = { name: file.name, mimeType: 'application/vnd.google-apps.document', parents: [driveFolderId] };
      var boundary = 'roweos_boundary_' + Date.now();
      var body = '--' + boundary + '\r\n' +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) + '\r\n' +
        '--' + boundary + '\r\n' +
        'Content-Type: text/html\r\n\r\n' +
        result.content + '\r\n' +
        '--' + boundary + '--';
      fetch(GDRIVE_UPLOAD_BASE + '/files?uploadType=multipart&convert=true&fields=id,name', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: body
      }).then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function(d) { onUploaded(d, null); }).catch(function(e) { onUploaded(null, e); });
    } else if (result.isBinary && result.blob) {
      gdriveUploadBinaryFile(fullFileName, result.blob, result.mimeType, driveFolderId, onUploaded);
    } else {
      gdriveUploadFile(fullFileName, result.content, result.mimeType, driveFolderId, onUploaded);
    }
  });
}
