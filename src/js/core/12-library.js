// ═══════════════════════════════════════════════════════════════
// FILE LIBRARY SYSTEM
// ═══════════════════════════════════════════════════════════════

var fileLibrary = {};
var selectedLibraryItem = null;
var contextMenuItem = null;
var draggedItem = null;

// Initialize library from localStorage
function initLibrary() {
  var saved = localStorage.getItem('roweosLibrary');
  if (saved) {
    try {
      var parsedLib = JSON.parse(saved);
      // v15.7: Merge cloud data with existing - don't overwrite non-empty library
      if (Object.keys(fileLibrary).length === 0 || Object.keys(parsedLib).length > 0) {
        fileLibrary = parsedLib;
      }
    } catch(e) {
      if (Object.keys(fileLibrary).length === 0) fileLibrary = {};
    }
  }
  // Ensure each brand has a root structure (only create if truly empty)
  brands.forEach(function(brand) {
    var key = brand.name; // Use brand name as key since brands don't have id
    if (!fileLibrary[key] || (!fileLibrary[key].files && !fileLibrary[key].folders)) {
      fileLibrary[key] = {
        folders: [
          { id: 'root', name: 'Root', parentId: null, children: [] }
        ],
        files: fileLibrary[key] && fileLibrary[key].files ? fileLibrary[key].files : []
      };
    }
  });

  // v31.8: ONE-TIME MIGRATION — recover legacy `roweos_brand_library_<idx>` per-brand
  // localStorage keys into the canonical `fileLibrary` global, then push to Firebase.
  // Pre-v31.7, saveBrandLibrary() wrote ONLY to that legacy per-brand key — never to
  // fileLibrary, never to roweosLibrary, never to Firestore. So uploads + folders made
  // via that path existed only on the device that created them. This loop salvages any
  // legacy data still cached locally and promotes it to the canonical, synced store.
  // Files are merged by id (legacy wins for ids the canonical doesn't have, never overwrites).
  // Folders are merged by id with the same rule.
  try {
    if (localStorage.getItem('roweos_brand_library_migration_v31_8') !== 'done') {
      var migrationCount = 0;
      brands.forEach(function(brand, brandIdx) {
        try {
          var legacyRaw = localStorage.getItem('roweos_brand_library_' + brandIdx);
          if (!legacyRaw) return;
          var legacy = JSON.parse(legacyRaw);
          if (!legacy || (!legacy.files && !legacy.folders)) return;
          var brandKey = brand.name;
          var canonical = fileLibrary[brandKey] || { folders: [{ id: 'root', name: 'Root', parentId: null, children: [] }], files: [] };
          // Merge files by id
          var canonFileIds = {};
          (canonical.files || []).forEach(function(f) { if (f && f.id) canonFileIds[f.id] = true; });
          (legacy.files || []).forEach(function(f) {
            if (f && f.id && !canonFileIds[f.id]) {
              canonical.files.push(f);
              migrationCount++;
            }
          });
          // Merge folders by id
          var canonFolderIds = {};
          (canonical.folders || []).forEach(function(fo) { if (fo && fo.id) canonFolderIds[fo.id] = true; });
          (legacy.folders || []).forEach(function(fo) {
            if (fo && fo.id && !canonFolderIds[fo.id]) {
              canonical.folders.push(fo);
            }
          });
          fileLibrary[brandKey] = canonical;
        } catch (innerErr) {
          console.warn('[Library Migration] Brand', brandIdx, 'failed:', innerErr.message);
        }
      });
      if (migrationCount > 0) {
        // Persist canonical + push to Firebase write-through
        try {
          localStorage.setItem('roweosLibrary', JSON.stringify(fileLibrary));
          if (typeof writeDB === 'function') {
            writeDB('library/brand', { data: JSON.stringify(fileLibrary) }, { category: 'library' });
          }
          console.log('[Library Migration] Promoted', migrationCount, 'legacy files to canonical + Firebase');
        } catch (saveErr) {
          console.error('[Library Migration] Save failed:', saveErr.message);
        }
      }
      localStorage.setItem('roweos_brand_library_migration_v31_8', 'done');
    }
  } catch (migErr) {
    console.error('[Library Migration] Outer error:', migErr.message);
  }

  // v10.5.25: Also hydrate LifeAI library from its own localStorage key
  var lifeSaved = localStorage.getItem('roweos_life_library');
  if (lifeSaved) {
    try {
      fileLibrary['_life'] = JSON.parse(lifeSaved);
    } catch(e) {
      fileLibrary['_life'] = { folders: [{ id: 'root', name: 'Root', parentId: null }], files: [] };
    }
  }
}

// v15.33: Refresh in-memory fileLibrary from localStorage before rendering save modal
function refreshLibraryFromStorage() {
  var saved = localStorage.getItem('roweosLibrary');
  if (saved) {
    try { fileLibrary = JSON.parse(saved); } catch(e) { console.warn('[Library] Corrupted brand library data:', e.message); }
  }
  // Also refresh per-profile LifeAI library
  if (typeof getLifeLibrary === 'function') {
    try { fileLibrary['_life'] = getLifeLibrary(); } catch(e) { console.warn('[Library] Failed to load LifeAI library:', e.message); }
  } else {
    var lifeSaved = localStorage.getItem('roweos_life_library');
    if (lifeSaved) {
      try { fileLibrary['_life'] = JSON.parse(lifeSaved); } catch(e) { console.warn('[Library] Corrupted LifeAI library data:', e.message); }
    }
  }
}

function saveLibrary() {
  localStorage.setItem('roweosLibrary', JSON.stringify(fileLibrary));
  // v25.1: Write-through to Firestore (replaces deprecated syncToFirebase)
  if (typeof writeDB === 'function') {
    writeDB('library/brand', { data: JSON.stringify(fileLibrary) }, { category: 'library' });
  }
}

function getCurrentBrandLibrary() {
  // v15.37: Prefer pendingSaveBrandIdx over stale DOM dropdown
  var brandIdx = (window.pendingSaveBrandIdx !== undefined && window.pendingSaveBrandIdx !== null) ? window.pendingSaveBrandIdx : selectedBrand;
  if (isNaN(brandIdx) || brandIdx < 0 || brandIdx >= brands.length) brandIdx = 0;
  var brand = brands[brandIdx];
  var key = brand.name; // Use brand name as key since brands don't have id
  if (!fileLibrary[key]) {
    fileLibrary[key] = {
      folders: [{ id: 'root', name: 'Root', parentId: null, children: [] }],
      files: []
    };
  }
  return fileLibrary[key];
}

// Open/Close Library Panel
function openLibrary() {
  document.getElementById('libraryPanel').classList.add('open');
  document.getElementById('libraryBackdrop').classList.add('open');
  renderLibrary();
}

function closeLibrary() {
  document.getElementById('libraryPanel').classList.remove('open');
  document.getElementById('libraryBackdrop').classList.remove('open');
  closeContextMenu();
}

// Library Tab Switching
function switchLibraryTab(tab) {
  document.querySelectorAll('.library-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.getElementById('libraryOutputsTab').style.display = tab === 'outputs' ? 'flex' : 'none';
  document.getElementById('libraryPromptsTab').style.display = tab === 'prompts' ? 'flex' : 'none';
  
  if (tab === 'prompts') {
    renderPromptLibrary();
  }
}

// Prompt Library Functions
var promptLibrary = [];

function loadPromptLibrary() {
  var saved = localStorage.getItem('roweos_prompt_library');
  if (saved) {
    promptLibrary = JSON.parse(saved);
  }
}

function savePromptLibraryData() {
  localStorage.setItem('roweos_prompt_library', JSON.stringify(promptLibrary));
}

function saveCurrentPrompt() {
  var contextEl = document.getElementById('studioContext');
  var context = contextEl ? contextEl.value.trim() : '';
  
  if (!context) {
    showToast('No prompt to save. Enter context in Studio first.', 'warning');
    return;
  }
  
  var name = prompt('Enter a name for this prompt:');
  if (!name) return;
  
  var promptEntry = {
    id: Date.now(),
    name: name,
    context: context,
    operation: selectedOp ? selectedOp.name : 'General',
    agent: selectedOp ? selectedOp.agent : 'All',
    brand: brands[selectedBrand].name,
    date: new Date().toLocaleDateString()
  };
  
  promptLibrary.unshift(promptEntry);
  savePromptLibraryData();
  renderPromptLibrary();
  showToast('Prompt saved to library', 'success');
}

function renderPromptLibrary() {
  var container = document.getElementById('promptLibraryContent');
  if (!container) return;
  
  if (promptLibrary.length === 0) {
    container.innerHTML = '<div class="library-empty"><div class="library-empty-icon">◈</div><div>No saved prompts yet.</div><div style="font-size: var(--text-sm); margin-top: var(--space-2);">Save prompts from Studio to reuse them later.</div></div>';
    return;
  }
  
  var html = promptLibrary.map(function(p) {
    return '<div class="prompt-item" data-id="' + p.id + '">' +
      '<div class="prompt-item-header">' +
      '<span class="prompt-item-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="prompt-item-date">' + p.date + '</span>' +
      '</div>' +
      '<div class="prompt-item-preview">' + escapeHtml(p.context.substring(0, 100)) + (p.context.length > 100 ? '...' : '') + '</div>' +
      '<div class="prompt-item-meta">' + escapeHtml(p.agent || '') + ' &bull; ' + escapeHtml(p.operation || '') + ' &bull; ' + escapeHtml(p.brand || '') + '</div>' +
      '<div class="prompt-item-actions">' +
      '<button class="prompt-item-btn" onclick="loadPromptToStudio(' + p.id + ')">Load</button>' +
      '<button class="prompt-item-btn" onclick="deletePrompt(' + p.id + ')">Delete</button>' +
      '</div>' +
      '</div>';
  }).join('');
  
  container.innerHTML = html;
}

function loadPromptToStudio(id) {
  var prompt = promptLibrary.find(function(p) { return p.id === id; });
  if (!prompt) return;
  
  closeLibrary();
  showView('studio');
  
  var _ctx = document.getElementById('studioContext'); if (_ctx) _ctx.value = prompt.context;
  showToast('Prompt loaded to Studio', 'success');
}

function deletePrompt(id) {
  if (!confirm('Delete this prompt?')) return;
  promptLibrary = promptLibrary.filter(function(p) { return p.id !== id; });
  savePromptLibraryData();
  renderPromptLibrary();
  showToast('Prompt deleted', 'success');
}

function clearPromptLibrary() {
  if (!confirm('Clear all saved prompts?')) return;
  promptLibrary = [];
  savePromptLibraryData();
  renderPromptLibrary();
  showToast('Prompt library cleared', 'success');
}

// Render the folder tree
function renderLibrary() {
  var lib = getCurrentBrandLibrary();
  var container = document.getElementById('libraryContent');
  
  if (lib.files.length === 0 && lib.folders.length <= 1) {
    container.innerHTML = '<div class="library-empty"><div class="library-empty-icon">📂</div><div>No saved outputs yet.</div><div style="font-size: var(--text-sm); margin-top: var(--space-2);">Generate content and click "Save" to organize your outputs.</div></div>';
    return;
  }
  
  var html = '<ul class="folder-tree">';
  html += renderFolderContents('root', lib);
  html += '</ul>';
  container.innerHTML = html;
  
  // Add drag and drop listeners
  setupDragAndDrop();
}

function renderFolderContents(folderId, lib) {
  var html = '';
  
  // Get subfolders
  var subfolders = lib.folders.filter(function(f) { return f.parentId === folderId; });
  subfolders.forEach(function(folder) {
    var fileCount = countFilesInFolder(folder.id, lib);
    html += '<li>';
    html += '<div class="folder-item" data-id="' + folder.id + '" data-type="folder" draggable="true" oncontextmenu="showContextMenu(event, \'' + folder.id + '\', \'folder\')">';
    html += '<span class="folder-icon" onclick="toggleFolder(\'' + folder.id + '\')">▶</span>';
    html += '<span onclick="toggleFolder(\'' + folder.id + '\')">📁</span>';
    html += '<span class="folder-name" onclick="toggleFolder(\'' + folder.id + '\')">' + escapeHtml(folder.name) + '</span>';
    html += '<span class="folder-count">' + fileCount + '</span>';
    html += '<div class="folder-actions">';
    html += '<button class="folder-action-btn" onclick="renameFolder(\'' + folder.id + '\')" title="Rename">✏️</button>';
    html += '<button class="folder-action-btn" onclick="deleteFolder(\'' + folder.id + '\')" title="Delete">🗑️</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="folder-children collapsed" id="folder-' + folder.id + '">';
    html += '<ul class="folder-tree">' + renderFolderContents(folder.id, lib) + '</ul>';
    html += '</div>';
    html += '</li>';
  });
  
  // Get files in this folder
  var files = lib.files.filter(function(f) { return f.folderId === folderId; });
  files.forEach(function(file) {
    var dateStr = new Date(file.savedAt).toLocaleDateString();
    html += '<li>';
    html += '<div class="file-item" data-id="' + file.id + '" data-type="file" draggable="true" oncontextmenu="showContextMenu(event, \'' + file.id + '\', \'file\')" onclick="previewFile(\'' + file.id + '\')">';
    html += '<span>◇</span>';
    html += '<span class="file-name">' + escapeHtml(file.name) + '</span>';
    html += '<span class="file-date">' + dateStr + '</span>';
    html += '<div class="file-actions">';
    html += '<button class="file-action-btn" onclick="event.stopPropagation(); if(typeof openLibraryFileInScribe===\'function\') openLibraryFileInScribe(\'' + file.id + '\')" title="Open in Scribe"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528"/></svg></button>';
    html += '<button class="file-action-btn" onclick="event.stopPropagation(); renameFile(\'' + file.id + '\')" title="Rename">✏️</button>';
    html += '<button class="file-action-btn" onclick="event.stopPropagation(); deleteFile(\'' + file.id + '\')" title="Delete">🗑️</button>';
    html += '</div>';
    html += '</div>';
    html += '</li>';
  });
  
  return html;
}

function countFilesInFolder(folderId, lib) {
  var count = lib.files.filter(function(f) { return f.folderId === folderId; }).length;
  var subfolders = lib.folders.filter(function(f) { return f.parentId === folderId; });
  subfolders.forEach(function(sub) {
    count += countFilesInFolder(sub.id, lib);
  });
  return count;
}

function toggleFolder(folderId) {
  var children = document.getElementById('folder-' + folderId);
  var item = document.querySelector('.folder-item[data-id="' + folderId + '"]');
  if (children && item) {
    children.classList.toggle('collapsed');
    var icon = item.querySelector('.folder-icon');
    if (icon) {
      icon.classList.toggle('expanded');
    }
  }
}

function expandAllFolders() {
  document.querySelectorAll('.folder-children').forEach(function(el) {
    el.classList.remove('collapsed');
  });
  document.querySelectorAll('.folder-icon').forEach(function(el) {
    el.classList.add('expanded');
  });
}

function collapseAllFolders() {
  document.querySelectorAll('.folder-children').forEach(function(el) {
    el.classList.add('collapsed');
  });
  document.querySelectorAll('.folder-icon').forEach(function(el) {
    el.classList.remove('expanded');
  });
}

// Create new folder
function createNewFolder(parentId) {
  var name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;
  
  var lib = getCurrentBrandLibrary();
  var folder = {
    id: 'folder_' + Date.now(),
    name: name.trim(),
    parentId: parentId || 'root',
    children: []
  };
  lib.folders.push(folder);
  saveLibrary();
  renderLibrary();
  showToast('Folder created', 'success');
}

// Rename folder
function renameFolder(folderId) {
  var lib = getCurrentBrandLibrary();
  var folder = lib.folders.find(function(f) { return f.id === folderId; });
  if (!folder) return;
  
  var newName = prompt('Enter new name:', folder.name);
  if (!newName || !newName.trim()) return;
  
  folder.name = newName.trim();
  saveLibrary();
  renderLibrary();
  showToast('Folder renamed', 'success');
}

// Delete folder
function deleteFolder(folderId) {
  if (folderId === 'root') {
    showToast('Cannot delete root folder', 'error');
    return;
  }
  
  if (!confirm('Delete this folder and all its contents?')) return;
  
  var lib = getCurrentBrandLibrary();
  
  // Delete all files in folder and subfolders
  function deleteRecursive(id) {
    lib.files = lib.files.filter(function(f) { return f.folderId !== id; });
    var subfolders = lib.folders.filter(function(f) { return f.parentId === id; });
    subfolders.forEach(function(sub) { deleteRecursive(sub.id); });
    lib.folders = lib.folders.filter(function(f) { return f.id !== id; });
  }
  
  deleteRecursive(folderId);
  saveLibrary();
  renderLibrary();
  showToast('Folder deleted', 'success');
}

// Rename file
function renameFile(fileId) {
  var lib = getCurrentBrandLibrary();
  var file = lib.files.find(function(f) { return f.id === fileId; });
  if (!file) return;
  
  var newName = prompt('Enter new name:', file.name);
  if (!newName || !newName.trim()) return;
  
  file.name = newName.trim();
  saveLibrary();
  renderLibrary();
  showToast('File renamed', 'success');
}

// Delete file
function deleteFile(fileId) {
  if (!confirm('Delete this file?')) return;

  // v28.7: Also delete from Google Drive if synced
  if (_gdriveAutoSync && _gdriveSyncMap && _gdriveSyncMap[fileId]) {
    if (typeof gdriveDeleteFile === 'function') {
      gdriveDeleteFile(_gdriveSyncMap[fileId].driveFileId, function() {
        delete _gdriveSyncMap[fileId];
        localStorage.setItem('roweos_gdrive_sync_map', JSON.stringify(_gdriveSyncMap));
      });
    }
  }

  var lib = getCurrentBrandLibrary();
  lib.files = lib.files.filter(function(f) { return f.id !== fileId; });
  saveLibrary();
  renderLibrary();
  showToast('File deleted', 'success');
}

// Preview file
function previewFile(fileId) {
  var lib = getCurrentBrandLibrary();
  var file = lib.files.find(function(f) { return f.id === fileId; });
  if (!file) return;
  
  document.getElementById('previewFileName').textContent = file.name;
  document.getElementById('previewFileMeta').textContent = 'Saved on ' + new Date(file.savedAt || file.created).toLocaleString() + ' • ' + (file.operation || file.type || 'File') + ' • ' + file.brand;
  
  // v9.1.16: Handle image files specially
  var contentEl = document.getElementById('previewFileContent');
  if (file.type === 'image' || (file.mimeType && file.mimeType.startsWith('image/'))) {
    var imgSrc = file.imageData || file.content;
    var imgHtml = '<div style="text-align: center; padding: var(--space-5);">';
    imgHtml += '<img src="' + imgSrc + '" style="max-width: 100%; max-height: 60vh; border-radius: var(--radius-md); box-shadow: 0 4px 20px rgba(0,0,0,0.3);" alt="' + file.name + '">';
    
    // Show metadata if available
    if (file.metadata) {
      imgHtml += '<div style="margin-top: var(--space-4); padding: var(--space-4); background: var(--bg-secondary); border-radius: var(--radius-md); text-align: left; font-size: var(--text-sm);">';
      if (file.metadata.prompt) {
        imgHtml += '<div style="margin-bottom: var(--space-2);"><strong style="color: var(--text-secondary);">Prompt:</strong><br><span style="color: var(--text-primary);">' + escapeHtml(file.metadata.prompt || '') + '</span></div>'; // v30.1: XSS fix
      }
      if (file.metadata.model) {
        imgHtml += '<div style="color: var(--text-tertiary);">Model: ' + file.metadata.model + '</div>';
      }
      if (file.metadata.provider) {
        imgHtml += '<div style="color: var(--text-tertiary);">Provider: ' + (file.metadata.provider === 'gemini' ? 'Nano Banana' : 'GPT Image 2') + '</div>'; // v31.0
      }
      imgHtml += '</div>';
    }
    imgHtml += '</div>';
    contentEl.innerHTML = imgHtml;
  } else {
    contentEl.innerHTML = file.content;
  }
  
  document.getElementById('filePreviewModal').classList.add('open');
  
  // v10.5.25: Show "Continue" button if this is a conversation - mode-aware label
  // v11.0.5: Also check for conversation property (newer format)
  var hasConversation = (file.content && file.content.includes('data-conversation=')) ||
                        (file.conversation && Array.isArray(file.conversation) && file.conversation.length > 0);
  var continueBtn = document.getElementById('continueConversationBtn');
  var continueMenuItem = document.getElementById('continueConversationMenuItem');
  if (hasConversation) {
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    var continueLabel = currentMode === 'life' ? 'Continue in LifeAI' : 'Continue in BrandAI';
    if (continueBtn) { continueBtn.style.display = 'inline-flex'; continueBtn.textContent = continueLabel; }
    if (continueMenuItem) { continueMenuItem.style.display = 'block'; continueMenuItem.textContent = '◇ ' + continueLabel; }
  } else {
    if (continueBtn) continueBtn.style.display = 'none';
    if (continueMenuItem) continueMenuItem.style.display = 'none';
  }
  
  selectedLibraryItem = file;
}

function closeFilePreview() {
  document.getElementById('filePreviewModal').classList.remove('open');
  selectedLibraryItem = null;
  hideFilePreviewContextMenu();
}

/**
 * v9.1.14: Continue conversation from Library in BrandAI
 */
// v10.5.25: continueConversationFromLibrary is defined below (line ~49500) with full LifeAI support
// Removed duplicate definition that was being overwritten

// File Preview Context Menu
function showFilePreviewContextMenu(e) {
  e.preventDefault();
  var menu = document.getElementById('filePreviewContextMenu');
  menu.style.display = 'block';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
}

function hideFilePreviewContextMenu() {
  document.getElementById('filePreviewContextMenu').style.display = 'none';
}

function copyPreviewContent() {
  if (!selectedLibraryItem) return;
  
  // Strip HTML tags to get plain text
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = selectedLibraryItem.content;
  var plainText = tempDiv.textContent || tempDiv.innerText;
  
  navigator.clipboard.writeText(plainText).then(function() {
    showToast('Content copied to clipboard', 'success');
  }).catch(function() {
    showToast('Failed to copy', 'error');
  });
}

// Close context menu when clicking elsewhere
document.addEventListener('click', function() {
  hideFilePreviewContextMenu();
});

function loadToStudio() {
  if (!selectedLibraryItem) return;
  
  // Navigate to Studio view
  showView('studio');
  
  // Get content and render with proper markdown formatting
  var content = selectedLibraryItem.content;
  
  // If content looks like raw markdown (not already HTML), convert it
  if (content && !content.includes('<div') && !content.includes('<p>') && !content.includes('<h')) {
    content = markdownToHtml(content);
  }
  
  document.getElementById('studioOutputContent').innerHTML = '<div class="output-canvas">' + content + '</div>';
  closeFilePreview();
  showToast('Loaded to Studio', 'success');
}

function exportPreviewFile() {
  if (!selectedLibraryItem) return;
  
  var filename = selectedLibraryItem.name.replace(/[^a-z0-9]/gi, '_') + '.html';
  var blob = new Blob([selectedLibraryItem.content], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Save to Library Modal
function openSaveLibraryModal() {
  // v15.32: If Studio has a current run, use the dedicated Studio save path
  // which preserves full raw content (not truncated DOM innerHTML)
  if (window.currentRun && window.currentRun.deliv) {
    if (typeof openSaveLibraryModalForStudio === 'function') {
      openSaveLibraryModalForStudio();
      return;
    }
  }
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent || outputContent.querySelector('.studio-output-empty')) {
    showToast('No output to save', 'error');
    return;
  }
  
  // v10.5.25: Mode-aware save - detect if in LifeAI mode
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';
  
  // Generate default name from operation
  var defaultName = 'Output ' + new Date().toLocaleDateString();
  if (selectedOp) {
    defaultName = selectedOp.name + ' - ' + new Date().toLocaleDateString();
  }
  
  // Store mode for confirmSaveToLibrary
  window.pendingSaveMode = currentMode;
  // v15.37: Set brand index so renderSaveFolderList uses correct brand
  window.pendingSaveBrandIdx = isLifeMode ? null : (selectedBrand || 0);

  document.getElementById('saveFileName').value = defaultName;
  refreshLibraryFromStorage(); // v15.33: Pick up sync changes
  renderSaveFolderList(); // This will now be mode-aware
  // v28.7: Show Google Drive tab if connected
  var gdriveTab = document.getElementById('saveTabGDrive');
  if (gdriveTab) gdriveTab.style.display = _gdriveConnected ? '' : 'none';
  if (typeof switchSaveTab === 'function') switchSaveTab('library');
  document.getElementById('saveLibraryModal').classList.add('open');
}

function closeSaveLibraryModal() {
  document.getElementById('saveLibraryModal').classList.remove('open');
  // v15.18: Clean up snapshot on cancel
  window.pendingSaveConversation = null;
}

/**
 * v9.1.14: Create new folder from within save modal
 */
function createNewFolderInSaveModal() {
  // Show inline folder creation UI
  var container = document.getElementById('saveFolderList');
  var existingInput = container.querySelector('.new-folder-inline-input');
  if (existingInput) {
    existingInput.querySelector('input').focus();
    return;
  }
  
  var inputHtml = '<div class="new-folder-inline-input" style="display: flex; gap: var(--space-2); margin-bottom: var(--space-2); padding: var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-md); border: 1px solid var(--accent);">';
  inputHtml += '<input type="text" id="newFolderInlineInput" placeholder="Folder name..." style="flex: 1; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; color: var(--text-primary); font-size: var(--text-base);" onkeypress="if(event.key===\'Enter\')confirmNewFolderInline()">';
  inputHtml += '<button onclick="confirmNewFolderInline()" style="background: var(--accent); color: #000; border: none; border-radius: var(--radius-sm); padding: 8px 12px; font-size: var(--text-sm); font-weight: 600; cursor: pointer;">Create</button>';
  inputHtml += '<button onclick="cancelNewFolderInline()" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; font-size: var(--text-sm); cursor: pointer;">Cancel</button>';
  inputHtml += '</div>';
  
  container.insertAdjacentHTML('afterbegin', inputHtml);
  
  setTimeout(function() {
    document.getElementById('newFolderInlineInput').focus();
  }, 50);
}

function confirmNewFolderInline() {
  var input = document.getElementById('newFolderInlineInput');
  var folderName = input ? input.value.trim() : '';
  
  if (!folderName) {
    showToast('Please enter a folder name', 'warning');
    return;
  }
  
  // v10.5.25: Mode-aware folder creation
  var currentMode = window.pendingSaveMode || localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var inLifeMode = currentMode === 'life';
  
  var newFolder = {
    id: 'folder_' + Date.now(),
    name: folderName,
    parentId: 'root'
  };
  
  if (inLifeMode) {
    // v15.30: Use getLifeLibrary()/saveLifeLibrary() for per-profile support
    var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    if (!lifeLib.folders) lifeLib.folders = [];
    lifeLib.folders.push(newFolder);
    fileLibrary['_life'] = lifeLib;
    if (typeof saveLifeLibrary === 'function') { saveLifeLibrary(); } else { localStorage.setItem('roweos_life_library', JSON.stringify(lifeLib)); }
    // v25.1: Write-through life library to Firestore
    writeDB('library/life', { data: JSON.stringify(lifeLib) }, { category: 'library' });

    // Re-render with mode-aware folder list
    renderSaveFolderList();
    
    // v11.0.5: Also refresh main library view if visible
    if (currentView === 'library') {
      renderLibraryView();
    }
  } else {
    // Add to brand library
    var brandIdx = window.pendingSaveBrandIdx !== undefined ? window.pendingSaveBrandIdx : selectedBrand;
    var lib = getLibraryForBrandIndex(brandIdx);
    
    if (!lib) {
      var brand = brands[brandIdx];
      var key = brand ? brand.name : 'Default';
      fileLibrary[key] = {
        folders: [{ id: 'root', name: 'Root', parentId: null }],
        files: []
      };
      lib = fileLibrary[key];
    }
    
    lib.folders.push(newFolder);
    saveLibrary();
    
    // v15.30: Re-render and select the new folder (mode-aware)
    renderSaveFolderList();
    
    // v11.0.5: Also refresh main library view if visible
    if (currentView === 'library') {
      renderLibraryView();
    }
  }
  
  setTimeout(function() {
    selectSaveFolder(newFolder.id);
  }, 50);
  
  showToast('Folder "' + folderName + '" created', 'success');
}

function cancelNewFolderInline() {
  var container = document.getElementById('saveFolderList');
  var inputEl = container.querySelector('.new-folder-inline-input');
  if (inputEl) inputEl.remove();
}

function renderSaveFolderList() {
  // v10.5.25: Mode-aware - show LifeAI Library or Brand Library
  var currentMode = window.pendingSaveMode || localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';
  
  var lib, libraryName;
  
  if (isLifeMode) {
    // v15.30: Use getLifeLibrary() for per-profile library support
    lib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
    libraryName = profile && profile.name ? profile.name + "'s Library" : 'My Life Library';
  } else {
    // v15.37: Use pendingSaveBrandIdx (set by save modal openers) instead of stale DOM dropdown
    var brandIdx = (window.pendingSaveBrandIdx !== undefined && window.pendingSaveBrandIdx !== null) ? window.pendingSaveBrandIdx : selectedBrand;
    if (isNaN(brandIdx) || brandIdx < 0 || brandIdx >= brands.length) brandIdx = selectedBrand || 0;
    lib = typeof getLibraryForBrandIndex === 'function' ? getLibraryForBrandIndex(brandIdx) : getCurrentBrandLibrary();
    var brand = brands[brandIdx];
    libraryName = brand ? (brand.shortName || brand.name) : 'Library';
  }
  
  var container = document.getElementById('saveFolderList');
  
  // v10.5.25: Use SVG icons instead of emojis
  var folderSvg = icon('folder', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'});
  
  var html = '<div class="save-library-folder root selected" data-id="root" onclick="selectSaveFolder(\'root\')">' + folderSvg + escapeHtml(libraryName) + ' (All Files)</div>';
  
  // v11.0.5: Mode-specific default folders with SVG icons - ALWAYS shown
  var defaultFolders;
  if (isLifeMode) {
    defaultFolders = [
      { id: 'journals', icon: 'note', name: 'Journals' },
      { id: 'notes', icon: 'document', name: 'Notes' },
      { id: 'reflections', icon: 'chat', name: 'Reflections' },
      { id: 'goals', icon: 'lightning', name: 'Goals' },
      { id: 'ideas', icon: 'sparkles', name: 'Ideas' },
      { id: 'plans', icon: 'chart', name: 'Plans' }
    ];
  } else {
    // v15.37: Match Library view defaults so save modal folders align with what user sees
    defaultFolders = [
      { id: 'brandai-chats', icon: 'chat', name: 'BrandAI Chats' },
      { id: 'documents', icon: 'document', name: 'Documents' },
      { id: 'presentations', icon: 'sparkles', name: 'Presentations' },
      { id: 'emails', icon: 'envelope', name: 'Emails' },
      { id: 'social', icon: 'phone', name: 'Social Media' },
      { id: 'strategy', icon: 'chart', name: 'Strategy' },
      { id: 'scheduled-outputs', icon: 'lightning', name: 'Scheduled Outputs' }
    ];
  }
  
  // SVG icon map for save modal
  var saveFolderIcons = {
    'folder': icon('folder', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'chat': icon('chat', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'sparkles': icon('sparkles', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'envelope': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>',
    'phone': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
    'chart': icon('chart', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'lightning': icon('lightning', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'document': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    'note': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h8l6-6V5a2 2 0 00-2-2z"/><path d="M13 21v-6h6M7 7h10M7 11h10M7 15h4"/></svg>'
  };
  
  // v11.0.5: Get custom folder names AND IDs to properly detect duplicates
  var customFolderIds = [];
  var customFolderNames = [];
  if (lib && lib.folders) {
    lib.folders.filter(function(f) { return f.id !== 'root'; }).forEach(function(f) {
      customFolderIds.push(f.id);
      customFolderNames.push(f.name.toLowerCase());
    });
  }
  
  // v11.0.5: ALWAYS show default folders first, skip if custom folder with same name exists
  defaultFolders.forEach(function(folder) {
    // Skip default if user has a custom folder with the SAME NAME
    if (customFolderNames.indexOf(folder.name.toLowerCase()) !== -1) return;
    
    var iconSvg = saveFolderIcons[folder.icon] || saveFolderIcons['folder'];
    html += '<div class="save-library-folder" data-id="' + folder.id + '" onclick="selectSaveFolder(\'' + folder.id + '\')" style="padding-left: 32px; display: flex; align-items: center;">' + iconSvg + escapeHtml(folder.name) + '</div>';
  });
  
  // v11.0.5: Add custom folders (skip those that have same name as defaults, they were already shown as defaults)
  if (lib && lib.folders) {
    var defaultNames = defaultFolders.map(function(d) { return d.name.toLowerCase(); });
    lib.folders.forEach(function(folder) {
      if (folder.id === 'root') return;
      
      // If this custom folder has same name as a default, it was already skipped above
      // and the custom one should be shown instead with its actual ID
      var iconSvg = saveFolderIcons[folder.icon] || saveFolderIcons['folder'];
      html += '<div class="save-library-folder" data-id="' + folder.id + '" onclick="selectSaveFolder(\'' + folder.id + '\')" style="padding-left: 32px; display: flex; align-items: center;">' + iconSvg + escapeHtml(folder.name) + '</div>';
    });
  }
  
  container.innerHTML = html;
}

function selectSaveFolder(folderId) {
  document.querySelectorAll('.save-library-folder').forEach(function(el) {
    el.classList.remove('selected');
  });
  document.querySelector('.save-library-folder[data-id="' + folderId + '"]').classList.add('selected');
}

function confirmSaveToLibrary() {
  var name = document.getElementById('saveFileName').value.trim();
  if (!name) {
    showToast('Please enter a file name', 'error');
    return;
  }
  
  var selectedFolder = document.querySelector('.save-library-folder.selected');
  var folderId = selectedFolder ? selectedFolder.getAttribute('data-id') : 'root';
  
  // v10.5.25: Mode-aware save
  var currentMode = window.pendingSaveMode || localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';
  
  var content, operation, sourceName;
  
  // v15.18: Use snapshotted conversation from open time (not currentConversation which may have been reset)
  var saveConversation = null;
  var isConversationSave = (window.pendingSaveSource === 'brandai' || window.pendingSaveSource === 'lifeai' || window.pendingSaveSource === 'conversation');
  if (isConversationSave) {
    // Prefer the snapshot taken when the modal opened
    if (window.pendingSaveConversation && window.pendingSaveConversation.length > 0) {
      saveConversation = window.pendingSaveConversation;
      console.log('[SaveToLibrary] Using snapshotted conversation:', saveConversation.length, 'messages');
    } else if (typeof currentConversation !== 'undefined' && currentConversation && currentConversation.length > 0) {
      // Fallback to live conversation if no snapshot
      saveConversation = JSON.parse(JSON.stringify(currentConversation));
      console.log('[SaveToLibrary] Fallback to live conversation:', saveConversation.length, 'messages');
    }
  }

  // v14.3: Handle Image Lab save through folder picker
  if (window.pendingSaveSource === 'imagelab' && window.pendingImageLabSave) {
    var imgSave = window.pendingImageLabSave;
    var folderId = window.selectedSaveFolderId || 'root';
    var customName = document.getElementById('saveFileName');
    var imgFileName = customName ? customName.value.trim() : imgSave.fileName;
    if (!imgFileName) imgFileName = imgSave.fileName;

    var mode = window.pendingSaveMode || (typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand');
    var key = 'LifeAI';
    if (mode === 'brand' && typeof brands !== 'undefined' && brands.length > 0) {
      var bIdx = typeof studioSelectedBrand !== 'undefined' ? studioSelectedBrand : 0;
      key = brands[bIdx] ? brands[bIdx].name : 'LifeAI';
    }

    if (typeof fileLibrary === 'undefined') window.fileLibrary = {};
    if (!fileLibrary[key]) {
      fileLibrary[key] = { folders: [{ id: 'root', name: 'Root', parentId: null }], files: [] };
    }
    if (!fileLibrary[key].files) fileLibrary[key].files = [];

    fileLibrary[key].files.push({
      id: 'file_' + Date.now(),
      name: imgFileName,
      type: 'image/png',
      content: imgSave.dataUrl,
      folderId: folderId,
      createdAt: imgSave.createdAt,
      metadata: { source: 'image-lab', prompt: imgSave.prompt }
    });

    try { localStorage.setItem('roweos_file_library', JSON.stringify(fileLibrary)); } catch(e) {}
    window.pendingImageLabSave = null;
    window.pendingSaveSource = null;
    closeSaveLibraryModal();
    showToast('Image saved to Library', 'success');
    return;
  }

  // Check if saving from BrandAI, LifeAI, Conversation, or Studio via pending save
  if ((window.pendingSaveSource === 'brandai' || window.pendingSaveSource === 'lifeai' || window.pendingSaveSource === 'conversation') && window.pendingSaveContent) {
    content = window.pendingSaveContent;
    operation = isLifeMode ? 'LifeAI Conversation' : 'BrandAI Conversation';
    if (isLifeMode) {
      var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
      sourceName = profile && profile.name ? profile.name : 'My Life';
    } else {
      var brandIdx = window.pendingSaveBrandIdx || 0;
      sourceName = brands[brandIdx] ? brands[brandIdx].name : 'Unknown Brand';
    }
  } else if (window.pendingSaveSource === 'studio' && window.pendingSaveContent) {
    content = window.pendingSaveContent;
    operation = window.pendingSaveOperation || 'Studio Output';
    if (isLifeMode) {
      var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
      sourceName = profile && profile.name ? profile.name : 'My Life';
    } else {
      var brandIdx = window.pendingSaveBrandIdx || 0;
      sourceName = brands[brandIdx] ? brands[brandIdx].name : 'Unknown Brand';
    }
  } else {
    // Fallback - try to get from current output elements
    var outputContent = document.getElementById('studioOutputContent');
    var canvas = outputContent ? outputContent.querySelector('.output-canvas') : null;
    content = canvas ? canvas.innerHTML : (outputContent ? outputContent.innerHTML : '');
    operation = selectedOp ? selectedOp.name : 'Unknown';
    
    if (isLifeMode) {
      var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
      sourceName = profile && profile.name ? profile.name : 'My Life';
    } else {
      var brandSelect = document.getElementById('studioBrandSelect');
      var brandIdx = brandSelect ? parseInt(brandSelect.value) : 0;
      sourceName = brands[brandIdx] ? brands[brandIdx].name : 'Unknown Brand';
    }
  }
  
  // Clear pending save data AFTER extracting everything
  var saveBrandIdx = window.pendingSaveBrandIdx;
  window.pendingSaveContent = null;
  window.pendingSaveSource = null;
  window.pendingSaveBrandIdx = null;
  window.pendingSaveOperation = null;
  window.pendingSaveMode = null;
  window.pendingSaveConversation = null;

  // v22.40: Intercept - queue for approval if guardrails require it
  // v22.47: Also intercept if _forceApprovalQueue is set (per-automation requireApproval toggle)
  if (!window._docApprovalBypass && (window._forceApprovalQueue || (typeof docApprovalRequired === 'function' && docApprovalRequired()))) {
    addToPendingApproval({
      type: 'document',
      data: { name: name, content: content, folderId: folderId, source: sourceName, agentType: operation, isLifeMode: isLifeMode, brandIdx: saveBrandIdx, conversation: saveConversation }
    });
    closeSaveLibraryModal();
    showToast('Document queued for approval in Automations', 'info');
    return;
  }

  var file = {
    id: 'file_' + Date.now(),
    name: name,
    folderId: folderId,
    content: content,
    operation: operation,
    source: sourceName,
    savedAt: Date.now(),
    storageMode: 'local' // v14.0: default to local storage
  };
  
  // v11.0.5: Store conversation array directly (already captured above)
  if (saveConversation) {
    file.conversation = saveConversation;
    console.log('[SaveToLibrary] Attached conversation to file');
  }
  
  // v10.5.25: Save to appropriate library based on mode
  if (isLifeMode) {
    // v15.30: Use getLifeLibrary()/saveLifeLibrary() for per-profile support
    var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    if (!lifeLib.files) lifeLib.files = [];
    if (!lifeLib.folders) lifeLib.folders = [];

    // v11.0.5: Debug logging
    console.log('[SaveToLibrary] BEFORE save - Life library has', lifeLib.files.length, 'files');
    console.log('[SaveToLibrary] New file:', { id: file.id, name: file.name, folderId: folderId, hasContent: !!file.content, hasConversation: !!file.conversation });

    lifeLib.files.push(file);
    fileLibrary['_life'] = lifeLib;
    if (typeof saveLifeLibrary === 'function') { saveLifeLibrary(); } else { localStorage.setItem('roweos_life_library', JSON.stringify(lifeLib)); }
    // v28.7: Auto-sync to Google Drive (LifeAI)
    if (typeof gdriveAutoSyncFile === 'function') gdriveAutoSyncFile(file, 'life');
    console.log('[SaveToLibrary] Saved to LifeAI library:', name, 'in folder:', folderId);
    console.log('[SaveToLibrary] AFTER save - Life library has', lifeLib.files.length, 'files');
    
    // v10.5.25: Keep in-memory cache in sync
    fileLibrary['_life'] = lifeLib;
    // Sync to Firebase
    if (typeof syncToFirebase === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
      syncToFirebase();
    }
  } else {
    var brandIdx = saveBrandIdx !== undefined && saveBrandIdx !== null ? saveBrandIdx : selectedBrand;
    var lib = getLibraryForBrandIndex(brandIdx);
    file.brand = sourceName;
    lib.files.push(file);
    saveLibrary();
    // v28.7: Auto-sync to Google Drive
    if (typeof gdriveAutoSyncFile === 'function') gdriveAutoSyncFile(file, brandIdx);
    console.log('[SaveToLibrary] Saved to BrandAI library:', name, 'in folder:', folderId);
  }
  
  closeSaveLibraryModal();
  
  // Refresh library view if currently visible
  if (currentView === 'library') {
    renderLibraryView();
  }
  
  showToast('Saved to library: ' + name, 'success');
}

// Context Menu
function showContextMenu(e, itemId, itemType) {
  e.preventDefault();
  e.stopPropagation();
  
  contextMenuItem = { id: itemId, type: itemType };
  
  var menu = document.getElementById('libraryContextMenu');
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.add('open');
  
  // Hide "New Folder Here" for files
  var newFolderItem = menu.querySelector('.context-menu-item[onclick="contextMenuNewFolder()"]');
  if (newFolderItem) {
    newFolderItem.style.display = itemType === 'folder' ? 'flex' : 'none';
  }
  
  document.addEventListener('click', closeContextMenu, { once: true });
}

function closeContextMenu() {
  document.getElementById('libraryContextMenu').classList.remove('open');
}

function contextMenuRename() {
  if (!contextMenuItem) return;
  if (contextMenuItem.type === 'folder') {
    renameFolder(contextMenuItem.id);
  } else {
    renameFile(contextMenuItem.id);
  }
  closeContextMenu();
}

function contextMenuDuplicate() {
  if (!contextMenuItem) return;
  var lib = getCurrentBrandLibrary();
  
  if (contextMenuItem.type === 'file') {
    var file = lib.files.find(function(f) { return f.id === contextMenuItem.id; });
    if (file) {
      var newFile = Object.assign({}, file);
      newFile.id = 'file_' + Date.now();
      newFile.name = file.name + ' (copy)';
      newFile.savedAt = Date.now();
      lib.files.push(newFile);
      saveLibrary();
      renderLibrary();
      showToast('File duplicated', 'success');
    }
  }
  closeContextMenu();
}

function contextMenuNewFolder() {
  if (!contextMenuItem || contextMenuItem.type !== 'folder') return;
  createNewFolder(contextMenuItem.id);
  closeContextMenu();
}

function contextMenuDelete() {
  if (!contextMenuItem) return;
  if (contextMenuItem.type === 'folder') {
    deleteFolder(contextMenuItem.id);
  } else {
    deleteFile(contextMenuItem.id);
  }
  closeContextMenu();
}

// Drag and Drop
// v24.27: Renamed lib* to avoid calendar drag handler collision
function setupDragAndDrop() {
  var items = document.querySelectorAll('.folder-item, .file-item');

  items.forEach(function(item) {
    item.addEventListener('dragstart', libDragStart);
    item.addEventListener('dragend', libDragEnd);
    item.addEventListener('dragover', libDragOver);
    item.addEventListener('dragleave', libDragLeave);
    item.addEventListener('drop', libDrop);
  });
}

function libDragStart(e) {
  draggedItem = {
    id: this.getAttribute('data-id'),
    type: this.getAttribute('data-type')
  };
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function libDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(function(el) {
    el.classList.remove('drag-over');
  });
  draggedItem = null;
}

function libDragOver(e) {
  e.preventDefault();
  if (this.getAttribute('data-type') === 'folder') {
    this.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
  }
}

function libDragLeave(e) {
  this.classList.remove('drag-over');
}

function libDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  if (!draggedItem) return;

  var targetId = this.getAttribute('data-id');
  var targetType = this.getAttribute('data-type');

  // Can only drop into folders
  if (targetType !== 'folder') return;

  // Can't drop folder into itself
  if (draggedItem.type === 'folder' && draggedItem.id === targetId) return;

  var lib = getCurrentBrandLibrary();

  if (draggedItem.type === 'file') {
    var file = lib.files.find(function(f) { return f.id === draggedItem.id; });
    if (file) {
      file.folderId = targetId;
      saveLibrary();
      renderLibrary();
      showToast('File moved', 'success');
    }
  } else if (draggedItem.type === 'folder') {
    // Check if not dropping into a child folder
    if (!isChildFolder(draggedItem.id, targetId, lib)) {
      var folder = lib.folders.find(function(f) { return f.id === draggedItem.id; });
      if (folder) {
        folder.parentId = targetId;
        saveLibrary();
        renderLibrary();
        showToast('Folder moved', 'success');
      }
    } else {
      showToast('Cannot move folder into its own subfolder', 'error');
    }
  }
}

function isChildFolder(parentId, childId, lib) {
  var folder = lib.folders.find(function(f) { return f.id === childId; });
  if (!folder) return false;
  if (folder.parentId === parentId) return true;
  if (folder.parentId === 'root') return false;
  return isChildFolder(parentId, folder.parentId, lib);
}

// ═══════════════════════════════════════════════════════════════
// FINDER-STYLE LIBRARY VIEW
// ═══════════════════════════════════════════════════════════════
var libraryCurrentFolder = 'all';
var libraryViewMode = 'grid';
var librarySearchQuery = '';

// Helper function to get library for a brand by index
function getLibraryForBrandIndex(brandIdx) {
  // v10.5.25: Support LifeAI library (brandIdx === -1)
  if (brandIdx === -1) {
    return getLifeLibrary();
  }
  var brand = brands[brandIdx];
  if (!brand) return { folders: [], files: [] };
  
  var key = brand.name; // Use brand name as key since brands don't have id
  if (!fileLibrary[key]) {
    fileLibrary[key] = {
      folders: [{ id: 'root', name: 'Root', parentId: null, children: [] }],
      files: []
    };
  }
  return fileLibrary[key];
}

/**
 * v10.5.25: Mode-aware library save - saves to correct storage based on brandIdx
 */
function saveLibraryForBrandIndex(brandIdx) {
  if (brandIdx === -1) {
    saveLifeLibrary();
  } else {
    saveLibrary();
  }
}

function renderLibraryBrands() {
  // Find the Brands section in library sidebar
  var brandsSection = document.querySelector('.finder-sidebar-content');
  if (!brandsSection) return;
  
  // Find or create the brands container
  var brandsHeader = Array.from(brandsSection.children).find(function(el) {
    return el.textContent === 'Brands';
  });
  
  if (!brandsHeader) return;
  
  // Remove all existing brand folders
  var nextEl = brandsHeader.nextElementSibling;
  while (nextEl && !nextEl.classList.contains('finder-sidebar-header')) {
    var toRemove = nextEl;
    nextEl = nextEl.nextElementSibling;
    if (toRemove.dataset.folder && toRemove.dataset.folder.startsWith('brand-')) {
      toRemove.remove();
    }
  }
  
  // Add brand folders dynamically
  brands.forEach(function(brand, idx) {
    var brandFolder = document.createElement('div');
    brandFolder.className = 'finder-folder';
    brandFolder.dataset.folder = 'brand-' + idx;
    brandFolder.onclick = function() { selectLibraryFolder('brand-' + idx); };
    brandFolder.innerHTML = '<span class="finder-folder-name">' + escapeHtml(brand.name || '') + '</span>'; // v30.1: XSS fix
    
    // Insert after brands header
    if (nextEl) {
      brandsSection.insertBefore(brandFolder, nextEl);
    } else {
      brandsSection.appendChild(brandFolder);
    }
  });
}

function renderLibraryView() {
  // v10.5.25: Mode-aware Library - show BrandAI or LifeAI content based on current mode
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  
  if (isLifeMode) {
    renderLifeLibrary();
  } else {
    renderLibraryBrandCards();
  }
}

// SVG icons for library folders
var libraryFolderIcons = {
  'folder': icon('folder', {size: 20, strokeWidth: 1.5}),
  'chat': icon('chat', {size: 20, strokeWidth: 1.5}),
  'sparkles': icon('sparkles', {size: 20, strokeWidth: 1.5}),
  'envelope': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>',
  'phone': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  'chart': icon('chart', {size: 20, strokeWidth: 1.5}),
  'lightning': icon('lightning', {size: 20, strokeWidth: 1.5}),
  'document': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  'briefcase': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>',
  'archive': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>',
  'plus': icon('plus', {size: 16}),
  'note': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h8l6-6V5a2 2 0 00-2-2z"/><path d="M13 21v-6h6M7 7h10M7 11h10M7 15h4"/></svg>'
};

// Default folders with SVG icons
var libraryDefaultFolders = [
  { id: 'all', icon: 'folder', name: 'All Files' },
  { id: 'brandai-chats', icon: 'chat', name: 'BrandAI Chats' },
  { id: 'documents', icon: 'document', name: 'Documents' },
  { id: 'presentations', icon: 'sparkles', name: 'Presentations' },
  { id: 'emails', icon: 'envelope', name: 'Emails' },
  { id: 'social', icon: 'phone', name: 'Social Media' },
  { id: 'strategy', icon: 'chart', name: 'Strategy' },
  { id: 'scheduled-outputs', icon: 'lightning', name: 'Scheduled Outputs' },
  { id: 'bloom', icon: 'sparkles', name: 'Bloom Posts' }
];

// Track which brand is being viewed in files section
var libraryViewingBrandIdx = null;

/**
 * v9.1.14: Toggle to filter showing only selected brand
 */
function toggleLibraryBrandFilter() {
  var toggle = document.getElementById('libraryFilterToggle');
  var checkbox = document.getElementById('libraryHideOtherBrands');
  
  if (checkbox) {
    checkbox.checked = !checkbox.checked;
  }
  
  if (toggle) {
    toggle.classList.toggle('active', checkbox && checkbox.checked);
  }
  
  renderLibraryBrandCards();
}

/**
 * v9.1.14: Toggle expand/collapse for a brand card
 */
function toggleLibraryBrandCard(brandIdx) {
  var card = document.querySelector('.library-brand-card[data-brand-idx="' + brandIdx + '"]');
  if (card) {
    // v9.1.14: Allow multiple cards to be expanded simultaneously
    card.classList.toggle('expanded');
  }
}

/**
 * v10.5.25: Render LifeAI Library (single card for life content)
 */
function renderLifeLibrary() {
  var container = document.getElementById('libraryBrandsGrid');
  if (!container) return;
  
  // Get or create life library
  var lifeLib = getLifeLibrary();
  var totalFiles = lifeLib.files ? lifeLib.files.length : 0;
  
  var html = '';
  
  // Single "Life" card
  html += '<div class="library-brand-card expanded life-library-card" data-brand-idx="-1">';
  
  // Header
  html += '<div class="library-brand-header">';
  html += '<div class="library-brand-info">';
  html += '<div class="library-brand-label" style="color: var(--life-accent);">LIFE LIBRARY</div>';
  html += '<span class="library-brand-name">Personal Files</span>';
  if (totalFiles > 0) {
    html += '<div class="library-brand-meta"><span class="library-brand-count" style="background: var(--life-accent); color: #fff;">' + totalFiles + '</span></div>';
  }
  html += '</div>';
  html += '</div>';
  
  // Content - always expanded
  html += '<div class="library-brand-content" style="display: block;">';
  html += '<div class="library-brand-inner">';
  
  // Folder grid
  html += '<div class="library-folder-grid">';
  
  // v11.0.5: Default life folders - unified with Save Modal defaults
  var lifeDefaultFolders = [
    { id: 'all', name: 'All Files', icon: 'folder' },
    { id: 'journals', name: 'Journals', icon: 'document' },
    { id: 'notes', name: 'Notes', icon: 'note' },
    { id: 'goals', name: 'Goals', icon: 'lightning' },
    { id: 'ideas', name: 'Ideas', icon: 'sparkles' },
    { id: 'plans', name: 'Plans', icon: 'chart' },
    { id: 'reflections', name: 'Reflections', icon: 'chat' }
  ];
  
  // Get custom folder names to skip duplicates
  var customFolderNames = [];
  if (lifeLib.folders) {
    customFolderNames = lifeLib.folders.filter(function(f) { return f.id !== 'root'; }).map(function(f) { return f.name.toLowerCase(); });
  }
  
  lifeDefaultFolders.forEach(function(folder) {
    // Skip if a custom folder with same name exists
    if (folder.id !== 'all' && customFolderNames.indexOf(folder.name.toLowerCase()) !== -1) return;
    
    var count = getLifeFolderCount(folder.id);
    html += '<div class="library-folder-tile" onclick="event.stopPropagation(); openLifeFolder(\'' + folder.id + '\')">';
    html += '<span class="folder-icon" style="color: var(--life-accent);">' + libraryFolderIcons[folder.icon] + '</span>';
    html += '<span class="folder-name">' + folder.name + '</span>';
    if (count > 0) {
      html += '<span class="folder-count" style="background: var(--life-accent); color: #fff;">' + count + '</span>';
    }
    html += '</div>';
  });
  
  // Custom life folders
  if (lifeLib.folders) {
    lifeLib.folders.forEach(function(folder) {
      if (folder.id === 'root') return;
      if (folder.parentId && folder.parentId !== 'root') return;
      var count = getLifeFolderCount(folder.id);
      var iconSvg = folder.icon && libraryFolderIcons[folder.icon] ? libraryFolderIcons[folder.icon] : libraryFolderIcons['folder'];
      html += '<div class="library-folder-tile custom-folder" onclick="event.stopPropagation(); openLifeFolder(\'' + folder.id + '\')" data-folder-id="' + folder.id + '">';
      html += '<span class="folder-icon" style="color: var(--life-accent);">' + iconSvg + '</span>';
      html += '<span class="folder-name">' + escapeHtml(folder.name) + '</span>';
      if (count > 0) {
        html += '<span class="folder-count" style="background: var(--life-accent); color: #fff;">' + count + '</span>';
      }
      // Action buttons
      html += '<div class="folder-actions">';
      html += '<button class="folder-action-btn" onclick="event.stopPropagation(); renameLifeFolder(\'' + folder.id + '\')" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
      html += '<button class="folder-action-btn delete" onclick="event.stopPropagation(); deleteLifeFolder(\'' + folder.id + '\')" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
      html += '</div>';
      html += '</div>';
    });
  }
  
  // Add folder tile
  html += '<div class="library-folder-tile library-add-folder-tile" onclick="event.stopPropagation(); openNewLifeFolderModal()">';
  html += '<span class="folder-icon">' + libraryFolderIcons['plus'] + '</span>';
  html += '<span class="folder-name">New Folder</span>';
  html += '</div>';
  
  // v11.0.5: Upload file tile
  html += '<div class="library-folder-tile library-upload-tile" onclick="event.stopPropagation(); uploadFileToLifeLibrary()" style="border-color: var(--life-accent);">';
  html += '<span class="folder-icon" style="color: var(--life-accent);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></span>';
  html += '<span class="folder-name">Upload File</span>';
  html += '</div>';
  
  html += '</div>'; // folder-grid
  html += '</div>'; // brand-inner
  html += '</div>'; // brand-content
  html += '</div>'; // brand-card
  
  container.innerHTML = html;
  
  // Hide the brand filter toggle in life mode
  var filterToggle = document.getElementById('libraryFilterToggle');
  if (filterToggle) filterToggle.style.display = 'none';
  
  // Make sure we're showing the brands list, not files
  var brandsList = document.getElementById('libraryBrandsGrid');
  var filesSection = document.getElementById('libraryFilesSection');
  if (brandsList) brandsList.style.display = '';
  if (filesSection) filesSection.classList.add('hidden');
}

/**
 * v10.5.25: Get the LifeAI library storage - reads from localStorage as single source of truth
 */
function getLifeLibrary() {
  // v15.30: Per-profile storage key - each LifeAI profile gets its own library
  var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var storageKey = 'roweos_life_library_profile_' + profileIdx;
  var saved = localStorage.getItem(storageKey);
  // v15.30: Migrate old shared key to profile 0 on first access
  if (!saved && profileIdx === 0) {
    saved = localStorage.getItem('roweos_life_library');
  }
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      // Merge into fileLibrary in-memory cache
      fileLibrary['_life'] = {
        folders: parsed.folders || [{ id: 'root', name: 'Root', parentId: null }],
        files: parsed.files || []
      };
      // v11.0.5: Debug logging
      console.log('[getLifeLibrary] Loaded', fileLibrary['_life'].files.length, 'files from localStorage');
    } catch(e) {
      console.warn('Failed to parse roweos_life_library:', e);
    }
  }
  if (!fileLibrary['_life']) {
    fileLibrary['_life'] = {
      folders: [{ id: 'root', name: 'Root', parentId: null }],
      files: []
    };
  }
  return fileLibrary['_life'];
}

/**
 * v10.5.25: Save LifeAI library back to localStorage
 */
function saveLifeLibrary() {
  var lib = fileLibrary['_life'] || { folders: [], files: [] };
  // v15.30: Per-profile storage key
  var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var storageKey = 'roweos_life_library_profile_' + profileIdx;
  localStorage.setItem(storageKey, JSON.stringify(lib));
  // v25.1: Write-through to Firestore (replaces deprecated syncToFirebase)
  if (typeof writeDB === 'function') {
    writeDB('library/life', { data: JSON.stringify(lib) }, { category: 'library' });
  }
}

/**
 * v11.0.5: Upload file from device to Life Library
 */
function uploadFileToLifeLibrary(targetFolderId) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.csv,.xlsx,.xls';
  input.multiple = true;
  
  // v11.0.5: Max file size 5MB to prevent storage issues
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  
  input.onchange = function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Check file sizes
    var oversized = Array.from(files).filter(function(f) { return f.size > MAX_FILE_SIZE; });
    if (oversized.length > 0) {
      showToast('Files over 5MB not supported: ' + oversized.map(function(f) { return f.name; }).join(', '), 'error');
      return;
    }
    
    var lib = getLifeLibrary();
    var processedCount = 0;
    var folderId = targetFolderId || libraryCurrentFolder || 'all';
    
    // Process each file
    Array.from(files).forEach(function(file) {
      var reader = new FileReader();
      
      reader.onload = function(evt) {
        var content = evt.target.result;
        var isImage = file.type.startsWith('image/');
        var isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|csv)$/i);
        
        var newFile = {
          id: 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: isImage ? 'image' : (isText ? 'text' : 'document'),
          content: content,
          fileType: file.type,
          fileSize: file.size,
          folderId: folderId === 'all' ? null : folderId,
          savedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isUploaded: true,
          storageMode: 'local' // v14.0: default to local storage
        };
        
        lib.files.push(newFile);
        processedCount++;
        
        // When all files processed, save and refresh
        if (processedCount === files.length) {
          saveLifeLibrary();
          showToast(files.length + ' file' + (files.length > 1 ? 's' : '') + ' uploaded', 'success');
          
          // Refresh the view
          if (libraryCurrentFolder) {
            renderLifeFilesForFolder(libraryCurrentFolder);
          } else {
            renderLifeLibrary();
          }
        }
      };
      
      // Read as text for text files, data URL for binary
      if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|csv)$/i)) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };
  
  input.click();
}

/**
 * v10.5.25: Get file count for a life folder
 */
function getLifeFolderCount(folderId) {
  var lib = getLifeLibrary();
  if (folderId === 'all') {
    return lib.files ? lib.files.length : 0;
  }
  return lib.files ? lib.files.filter(function(f) { return f.folderId === folderId; }).length : 0;
}

/**
 * v10.5.25: Open a life folder to show files
 */
function openLifeFolder(folderId) {
  libraryCurrentFolder = folderId;
  libraryViewingBrandIdx = -1; // Special index for life
  
  var filesSection = document.getElementById('libraryFilesSection');
  var brandsGrid = document.getElementById('libraryBrandsGrid');
  var titleEl = document.getElementById('libraryFolderTitle');
  var brandEl = document.getElementById('libraryFilesBrand');
  
  if (filesSection) filesSection.classList.remove('hidden');
  if (brandsGrid) brandsGrid.style.display = 'none';
  
  // Get folder name
  var folderName = 'All Files';
  if (folderId !== 'all') {
    var lifeLib = getLifeLibrary();
    var folder = lifeLib.folders.find(function(f) { return f.id === folderId; });
    if (folder) folderName = folder.name;
    else {
      // Check default folders
      var defaults = { 'notes': 'Notes', 'journals': 'Journals', 'goals': 'Goals' };
      if (defaults[folderId]) folderName = defaults[folderId];
    }
  }
  
  if (titleEl) titleEl.textContent = folderName;
  if (brandEl) brandEl.textContent = 'Life';
  
  renderLifeFilesForFolder(folderId);
}

/**
 * v10.5.25: Render files in a life folder
 */
function renderLifeFilesForFolder(folderId) {
  var container = document.getElementById('libraryFilesGrid');
  var emptyEl = document.getElementById('libraryFilesEmpty');
  if (!container) return;
  
  var lib = getLifeLibrary();
  var files = lib.files || [];
  
  // v11.0.5: Debug logging
  console.log('[renderLifeFilesForFolder] Total files in library:', files.length);
  console.log('[renderLifeFilesForFolder] Filtering by folderId:', folderId);
  
  // Filter by folder
  if (folderId !== 'all') {
    files = files.filter(function(f) { return f.folderId === folderId; });
    console.log('[renderLifeFilesForFolder] After filter:', files.length, 'files');
  }
  
  // v11.0.5: Log file details
  files.forEach(function(f, idx) {
    console.log('[renderLifeFilesForFolder] File ' + idx + ':', f.name, 'id:', f.id, 'folderId:', f.folderId, 'savedAt:', f.savedAt);
  });
  
  // v10.5.25: Get subfolders - allow in default folders like notes, journals, goals
  var subfoldersHtml = '';
  var noSubfolderFolders = ['all']; // Only 'all' should not show subfolders
  if (!noSubfolderFolders.includes(folderId)) {
    var subfolders = lib.folders.filter(function(f) { return f.parentId === folderId; });
    if (subfolders.length > 0) {
      subfoldersHtml = subfolders.map(function(folder) {
        var icon = libraryFolderIcons[folder.icon] || libraryFolderIcons['folder'];
        return '<div class="library-file-card subfolder-card" draggable="true" data-folder-id="' + folder.id + '" ondragstart="handleLifeFolderDragStart(event, \'' + folder.id + '\')" ondragover="handleFolderDragOver(event)" ondragleave="handleFolderDragLeave(event)" ondrop="handleLifeFolderDrop(event, \'' + folder.id + '\')" ondragend="this.style.opacity=1" onclick="openLifeFolder(\'' + folder.id + '\')">' +
          '<div class="file-icon" style="color: var(--life-accent);">' + icon + '</div>' +
          '<div class="file-name">' + escapeHtml(folder.name) + '</div>' +
          '<div class="file-meta">Folder</div>' +
          '<div class="subfolder-actions">' +
            '<button class="subfolder-action-btn" onclick="event.stopPropagation(); renameLifeFolder(\'' + folder.id + '\')" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
            '<button class="subfolder-action-btn delete" onclick="event.stopPropagation(); deleteLifeFolder(\'' + folder.id + '\')" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }
  
  if (files.length === 0 && subfoldersHtml === '') {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  
  emptyEl.classList.add('hidden');
  
  // Sort by date
  files.sort(function(a, b) { return new Date(b.savedAt || 0) - new Date(a.savedAt || 0); });
  
  // v11.0.5: Action cards - New Note and Upload File
  var actionCardsHtml = '';
  actionCardsHtml += '<div class="library-file-card new-note-card" onclick="createNewLifeStickyNote()" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px dashed #f59e0b;">';
  actionCardsHtml += '<div class="file-icon" style="color: #78350f;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg></div>';
  actionCardsHtml += '<div class="file-name" style="color: #78350f;">New Note</div>';
  actionCardsHtml += '</div>';
  
  actionCardsHtml += '<div class="library-file-card upload-file-card" onclick="uploadFileToLifeLibrary(\'' + folderId + '\')" style="border: 2px dashed var(--life-accent);">';
  actionCardsHtml += '<div class="file-icon" style="color: var(--life-accent);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></div>';
  actionCardsHtml += '<div class="file-name">Upload File</div>';
  actionCardsHtml += '</div>';
  
  var html = files.map(function(file) {
    var dateStr = file.savedAt ? new Date(file.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
    var icon = (file.type === 'sticky' || file.isNote) ? libraryFolderIcons['note'] : libraryFolderIcons['document'];
    // v10.5.25: Support note colors
    // v11.0.5: Added neutral color support with dark mode detection
    var noteColor = file.color || 'yellow';
    var isDarkMode = document.documentElement.classList.contains('dark-mode') || 
                     window.matchMedia('(prefers-color-scheme: dark)').matches;
    var colorGradients = {
      'yellow': 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      'blue': 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)',
      'green': 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)',
      'pink': 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)',
      'purple': 'linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 100%)',
      'orange': 'linear-gradient(135deg, #ffedd5 0%, #fdba74 100%)',
      'neutral': isDarkMode ? '#1a1a1a' : '#ffffff'
    };
    var colorTextColors = {
      'yellow': '#78350f',
      'blue': '#1e40af',
      'green': '#166534',
      'pink': '#9d174d',
      'purple': '#5b21b6',
      'orange': '#9a3412',
      'neutral': isDarkMode ? '#e5e5e5' : '#171717'
    };
    var isNote = file.type === 'sticky' || file.isNote;
    var bgStyle = isNote ? 'background: ' + (colorGradients[noteColor] || colorGradients['yellow']) + ';' : '';
    var textColor = isNote ? (colorTextColors[noteColor] || colorTextColors['yellow']) : '';
    
    // v11.0.5: Sticky notes need explicit dark text colors (visible on light backgrounds)
    if (isNote) {
      return '<div class="library-file-card sticky-note-card" onclick="openLifeStickyNoteEditor(\'' + file.id + '\')" style="' + bgStyle + '">' +
        '<div class="file-icon" style="color: ' + textColor + ';">' + icon + '</div>' +
        '<div class="file-name" style="color: ' + textColor + ';">' + escapeHtml(file.name || 'Untitled') + '</div>' +
        '<div class="file-meta" style="color: ' + textColor + '; opacity: 0.8;">' + dateStr + '</div>' +
      '</div>';
    }
    
    return '<div class="library-file-card" onclick="openLifeFilePreview(\'' + file.id + '\')" style="' + bgStyle + '">' +
      '<div class="file-icon" style="color: var(--life-accent);">' + icon + '</div>' +
      '<div class="file-name">' + escapeHtml(file.name || 'Untitled') + '</div>' +
      '<div class="file-meta">' + dateStr + '</div>' +
    '</div>';
  }).join('');
  
  container.innerHTML = subfoldersHtml + actionCardsHtml + html;
}

/**
 * v10.5.25: Create new sticky note in LifeAI
 */
function createNewLifeStickyNote() {
  var lib = getLifeLibrary();
  
  // v11.0.5: Determine folder to save note in - use current viewing folder
  var folderId = libraryCurrentFolder || 'notes';
  var specialFolders = ['all'];
  if (specialFolders.includes(folderId)) {
    folderId = 'notes';
  }
  
  console.log('Creating sticky note in folder:', folderId, '(libraryCurrentFolder:', libraryCurrentFolder, ')');
  
  var newNote = {
    id: 'note_' + Date.now(),
    name: 'Untitled Note',
    type: 'sticky',
    content: '',
    isNote: true,
    color: 'yellow', // v11.0.5: Default yellow color
    folderId: folderId,
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  lib.files.push(newNote);
  saveLifeLibrary(); // v10.5.25: Use life-specific save
  
  // v11.0.5: Refresh the view to show the new note
  if (libraryCurrentFolder) {
    renderLifeFilesForFolder(libraryCurrentFolder);
  }
  
  // v10.5.25: Open the note editor immediately
  openLifeStickyNoteEditor(newNote.id);
}

/**
 * v10.5.25: Open sticky note editor for LifeAI
 */
function openLifeStickyNoteEditor(noteId) {
  var lib = getLifeLibrary();
  if (!lib) return;
  
  var note = lib.files.find(function(f) { return f.id === noteId; });
  if (!note) {
    showToast('Note not found', 'error');
    return;
  }
  
  stickyNoteEditing = noteId;
  stickyNoteBrandIdx = -1; // Life mode
  
  // v10.5.25: Simply call the same function used for BrandAI
  // but we need to handle the different lib lookup
  var noteColor = note.color || 'yellow';
  
  // v11.0.5: Check for dark mode for neutral color adaptation
  var isDarkMode = document.documentElement.classList.contains('dark-mode') || 
                   window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  var modal = document.getElementById('stickyNoteEditorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stickyNoteEditorModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 10000;';
    document.body.appendChild(modal);
  }
  
  // v10.5.25: Color gradients and borders
  // v11.0.5: Added 'neutral' - adapts to light/dark mode
  var colorGradients = {
    'yellow': { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#f59e0b', text: '#78350f' },
    'blue': { bg: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', border: '#3b82f6', text: '#1e40af' },
    'green': { bg: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)', border: '#22c55e', text: '#166534' },
    'pink': { bg: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)', border: '#ec4899', text: '#9d174d' },
    'purple': { bg: 'linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 100%)', border: '#8b5cf6', text: '#5b21b6' },
    'orange': { bg: 'linear-gradient(135deg, #ffedd5 0%, #fdba74 100%)', border: '#f97316', text: '#9a3412' },
    'neutral': isDarkMode 
      ? { bg: '#1a1a1a', border: '#404040', text: '#e5e5e5' }
      : { bg: '#ffffff', border: '#d4d4d4', text: '#171717' }
  };
  var colors = colorGradients[noteColor] || colorGradients['yellow'];
  
  modal.innerHTML = '<div id="stickyNoteModalContent" style="position: relative; width: 500px; min-width: 320px; max-width: 90vw; max-height: 80vh; background: ' + colors.bg + '; border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 2px solid ' + colors.border + '; display: flex; flex-direction: column; resize: both; overflow: hidden;">' +
    '<div id="stickyNoteHeader" style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid ' + colors.border + '; cursor: move; user-select: none;">' +
      '<input type="text" id="stickyNoteName" placeholder="Note title..." style="flex: 1; background: transparent; border: none; font-size: var(--text-xl); font-weight: 600; color: ' + colors.text + '; outline: none;">' +
      '<button onclick="closeStickyNoteEditor()" style="width: 28px; height: 28px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-sm); cursor: pointer; color: ' + colors.text + '; font-size: var(--text-xl); display: flex; align-items: center; justify-content: center;">&times;</button>' +
    '</div>' +
    '<div style="padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,0.1); display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap;">' +
      '<div id="stickyNoteToolbar" style="display: flex; gap: var(--space-1); flex-wrap: wrap; flex: 1;">' +
        '<button onclick="stickyNoteFormat(\'bold\')" title="Bold" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + '; font-weight: bold;">B</button>' +
        '<button onclick="stickyNoteFormat(\'italic\')" title="Italic" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + '; font-style: italic;">I</button>' +
        '<button onclick="stickyNoteFormat(\'underline\')" title="Underline" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + '; text-decoration: underline;">U</button>' +
        '<span style="width: 1px; background: rgba(0,0,0,0.2); margin: 0 4px; height: 20px;"></span>' +
        '<button onclick="stickyNoteFormat(\'insertUnorderedList\')" title="Bullet list" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + ';">• List</button>' +
        '<button onclick="stickyNoteInsertCheckbox()" title="Checkbox" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + ';">☐</button>' +
      '</div>' +
      '<div id="stickyNoteColorPicker" style="display: flex; gap: var(--space-1);">' +
        '<button onclick="setStickyNoteColor(\'yellow\')" title="Yellow" style="width: 24px; height: 24px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid ' + (noteColor === 'yellow' ? '#f59e0b' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'blue\')" title="Blue" style="width: 24px; height: 24px; background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%); border: 2px solid ' + (noteColor === 'blue' ? '#3b82f6' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'green\')" title="Green" style="width: 24px; height: 24px; background: linear-gradient(135deg, #dcfce7 0%, #86efac 100%); border: 2px solid ' + (noteColor === 'green' ? '#22c55e' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'pink\')" title="Pink" style="width: 24px; height: 24px; background: linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%); border: 2px solid ' + (noteColor === 'pink' ? '#ec4899' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'purple\')" title="Purple" style="width: 24px; height: 24px; background: linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 100%); border: 2px solid ' + (noteColor === 'purple' ? '#8b5cf6' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'orange\')" title="Orange" style="width: 24px; height: 24px; background: linear-gradient(135deg, #ffedd5 0%, #fdba74 100%); border: 2px solid ' + (noteColor === 'orange' ? '#f97316' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'neutral\')" title="Neutral (B/W)" style="width: 24px; height: 24px; background: ' + (isDarkMode ? '#1a1a1a' : '#ffffff') + '; border: 2px solid ' + (noteColor === 'neutral' ? (isDarkMode ? '#e5e5e5' : '#171717') : '#d4d4d4') + '; border-radius: 50%; cursor: pointer;"></button>' +
      '</div>' +
    '</div>' +
    '<div id="stickyNoteContent" contenteditable="true" style="flex: 1; min-height: 200px; padding: var(--space-4); background: ' + (noteColor === 'neutral' ? (isDarkMode ? '#252525' : '#fafafa') : 'rgba(255,255,255,0.5)') + '; color: ' + colors.text + '; font-size: var(--text-base); line-height: 1.6; outline: none; overflow-y: auto;"></div>' +
    '<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid ' + colors.border + '; gap: var(--space-2); flex-wrap: wrap;">' +
      '<button onclick="deleteStickyNote()" style="padding: 8px 14px; background: #dc2626; color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-base);">Delete</button>' +
      '<div style="display: flex; gap: 6px; flex-wrap: wrap;">' +
        '<button onclick="sendStickyNoteToPulse()" title="Create Pulse Goal" style="padding: 6px 10px; background: var(--life-accent, #22c55e); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); display: flex; align-items: center; gap: var(--space-1);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Pulse</button>' +
        '<button onclick="sendStickyNoteToChat()" title="Send to Chat" style="padding: 6px 10px; background: var(--bg-secondary, #f3f4f6); color: var(--text-primary, #1f2937); border: 1px solid var(--border-color, #e5e7eb); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); display: flex; align-items: center; gap: var(--space-1);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat</button>' +
        '<button onclick="saveStickyNote()" style="padding: 6px 14px; background: ' + colors.text + '; color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-base);">Save</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  
  // Setup drag functionality
  setupStickyNoteDrag();
  
  // Populate with note data
  document.getElementById('stickyNoteName').value = note.name;
  document.getElementById('stickyNoteContent').innerHTML = note.content || '';
  
  // Reset position to center
  var content = document.getElementById('stickyNoteModalContent');
  if (content) {
    content.style.position = 'relative';
    content.style.left = '';
    content.style.top = '';
  }
  
  modal.style.display = 'flex';
  document.getElementById('stickyNoteName').focus();
}

/**
 * v10.5.25: Open new folder modal for LifeAI
 */
function openNewLifeFolderModal() {
  newFolderModalBrandIdx = -1; // Life mode
  document.getElementById('libraryNewFolderModal').classList.remove('hidden');
  document.getElementById('newLibraryFolderName').value = '';
  document.getElementById('newLibraryFolderName').focus();
  
  // v11.0.5: Reset icon selection to first (folder)
  document.querySelectorAll('.library-icon-btn').forEach(function(btn, idx) {
    btn.classList.toggle('selected', idx === 0);
  });
  
  // v11.0.5: Add click handlers for icon buttons (was missing!)
  document.querySelectorAll('.library-icon-btn').forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.library-icon-btn').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
    };
  });
  
  // v10.5.25: Show folder path
  updateNewFolderPath(-1);
}

/**
 * v10.5.25: Rename a life folder
 */
function renameLifeFolder(folderId) {
  var lib = getLifeLibrary();
  var folder = lib.folders.find(function(f) { return f.id === folderId; });
  if (!folder) return;
  
  var newName = prompt('Enter new folder name:', folder.name);
  if (!newName || !newName.trim() || newName.trim() === folder.name) return;
  
  folder.name = newName.trim();
  saveLifeLibrary(); // v10.5.25: Use life-specific save
  renderLifeLibrary();
  if (libraryCurrentFolder === folderId) {
    document.getElementById('libraryFolderTitle').textContent = folder.name;
  }
  showToast('Folder renamed', 'success');
}

/**
 * v10.5.25: Delete a life folder
 */
function deleteLifeFolder(folderId) {
  var lib = getLifeLibrary();
  var folder = lib.folders.find(function(f) { return f.id === folderId; });
  if (!folder) return;
  
  var filesInFolder = lib.files.filter(function(f) { return f.folderId === folderId; }).length;
  var subfolders = lib.folders.filter(function(f) { return f.parentId === folderId; }).length;
  
  var message = 'Delete folder "' + folder.name + '"?';
  if (filesInFolder > 0 || subfolders > 0) {
    message = 'Delete folder "' + folder.name + '" and all its contents (' + filesInFolder + ' files, ' + subfolders + ' subfolders)?';
  }
  
  if (!confirm(message)) return;
  
  // Recursively delete
  function deleteFolderRecursive(fId) {
    var childFolders = lib.folders.filter(function(f) { return f.parentId === fId; });
    childFolders.forEach(function(child) {
      deleteFolderRecursive(child.id);
    });
    lib.files = lib.files.filter(function(f) { return f.folderId !== fId; });
    lib.folders = lib.folders.filter(function(f) { return f.id !== fId; });
  }
  
  deleteFolderRecursive(folderId);
  saveLifeLibrary(); // v10.5.25: Use life-specific save
  renderLifeLibrary();
  showToast('Folder deleted', 'info');
}

/**
 * v10.5.25: Open life file preview - full-featured, matches openLibraryFilePreview
 */
function openLifeFilePreview(fileId) {
  var lib = getLifeLibrary();
  var file = lib.files.find(function(f) { return f.id === fileId; });
  if (!file) return;
  
  // v10.5.25: If it's a sticky note, open the editor instead
  if (file.type === 'sticky' || file.isNote) {
    openLifeStickyNoteEditor(fileId);
    return;
  }
  
  // v10.5.25: Set the canonical state variables (used by delete, rename, notes, export)
  libraryPreviewFileId = fileId;
  libraryPreviewBrandIdx = -1;
  
  // Use existing preview modal
  var modal = document.getElementById('libraryPreviewModal');
  var titleEl = document.getElementById('libraryPreviewTitle');
  var metaEl = document.getElementById('libraryPreviewMeta');
  var bodyEl = document.getElementById('libraryPreviewBody');
  
  if (titleEl) titleEl.textContent = file.name || 'Untitled';
  if (metaEl) {
    var dateStr = file.savedAt ? new Date(file.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
    metaEl.textContent = dateStr + ' • Life';
  }
  
  // v10.5.25: Detect conversation content and render properly
  // v11.0.5: Also check for conversation property (newer format)
  var isConversation = (file.content && file.content.indexOf('data-conversation=') !== -1) ||
                       (file.conversation && Array.isArray(file.conversation) && file.conversation.length > 0);
  
  // Show/hide Continue button
  var continueBtn = document.getElementById('libraryContinueBtn');
  if (continueBtn) {
    continueBtn.classList.toggle('hidden', !isConversation);
    // Update label for LifeAI context
    if (isConversation) {
      continueBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Continue in LifeAI';
    }
  }
  
  // v10.5.26: Show Upload button for non-conversation files (inverse of Continue)
  var uploadBtn = document.getElementById('libraryUploadBtn');
  if (uploadBtn) {
    uploadBtn.classList.toggle('hidden', isConversation);
    if (!isConversation) {
      uploadBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg> Upload to LifeAI Chat';
    }
  }
  
  // Render content
  if (bodyEl) {
    console.log('[LifePreview] file.conversation:', file.conversation ? file.conversation.length + ' messages' : 'undefined');
    console.log('[LifePreview] file.content:', file.content ? file.content.substring(0, 200) + '...' : 'undefined');
    console.log('[LifePreview] isConversation:', isConversation);
    console.log('[LifePreview] file.type:', file.type, 'file.fileType:', file.fileType, 'file.isUploaded:', file.isUploaded);
    
    // v11.0.5: Handle uploaded files (PDF, images, etc.)
    if (file.isUploaded && file.content) {
      var content = file.content;
      
      // Handle PDFs
      if (file.fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        bodyEl.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; text-align: center;">' +
          '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--life-accent)" stroke-width="1.5" style="margin-bottom: var(--space-4);"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M10 9H8v6h2v-2h1a2 2 0 000-4h-1z"/><path d="M16 9h-2v6h2a2 2 0 002-2v-2a2 2 0 00-2-2z"/></svg>' +
          '<div style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2);">PDF Document</div>' +
          '<div style="font-size: var(--text-base); color: var(--text-secondary); margin-bottom: var(--space-5);">' + escapeHtml(file.name) + (file.fileSize ? ' • ' + Math.round(file.fileSize / 1024) + ' KB' : '') + '</div>' +
          '<div style="display: flex; gap: var(--space-3);">' +
            '<button onclick="viewUploadedPDF(\'' + file.id + '\')" style="padding: 10px 20px; background: var(--life-accent); color: #fff; border: none; border-radius: var(--radius-md); font-size: var(--text-base); font-weight: 600; cursor: pointer;">View PDF</button>' +
            '<button onclick="downloadUploadedFile(\'' + file.id + '\')" style="padding: 10px 20px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--text-base); cursor: pointer;">Download</button>' +
          '</div>' +
        '</div>';
      }
      // Handle images
      else if (file.fileType && file.fileType.startsWith('image/')) {
        bodyEl.innerHTML = '<div style="display: flex; justify-content: center; padding: var(--space-5);"><img src="' + content + '" style="max-width: 100%; max-height: 60vh; border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(0,0,0,0.2);" alt="' + escapeHtml(file.name) + '"></div>';
      }
      // Handle text files
      else if (file.type === 'text' || (file.fileType && file.fileType.startsWith('text/'))) {
        bodyEl.innerHTML = '<div class="library-preview-text" style="white-space: pre-wrap; font-family: monospace; font-size: var(--text-base); padding: var(--space-5); background: var(--bg-secondary); border-radius: var(--radius-md); max-height: 60vh; overflow-y: auto;">' + escapeHtml(content) + '</div>';
      }
      // Other files - show download option
      else {
        bodyEl.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; text-align: center;">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" style="margin-bottom: var(--space-4);"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' +
          '<div style="font-size: var(--text-base); color: var(--text-secondary); margin-bottom: var(--space-4);">' + escapeHtml(file.name) + '</div>' +
          '<button onclick="downloadUploadedFile(\'' + file.id + '\')" style="padding: 10px 20px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--text-base); cursor: pointer;">Download File</button>' +
        '</div>';
      }
    }
    // v11.0.5: Handle both old format (data-conversation in content) and new format (file.conversation array)
    else if (isConversation) {
      // Check if we have direct conversation array (newer format)
      if (file.conversation && Array.isArray(file.conversation) && file.conversation.length > 0) {
        console.log('[LifePreview] Rendering from conversation array');
        bodyEl.innerHTML = renderConversationFromArray(file.conversation, 'Life');
      } else if (file.content) {
        console.log('[LifePreview] Rendering from content data-conversation');
        bodyEl.innerHTML = convertConversationToStyledFormat(file.content, 'Life');
      } else {
        console.log('[LifePreview] No content available!');
        bodyEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No content available</p>';
      }
    } else if (file.content) {
      bodyEl.innerHTML = '<div class="library-preview-text">' + file.content + '</div>';
    } else {
      bodyEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No content available</p>';
    }
  }
  
  // v10.5.25: Load notes
  var notesTextarea = document.getElementById('libraryNotesTextarea');
  if (notesTextarea) {
    notesTextarea.value = file.notes || '';
  }
  
  if (modal) modal.classList.remove('hidden');
}

/**
 * v11.0.5: View uploaded PDF in new tab
 */
function viewUploadedPDF(fileId) {
  var lib = getLifeLibrary();
  var file = lib.files.find(function(f) { return f.id === fileId; });
  if (!file || !file.content) {
    showToast('PDF not found', 'error');
    return;
  }
  
  // Open base64 PDF in new tab
  var newTab = window.open();
  if (newTab) {
    newTab.document.write('<html><head><title>' + escapeHtml(file.name) + '</title><style>body{margin:0;padding:0;}</style></head><body><embed width="100%" height="100%" src="' + file.content + '" type="application/pdf"></body></html>');
    newTab.document.close();
  } else {
    showToast('Pop-up blocked - allow pop-ups to view PDF', 'warning');
  }
}

/**
 * v11.0.5: Download uploaded file
 */
function downloadUploadedFile(fileId) {
  var lib = getLifeLibrary();
  var file = lib.files.find(function(f) { return f.id === fileId; });
  if (!file || !file.content) {
    showToast('File not found', 'error');
    return;
  }
  
  var link = document.createElement('a');
  link.href = file.content;
  link.download = file.name || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Downloading ' + file.name, 'success');
}

/**
 * v9.1.14: Render all brand cards with collapsible folders
 */
function renderLibraryBrandCards() {
  var container = document.getElementById('libraryBrandsGrid');
  if (!container) return;
  
  var hideOthers = document.getElementById('libraryHideOtherBrands');
  var showOnlySelected = hideOthers && hideOthers.checked;
  
  var html = '';
  
  brands.forEach(function(brand, brandIdx) {
    // If filter is on, only show selected brand
    if (showOnlySelected && brandIdx !== selectedBrand) return;
    
    var lib = getLibraryForBrandIndex(brandIdx);
    var totalFiles = lib && lib.files ? lib.files.length : 0;
    
    // v9.1.14: Add documents count
    var brandKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(brandIdx) : 'brand_' + brandIdx;
    if (brandMemory && brandMemory[brandKey] && brandMemory[brandKey].documents) {
      totalFiles += brandMemory[brandKey].documents.length;
    }
    
    // Expand selected brand by default
    var isExpanded = brandIdx === selectedBrand;
    
    // Brand card - collapsible
    // v15.14: Removed per-brand color border (conflicts with current brand accent in dark mode)
    html += '<div class="library-brand-card' + (isExpanded ? ' expanded' : '') + '" data-brand-idx="' + brandIdx + '">';

    // v9.1.14: Header contains label + name (label animates in on expand)
    html += '<div class="library-brand-header" onclick="toggleLibraryBrandCard(' + brandIdx + ')">';
    html += '<div class="library-brand-info">';
    html += '<div class="library-brand-label">BRAND LIBRARY</div>';
    html += '<span class="library-brand-name">' + escapeHtml(brand.name) + '</span>';
    if (totalFiles > 0) {
      html += '<div class="library-brand-meta"><span class="library-brand-count">' + totalFiles + '</span></div>';
    }
    html += '</div>';
    html += '<svg class="library-brand-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + ICONS.chevronDown + '</svg>';
    html += '</div>';
    
    // Expandable content - just folders (no duplicate label/name)
    html += '<div class="library-brand-content">';
    html += '<div class="library-brand-inner">';
    
    // Folder grid (no label/title here anymore)
    html += '<div class="library-folder-grid">';
    
    // Render default folders
    libraryDefaultFolders.forEach(function(folder) {
      var count = getLibraryFolderCount(brandIdx, folder.id);
      html += '<div class="library-folder-tile" onclick="event.stopPropagation(); openLibraryFolderForBrand(' + brandIdx + ', \'' + folder.id + '\')">';
      html += '<span class="folder-icon">' + libraryFolderIcons[folder.icon] + '</span>';
      html += '<span class="folder-name">' + folder.name + '</span>';
      if (count > 0) {
        html += '<span class="folder-count">' + count + '</span>';
      }
      html += '</div>';
    });
    
    // Render custom folders
    if (lib && lib.folders) {
      lib.folders.forEach(function(folder) {
        if (folder.id === 'root') return;
        // v10.5.25: Only show root-level folders here (parentId is 'root' or null)
        if (folder.parentId && folder.parentId !== 'root') return;
        var count = getLibraryFolderCount(brandIdx, folder.id);
        var iconSvg = folder.icon && libraryFolderIcons[folder.icon] ? libraryFolderIcons[folder.icon] : libraryFolderIcons['folder'];
        html += '<div class="library-folder-tile custom-folder" onclick="event.stopPropagation(); openLibraryFolderForBrand(' + brandIdx + ', \'' + folder.id + '\')" data-folder-id="' + folder.id + '" data-brand-idx="' + brandIdx + '">';
        html += '<span class="folder-icon">' + iconSvg + '</span>';
        html += '<span class="folder-name">' + escapeHtml(folder.name) + '</span>';
        if (count > 0) {
          html += '<span class="folder-count">' + count + '</span>';
        }
        // v10.5.25: Action buttons for custom folders
        html += '<div class="folder-actions">';
        html += '<button class="folder-action-btn" onclick="event.stopPropagation(); renameLibraryFolder(\'' + folder.id + '\', ' + brandIdx + ')" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
        html += '<button class="folder-action-btn delete" onclick="event.stopPropagation(); deleteLibraryFolder(\'' + folder.id + '\', ' + brandIdx + ')" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
        html += '</div>';
        html += '</div>';
      });
    }
    
    // Add folder tile
    html += '<div class="library-folder-tile library-add-folder-tile" onclick="event.stopPropagation(); openNewFolderModalForBrand(' + brandIdx + ')">';
    html += '<span class="folder-icon">' + libraryFolderIcons['plus'] + '</span>';
    html += '<span class="folder-name">New Folder</span>';
    html += '</div>';
    
    html += '</div>'; // folder-grid
    html += '</div>'; // brand-inner
    html += '</div>'; // brand-content
    html += '</div>'; // brand-card
  });
  
  container.innerHTML = html;
  
  // Make sure we're showing the brands list, not files
  var brandsList = document.getElementById('libraryBrandsGrid');
  var filesSection = document.getElementById('libraryFilesSection');
  if (brandsList) brandsList.style.display = '';
  if (filesSection) filesSection.classList.add('hidden');
}

/**
 * v9.1.14: Get file count for a folder
 */
function getLibraryFolderCount(brandIdx, folderId) {
  var lib = getLibraryForBrandIndex(brandIdx);
  var fileCount = lib && lib.files ? lib.files.length : 0;
  
  // v9.1.14: Count documents from brandMemory for this brand
  var brandKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(brandIdx) : 'brand_' + brandIdx;
  var docsCount = 0;
  if (brandMemory && brandMemory[brandKey] && brandMemory[brandKey].documents) {
    docsCount = brandMemory[brandKey].documents.length;
  }
  
  if (folderId === 'all') {
    return fileCount + docsCount;
  }
  
  // v9.1.14: Documents folder shows identity uploads
  if (folderId === 'documents') {
    return docsCount;
  }
  
  if (!lib || !lib.files) return 0;
  
  // Map folder IDs to file properties
  if (folderId === 'brandai-chats') {
    return lib.files.filter(function(f) {
      return f.content && f.content.includes('data-conversation=');
    }).length;
  }
  
  if (folderId === 'scheduled-outputs') {
    return lib.files.filter(function(f) {
      return f.folderId === 'scheduled-outputs' || f.isScheduled;
    }).length;
  }
  
  return lib.files.filter(function(f) { return f.folderId === folderId; }).length;
}

/**
 * v9.1.14: Open a folder for a specific brand
 */
function openLibraryFolderForBrand(brandIdx, folderId) {
  libraryViewingBrandIdx = brandIdx;
  libraryCurrentFolder = folderId;
  
  // v10.5.25: Track parent folder for nested folder creation
  window.currentFolderParentId = folderId;
  
  var brand = brands[brandIdx];
  var folderName = 'All Files';
  
  // Get folder name
  var defaultFolder = libraryDefaultFolders.find(function(f) { return f.id === folderId; });
  if (defaultFolder) {
    folderName = defaultFolder.name;
  } else {
    var lib = getLibraryForBrandIndex(brandIdx);
    if (lib && lib.folders) {
      var customFolder = lib.folders.find(function(f) { return f.id === folderId; });
      if (customFolder) {
        folderName = customFolder.name;
      }
    }
  }
  
  // Update UI
  document.getElementById('libraryFolderTitle').textContent = folderName;
  document.getElementById('libraryFilesBrand').textContent = brand ? (brand.shortName || brand.name) : '';
  
  // Hide brand cards, show files
  document.getElementById('libraryBrandsGrid').style.display = 'none';
  document.getElementById('libraryFilesSection').classList.remove('hidden');
  
  // Render files
  renderLibraryFilesForBrand(brandIdx, folderId);
}

/**
 * v9.1.14: Render files in a folder for a specific brand
 * v10.5.25: Also render subfolders within the current folder
 */
function renderLibraryFilesForBrand(brandIdx, folderId) {
  var lib = getLibraryForBrandIndex(brandIdx);
  var container = document.getElementById('libraryFilesGrid');
  var emptyEl = document.getElementById('libraryFilesEmpty');
  
  // v9.1.14: Handle documents folder - show files from brandMemory
  if (folderId === 'documents') {
    var brandKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(brandIdx) : 'brand_' + brandIdx;
    var docs = [];
    if (brandMemory && brandMemory[brandKey] && brandMemory[brandKey].documents) {
      docs = brandMemory[brandKey].documents;
    }
    
    if (docs.length === 0) {
      container.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }
    
    emptyEl.classList.add('hidden');
    
    // Sort by date (newest first)
    docs.sort(function(a, b) { 
      return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0); 
    });
    
    var html = docs.map(function(doc, idx) {
      var dateStr = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '';
      var sizeStr = doc.size ? formatFileSize(doc.size) : '';
      var statusStr = doc.processed ? 'Processed' : 'Pending';
      
      return '<div class="library-file-card" onclick="openIdentityDocPreview(' + brandIdx + ', ' + idx + ')">' +
        '<div class="file-icon">' + libraryFolderIcons['document'] + '</div>' +
        '<div class="file-name">' + escapeHtml(doc.name) + '</div>' +
        '<div class="file-meta">' + statusStr + ' • ' + sizeStr + ' • ' + dateStr + '</div>' +
      '</div>';
    }).join('');
    
    container.innerHTML = html;
    return;
  }
  
  if (!lib || !lib.files) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  
  // Filter files by folder
  var files;
  if (folderId === 'all') {
    // v9.1.14: Include ALL files (notes, outputs, docs) in All Files view
    files = lib.files.slice();
    var brandKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(brandIdx) : 'brand_' + brandIdx;
    if (brandMemory && brandMemory[brandKey] && brandMemory[brandKey].documents) {
      brandMemory[brandKey].documents.forEach(function(doc, idx) {
        files.push({
          id: 'doc_' + idx,
          name: doc.name,
          savedAt: doc.uploadedAt,
          isDocument: true,
          docIndex: idx,
          size: doc.size,
          processed: doc.processed
        });
      });
    }
  } else if (folderId === 'brandai-chats') {
    files = lib.files.filter(function(f) {
      return f.content && f.content.includes('data-conversation=');
    });
  } else if (folderId === 'scheduled-outputs') {
    files = lib.files.filter(function(f) {
      return f.folderId === 'scheduled-outputs' || f.isScheduled;
    });
  } else if (folderId === 'root') {
    // v10.5.25: Root shows files with folderId='root' OR no folderId
    files = lib.files.filter(function(f) { return !f.folderId || f.folderId === 'root'; });
  } else {
    files = lib.files.filter(function(f) { return f.folderId === folderId; });
  }
  
  // v10.5.25: No inline action cards - use header buttons instead
  var hideActionsFolders = ['all', 'brandai-chats', 'scheduled-outputs', 'documents'];
  
  // v10.5.25: Get subfolders for this folder
  var subfoldersHtml = '';
  if (lib && lib.folders && !hideActionsFolders.includes(folderId)) {
    var subfolders = lib.folders.filter(function(f) { return f.parentId === folderId; });
    if (subfolders.length > 0) {
      subfoldersHtml = subfolders.map(function(folder) {
        var icon = libraryFolderIcons[folder.icon] || libraryFolderIcons['folder'];
        return '<div class="library-file-card subfolder-card" draggable="true" data-folder-id="' + folder.id + '" ondragstart="handleFolderDragStart(event, \'' + folder.id + '\', ' + brandIdx + ')" ondragover="handleFolderDragOver(event)" ondragleave="handleFolderDragLeave(event)" ondrop="handleFolderDrop(event, \'' + folder.id + '\', ' + brandIdx + ')" ondragend="this.style.opacity=1" onclick="openLibraryFolderForBrand(' + brandIdx + ', \'' + folder.id + '\')">' +
          '<div class="file-icon">' + icon + '</div>' +
          '<div class="file-name">' + escapeHtml(folder.name) + '</div>' +
          '<div class="file-meta">Folder</div>' +
          '<div class="subfolder-actions">' +
            '<button class="subfolder-action-btn" onclick="event.stopPropagation(); renameLibraryFolder(\'' + folder.id + '\', ' + brandIdx + ')" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
            '<button class="subfolder-action-btn delete" onclick="event.stopPropagation(); deleteLibraryFolder(\'' + folder.id + '\', ' + brandIdx + ')" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }
  
  if (files.length === 0 && subfoldersHtml === '') {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  
  // v10.5.25: If empty but we have action buttons, show them
  if (files.length === 0) {
    container.innerHTML = subfoldersHtml;
    emptyEl.classList.add('hidden');
    return;
  }
  
  emptyEl.classList.add('hidden');
  
  // Sort by date (newest first)
  files.sort(function(a, b) { return new Date(b.savedAt || 0) - new Date(a.savedAt || 0); });
  
  // v14.0: Storage mode icon builder
  var storageIcon = function(fileId, mode) {
    var isCloud = mode === 'cloud';
    var title = isCloud ? 'Synced to cloud' : 'Stored locally';
    var color = isCloud ? '#60a5fa' : 'var(--text-tertiary)';
    var svg = isCloud
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + color + '" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + color + '" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>';
    return '<button class="file-storage-toggle" onclick="event.stopPropagation(); toggleFileStorageMode(\'' + fileId + '\', ' + brandIdx + ')" title="' + title + '" style="position:absolute; top:8px; right:8px; background:none; border:none; cursor:pointer; padding:4px; opacity:0.6; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">' + svg + '</button>';
  };

  var html = files.map(function(file) {
    var dateStr = file.savedAt ? new Date(file.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
    var fileStorageMode = file.storageMode || 'local';

    // v9.1.14: Handle document files differently
    if (file.isDocument) {
      var sizeStr = file.size ? formatFileSize(file.size) : '';
      return '<div class="library-file-card" style="position:relative;" onclick="openIdentityDocPreview(' + brandIdx + ', ' + file.docIndex + ')">' +
        '<div class="file-icon">' + libraryFolderIcons['document'] + '</div>' +
        '<div class="file-name">' + escapeHtml(file.name) + '</div>' +
        '<div class="file-meta">Document • ' + sizeStr + ' • ' + dateStr + '</div>' +
      '</div>';
    }

    // v10.5.25: Handle sticky notes
    if (file.isNote) {
      return '<div class="library-file-card sticky-note-card" style="position:relative; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-color: #f59e0b;" onclick="openStickyNoteEditor(\'' + file.id + '\', ' + brandIdx + ')">' +
        storageIcon(file.id, fileStorageMode) +
        '<div class="file-icon" style="color: #92400e;">' + libraryFolderIcons['note'] + '</div>' +
        '<div class="file-name" style="color: #78350f;">' + escapeHtml(file.name) + '</div>' +
        '<div class="file-meta" style="color: #92400e;">Note • ' + dateStr + '</div>' +
      '</div>';
    }

    // v11.0.5: Also check for conversation property (newer format)
    var isConversation = (file.content && file.content.includes('data-conversation=')) ||
                         (file.conversation && Array.isArray(file.conversation) && file.conversation.length > 0);
    var iconSvg = isConversation ? libraryFolderIcons['chat'] : libraryFolderIcons['document'];
    var typeLabel = file.operation || 'Output';

    return '<div class="library-file-card" style="position:relative;" onclick="openLibraryFilePreview(\'' + file.id + '\', ' + brandIdx + ')">' +
      storageIcon(file.id, fileStorageMode) +
      '<div class="file-icon">' + iconSvg + '</div>' +
      '<div class="file-name">' + escapeHtml(file.name) + '</div>' +
      '<div class="file-meta">' + typeLabel + ' • ' + dateStr + (file.notes ? ' • 📝' : '') + '</div>' +
    '</div>';
  }).join('');
  
  // v10.5.25: subfoldersHtml and actionButtonsHtml already defined above
  container.innerHTML = subfoldersHtml + html;
}

/**
 * v9.1.14: Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var k = 1024;
  var sizes = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// v14.0: Toggle file storage mode between local and cloud
function toggleFileStorageMode(fileId, brandIdx) {
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib || !lib.files) return;

  var file = null;
  for (var i = 0; i < lib.files.length; i++) {
    if (lib.files[i].id === fileId) {
      file = lib.files[i];
      break;
    }
  }
  if (!file) return;

  var currentMode = file.storageMode || 'local';
  var newMode = currentMode === 'local' ? 'cloud' : 'local';

  // If toggling to cloud, check Firebase is configured
  if (newMode === 'cloud') {
    if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) {
      showToast('Configure Firebase in Settings to enable cloud sync', 'error');
      return;
    }
  }

  file.storageMode = newMode;

  // Save library
  if (brandIdx === -1) {
    if (typeof saveLifeLibrary === 'function') saveLifeLibrary();
  } else {
    if (typeof saveLibrary === 'function') saveLibrary();
  }

  // Queue sync if toggling to cloud
  if (newMode === 'cloud' && typeof queueBackgroundSync === 'function') {
    queueBackgroundSync();
  }

  showToast(newMode === 'cloud' ? 'File will sync to cloud' : 'File stored locally only', 'info');

  // Re-render
  var currentFolder = window.currentLibraryFolder || 'root';
  renderLibraryFilesForBrand(brandIdx, currentFolder);
}

/**
 * v9.1.14: Open Identity document preview
 */
function openIdentityDocPreview(brandIdx, docIndex) {
  var brandKey = typeof getBrandMemoryKey === 'function' ? getBrandMemoryKey(brandIdx) : 'brand_' + brandIdx;
  if (!brandMemory || !brandMemory[brandKey] || !brandMemory[brandKey].documents) {
    showToast('Document not found', 'error');
    return;
  }
  
  var doc = brandMemory[brandKey].documents[docIndex];
  if (!doc) {
    showToast('Document not found', 'error');
    return;
  }
  
  var brand = brands[brandIdx];
  var dateStr = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : '';
  var sizeStr = doc.size ? formatFileSize(doc.size) : '';
  
  // Update modal header
  document.getElementById('libraryPreviewTitle').textContent = doc.name;
  document.getElementById('libraryPreviewMeta').textContent = 'Uploaded ' + dateStr + ' • ' + sizeStr + ' • ' + (brand ? brand.name : '');
  
  // Hide continue button (not a conversation)
  var continueBtn = document.getElementById('libraryContinueBtn');
  if (continueBtn) continueBtn.classList.add('hidden');
  
  // Render content
  var bodyEl = document.getElementById('libraryPreviewBody');
  var html = '<div style="padding: var(--space-4);">';
  html += '<div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);">';
  html += '<div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;">';
  html += libraryFolderIcons['document'];
  html += '</div>';
  html += '<div>';
  html += '<div style="font-weight: 600; color: var(--text-primary);">' + escapeHtml(doc.name) + '</div>';
  html += '<div style="font-size: var(--text-sm); color: var(--text-muted);">' + (doc.processed ? 'Processed' : 'Pending') + ' • ' + doc.chunks + ' chunks</div>';
  html += '</div></div>';
  
  if (doc.summary) {
    // v24.11: Handle both string and object formats for doc.summary
    var _sumText = typeof doc.summary === 'string' ? doc.summary : (doc.summary.summary || '');
    if (_sumText) {
      html += '<div style="margin-top: var(--space-4); padding: var(--space-4); background: var(--bg-tertiary); border-radius: var(--radius-lg);">';
      html += '<div style="font-size: var(--text-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: var(--space-2);">AI Summary</div>';
      html += '<div style="font-size: var(--text-base); line-height: 1.6; color: var(--text-primary);">' + escapeHtml(_sumText).replace(/\n/g, '<br>') + '</div>';
      html += '</div>';
    }
  }
  
  html += '</div>';
  bodyEl.innerHTML = html;
  
  // Store for delete functionality
  libraryPreviewFileId = 'doc_' + docIndex;
  libraryPreviewBrandIdx = brandIdx;
  
  // Show modal
  document.getElementById('libraryPreviewModal').classList.remove('hidden');
}

/**
 * v9.1.14: Show folder grid (back button)
 */
function showLibraryFolders() {
  libraryCurrentFolder = null;
  
  // v10.5.25: Handle life mode - re-render the correct view
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  
  document.getElementById('libraryBrandsGrid').style.display = '';
  document.getElementById('libraryFilesSection').classList.add('hidden');
  
  // Show/hide filter toggle based on mode
  var filterToggle = document.getElementById('libraryFilterToggle');
  if (filterToggle) {
    filterToggle.style.display = isLifeMode ? 'none' : '';
  }
  
  // Re-render the appropriate view
  if (isLifeMode) {
    libraryViewingBrandIdx = -1;
    renderLifeLibrary();
  } else {
    libraryViewingBrandIdx = null;
    renderLibraryBrandCards();
  }
}

// Track which brand the new folder modal is for
var newFolderModalBrandIdx = null;

/**
 * v9.1.14: Open new folder modal for specific brand
 */
function openNewFolderModalForBrand(brandIdx) {
  newFolderModalBrandIdx = brandIdx;
  document.getElementById('libraryNewFolderModal').classList.remove('hidden');
  document.getElementById('newLibraryFolderName').value = '';
  document.getElementById('newLibraryFolderName').focus();
  
  // Reset icon selection
  document.querySelectorAll('.library-icon-btn').forEach(function(btn, idx) {
    btn.classList.toggle('selected', idx === 0);
  });
  
  // v11.0.5: Add click handlers for icon buttons (with proper event handling)
  document.querySelectorAll('.library-icon-btn').forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.library-icon-btn').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
    };
  });
  
  // v10.5.25: Show folder path
  updateNewFolderPath(brandIdx);
}

/**
 * v10.5.25: Mode-aware sticky note creation
 */
function createModeAwareStickyNote() {
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  if (isLifeMode) {
    createNewLifeStickyNote();
  } else {
    createNewStickyNote(selectedBrand);
  }
}

/**
 * v10.5.25: Mode-aware folder modal
 */
function openModeAwareFolderModal() {
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  if (isLifeMode) {
    openNewLifeFolderModal();
  } else {
    openNewFolderModal();
  }
}

/**
 * v12.2.6: Mode-aware file upload for Library header button
 */
function uploadFileToModeLibrary() {
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  if (isLifeMode) {
    uploadFileToLifeLibrary(null);
  } else {
    // Brand mode: upload to currently selected brand
    var brandIdx = selectedBrand || 0;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.csv,.xlsx,.xls';
    input.multiple = true;
    var MAX_FILE_SIZE = 5 * 1024 * 1024;
    input.onchange = function(e) {
      var files = e.target.files;
      if (!files || files.length === 0) return;
      var oversized = Array.from(files).filter(function(f) { return f.size > MAX_FILE_SIZE; });
      if (oversized.length > 0) {
        showToast('Files over 5MB not supported: ' + oversized.map(function(f) { return f.name; }).join(', '), 'error');
        return;
      }
      var lib = getLibraryForBrandIndex(brandIdx);
      if (!lib) lib = { files: [], folders: [] };
      var processedCount = 0;
      Array.from(files).forEach(function(file) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          var content = evt.target.result;
          var isImage = file.type.startsWith('image/');
          var newFile = {
            id: 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: isImage ? 'image' : 'document',
            content: content,
            fileType: file.type,
            fileSize: file.size,
            folderId: libraryCurrentFolder || null,
            savedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isUploaded: true
          };
          lib.files.push(newFile);
          processedCount++;
          if (processedCount === files.length) {
            saveBrandLibrary(brandIdx, lib);
            showToast(files.length + ' file' + (files.length > 1 ? 's' : '') + ' uploaded', 'success');
            // v31.9: Always go through the folder-view renderer when the user is inside
            // a brand. Previously fell back to renderLibrary() (legacy) which targets a
            // dead #libraryContent element — uploads at the top-level didn't repaint.
            if (libraryCurrentFolder && libraryCurrentFolder !== 'all' && typeof openLibraryFolderForBrand === 'function') {
              openLibraryFolderForBrand(libraryViewingBrandIdx != null ? libraryViewingBrandIdx : brandIdx, libraryCurrentFolder);
            } else if (typeof libraryViewingBrandIdx === 'number' && libraryViewingBrandIdx !== null && typeof openLibraryFolderForBrand === 'function') {
              openLibraryFolderForBrand(libraryViewingBrandIdx, 'all');
            } else if (typeof renderLibraryView === 'function') {
              renderLibraryView();
            }
          }
        };
        if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|csv)$/i)) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
    };
    input.click();
  }
}

function saveBrandLibrary(brandIdx, lib) {
  try {
    // v31.6: Per-brand snapshot (legacy local key — used by some callers as a quick lookup).
    localStorage.setItem('roweos_brand_library_' + brandIdx, JSON.stringify(lib));
    // v31.6 CRITICAL FIX: This function previously wrote ONLY to localStorage. The canonical
    // library lives on the in-memory `fileLibrary` global (keyed by brand.name), persisted as
    // `roweosLibrary`, and synced to Firestore at `library/brand` via saveLibrary(). Without
    // this update + sync, folders + uploads created in a brand library never propagated to
    // Firebase — users wiping a device or installing on iPad lost everything.
    if (brands && brands[brandIdx] && typeof fileLibrary === 'object' && fileLibrary) {
      var brandKey = brands[brandIdx].name;
      if (brandKey) {
        fileLibrary[brandKey] = lib;
        if (typeof saveLibrary === 'function') {
          saveLibrary(); // writes roweosLibrary + writeDB('library/brand', ...) for cloud sync
        }
      }
    }
  } catch(e) {
    console.error('[saveBrandLibrary] error:', e);
  }
}

/**
 * v10.5.25: Open folder modal from files header (uses current viewing context)
 */
function openFilesHeaderFolderModal() {
  if (libraryViewingBrandIdx === -1) {
    openNewLifeFolderModal();
  } else if (libraryViewingBrandIdx !== null) {
    openNewFolderModalForBrand(libraryViewingBrandIdx);
  } else {
    openModeAwareFolderModal();
  }
}

/**
 * v9.1.14: Open new folder modal (for selected brand)
 */
function openNewFolderModal() {
  openNewFolderModalForBrand(selectedBrand);
}

/**
 * v10.5.25: Update folder path display in new folder modal
 */
function updateNewFolderPath(brandIdx) {
  var pathEl = document.getElementById('newFolderPath');
  if (!pathEl) return;
  
  // v10.5.25: Only these folders can't have subfolders
  var noSubfolderFolders = ['root', 'all', 'brandai-chats', 'scheduled-outputs', 'documents'];
  var defaultNames = { 'notes': 'Notes', 'journals': 'Journals', 'goals': 'Goals', 'all': 'All Files' };
  
  // Build path
  var pathParts = [];
  
  if (brandIdx === -1) {
    // Life mode
    pathParts.push('Life');
    
    if (libraryCurrentFolder) {
      // Check if it's a default folder (notes, journals, goals)
      if (defaultNames[libraryCurrentFolder]) {
        pathParts.push(defaultNames[libraryCurrentFolder]);
      } else if (!noSubfolderFolders.includes(libraryCurrentFolder)) {
        // Custom folder - traverse parents
        var lib = getLifeLibrary();
        var folder = lib.folders.find(function(f) { return f.id === libraryCurrentFolder; });
        if (folder) {
          var current = folder;
          var folderPath = [];
          var maxDepth = 50;
          while (current && maxDepth-- > 0) {
            folderPath.unshift(current.name);
            // Check if parent is a default folder
            if (defaultNames[current.parentId]) {
              folderPath.unshift(defaultNames[current.parentId]);
              break;
            }
            current = lib.folders.find(function(f) { return f.id === current.parentId; });
          }
          pathParts = pathParts.concat(folderPath);
        }
      }
    }
  } else {
    // Brand mode
    var brand = brands[brandIdx];
    pathParts.push(brand ? brand.name : 'Brand');
    
    if (libraryCurrentFolder && !noSubfolderFolders.includes(libraryCurrentFolder)) {
      var lib = getLibraryForBrandIndex(brandIdx);
      if (lib && lib.folders) {
        var folder = lib.folders.find(function(f) { return f.id === libraryCurrentFolder; });
        if (folder) {
          var current = folder;
          var folderPath = [];
          while (current && current.id !== 'root') {
            folderPath.unshift(current.name);
            current = lib.folders.find(function(f) { return f.id === current.parentId; });
          }
          pathParts = pathParts.concat(folderPath);
        }
      }
    }
  }
  
  pathEl.textContent = '/ ' + pathParts.join(' / ');
}

/**
 * v9.1.14: Close new folder modal
 */
function closeNewFolderModal() {
  document.getElementById('libraryNewFolderModal').classList.add('hidden');
  newFolderModalBrandIdx = null;
}

/**
 * v9.1.14: Create new library folder
 * v10.5.25: Support nested folders (parentId can be any folder, not just root)
 */
function createNewLibraryFolder() {
  var name = document.getElementById('newLibraryFolderName').value.trim();
  if (!name) {
    showToast('Please enter a folder name', 'warning');
    return;
  }
  
  var selectedIcon = document.querySelector('.library-icon-btn.selected');
  var icon = selectedIcon ? selectedIcon.dataset.icon : 'folder';
  
  var brandIdx = newFolderModalBrandIdx !== null ? newFolderModalBrandIdx : selectedBrand;
  
  // v10.5.25: Handle LifeAI mode (brandIdx = -1)
  var lib;
  if (brandIdx === -1) {
    lib = getLifeLibrary();
  } else {
    lib = getLibraryForBrandIndex(brandIdx);
    if (!lib) {
      var brand = brands[brandIdx];
      var key = brand ? brand.name : 'Default';
      fileLibrary[key] = {
        folders: [{ id: 'root', name: 'Root', parentId: null }],
        files: []
      };
      lib = fileLibrary[key];
    }
  }
  
  // v10.5.25: Determine parent folder
  // Only 'root' and 'all' should NOT be valid parents
  // Default folders like 'notes', 'journals', 'goals' CAN have subfolders
  var noSubfolderFolders = ['root', 'all', 'brandai-chats', 'scheduled-outputs', 'documents'];
  var parentId = 'root';
  
  if (libraryCurrentFolder && !noSubfolderFolders.includes(libraryCurrentFolder)) {
    parentId = libraryCurrentFolder;
  }
  
  console.log('Creating folder with parentId:', parentId, 'libraryCurrentFolder:', libraryCurrentFolder);
  
  var newFolder = {
    id: 'folder_' + Date.now(),
    name: name,
    icon: icon,
    parentId: parentId
  };
  
  lib.folders.push(newFolder);
  // v10.5.25: Save to correct storage based on mode
  if (brandIdx === -1) {
    saveLifeLibrary();
  } else {
    saveLibrary();
  }
  
  closeNewFolderModal();

  // v31.9 (folder render fix): If the user was inside a brand's folder view when they
  // created the folder, re-render that view so the new folder appears immediately.
  // Previously renderLibraryView() bounced back to brand cards, so the folder didn't
  // show until the user toggled tabs (the "bounce to Visual Assets and back" workaround).
  if (typeof libraryViewingBrandIdx === 'number' && libraryViewingBrandIdx !== null && typeof openLibraryFolderForBrand === 'function') {
    openLibraryFolderForBrand(libraryViewingBrandIdx, libraryCurrentFolder || 'all');
  } else {
    renderLibraryView();
  }

  showToast('Folder "' + name + '" created', 'success');
}

// v10.5.25: Track parent folder for nested folder creation
var currentFolderParentId = null;

// v10.5.25: Sticky Note variables
var stickyNoteEditing = null;
var stickyNoteBrandIdx = null;

/**
 * v10.5.25: Create a new sticky note in current folder
 */
function createNewStickyNote(brandIdx) {
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib) {
    showToast('Unable to access library', 'error');
    return;
  }
  
  // Determine folder to save note in
  var folderId = libraryCurrentFolder || 'root';
  var specialFolders = ['all', 'brandai-chats', 'scheduled-outputs', 'documents'];
  if (specialFolders.includes(folderId)) {
    folderId = 'root';
  }
  
  var newNote = {
    id: 'note_' + Date.now(),
    name: 'Untitled Note',
    content: '',
    isNote: true,
    folderId: folderId,
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  lib.files.push(newNote);
  saveLibrary();
  
  // Open the note editor immediately
  openStickyNoteEditor(newNote.id, brandIdx);
}

/**
 * v10.5.25: Open sticky note editor modal
 */
function openStickyNoteEditor(noteId, brandIdx) {
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib) return;
  
  var note = lib.files.find(function(f) { return f.id === noteId; });
  if (!note) {
    showToast('Note not found', 'error');
    return;
  }
  
  stickyNoteEditing = noteId;
  stickyNoteBrandIdx = brandIdx;
  
  // v10.5.25: Get note color
  var noteColor = note.color || 'yellow';
  
  // v11.0.5: Check for dark mode for neutral color adaptation
  var isDarkMode = document.documentElement.classList.contains('dark-mode') || 
                   window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Create modal if not exists
  var modal = document.getElementById('stickyNoteEditorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stickyNoteEditorModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 10000;';
    document.body.appendChild(modal);
  }
  
  // v10.5.25: Color gradients and borders
  // v11.0.5: Added 'neutral' - adapts to light/dark mode
  var colorGradients = {
    'yellow': { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#f59e0b', text: '#78350f' },
    'blue': { bg: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', border: '#3b82f6', text: '#1e40af' },
    'green': { bg: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)', border: '#22c55e', text: '#166534' },
    'pink': { bg: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)', border: '#ec4899', text: '#9d174d' },
    'purple': { bg: 'linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 100%)', border: '#8b5cf6', text: '#5b21b6' },
    'orange': { bg: 'linear-gradient(135deg, #ffedd5 0%, #fdba74 100%)', border: '#f97316', text: '#9a3412' },
    'neutral': isDarkMode 
      ? { bg: '#1a1a1a', border: '#404040', text: '#e5e5e5' }
      : { bg: '#ffffff', border: '#d4d4d4', text: '#171717' }
  };
  var colors = colorGradients[noteColor] || colorGradients['yellow'];
  
  modal.innerHTML = '<div id="stickyNoteModalContent" style="position: relative; width: 500px; min-width: 320px; max-width: 90vw; max-height: 80vh; background: ' + colors.bg + '; border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 2px solid ' + colors.border + '; display: flex; flex-direction: column; resize: both; overflow: hidden;">' +
    '<div id="stickyNoteHeader" style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid ' + colors.border + '; cursor: move; user-select: none;">' +
      '<input type="text" id="stickyNoteName" placeholder="Note title..." style="flex: 1; background: transparent; border: none; font-size: var(--text-xl); font-weight: 600; color: ' + colors.text + '; outline: none;">' +
      '<button onclick="closeStickyNoteEditor()" style="width: 28px; height: 28px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-sm); cursor: pointer; color: ' + colors.text + '; font-size: var(--text-xl); display: flex; align-items: center; justify-content: center;">&times;</button>' +
    '</div>' +
    '<div style="padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,0.1); display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap;">' +
      '<div id="stickyNoteToolbar" style="display: flex; gap: var(--space-1); flex-wrap: wrap; flex: 1;">' +
        '<button onclick="stickyNoteFormat(\'bold\')" title="Bold" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + '; font-weight: bold;">B</button>' +
        '<button onclick="stickyNoteFormat(\'italic\')" title="Italic" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + '; font-style: italic;">I</button>' +
        '<button onclick="stickyNoteFormat(\'underline\')" title="Underline" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + '; text-decoration: underline;">U</button>' +
        '<span style="width: 1px; background: rgba(0,0,0,0.2); margin: 0 4px; height: 20px;"></span>' +
        '<button onclick="stickyNoteFormat(\'insertUnorderedList\')" title="Bullet list" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + ';">• List</button>' +
        '<button onclick="stickyNoteInsertCheckbox()" title="Checkbox" style="padding: 6px 10px; background: rgba(0,0,0,0.1); border: none; border-radius: var(--radius-xs); cursor: pointer; color: ' + colors.text + ';">☐</button>' +
      '</div>' +
      '<div id="stickyNoteColorPicker" style="display: flex; gap: var(--space-1);">' +
        '<button onclick="setStickyNoteColor(\'yellow\')" title="Yellow" style="width: 24px; height: 24px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid ' + (noteColor === 'yellow' ? '#f59e0b' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'blue\')" title="Blue" style="width: 24px; height: 24px; background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%); border: 2px solid ' + (noteColor === 'blue' ? '#3b82f6' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'green\')" title="Green" style="width: 24px; height: 24px; background: linear-gradient(135deg, #dcfce7 0%, #86efac 100%); border: 2px solid ' + (noteColor === 'green' ? '#22c55e' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'pink\')" title="Pink" style="width: 24px; height: 24px; background: linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%); border: 2px solid ' + (noteColor === 'pink' ? '#ec4899' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'purple\')" title="Purple" style="width: 24px; height: 24px; background: linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 100%); border: 2px solid ' + (noteColor === 'purple' ? '#8b5cf6' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'orange\')" title="Orange" style="width: 24px; height: 24px; background: linear-gradient(135deg, #ffedd5 0%, #fdba74 100%); border: 2px solid ' + (noteColor === 'orange' ? '#f97316' : 'transparent') + '; border-radius: 50%; cursor: pointer;"></button>' +
        '<button onclick="setStickyNoteColor(\'neutral\')" title="Neutral (B/W)" style="width: 24px; height: 24px; background: ' + (isDarkMode ? '#1a1a1a' : '#ffffff') + '; border: 2px solid ' + (noteColor === 'neutral' ? (isDarkMode ? '#e5e5e5' : '#171717') : '#d4d4d4') + '; border-radius: 50%; cursor: pointer;"></button>' +
      '</div>' +
    '</div>' +
    '<div id="stickyNoteContent" contenteditable="true" style="flex: 1; min-height: 200px; padding: var(--space-4); background: ' + (noteColor === 'neutral' ? (isDarkMode ? '#252525' : '#fafafa') : 'rgba(255,255,255,0.5)') + '; color: ' + colors.text + '; font-size: var(--text-base); line-height: 1.6; outline: none; overflow-y: auto;"></div>' +
    '<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid ' + colors.border + '; gap: var(--space-2); flex-wrap: wrap;">' +
      '<button onclick="deleteStickyNote()" style="padding: 8px 14px; background: #dc2626; color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-base);">Delete</button>' +
      '<div style="display: flex; gap: 6px; flex-wrap: wrap;">' +
        '<button onclick="sendStickyNoteToPulse()" title="Create Pulse Goal" style="padding: 6px 10px; background: var(--accent, #a89878); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); display: flex; align-items: center; gap: var(--space-1);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Pulse</button>' +
        '<button onclick="sendStickyNoteToChat()" title="Send to Chat" style="padding: 6px 10px; background: var(--bg-secondary, #f3f4f6); color: var(--text-primary, #1f2937); border: 1px solid var(--border-color, #e5e7eb); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); display: flex; align-items: center; gap: var(--space-1);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat</button>' +
        '<button onclick="saveStickyNote()" style="padding: 6px 14px; background: ' + colors.text + '; color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-base);">Save</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  
  // Setup drag functionality
  setupStickyNoteDrag();
  
  // Populate with note data
  document.getElementById('stickyNoteName').value = note.name;
  document.getElementById('stickyNoteContent').innerHTML = note.content || '';
  
  // Reset position to center
  var content = document.getElementById('stickyNoteModalContent');
  if (content) {
    content.style.position = 'relative';
    content.style.left = '';
    content.style.top = '';
  }
  
  modal.style.display = 'flex';
  document.getElementById('stickyNoteName').focus();
}

/**
 * v10.5.25: Setup drag functionality for sticky note
 */
function setupStickyNoteDrag() {
  var header = document.getElementById('stickyNoteHeader');
  var content = document.getElementById('stickyNoteModalContent');
  if (!header || !content) return;
  
  var isDragging = false;
  var startX, startY, initialX, initialY;
  
  header.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    var rect = content.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    // Switch to absolute positioning for dragging
    content.style.position = 'fixed';
    content.style.left = initialX + 'px';
    content.style.top = initialY + 'px';
    content.style.margin = '0';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    content.style.left = (initialX + dx) + 'px';
    content.style.top = (initialY + dy) + 'px';
  });
  
  document.addEventListener('mouseup', function() {
    isDragging = false;
  });
}

/**
 * v10.5.25: Close sticky note editor
 */
function closeStickyNoteEditor() {
  var modal = document.getElementById('stickyNoteEditorModal');
  if (modal) {
    modal.style.display = 'none';
  }
  stickyNoteEditing = null;
  stickyNoteBrandIdx = null;
}

/**
 * v10.5.25: Save sticky note (supports both BrandAI and LifeAI)
 */
function saveStickyNote() {
  if (!stickyNoteEditing) return;
  
  // v10.5.25: Support LifeAI mode (brandIdx = -1)
  var lib;
  if (stickyNoteBrandIdx === -1) {
    lib = getLifeLibrary();
  } else if (stickyNoteBrandIdx !== null) {
    lib = getLibraryForBrandIndex(stickyNoteBrandIdx);
  } else {
    return;
  }
  
  if (!lib) return;
  
  var note = lib.files.find(function(f) { return f.id === stickyNoteEditing; });
  if (!note) return;
  
  note.name = document.getElementById('stickyNoteName').value.trim() || 'Untitled Note';
  note.content = document.getElementById('stickyNoteContent').innerHTML;
  note.updatedAt = new Date().toISOString();
  
  // v10.5.25: Save color
  if (window.stickyNoteSelectedColor) {
    note.color = window.stickyNoteSelectedColor;
  }
  
  // v15.3: Save brandIdx before closing editor (close resets it to null)
  var savedBrandIdx = stickyNoteBrandIdx;

  // v10.5.25: Save to correct storage based on mode
  if (savedBrandIdx === -1) {
    saveLifeLibrary();
  } else {
    saveLibrary();
  }

  // v15.3: Refresh library view BEFORE closing editor (uses savedBrandIdx)
  if (libraryCurrentFolder) {
    if (savedBrandIdx === -1) {
      renderLifeFilesForFolder(libraryCurrentFolder);
    } else {
      renderLibraryFilesForBrand(savedBrandIdx, libraryCurrentFolder);
    }
  }

  closeStickyNoteEditor();

  // Clear color selection
  window.stickyNoteSelectedColor = null;

  showToast('Note saved', 'success');
}

/**
 * v10.5.25: Delete sticky note (supports both BrandAI and LifeAI)
 */
function deleteStickyNote() {
  if (!stickyNoteEditing) return;
  
  if (!confirm('Delete this note? This cannot be undone.')) return;
  
  // v10.5.25: Support LifeAI mode (brandIdx = -1)
  var lib;
  var brandIdx = stickyNoteBrandIdx;
  if (brandIdx === -1) {
    lib = getLifeLibrary();
  } else if (brandIdx !== null) {
    lib = getLibraryForBrandIndex(brandIdx);
  } else {
    return;
  }
  
  if (!lib) return;
  
  var idx = lib.files.findIndex(function(f) { return f.id === stickyNoteEditing; });
  if (idx !== -1) {
    lib.files.splice(idx, 1);
    // v10.5.25: Save to correct storage based on mode
    if (brandIdx === -1) {
      saveLifeLibrary();
    } else {
      saveLibrary();
    }
  }
  
  closeStickyNoteEditor();
  
  // Refresh library view
  if (libraryCurrentFolder) {
    if (brandIdx === -1) {
      renderLifeFilesForFolder(libraryCurrentFolder);
    } else {
      renderLibraryFilesForBrand(brandIdx, libraryCurrentFolder);
    }
  }
  
  showToast('Note deleted', 'info');
}

/**
 * v11.0.5: Send sticky note content to Pulse as a goal/checklist
 */
function sendStickyNoteToPulse() {
  var contentEl = document.getElementById('stickyNoteContent');
  var nameEl = document.getElementById('stickyNoteName');
  
  if (!contentEl) {
    console.error('[StickyNote] Content element not found');
    showToast('Could not find note content', 'error');
    return;
  }
  
  var content = contentEl.innerHTML || '';
  var name = nameEl ? nameEl.value.trim() : 'Untitled';
  
  if (!name) name = 'Untitled Note';
  
  console.log('[StickyNote] Sending to Pulse:', name);
  
  // v11.0.5: Enhanced extraction of checklist items from content
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  // Find all list items and checkbox items
  var items = [];
  var listItems = tempDiv.querySelectorAll('li');
  listItems.forEach(function(li) {
    var text = li.textContent.trim();
    if (text) items.push({ id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), text: text, completed: false });
  });
  
  // v11.0.5: Also look for lines with various bullet formats
  if (items.length === 0) {
    var text = tempDiv.textContent || '';
    var lines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
    lines.forEach(function(line, idx) {
      // Match: -, •, *, ☐, ☑, ✓, ✔, [ ], [x], [X], numbered lists
      var trimmed = line.replace(/^[\d\.\)\-\•\*☐☑✓✔\[\]xX\s]+/, '').trim();
      if (trimmed) {
        var completed = /^[☑✓✔]|\[x\]|\[X\]/.test(line);
        items.push({ id: 'item_' + Date.now() + '_' + idx, text: trimmed, completed: completed });
      }
    });
  }
  
  // v11.0.5: Create goal with 'items' property (not 'checklist')
  var goal = {
    id: 'goal_' + Date.now(),
    title: name,
    category: 'Personal',
    progress: 0,
    items: items.length > 0 ? items : [{ id: 'item_' + Date.now(), text: 'Review note content', completed: false }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fromNote: true
  };
  
  // Get existing goals from Pulse
  // v30.1: Guard with try/catch and Array.isArray per CLAUDE.md rule
  var goals = [];
  try { goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); if (!Array.isArray(goals)) goals = []; } catch(e) { goals = []; }
  goals.push(goal);
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(goals));
  // v25.1: Write-through pulse goals to Firestore
  writeDB('pulse/main', { goals: JSON.stringify(goals) }, { category: 'goals' });

  // v11.0.5: Also update global pulseGoals if available
  if (typeof pulseGoals !== 'undefined') {
    pulseGoals = goals;
  }
  
  // Close the sticky note editor
  closeStickyNoteEditor();
  
  // Navigate to Pulse and show the new goal
  showView('pulse');
  showToast('Created goal in Pulse: ' + name, 'success');
  
  // Trigger refresh of Pulse view
  if (typeof renderPulseGoals === 'function') {
    setTimeout(renderPulseGoals, 100);
  }
}

/**
 * v11.0.5: Send sticky note content to chat
 */
function sendStickyNoteToChat() {
  console.log('[StickyNote] sendStickyNoteToChat called, brandIdx:', stickyNoteBrandIdx);
  
  var contentEl = document.getElementById('stickyNoteContent');
  var nameEl = document.getElementById('stickyNoteName');
  if (!contentEl) {
    console.error('[StickyNote] Content element not found');
    showToast('Note content not found', 'error');
    return;
  }
  
  var content = contentEl.innerHTML || '';
  var name = nameEl ? nameEl.value.trim() : 'Untitled';
  if (!name) name = 'Untitled Note';
  
  // Convert HTML to plain text
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  var plainText = tempDiv.textContent || tempDiv.innerText || '';
  
  if (!plainText.trim()) {
    showToast('Note is empty', 'warning');
    return;
  }
  
  // v11.0.5: Save brandIdx BEFORE closing (close resets it to null)
  var isLifeMode = stickyNoteBrandIdx === -1;
  var targetView = isLifeMode ? 'lifeai' : 'brandai';
  console.log('[StickyNote] Target view:', targetView);
  
  // Close the sticky note editor
  closeStickyNoteEditor();
  
  // Navigate to appropriate chat view
  showView(targetView);
  
  // Set the message in the input field with context
  var promptText = 'Here is my note titled "' + name + '":\n\n' + plainText + '\n\nPlease help me organize this into actionable items or a structured plan.';
  
  setTimeout(function() {
    var inputEl = document.getElementById('userMessage');
    if (inputEl) {
      inputEl.value = promptText;
      inputEl.focus();
      // Trigger input event to resize textarea if needed
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('[StickyNote] Message set in chat input');
    } else {
      console.error('[StickyNote] userMessage input not found');
    }
  }, 300);
  
  showToast('Note added to chat - press Send to continue', 'success');
}

/**
 * v10.5.25: Apply formatting to sticky note
 */
function stickyNoteFormat(command) {
  document.execCommand(command, false, null);
  document.getElementById('stickyNoteContent').focus();
}

/**
 * v10.5.25: Insert checkbox in sticky note
 */
function stickyNoteInsertCheckbox() {
  var content = document.getElementById('stickyNoteContent');
  var checkbox = '<label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer;"><input type="checkbox" style="width: 16px; height: 16px; cursor: pointer;" onchange="this.parentElement.style.textDecoration = this.checked ? \'line-through\' : \'none\'"> <span contenteditable="true">Task item</span></label><br>';
  document.execCommand('insertHTML', false, checkbox);
  content.focus();
}

/**
 * v10.5.25: Set sticky note color and update modal appearance
 */
function setStickyNoteColor(color) {
  // Store color for save
  window.stickyNoteSelectedColor = color;
  
  // v11.0.5: Check for dark mode for neutral color
  var isDarkMode = document.documentElement.classList.contains('dark-mode') || 
                   window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Color definitions
  var colorGradients = {
    'yellow': { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#f59e0b', text: '#78350f' },
    'blue': { bg: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', border: '#3b82f6', text: '#1e40af' },
    'green': { bg: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)', border: '#22c55e', text: '#166534' },
    'pink': { bg: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)', border: '#ec4899', text: '#9d174d' },
    'purple': { bg: 'linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 100%)', border: '#8b5cf6', text: '#5b21b6' },
    'orange': { bg: 'linear-gradient(135deg, #ffedd5 0%, #fdba74 100%)', border: '#f97316', text: '#9a3412' },
    'neutral': isDarkMode 
      ? { bg: '#1a1a1a', border: '#404040', text: '#e5e5e5' }
      : { bg: '#ffffff', border: '#d4d4d4', text: '#171717' }
  };
  var colors = colorGradients[color] || colorGradients['yellow'];
  
  // Update modal appearance
  var modalContent = document.getElementById('stickyNoteModalContent');
  if (modalContent) {
    modalContent.style.background = colors.bg;
    modalContent.style.borderColor = colors.border;
  }
  
  // Update color picker selection
  var picker = document.getElementById('stickyNoteColorPicker');
  if (picker) {
    var buttons = picker.querySelectorAll('button');
    buttons.forEach(function(btn) {
      var btnTitle = btn.getAttribute('title') || '';
      var btnColor = btnTitle.toLowerCase().split(' ')[0]; // Get first word (color name)
      if (colorGradients[btnColor]) {
        btn.style.borderColor = btnColor === color ? colorGradients[btnColor].border : 'transparent';
      }
    });
  }
  
  // Update text colors
  var header = document.getElementById('stickyNoteHeader');
  if (header) {
    header.style.borderColor = colors.border;
    var titleInput = document.getElementById('stickyNoteName');
    if (titleInput) titleInput.style.color = colors.text;
    var closeBtn = header.querySelector('button');
    if (closeBtn) closeBtn.style.color = colors.text;
  }
  
  var contentArea = document.getElementById('stickyNoteContent');
  if (contentArea) {
    contentArea.style.color = colors.text;
    // v11.0.5: Update content area background for neutral color
    if (color === 'neutral') {
      contentArea.style.background = isDarkMode ? '#252525' : '#fafafa';
    } else {
      contentArea.style.background = 'rgba(255,255,255,0.5)';
    }
  }
  
  // Update toolbar buttons
  var toolbar = document.getElementById('stickyNoteToolbar');
  if (toolbar) {
    var toolBtns = toolbar.querySelectorAll('button');
    toolBtns.forEach(function(btn) { btn.style.color = colors.text; });
  }
}

/**
 * v10.5.25: Rename a library folder
 */
function renameLibraryFolder(folderId, brandIdx) {
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib || !lib.folders) return;
  
  var folder = lib.folders.find(function(f) { return f.id === folderId; });
  if (!folder) return;
  
  var newName = prompt('Enter new folder name:', folder.name);
  if (!newName || !newName.trim() || newName.trim() === folder.name) return;
  
  folder.name = newName.trim();
  saveLibrary();
  
  // Refresh view
  renderLibraryBrandCards();
  if (libraryCurrentFolder === folderId) {
    document.getElementById('libraryFolderTitle').textContent = folder.name;
  }
  showToast('Folder renamed', 'success');
}

/**
 * v10.5.25: Delete a library folder and its contents
 */
function deleteLibraryFolder(folderId, brandIdx) {
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib || !lib.folders) return;
  
  var folder = lib.folders.find(function(f) { return f.id === folderId; });
  if (!folder) return;
  
  // Check if folder has contents
  var filesInFolder = lib.files.filter(function(f) { return f.folderId === folderId; }).length;
  var subfolders = lib.folders.filter(function(f) { return f.parentId === folderId; }).length;
  
  var message = 'Delete folder "' + folder.name + '"?';
  if (filesInFolder > 0 || subfolders > 0) {
    message = 'Delete folder "' + folder.name + '" and all its contents (' + filesInFolder + ' files, ' + subfolders + ' subfolders)?';
  }
  
  if (!confirm(message)) return;
  
  // Recursively delete all subfolders and their contents
  function deleteFolderRecursive(fId) {
    var childFolders = lib.folders.filter(function(f) { return f.parentId === fId; });
    childFolders.forEach(function(child) {
      deleteFolderRecursive(child.id);
    });
    // Delete files in this folder
    lib.files = lib.files.filter(function(f) { return f.folderId !== fId; });
    // Delete the folder
    lib.folders = lib.folders.filter(function(f) { return f.id !== fId; });
  }
  
  deleteFolderRecursive(folderId);
  saveLibrary();
  
  // Refresh library view
  renderLibraryFilesForBrand(brandIdx, libraryCurrentFolder);
  showToast('Folder deleted', 'info');
}

// v10.5.25: Folder drag-drop state
var draggingFolderId = null;
var draggingFolderBrandIdx = null;

/**
 * v10.5.25: Handle folder drag start
 */
function handleFolderDragStart(event, folderId, brandIdx) {
  draggingFolderId = folderId;
  draggingFolderBrandIdx = brandIdx;
  event.dataTransfer.setData('text/plain', folderId);
  event.dataTransfer.effectAllowed = 'move';
  event.target.style.opacity = '0.5';
}

/**
 * v10.5.25: Handle folder drag over
 */
function handleFolderDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  var target = event.target.closest('.subfolder-card');
  if (target && target.dataset.folderId !== draggingFolderId) {
    target.style.background = 'rgba(212, 175, 55, 0.2)';
    target.style.borderColor = '#a89878';
  }
}

/**
 * v10.5.25: Handle folder drag leave
 */
function handleFolderDragLeave(event) {
  var target = event.target.closest('.subfolder-card');
  if (target) {
    target.style.background = '';
    target.style.borderColor = '';
  }
}

/**
 * v10.5.25: Handle folder drop - move folder into another folder
 */
function handleFolderDrop(event, targetFolderId, brandIdx) {
  event.preventDefault();
  event.stopPropagation();
  
  var target = event.target.closest('.subfolder-card');
  if (target) {
    target.style.background = '';
    target.style.borderColor = '';
  }
  
  if (!draggingFolderId || draggingFolderId === targetFolderId) {
    draggingFolderId = null;
    draggingFolderBrandIdx = null;
    return;
  }
  
  // Prevent circular nesting
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib || !lib.folders) return;
  
  // Check if target is a descendant of dragging folder
  function isDescendant(parentId, childId) {
    var folder = lib.folders.find(function(f) { return f.id === childId; });
    if (!folder) return false;
    if (folder.parentId === parentId) return true;
    if (!folder.parentId) return false;
    return isDescendant(parentId, folder.parentId);
  }
  
  if (isDescendant(draggingFolderId, targetFolderId)) {
    showToast('Cannot move folder into its own subfolder', 'error');
    draggingFolderId = null;
    draggingFolderBrandIdx = null;
    return;
  }
  
  // Move the folder
  var folder = lib.folders.find(function(f) { return f.id === draggingFolderId; });
  if (folder) {
    folder.parentId = targetFolderId;
    saveLibrary();
    renderLibraryFilesForBrand(brandIdx, libraryCurrentFolder);
    showToast('Folder moved', 'success');
  }
  
  draggingFolderId = null;
  draggingFolderBrandIdx = null;
}

// v14.0: Life folder drag & drop handlers
function handleLifeFolderDragStart(event, folderId) {
  draggingFolderId = folderId;
  draggingFolderBrandIdx = -1; // -1 = life mode
  event.dataTransfer.setData('text/plain', folderId);
  event.dataTransfer.effectAllowed = 'move';
  event.target.style.opacity = '0.5';
}

function handleLifeFolderDrop(event, targetFolderId) {
  event.preventDefault();
  event.stopPropagation();

  var target = event.target.closest('.subfolder-card');
  if (target) {
    target.style.background = '';
    target.style.borderColor = '';
  }

  if (!draggingFolderId || draggingFolderId === targetFolderId) {
    draggingFolderId = null;
    return;
  }

  var lib = getLifeLibrary();
  if (!lib || !lib.folders) return;

  // Prevent circular nesting
  function isDescendant(parentId, childId) {
    var folder = lib.folders.find(function(f) { return f.id === childId; });
    if (!folder) return false;
    if (folder.parentId === parentId) return true;
    if (!folder.parentId) return false;
    return isDescendant(parentId, folder.parentId);
  }

  if (isDescendant(draggingFolderId, targetFolderId)) {
    showToast('Cannot move folder into its own subfolder', 'error');
    draggingFolderId = null;
    return;
  }

  var folder = lib.folders.find(function(f) { return f.id === draggingFolderId; });
  if (folder) {
    folder.parentId = targetFolderId;
    saveLifeLibrary();
    renderLifeFilesForFolder(libraryCurrentFolder || 'root');
    showToast('Folder moved', 'success');
  }

  draggingFolderId = null;
}

// Track current file being previewed
var libraryPreviewFileId = null;
var libraryPreviewBrandIdx = null;

/**
 * v9.1.14: Open file preview modal
 */
function openLibraryFilePreview(fileId, brandIdx) {
  libraryPreviewFileId = fileId;
  libraryPreviewBrandIdx = brandIdx;
  
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib || !lib.files) return;
  
  var file = lib.files.find(function(f) { return f.id === fileId; });
  if (!file) return;
  
  var brand = brands[brandIdx];
  var brandName = brand ? brand.name : '';
  var dateStr = file.savedAt ? new Date(file.savedAt).toLocaleString() : '';
  
  // Update modal header
  document.getElementById('libraryPreviewTitle').textContent = file.name;
  document.getElementById('libraryPreviewMeta').textContent = 'Saved ' + dateStr + ' • ' + brandName;
  
  // Check if it's a conversation
  // v11.0.5: Also check for conversation property (newer format)
  var isConversation = (file.content && file.content.includes('data-conversation=')) ||
                       (file.conversation && Array.isArray(file.conversation) && file.conversation.length > 0);
  var continueBtn = document.getElementById('libraryContinueBtn');
  if (continueBtn) {
    continueBtn.classList.toggle('hidden', !isConversation);
    // v10.5.25: Set correct label based on mode
    if (isConversation) {
      continueBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Continue in BrandAI';
    }
  }
  
  // v10.5.26: Show Upload button for non-conversation files (inverse of Continue)
  var uploadBtn = document.getElementById('libraryUploadBtn');
  if (uploadBtn) {
    uploadBtn.classList.toggle('hidden', isConversation);
    if (!isConversation) {
      uploadBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg> Upload to BrandAI Chat';
    }
  }
  
  // Render content
  var bodyEl = document.getElementById('libraryPreviewBody');
  // v11.0.5: Handle both old format (data-conversation in content) and new format (file.conversation array)
  console.log('[LibraryPreview] file.conversation:', file.conversation ? file.conversation.length + ' messages' : 'undefined');
  console.log('[LibraryPreview] file.content:', file.content ? (file.content.substring(0, 100) + '...') : 'undefined');
  console.log('[LibraryPreview] isConversation:', isConversation);
  
  if (isConversation) {
    // Check if we have direct conversation array (newer format)
    if (file.conversation && Array.isArray(file.conversation) && file.conversation.length > 0) {
      console.log('[LibraryPreview] Rendering from conversation array');
      bodyEl.innerHTML = renderConversationFromArray(file.conversation, brandName);
    } else if (file.content) {
      console.log('[LibraryPreview] Rendering from content data-conversation');
      var rendered = convertConversationToStyledFormat(file.content, brandName);
      // v11.0.5: If conversion failed, show raw content as fallback
      if (!rendered || rendered.indexOf('library-conversation') === -1) {
        console.log('[LibraryPreview] Conversation parsing failed, showing raw content');
        bodyEl.innerHTML = '<div class="library-preview-text" style="white-space: pre-wrap;">' + escapeHtml(file.content.replace(/<[^>]*>/g, '').substring(0, 50000)) + '</div>';
      } else {
        bodyEl.innerHTML = rendered;
      }
    } else {
      bodyEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No conversation content available</p>';
    }
  } else if (file.content) {
    // v24.24: Render markdown as rich text, or pass through existing HTML
    if (file.content.indexOf('<') !== -1 && file.content.indexOf('**') === -1 && file.content.indexOf('##') === -1) {
      bodyEl.innerHTML = file.content;
    } else {
      bodyEl.innerHTML = '<div class="library-preview-text" style="line-height:1.7;">' + (typeof formatMessageContent === 'function' ? formatMessageContent(file.content) : escapeHtml(file.content)) + '</div>';
    }
  } else {
    bodyEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No content available</p>';
  }
  
  // v10.5.25: Load notes
  var notesTextarea = document.getElementById('libraryNotesTextarea');
  if (notesTextarea) {
    notesTextarea.value = file.notes || '';
  }
  
  // Show modal
  document.getElementById('libraryPreviewModal').classList.remove('hidden');
}

/**
 * v10.5.25: Convert old conversation format to new styled format with toggle
 */
function convertConversationToStyledFormat(content, brandName) {
  // Try to extract raw conversation data
  var match = content.match(/data-conversation='([^']+)'/);
  if (!match) {
    match = content.match(/data-conversation="([^"]+)"/);
  }
  
  // v11.0.5: Try multiline match for longer conversations
  if (!match) {
    match = content.match(/data-conversation='([\s\S]*?)'/);
  }
  
  if (!match) {
    // Fallback: just return original content
    return content;
  }
  
  var conversationJson = match[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  var conversation;
  try {
    conversation = JSON.parse(conversationJson);
  } catch (e) {
    console.error('Failed to parse conversation JSON:', e);
    return content;
  }
  
  if (!conversation || !conversation.length) {
    return content;
  }
  
  // Use the shared renderer
  return renderConversationFromArray(conversation, brandName);
}

/**
 * v11.0.5: Render conversation from array directly (for new storage format)
 */
function renderConversationFromArray(conversation, brandName) {
  if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
    return '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No messages in conversation</p>';
  }
  
  // Determine if Life mode
  var isLifeMode = brandName === 'Life' || brandName === 'LifeAI';
  var aiLabel = isLifeMode ? 'LifeAI' : 'BrandAI';
  
  // Get message count
  var messageCount = conversation.length;
  
  // Build new styled HTML - store conversation as JSON for Continue functionality
  var conversationJson = JSON.stringify(conversation).replace(/'/g, '&#39;');
  var html = '<div class="library-conversation" data-conversation=\'' + conversationJson + '\'>';
  
  // Header with view toggle
  html += '<div class="library-convo-header">';
  html += '<div class="library-convo-info">';
  html += '<h2 class="library-convo-title">' + escapeHtml(brandName) + ' - ' + aiLabel + ' Conversation</h2>';
  html += '<p class="library-convo-meta">' + messageCount + ' messages</p>';
  html += '</div>';
  html += '<div class="library-convo-view-toggle">';
  html += '<button class="convo-view-btn active" data-view="bubble" onclick="toggleConvoView(this, \'bubble\')">Bubble</button>';
  html += '<button class="convo-view-btn" data-view="inline" onclick="toggleConvoView(this, \'inline\')">Inline</button>';
  html += '</div>';
  html += '</div>';
  
  html += '<div class="library-convo-messages" data-view="bubble">';
  
  conversation.forEach(function(msg) {
    var isUser = msg.role === 'user';
    var roleLabel = isUser ? 'You' : aiLabel;
    var roleClass = isUser ? 'user-msg' : 'ai-msg';
    var aiTypeClass = isLifeMode ? 'life-ai' : 'brand-ai';

    // v11.0.5: Use displayContent for user messages if available (cleaner than full content with file data)
    // v20.1: Handle multimodal content (array) - always prefer displayContent for arrays
    var messageContent = (typeof msg.content === 'string' ? msg.content : (msg.displayContent || '[Multimodal content]')) || '';
    if (isUser && msg.displayContent) {
      messageContent = msg.displayContent;
    }
    // v20.6: Strip hidden URL context from user message display
    if (isUser && typeof messageContent === 'string') {
      messageContent = messageContent.replace(/\n\n---\n\[Web page content from [^\]]*\][\s\S]*$/g, '');
    }

    // v12.0.3: Render file cards for attached files
    var fileCardsHtml = '';
    if (isUser && msg.attachedFiles && msg.attachedFiles.length > 0) {
      fileCardsHtml = renderAttachedFileCards(msg.attachedFiles, msg.id || Date.now());
      messageContent = messageContent.replace(/\n?\n?\[Attached \d+ (?:file|image)\(s\): [^\]]+\]/g, '').trim();
    } else if (isUser && messageContent.match(/\[Attached \d+ (?:file|image)\(s\): ([^\]]+)\]/)) {
      var fileMatch = messageContent.match(/\[Attached \d+ (?:file|image)\(s\): ([^\]]+)\]/);
      if (fileMatch) {
        var fileNames = fileMatch[1].split(', ');
        var pseudoFiles = fileNames.map(function(name, idx) { return { name: name, id: 'lib_' + idx }; });
        fileCardsHtml = renderAttachedFileCards(pseudoFiles, msg.id || Date.now());
        messageContent = messageContent.replace(/\n?\n?\[Attached \d+ (?:file|image)\(s\): [^\]]+\]/g, '').trim();
      }
    }

    // Use rich text formatting for assistant messages
    var formattedContent = isUser
      ? escapeHtml(messageContent).replace(/\n/g, '<br>')
      : formatMessageContent(messageContent);

    // Combine file cards with content
    if (fileCardsHtml && formattedContent) {
      formattedContent = fileCardsHtml + '<div style="margin-top: var(--space-3);">' + formattedContent + '</div>';
    } else if (fileCardsHtml) {
      formattedContent = fileCardsHtml;
    }

    html += '<div class="convo-msg ' + roleClass + ' ' + (isUser ? '' : aiTypeClass) + '">';
    html += '<div class="convo-msg-label">' + roleLabel + '</div>';
    html += '<div class="convo-msg-bubble">';
    html += '<div class="convo-msg-content">' + formattedContent + '</div>';
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  return html;
}

/**
 * v9.1.14: Close file preview modal
 */
function closeLibraryPreview() {
  document.getElementById('libraryPreviewModal').classList.add('hidden');
  libraryPreviewFileId = null;
  libraryPreviewBrandIdx = null;
}

/**
 * v10.5.25: Toggle conversation view between bubble and inline
 */
function toggleConvoView(btn, viewMode) {
  // Update button states
  var parent = btn.parentElement;
  if (parent) {
    parent.querySelectorAll('.convo-view-btn').forEach(function(b) {
      b.classList.remove('active');
    });
  }
  btn.classList.add('active');
  
  // Update messages container
  var messagesContainer = document.querySelector('.library-convo-messages');
  if (messagesContainer) {
    messagesContainer.setAttribute('data-view', viewMode);
  }
}

/**
 * v10.5.25: Toggle notes section (collapsible on mobile)
 */
function toggleLibraryNotes() {
  var notesEl = document.getElementById('libraryPreviewNotes');
  if (notesEl) {
    notesEl.classList.toggle('expanded');
  }
}

/**
 * v10.5.25: Save note to library file
 */
function saveLibraryFileNote() {
  if (!libraryPreviewFileId || libraryPreviewBrandIdx === null) return;
  
  var lib = getLibraryForBrandIndex(libraryPreviewBrandIdx);
  if (!lib || !lib.files) return;
  
  var file = lib.files.find(function(f) { return f.id === libraryPreviewFileId; });
  if (!file) return;
  
  var notesTextarea = document.getElementById('libraryNotesTextarea');
  if (!notesTextarea) return;
  
  file.notes = notesTextarea.value.trim();
  saveLibraryForBrandIndex(libraryPreviewBrandIdx);
  
  showToast('Note saved', 'success');
}

/**
 * v10.5.25: Rename file from preview modal (click on title)
 */
function renameLibraryPreviewFile() {
  if (!libraryPreviewFileId || libraryPreviewBrandIdx === null) return;
  
  var lib = getLibraryForBrandIndex(libraryPreviewBrandIdx);
  if (!lib || !lib.files) return;
  
  var file = lib.files.find(function(f) { return f.id === libraryPreviewFileId; });
  if (!file) return;
  
  var newName = prompt('Rename file:', file.name);
  if (!newName || !newName.trim()) return;
  
  file.name = newName.trim();
  saveLibraryForBrandIndex(libraryPreviewBrandIdx);
  
  // Update preview title
  var titleEl = document.getElementById('libraryPreviewTitle');
  if (titleEl) titleEl.textContent = file.name;
  
  // Refresh file list
  if (libraryPreviewBrandIdx === -1) {
    if (libraryCurrentFolder) renderLifeFilesForFolder(libraryCurrentFolder);
  } else if (libraryCurrentFolder) {
    renderLibraryFilesForBrand(libraryPreviewBrandIdx, libraryCurrentFolder);
  }
  
  showToast('Renamed to "' + file.name + '"', 'success');
}

/**
 * v9.1.14: Export library file
 */
function exportLibraryFile() {
  if (!libraryPreviewFileId || libraryPreviewBrandIdx === null) return;
  
  var lib = getLibraryForBrandIndex(libraryPreviewBrandIdx);
  if (!lib || !lib.files) return;
  
  var file = lib.files.find(function(f) { return f.id === libraryPreviewFileId; });
  if (!file) return;
  
  var content = file.content || '';
  var filename = (file.name || 'export').replace(/[^a-z0-9]/gi, '_');
  var brand = libraryPreviewBrandIdx >= 0 ? brands[libraryPreviewBrandIdx] : null;
  var brandName = brand ? brand.name : (libraryPreviewBrandIdx === -1 ? 'Life' : '');
  var dateStr = file.savedAt ? new Date(file.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  
  // v9.1.14: Create PDF-ready HTML with print styling
  var pdfHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
  pdfHtml += '<title>' + escapeHtml(file.name) + '</title>';
  pdfHtml += '<style>';
  pdfHtml += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a1a1a; line-height: 1.7; }';
  pdfHtml += '.header { border-bottom: 2px solid #a89878; padding-bottom: var(--space-5); margin-bottom: 30px; }';
  pdfHtml += '.title { font-size: var(--text-3xl); font-weight: 600; margin: 0 0 8px 0; }';
  pdfHtml += '.meta { font-size: var(--text-sm); color: #666; }';
  pdfHtml += '.content { font-size: var(--text-base); }';
  pdfHtml += '.content h1 { font-size: var(--text-3xl); font-weight: 600; margin: 28px 0 14px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: var(--space-2); }';
  pdfHtml += '.content h2 { font-size: var(--text-xl); font-weight: 600; margin: 24px 0 12px 0; color: #333; }';
  pdfHtml += '.content h3 { font-size: var(--text-lg); font-weight: 600; margin: 20px 0 10px 0; }';
  pdfHtml += '.content h4 { font-size: var(--text-base); font-weight: 600; margin: 16px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; }';
  pdfHtml += '.content p { margin: 0 0 14px 0; line-height: 1.7; }';
  pdfHtml += '.content strong, .content b { font-weight: 600; }';
  pdfHtml += '.content ul, .content ol { margin: 0 0 16px 0; padding-left: 24px; }';
  pdfHtml += '.content li { margin-bottom: var(--space-2); line-height: 1.6; }';
  pdfHtml += '.content code { font-family: "SF Mono", Monaco, monospace; font-size: var(--text-sm); background: #f5f5f7; padding: 2px 6px; border-radius: var(--radius-xs); }';
  pdfHtml += '.content pre { background: #f5f5f7; border: 1px solid #e0e0e0; border-radius: var(--radius-md); padding: var(--space-4); margin: 16px 0; overflow-x: auto; font-family: "SF Mono", Monaco, monospace; font-size: var(--text-sm); }';
  pdfHtml += '.content pre code { background: none; padding: 0; }';
  pdfHtml += '.content blockquote { margin: 16px 0; padding: 12px 20px; border-left: 3px solid #a89878; background: #f9f9f9; font-style: italic; color: #555; }';
  pdfHtml += '.content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: var(--text-base); }';
  pdfHtml += '.content th, .content td { padding: 10px 12px; text-align: left; border: 1px solid #e0e0e0; }';
  pdfHtml += '.content th { background: #f5f5f7; font-weight: 600; }';
  pdfHtml += '.content hr { border: none; height: 1px; background: #e0e0e0; margin: 24px 0; }';
  pdfHtml += '.content a { color: #0066cc; text-decoration: none; }';
  pdfHtml += '.msg-row { margin-bottom: var(--space-6); padding: var(--space-4); background: #f5f5f7; border-radius: var(--radius-lg); }';
  pdfHtml += '.msg-label { font-size: var(--text-sm); font-weight: 600; text-transform: uppercase; color: #888; margin-bottom: var(--space-2); }';
  pdfHtml += '.user-row { background: #fffbeb; border: 1px solid #f5e6b3; }';
  pdfHtml += '.user-row .msg-label { color: #b8860b; }';
  pdfHtml += '@media print { body { padding: var(--space-5); } .header { page-break-after: avoid; } .msg-row { page-break-inside: avoid; } }';
  pdfHtml += '</style></head><body>';
  pdfHtml += '<div class="header">';
  pdfHtml += '<h1 class="title">' + escapeHtml(file.name) + '</h1>';
  pdfHtml += '<div class="meta">' + brandName + ' • ' + dateStr + '</div>';
  pdfHtml += '</div>';
  pdfHtml += '<div class="content">' + content + '</div>';
  pdfHtml += '<script>window.onload = function() { window.print(); }<\/script>';
  pdfHtml += '</body></html>';
  
  // Open in new window for print/save as PDF
  var printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(pdfHtml);
    printWindow.document.close();
    showToast('Print dialog opened - save as PDF', 'success');
  } else {
    // Fallback to HTML download if popup blocked
    var blob = new Blob([pdfHtml], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename + '.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('File exported as HTML (enable popups for PDF)', 'info');
  }
}

/**
 * v9.1.14: Move library file
 */
function moveLibraryFile() {
  if (!libraryPreviewFileId || libraryPreviewBrandIdx === null) return;
  showToast('Move feature coming soon', 'info');
}

/**
 * v10.5.26: Upload library file to chat as an attachment
 * Attaches the document content to the chat input and navigates to chat view
 */
function uploadLibraryFileToChat() {
  if (!libraryPreviewFileId) {
    showToast('No file selected', 'error');
    return;
  }
  
  // Get file from appropriate library
  var file = null;
  var isLifeMode = libraryPreviewBrandIdx === -1;
  
  if (isLifeMode) {
    // v15.32: Use getLifeLibrary() for per-profile support
    var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    file = lifeLib.files.find(function(f) { return f.id === libraryPreviewFileId; });
  } else {
    var lib = getLibraryForBrandIndex(libraryPreviewBrandIdx);
    if (lib && lib.files) {
      file = lib.files.find(function(f) { return f.id === libraryPreviewFileId; });
    }
  }
  
  if (!file || !file.content) {
    showToast('Could not load file content', 'error');
    return;
  }
  
  // Extract plain text from HTML content
  var textContent = file.content;
  if (textContent.indexOf('<') !== -1) {
    // Strip HTML tags but preserve structure
    var temp = document.createElement('div');
    temp.innerHTML = textContent;
    textContent = temp.textContent || temp.innerText || '';
    textContent = textContent.trim();
  }
  
  // Create a pseudo-file object for the attachment system
  var fileName = (file.name || 'document') + '.txt';
  
  // Set the appropriate mode
  if (isLifeMode) {
    localStorage.setItem('roweos_app_mode', 'life');
    localStorage.setItem('roweos_mode', 'life');
    document.documentElement.classList.add('life-mode');
    document.documentElement.classList.remove('brand-mode');
    var brandSelect = document.getElementById('agentBrand');
    if (brandSelect) brandSelect.value = 'none';
  } else {
    localStorage.setItem('roweos_app_mode', 'brand');
    localStorage.setItem('roweos_mode', 'brand');
    document.documentElement.classList.remove('life-mode');
    document.documentElement.classList.add('brand-mode');
    selectedBrand = libraryPreviewBrandIdx;
    var brandSelect = document.getElementById('agentBrand');
    if (brandSelect) brandSelect.value = libraryPreviewBrandIdx.toString();
  }
  
  // v28.4: Use currentAgentFiles array for proper file chip display
  var libFileId = 'lib_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var libFileEntry = {
    id: libFileId,
    file: { name: fileName, type: 'text/plain', size: textContent.length },
    name: file.name || fileName,
    type: 'text/plain',
    content: '[Library Document: ' + file.name + ']\n\n' + textContent,
    status: 'ready',
    source: 'library'
  };
  // Clear any existing files and add this one
  currentAgentFiles = [libFileEntry];
  currentAgentFile = libFileEntry.file;
  currentAgentFileContent = libFileEntry.content;

  // Close preview modal and navigate to chat
  closeLibraryPreview();
  showView('agent');
  
  // Reset to landing view but PRESERVE file attachment
  currentConversation = [];
  conversationStartBrand = null;
  window._continuedHistoryIndex = null;
  continuingFromHistoryIndex = null;
  
  var thread = document.getElementById('conversationThread');
  if (thread) thread.innerHTML = '';
  
  var agentView = document.getElementById('agentView');
  if (agentView) agentView.classList.remove('conversation-active');

  var conv = document.getElementById('agentConversation');
  if (conv) conv.classList.add('hidden');

  var header = document.getElementById('agentConversationHeader');
  if (header) {
    header.classList.add('hidden');
    header.style.display = 'none';
  }
  
  var landingContent = document.getElementById('agentLandingContent');
  if (landingContent) {
    landingContent.style.display = 'flex';
    landingContent.classList.remove('hidden');
  }
  
  // Focus the input and render file chips after DOM is ready
  setTimeout(function() {
    // v28.4: Render file chips after view switch so DOM container is visible
    if (typeof renderAgentFileChips === 'function') {
      renderAgentFileChips();
    }
    // Mark attach buttons
    var landingAttach = document.getElementById('landingAttachBtn');
    var followupAttach = document.getElementById('followupAttachBtn');
    if (landingAttach) landingAttach.classList.add('has-file');
    if (followupAttach) followupAttach.classList.add('has-file');

    var input = document.getElementById('agentCommand');
    if (input) {
      input.focus();
      input.placeholder = isLifeMode ? 'Ask about this document...' : 'Ask about this document...';
    }
    showToast('Document attached: type your question', 'success');
  }, 100);
}

/* v9.1.14: deleteLibraryFile moved to single location below */
/**
 * v9.1.14: Continue conversation from library
 */
function continueConversationFromLibrary() {
  // v10.5.25: Support both brand and life library files
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life' || libraryPreviewBrandIdx === -1;
  
  var file = null;
  
  if (isLifeMode || libraryPreviewBrandIdx === -1) {
    // LifeAI: Get file from life library - v16.0: use getLifeLibrary() for per-profile support
    var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    if (libraryPreviewFileId && lifeLib.files) {
      file = lifeLib.files.find(function(f) { return f.id === libraryPreviewFileId; });
    }
    // Also check selectedLibraryItem as fallback
    if (!file && selectedLibraryItem) {
      file = selectedLibraryItem;
    }
    isLifeMode = true; // Force life mode if file came from life library
  } else {
    // BrandAI: Get file from brand library
    if (!libraryPreviewFileId || libraryPreviewBrandIdx === null) return;
    var lib = getLibraryForBrandIndex(libraryPreviewBrandIdx);
    if (!lib || !lib.files) return;
    file = lib.files.find(function(f) { return f.id === libraryPreviewFileId; });
  }
  
  if (!file) {
    showToast('Could not find conversation file', 'error');
    return;
  }
  
  // v11.0.5: Check for conversation in either format
  if (!file.content && !file.conversation) {
    showToast('Could not find conversation data', 'error');
    return;
  }
  
  // Extract conversation data from data-conversation attribute or direct property
  // v10.5.34: More robust extraction that handles multiline JSON and various encodings
  var conversationData = null;
  
  // Method 1: Check if file has a separate conversation property (newer format) - PRIORITY
  if (file.conversation && Array.isArray(file.conversation) && file.conversation.length > 0) {
    conversationData = file.conversation;
    console.log('Using file.conversation directly, messages:', conversationData.length);
  }
  
  // Method 2: Try regex with non-greedy match on content
  if (!conversationData && file.content) {
    var match = file.content.match(/data-conversation='([\s\S]*?)'/);
    if (!match) {
      // Try double-quote variant
      match = file.content.match(/data-conversation="([\s\S]*?)"/);
    }
    
    if (match) {
      try {
        var jsonStr = match[1]
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        conversationData = JSON.parse(jsonStr);
        console.log('Extracted from data-conversation, messages:', conversationData.length);
      } catch (e) {
        console.error('Failed to parse data-conversation:', e);
      }
    }
  }
  
  // Method 3: Try to find JSON array directly in content
  if (!conversationData && file.content) {
    var jsonMatch = file.content.match(/\[[\s\S]*?"role"\s*:\s*"(user|assistant)"[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        conversationData = JSON.parse(jsonMatch[0]);
        console.log('Extracted from JSON pattern, messages:', conversationData.length);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
  
  if (!conversationData || !conversationData.length) {
    showToast('Could not load conversation data', 'error');
    return;
  }
  
  try {
    if (isLifeMode) {
      // LifeAI mode setup
      localStorage.setItem('roweos_app_mode', 'life');
      localStorage.setItem('roweos_mode', 'life');
      document.documentElement.classList.add('life-mode');
      document.documentElement.classList.remove('brand-mode');
      var brandSelect = document.getElementById('agentBrand');
      if (brandSelect) brandSelect.value = 'none';
      
      // v10.5.26: Create NEW history entry for continued conversation
      // v11.0.5: Use Library file name as title (user's custom name)
      var lifeProfile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
      var commandPreview = file.name || 'Continued conversation';
      
      var newHistoryEntry = {
        id: Date.now(),
        brand: lifeProfile ? lifeProfile.name : 'LifeAI',
        mode: 'life',
        lifeName: lifeProfile ? lifeProfile.name : null,
        command: commandPreview,
        conversation: JSON.parse(JSON.stringify(conversationData)),
        time: new Date().toLocaleString(),
        continuedFromLibrary: true,
        libraryFileName: file.name
      };
      agentCommands.push(newHistoryEntry);
      
      // Track the new index so followups update THIS entry
      window._continuedHistoryIndex = agentCommands.length - 1;
      continuingFromHistoryIndex = window._continuedHistoryIndex;
      
      saveRuns();
      renderAgentHistory();
      console.log('[Library Continue] Created new LifeAI history entry at index', window._continuedHistoryIndex);
      
    } else {
      // BrandAI mode setup
      selectedBrand = libraryPreviewBrandIdx;
      var brandSelect = document.getElementById('agentBrand');
      if (brandSelect) brandSelect.value = libraryPreviewBrandIdx.toString();
      conversationStartBrand = libraryPreviewBrandIdx;
      
      // v10.5.26: Create NEW history entry for continued conversation
      // v11.0.5: Use Library file name as title (user's custom name)
      var brand = brands[libraryPreviewBrandIdx];
      var brandName = brand ? brand.name : 'Unknown';
      var commandPreview = file.name || 'Continued conversation';
      
      var newHistoryEntry = {
        id: Date.now(),
        brand: brandName,
        brandIndex: libraryPreviewBrandIdx,
        mode: 'brand',
        command: commandPreview,
        conversation: JSON.parse(JSON.stringify(conversationData)),
        time: new Date().toLocaleString(),
        continuedFromLibrary: true,
        libraryFileName: file.name
      };
      agentCommands.push(newHistoryEntry);
      
      // Track the new index so followups update THIS entry
      window._continuedHistoryIndex = agentCommands.length - 1;
      continuingFromHistoryIndex = window._continuedHistoryIndex;
      
      saveRuns();
      renderAgentHistory();
      console.log('[Library Continue] Created new BrandAI history entry at index', window._continuedHistoryIndex);
    }
    
    // Load conversation
    currentConversation = conversationData;
    
    // Close preview and navigate
    closeLibraryPreview();
    showView('agent');
    
    setTimeout(function() {
      showConversationView();
      renderConversation();
      
      // Scroll to bottom
      var messagesEl = document.getElementById('agentConversation');
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      
      showToast('Conversation continued: new entry created in History', 'success');
    }, 100);
    
  } catch (e) {
    console.error('Error loading conversation:', e);
    showToast('Could not load conversation', 'error');
  }
}

// Legacy compatibility functions
function renderLibraryFolderGrid() {
  renderLibraryBrandCards();
}

function switchLibraryBrand(brandIdx) {
  selectedBrand = parseInt(brandIdx);
  renderLibraryBrandCards();
}

function openLibraryFolder(folderId) {
  openLibraryFolderForBrand(selectedBrand, folderId);
}

function renderLibraryFiles(folderId) {
  renderLibraryFilesForBrand(selectedBrand, folderId);
}

// Keep old function for compatibility
function selectLibraryFolder(folderId) {
  libraryCurrentFolder = folderId;
  
  // Update active state
  document.querySelectorAll('.finder-folder').forEach(function(el) {
    el.classList.toggle('active', el.dataset.folder === folderId);
  });
  
  // Update path
  var pathEl = document.getElementById('libraryCurrentPath');
  if (pathEl) {
    var folderNames = {
      'all': 'All Files',
      'recent': 'Recent',
      'favorites': 'Favorites',
      'scheduled-outputs': 'Scheduled Outputs',
      'type-outputs': 'Outputs',
      'type-prompts': 'Prompts',
      'type-templates': 'Templates'
    };
    
    // Handle dynamic brand folders
    if (folderId.startsWith('brand-')) {
      var brandIdx = parseInt(folderId.replace('brand-', ''));
      if (brands[brandIdx]) {
        folderNames[folderId] = brands[brandIdx].name;
      }
    }
    
    pathEl.textContent = folderNames[folderId] || folderId;
  }
  
  renderLibraryItems();
}

function updateLibraryFolderList() {
  var container = document.getElementById('libraryFolderList');
  if (!container) return;
  
  // Get all custom folders from all brand libraries
  var customFolders = [];
  for (var i = 0; i < brands.length; i++) {
    var lib = getLibraryForBrandIndex(i);
    if (lib && lib.folders) {
      lib.folders.forEach(function(folder) {
        if (folder.id !== 'root') {
          customFolders.push({
            id: 'folder-' + i + '-' + folder.id,
            name: folder.name,
            brandIdx: i,
            folderId: folder.id
          });
        }
      });
    }
  }
  
  if (customFolders.length === 0) {
    container.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted); font-size: var(--text-sm); font-style: italic;">No custom folders</div>';
    return;
  }
  
  var html = customFolders.map(function(folder) {
    return '<div class="finder-folder" data-folder="' + folder.id + '" onclick="selectLibraryFolder(\'' + folder.id + '\')" style="display: flex; align-items: center; justify-content: space-between; position: relative;">' +
      '<span class="finder-folder-name">' + escapeHtml(folder.name) + '</span>' +
      '<button class="folder-delete-btn" onclick="event.stopPropagation(); deleteLibraryFolder(\'' + folder.folderId + '\', ' + folder.brandIdx + ')" title="Delete folder" style="opacity: 0; background: none; border: none; color: #e57373; cursor: pointer; font-size: var(--text-base); padding: 4px 8px; transition: opacity 0.15s;">×</button>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
  
  // Add hover effect to show delete button
  container.querySelectorAll('.finder-folder').forEach(function(folder) {
    folder.addEventListener('mouseenter', function() {
      var btn = this.querySelector('.folder-delete-btn');
      if (btn) btn.style.opacity = '1';
    });
    folder.addEventListener('mouseleave', function() {
      var btn = this.querySelector('.folder-delete-btn');
      if (btn) btn.style.opacity = '0';
    });
  });
}

// v24.27: Removed dead updateLibraryCounts() - zero callers, folderCountAll/Recent/Favorites elements removed

// v16.0: Toggle a library file as favorite
function toggleLibraryFavorite(fileId) {
  var favIds = [];
  try { favIds = JSON.parse(localStorage.getItem('roweos_library_favorites') || '[]'); } catch(e) {}
  var idx = favIds.indexOf(fileId);
  if (idx !== -1) {
    favIds.splice(idx, 1);
    showToast('Removed from favorites', 'info');
  } else {
    favIds.push(fileId);
    showToast('Added to favorites', 'success');
  }
  try { localStorage.setItem('roweos_library_favorites', JSON.stringify(favIds)); } catch(e) {}
  // Refresh counts and view
  if (typeof renderLibraryView === 'function') renderLibraryView();
}

// v16.0: Check if a file is favorited
function isLibraryFavorite(fileId) {
  try {
    var favIds = JSON.parse(localStorage.getItem('roweos_library_favorites') || '[]');
    return favIds.indexOf(fileId) !== -1;
  } catch(e) { return false; }
}

function getLibraryItemsForFolder(folderId) {
  var items = [];
  
  if (folderId === 'all') {
    // Get all files from all brands
    for (var i = 0; i < 5; i++) {
      var lib = getLibraryForBrandIndex(i);
      if (lib && lib.files) {
        lib.files.forEach(function(file) {
          items.push(Object.assign({}, file, { brandIdx: i, brandName: brands[i].name }));
        });
      }
    }
  } else if (folderId === 'recent') {
    // Get files from last 7 days
    var weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (var i = 0; i < 5; i++) {
      var lib = getLibraryForBrandIndex(i);
      if (lib && lib.files) {
        lib.files.forEach(function(file) {
          if (file.savedAt > weekAgo) {
            items.push(Object.assign({}, file, { brandIdx: i, brandName: brands[i].name }));
          }
        });
      }
    }
  } else if (folderId === 'favorites') {
    // v16.0: Favorites - filter files by favorited IDs
    var favIds = [];
    try { favIds = JSON.parse(localStorage.getItem('roweos_library_favorites') || '[]'); } catch(e) {}
    if (favIds.length > 0) {
      for (var i = 0; i < 5; i++) {
        var lib = getLibraryForBrandIndex(i);
        if (lib && lib.files) {
          lib.files.forEach(function(file) {
            if (favIds.indexOf(file.id) !== -1) {
              items.push(Object.assign({}, file, { brandIdx: i, brandName: brands[i].name }));
            }
          });
        }
      }
      // Also check LifeAI library
      var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : { files: [] };
      if (lifeLib.files) {
        lifeLib.files.forEach(function(file) {
          if (favIds.indexOf(file.id) !== -1) {
            items.push(Object.assign({}, file, { brandIdx: -1, brandName: 'LifeAI' }));
          }
        });
      }
    }
  } else if (folderId === 'scheduled-outputs') {
    // v9.1.14: Get automation task history results
    var history = JSON.parse(localStorage.getItem('roweos_task_history') || '[]');
    history.forEach(function(entry) {
      items.push({
        id: 'task-' + entry.taskId + '-' + entry.timestamp,
        name: entry.taskName || 'Automation Output',
        type: 'output',
        content: entry.result,
        savedAt: new Date(entry.timestamp).getTime(),
        brandName: entry.brand || 'Unknown',
        operation: entry.action || 'automation'
      });
    });
  } else if (folderId.startsWith('brand-')) {
    var brandIdx = parseInt(folderId.replace('brand-', ''));
    var lib = getLibraryForBrandIndex(brandIdx);
    if (lib && lib.files) {
      lib.files.forEach(function(file) {
        items.push(Object.assign({}, file, { brandIdx: brandIdx, brandName: brands[brandIdx].name }));
      });
    }
  } else if (folderId === 'type-outputs') {
    for (var i = 0; i < 5; i++) {
      var lib = getLibraryForBrandIndex(i);
      if (lib && lib.files) {
        lib.files.forEach(function(file) {
          items.push(Object.assign({}, file, { brandIdx: i, brandName: brands[i].name }));
        });
      }
    }
  } else if (folderId === 'type-prompts') {
    promptLibrary.forEach(function(p) {
      items.push({
        id: p.id,
        name: p.name,
        type: 'prompt',
        content: p.context,
        savedAt: new Date(p.date).getTime() || Date.now(),
        brandName: p.brand,
        operation: p.operation
      });
    });
  } else if (folderId.startsWith('folder-')) {
    // Custom folder
    var parts = folderId.replace('folder-', '').split('-');
    var brandIdx = parseInt(parts[0]);
    var actualFolderId = parts.slice(1).join('-');
    var lib = getLibraryForBrandIndex(brandIdx);
    if (lib && lib.files) {
      lib.files.forEach(function(file) {
        if (file.folderId === actualFolderId) {
          items.push(Object.assign({}, file, { brandIdx: brandIdx, brandName: brands[brandIdx].name }));
        }
      });
    }
  }
  
  // Apply search filter
  if (librarySearchQuery) {
    var query = librarySearchQuery.toLowerCase();
    items = items.filter(function(item) {
      return item.name.toLowerCase().indexOf(query) !== -1 ||
             (item.brandName && item.brandName.toLowerCase().indexOf(query) !== -1) ||
             (item.operation && item.operation.toLowerCase().indexOf(query) !== -1);
    });
  }
  
  // Sort by date (newest first)
  items.sort(function(a, b) {
    return (b.savedAt || 0) - (a.savedAt || 0);
  });
  
  return items;
}

function renderLibraryItems() {
  var items = getLibraryItemsForFolder(libraryCurrentFolder);
  
  // Update item count
  var countEl = document.getElementById('libraryItemCount');
  if (countEl) {
    countEl.textContent = items.length + ' item' + (items.length !== 1 ? 's' : '');
  }
  
  var contentEl = document.getElementById('libraryFinderContent');
  if (!contentEl) return;
  
  if (items.length === 0) {
    contentEl.innerHTML = '<div class="finder-empty">' +
      '<div class="finder-empty-icon">◇</div>' +
      '<div class="finder-empty-text">No items here</div>' +
      '<div class="finder-empty-subtext">Save outputs from Studio or BrandAI to see them here.</div>' +
    '</div>';
    return;
  }
  
  // Ensure container exists
  var container = contentEl.querySelector('#libraryItemsGrid');
  if (!container) {
    contentEl.innerHTML = '<div class="' + (libraryViewMode === 'grid' ? 'finder-grid' : 'finder-list') + '" id="libraryItemsGrid"></div>';
    container = document.getElementById('libraryItemsGrid');
  }
  
  container.className = libraryViewMode === 'grid' ? 'finder-grid' : 'finder-list';
  
  var html = items.map(function(item) {
    var dateStr = item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '';
    var icon = item.type === 'prompt' ? '◇' : '◆';
    var typeLabel = item.type === 'prompt' ? 'Prompt' : 'Output';
    
    // v16.0: Favorite star button
    var isFav = isLibraryFavorite(item.id);
    var favStar = '<button onclick="event.stopPropagation(); toggleLibraryFavorite(\'' + item.id + '\')" style="background:none;border:none;cursor:pointer;padding:2px 4px;color:' + (isFav ? 'var(--accent, #a89878)' : 'var(--text-tertiary)') + ';font-size:14px;" title="' + (isFav ? 'Remove from favorites' : 'Add to favorites') + '">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="' + (isFav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>';

    if (libraryViewMode === 'grid') {
      return '<div class="finder-item" data-id="' + item.id + '" onclick="previewLibraryItem(\'' + item.id + '\', \'' + (item.brandIdx || 0) + '\', \'' + (item.type || 'output') + '\')">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
          '<div class="finder-item-icon">' + icon + '</div>' + favStar +
        '</div>' +
        '<div class="finder-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div class="finder-item-meta">' + escapeHtml(item.brandName || '') + '</div>' // v30.1: XSS fix +
      '</div>';
    } else {
      return '<div class="finder-item" data-id="' + item.id + '" onclick="previewLibraryItem(\'' + item.id + '\', \'' + (item.brandIdx || 0) + '\', \'' + (item.type || 'output') + '\')">' +
        '<div class="finder-item-icon">' + icon + '</div>' +
        '<div class="finder-item-info">' +
          '<div class="finder-item-name">' + escapeHtml(item.name) + '</div>' +
        '</div>' +
        '<div class="finder-item-type">' + typeLabel + '</div>' +
        '<div class="finder-item-date">' + dateStr + '</div>' +
        favStar +
      '</div>';
    }
  }).join('');
  
  container.innerHTML = html;
  
  // Initialize drag and drop
  initLibraryDragDrop();
}

function setLibraryView(mode) {
  libraryViewMode = mode;
  
  document.querySelectorAll('.finder-view-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  
  renderLibraryItems();
}

function searchLibrary(query) {
  librarySearchQuery = query.trim();
  renderLibraryItems();
}

var pendingFolderBrandIdx = 0;

function createLibraryFolder() {
  try {
    // Determine brand index from current library folder selection
    pendingFolderBrandIdx = 0;
    
    if (libraryCurrentFolder) {
      if (libraryCurrentFolder.startsWith('brand-')) {
        pendingFolderBrandIdx = parseInt(libraryCurrentFolder.replace('brand-', ''));
      } else if (libraryCurrentFolder.startsWith('folder-')) {
        var parts = libraryCurrentFolder.split('-');
        if (parts.length >= 2) {
          pendingFolderBrandIdx = parseInt(parts[1]);
        }
      }
    }
    
    // Show modal instead of prompt
    document.getElementById('folderNameModal').classList.add('show');
    document.getElementById('newFolderNameInput').value = '';
    setTimeout(function() {
      document.getElementById('newFolderNameInput').focus();
    }, 100);
  } catch(e) {
    console.error('Error opening folder modal:', e);
    showToast('Error: ' + e.message, 'error');
  }
}

function closeFolderNameModal() {
  document.getElementById('folderNameModal').classList.remove('show');
}

function confirmCreateFolder() {
  var name = document.getElementById('newFolderNameInput').value.trim();
  if (!name) {
    showToast('Please enter a folder name', 'error');
    return;
  }
  
  try {
    var brand = brands[pendingFolderBrandIdx];
    if (!brand) {
      showToast('Invalid brand selected', 'error');
      closeFolderNameModal();
      return;
    }
    
    var key = brand.name;
    if (!fileLibrary[key]) {
      fileLibrary[key] = {
        folders: [{ id: 'root', name: 'Root', parentId: null }],
        files: []
      };
    }
    
    var lib = fileLibrary[key];
    if (!lib.folders) {
      lib.folders = [{ id: 'root', name: 'Root', parentId: null }];
    }
    
    var folder = {
      id: 'folder_' + Date.now(),
      name: name,
      parentId: 'root'
    };
    lib.folders.push(folder);
    saveLibrary();
    
    closeFolderNameModal();
    
    // Refresh the library view
    updateLibraryFolderList();
    renderLibraryItems();
    showToast('Folder "' + name + '" created in ' + brand.name, 'success');
  } catch(e) {
    console.error('Error creating folder:', e);
    showToast('Error creating folder: ' + e.message, 'error');
  }
}

// Move to Folder functionality
var selectedMoveFolder = null;

function openMoveToFolderModal() {
  if (!selectedLibraryItem) {
    showToast('No file selected', 'error');
    return;
  }
  
  selectedMoveFolder = null;
  populateMoveFolderList();
  document.getElementById('moveToFolderModal').classList.add('show');
}

function closeMoveToFolderModal() {
  document.getElementById('moveToFolderModal').classList.remove('show');
  selectedMoveFolder = null;
}

function populateMoveFolderList() {
  var container = document.getElementById('moveFolderList');
  if (!container) return;
  
  var folders = [];
  
  // Add root for each brand
  for (var i = 0; i < 5; i++) {
    folders.push({
      id: 'root',
      name: 'Root',
      brandIdx: i,
      brandName: brands[i].name
    });
    
    // Add custom folders for this brand
    var lib = getLibraryForBrandIndex(i);
    if (lib && lib.folders) {
      lib.folders.forEach(function(folder) {
        if (folder.id !== 'root') {
          folders.push({
            id: folder.id,
            name: folder.name,
            brandIdx: i,
            brandName: brands[i].name
          });
        }
      });
    }
  }
  
  var html = folders.map(function(folder) {
    var isRoot = folder.id === 'root';
    return '<div class="move-folder-item" data-folder-id="' + folder.id + '" data-brand-idx="' + folder.brandIdx + '" onclick="selectMoveFolder(this)">' +
      '<span class="move-folder-icon">' + (isRoot ? '◇' : '◆') + '</span>' +
      '<div style="flex: 1;">' +
        '<div class="move-folder-name">' + escapeHtml(folder.name) + '</div>' +
        '<div class="move-folder-brand">' + escapeHtml(folder.brandName) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

function selectMoveFolder(el) {
  document.querySelectorAll('.move-folder-item').forEach(function(item) {
    item.classList.remove('selected');
  });
  el.classList.add('selected');
  selectedMoveFolder = {
    folderId: el.getAttribute('data-folder-id'),
    brandIdx: parseInt(el.getAttribute('data-brand-idx'))
  };
}

function confirmMoveToFolder() {
  if (!selectedLibraryItem || !selectedMoveFolder) {
    showToast('Please select a destination folder', 'error');
    return;
  }
  
  // Find and remove from current location
  var currentBrandIdx = null;
  for (var i = 0; i < 5; i++) {
    var lib = getLibraryForBrandIndex(i);
    if (lib && lib.files) {
      var fileIdx = lib.files.findIndex(function(f) { return f.id === selectedLibraryItem.id; });
      if (fileIdx !== -1) {
        currentBrandIdx = i;
        lib.files.splice(fileIdx, 1);
        break;
      }
    }
  }
  
  // Add to new location
  var destLib = getLibraryForBrandIndex(selectedMoveFolder.brandIdx);
  if (destLib) {
    selectedLibraryItem.folderId = selectedMoveFolder.folderId;
    selectedLibraryItem.brand = brands[selectedMoveFolder.brandIdx].name;
    destLib.files.push(selectedLibraryItem);
    saveLibrary();
    
    closeMoveToFolderModal();
    closeFilePreview();
    renderLibraryView();
    showToast('File moved successfully', 'success');
  }
}

// Drag and Drop functionality
var draggedLibraryItem = null;

// v24.27: Renamed finder* to avoid calendar drag handler collision
function initLibraryDragDrop() {
  // This is called after rendering library items
  var items = document.querySelectorAll('.finder-item');
  items.forEach(function(item) {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', finderDragStart);
    item.addEventListener('dragend', finderDragEnd);
  });

  // Make folders drop targets
  var folders = document.querySelectorAll('.finder-folder');
  folders.forEach(function(folder) {
    folder.addEventListener('dragover', finderDragOver);
    folder.addEventListener('dragleave', finderDragLeave);
    folder.addEventListener('drop', finderDrop);
  });
}

function finderDragStart(e) {
  draggedLibraryItem = {
    id: this.getAttribute('data-id'),
    element: this
  };
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function finderDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(function(el) {
    el.classList.remove('drag-over');
  });
}

function finderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}

function finderDragLeave(e) {
  this.classList.remove('drag-over');
}

function finderDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  if (!draggedLibraryItem) return;

  var targetFolder = this.getAttribute('data-folder');
  if (!targetFolder) return;

  // Parse folder info
  var destBrandIdx = 0;
  var destFolderId = 'root';

  if (targetFolder.startsWith('brand-')) {
    destBrandIdx = parseInt(targetFolder.replace('brand-', ''));
  } else if (targetFolder.startsWith('folder-')) {
    var parts = targetFolder.replace('folder-', '').split('-');
    destBrandIdx = parseInt(parts[0]);
    destFolderId = parts.slice(1).join('-');
  }

  // Find and move the file
  for (var i = 0; i < 5; i++) {
    var lib = getLibraryForBrandIndex(i);
    if (lib && lib.files) {
      var fileIdx = lib.files.findIndex(function(f) { return f.id === draggedLibraryItem.id; });
      if (fileIdx !== -1) {
        var file = lib.files.splice(fileIdx, 1)[0];
        file.folderId = destFolderId;
        file.brand = brands[destBrandIdx].name;

        var destLib = getLibraryForBrandIndex(destBrandIdx);
        destLib.files.push(file);
        saveLibrary();

        renderLibraryView();
        showToast('File moved', 'success');
        break;
      }
    }
  }

  draggedLibraryItem = null;
}

// v26.2: Visual Assets view in Library
function renderVisualAssetsView() {
  var container = document.getElementById('libraryContent') || document.querySelector('#libraryView .panel');
  if (!container) return;

  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];

  // Collect visual assets
  var assets = [];

  // Brand logos
  if (brand.logo) {
    assets.push({ name: brand.name + ' Logo (Dark)', src: brand.logo, type: 'logo' });
  }
  if (brand.logoLight) {
    assets.push({ name: brand.name + ' Logo (Light)', src: brand.logoLight, type: 'logo' });
  }

  // File library images
  var library = [];
  try { library = JSON.parse(localStorage.getItem('roweos_user_library') || '[]'); } catch(e) {}
  for (var i = 0; i < library.length; i++) {
    var item = library[i];
    var ext = (item.name || '').toLowerCase().split('.').pop();
    var isImage = ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].indexOf(ext) !== -1;
    if (isImage || item.type === 'image' || (item.mimeType && item.mimeType.indexOf('image') === 0)) {
      assets.push({
        name: item.name || 'Image',
        src: item.data || item.url || item.content || '',
        type: 'file',
        id: item.id,
        brand: item.brand || ''
      });
    }
  }

  // Store for preview access
  _visualAssets = assets;

  // Filter by current brand if brand filter is active
  var filteredAssets = assets;

  // Render
  var html = '<div style="margin-bottom:var(--space-4);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);">Visual Assets</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);">' + filteredAssets.length + ' items</div>';
  html += '</div>';

  if (filteredAssets.length === 0) {
    html += '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">';
    html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.4;display:block;margin:0 auto 12px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    html += 'No visual assets yet. Upload images or generate them in Studio.';
    html += '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));gap:12px;">';
    for (var j = 0; j < filteredAssets.length; j++) {
      var asset = filteredAssets[j];
      html += '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);overflow:hidden;cursor:pointer;" onclick="previewVisualAsset(' + j + ')">';
      html += '<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,0.2);">';
      if (asset.src) {
        html += '<img src="' + escapeHtml(asset.src) + '" alt="' + escapeHtml(asset.name) + '" style="max-width:100%;max-height:100%;object-fit:contain;" loading="lazy">';
      } else {
        html += '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
      }
      html += '</div>';
      html += '<div style="padding:8px;font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(asset.name) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Find a good insertion point -- look for the main library content area
  var libraryMain = document.getElementById('libraryMainContent');
  if (libraryMain) {
    libraryMain.innerHTML = html;
  } else {
    // Fallback: insert after the panel-header
    var view = document.getElementById('libraryView');
    if (view) {
      var existingContent = view.querySelector('.library-content-area, .brand-library-grid');
      if (existingContent) {
        existingContent.innerHTML = html;
      }
    }
  }
}

// Store visual assets for preview
var _visualAssets = [];

function previewVisualAsset(index) {
  if (_visualAssets && _visualAssets[index]) {
    var asset = _visualAssets[index];
    // Try to use existing file preview if available
    if (asset.id && typeof openFilePreview === 'function') {
      openFilePreview(asset.id);
    } else if (asset.src) {
      // Simple image preview modal
      showImagePreviewModal(asset.src, asset.name);
    }
  }
}

function showImagePreviewModal(src, name) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.onclick = function() { document.body.removeChild(overlay); };

  var img = document.createElement('img');
  img.src = src;
  img.alt = name || 'Preview';
  img.style.cssText = 'max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

function previewLibraryItem(itemId, brandIdx, type) {
  if (type === 'prompt') {
    var prompt = promptLibrary.find(function(p) { return p.id == itemId; });
    if (prompt) {
      // Load prompt to studio
      var contextEl = document.getElementById('studioContext');
      if (contextEl) contextEl.value = prompt.context;
      showView('studio');
      showToast('Prompt loaded to Studio', 'success');
    }
    return;
  }
  
  // Output file preview
  var lib = getLibraryForBrandIndex(parseInt(brandIdx));
  if (!lib) return;
  
  var file = lib.files.find(function(f) { return f.id === itemId; });
  if (!file) return;
  
  selectedLibraryItem = file;
  document.getElementById('previewFileName').textContent = file.name;
  document.getElementById('previewFileMeta').textContent = 'Saved ' + new Date(file.savedAt).toLocaleDateString() + ' • ' + file.brand;
  
  // Render content - check if it's already HTML or needs markdown conversion
  var content = file.content;
  if (content && !content.includes('<div') && !content.includes('<p>') && !content.includes('<h')) {
    // Looks like markdown, convert it
    content = markdownToHtml(content);
  }
  document.getElementById('previewFileContent').innerHTML = content;
  document.getElementById('filePreviewModal').classList.add('open');
}

// Clean up test/demo brands that shouldn't have been saved
// v20.8: Tightened - only remove brands named exactly "test", never remove brands with missing name
// (missing name is a sync corruption, not a test brand)
function cleanupTestBrands() {
  try {
    var savedBrands = localStorage.getItem(USER_DATA_KEYS.brands);
    if (savedBrands) {
      var brandsArray = JSON.parse(savedBrands);
      var originalLength = brandsArray.length;
      var removed = [];

      brandsArray = brandsArray.filter(function(brand) {
        if (!brand || !brand.name) return true; // v20.8: Keep brands with missing name (sync corruption) - don't silently delete
        var name = brand.name.toLowerCase().trim();

        // Only remove brands explicitly named "test"
        if (name === 'test') {
          removed.push(brand);
          return false;
        }

        return true;
      });

      // Move removed brands to trash for recovery
      if (brandsArray.length !== originalLength) {
        if (typeof window.deletedBrands !== 'undefined' && removed.length > 0) {
          for (var ri = 0; ri < removed.length; ri++) {
            window.deletedBrands.unshift({ brand: removed[ri], deletedAt: Date.now(), deletedBy: 'cleanup' });
          }
          if (typeof saveDeletedBrands === 'function') saveDeletedBrands();
        }
        localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brandsArray));
        brands = brandsArray;
        console.log('Cleaned up ' + (originalLength - brandsArray.length) + ' test brand(s)');
      }
    }
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

// Sync all brand dropdowns with the brands array
function syncBrandDropdowns() {
  // v10.5.25: Check mode - in Life mode, we still need the brand dropdowns synced for when user switches back
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';

  // v19.0: Use selectedBrand as authority (not DOM value) - prevents sync race conditions
  var authorityIdx = (typeof selectedBrand === 'number' && !isNaN(selectedBrand) && selectedBrand >= 0 && selectedBrand < brands.length)
    ? selectedBrand : parseInt(localStorage.getItem('roweos_selected_brand') || '0');
  if (isNaN(authorityIdx) || authorityIdx < 0 || authorityIdx >= brands.length) authorityIdx = 0;

  var brandSelectors = [
    document.getElementById('brand'),           // Sidebar
    document.getElementById('mobileBrand'),     // Mobile menu
    document.getElementById('studioBrand')      // Studio
  ];

  brandSelectors.forEach(function(select) {
    if (!select) return;

    select.innerHTML = '';

    brands.forEach(function(brand, idx) {
      var option = document.createElement('option');
      option.value = idx;
      option.textContent = brand.name;
      if (idx === authorityIdx) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  });
  
  // Sync agent brand dropdown (custom structure)
  var agentBrandDropdown = document.querySelector('#brandDropdown > div:last-child');
  if (agentBrandDropdown) {
    // v15.13: Use current agentBrand value (not hardcoded 0) for selected state
    var currentAgentBrand = parseInt((document.getElementById('agentBrand') || {}).value || '0');
    agentBrandDropdown.innerHTML = '';
    brands.forEach(function(brand, idx) {
      var option = document.createElement('div');
      option.className = 'tool-dropdown-item brand-option' + (idx === currentAgentBrand ? ' selected' : '');
      option.dataset.value = idx;
      var brandDisplay = brand.shortName || brand.name;
      option.onclick = function() { selectAgentBrand(idx, brandDisplay); };
      option.innerHTML = '<span class="brand-check">✓</span><div class="tool-dropdown-item-name">' + brandDisplay + '</div>';
      agentBrandDropdown.appendChild(option);
    });
    
    // v9.1.14: Add divider and "No BrandAI" option
    var divider = document.createElement('div');
    divider.style.cssText = 'height: 1px; background: var(--border-color); margin: 8px 0;';
    agentBrandDropdown.appendChild(divider);
    
    var noBrandOption = document.createElement('div');
    noBrandOption.className = 'tool-dropdown-item brand-option';
    noBrandOption.dataset.value = 'none';
    noBrandOption.onclick = function() { selectAgentBrand('none', 'StandardAI'); };
    noBrandOption.innerHTML = '<span class="brand-check">✓</span><div class="tool-dropdown-item-name" style="color: var(--text-muted);">No BrandAI (StandardAI)</div>';
    agentBrandDropdown.appendChild(noBrandOption);
  }
  
  // v10.5.25: Update brand name display respecting current mode
  updateBrandName();
  updateProviderPills();
}

// v16.11: Migrate old roweos_customOps key to roweos_custom_operations
function migrateCustomOpsKey() {
  try {
    var oldData = localStorage.getItem('roweos_customOps');
    if (!oldData) return;
    var oldOps = JSON.parse(oldData);
    if (!Array.isArray(oldOps) || oldOps.length === 0) {
      localStorage.removeItem('roweos_customOps');
      return;
    }
    var newOps = [];
    try { newOps = JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]'); } catch(e) {}
    // Merge, deduping by id
    var existingIds = {};
    newOps.forEach(function(op) { if (op.id) existingIds[op.id] = true; });
    oldOps.forEach(function(op) {
      if (op.id && !existingIds[op.id]) {
        newOps.push(op);
      }
    });
    localStorage.setItem('roweos_custom_operations', JSON.stringify(newOps));
    localStorage.removeItem('roweos_customOps');
  } catch(e) {}
}

function loadCustomOperations() {
  try {
    var customOps = JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]');
    customOps.forEach(function(op) {
      // Add to operations array if not already there
      var exists = operations.some(function(o) { return o.id === op.id; });
      if (!exists) {
        operations.push(op);
      }
    });
  } catch (e) {
    console.error('Error loading custom operations:', e);
  }
}

function init() {
  // v14.0: Sync version display across all UI elements
  var versionEls = [
    document.getElementById('settingsVersionDisplay'),
    document.getElementById('launchVersionTag'),
    document.getElementById('mobileVersionDisplay'),
    document.getElementById('sidebarVersionDisplay')
  ];
  versionEls.forEach(function(el) {
    if (el) {
      if (el.id === 'mobileVersionDisplay') {
        el.textContent = 'RoweOS ' + ROWEOS_VERSION;
      } else {
        el.textContent = ROWEOS_VERSION;
      }
    }
  });
  var sidebarVersion = document.querySelector('.sidebar-version');
  if (sidebarVersion) sidebarVersion.textContent = ROWEOS_VERSION;

  // v20.3: Handle ?join=CODE URL param for brand config sharing
  try {
    var joinParams = new URLSearchParams(window.location.search);
    var joinCode = joinParams.get('join');
    if (joinCode) {
      localStorage.setItem('roweos_pending_join', joinCode.trim());
      var cleanJoinUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanJoinUrl);
      console.log('[Init] Brand config join code stored:', joinCode);
    }
  } catch(e) {}

  // v18.3: Handle social OAuth redirect flow (mobile Safari popup blocked)
  try {
    var urlParams = new URLSearchParams(window.location.search);
    var socialCallback = urlParams.get('social_callback');
    if (socialCallback) {
      // Clean up URL without reload
      var cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      // v18.9: Restore view user was on before mobile OAuth redirect
      var returnView = null;
      try {
        returnView = localStorage.getItem('roweos_social_return_view');
        if (returnView) localStorage.removeItem('roweos_social_return_view');
      } catch(e) {}
      // Show success toast after a short delay so app is initialized
      var platformName = socialCallback.charAt(0).toUpperCase() + socialCallback.slice(1);
      setTimeout(function() {
        if (typeof showToast === 'function') showToast(platformName + ' connected', 'success');
        if (typeof refreshSocialAccountCards === 'function') refreshSocialAccountCards();
        // v18.9: Also refresh Digital Presence card if on Identity view
        if (typeof renderDigitalPresenceCard === 'function') renderDigitalPresenceCard();
        // v22.25: If returning from Gmail/Outlook mail OAuth, refresh mail connections
        if (socialCallback === 'gmail' || socialCallback === 'outlook') {
          if (typeof renderMailConnections === 'function') renderMailConnections();
          if (typeof renderMailComposeFrom === 'function') renderMailComposeFrom();
          if (typeof showView === 'function') showView('mail');
          return;
        }
        // v18.9: Navigate back to the view user was on before OAuth
        if (returnView && typeof showView === 'function') showView(returnView);
      }, 1500);
    }
  } catch(e) {}

  // v20.6: Handle Stripe checkout success redirect
  try {
    var subParams = new URLSearchParams(window.location.search);
    var subSuccess = subParams.get('subscription');
    if (subSuccess === 'success') {
      var subTier = subParams.get('tier') || '';
      // v30.5: Save params to window BEFORE cleaning URL - handleAuthState needs them
      window._stripeSubscriptionSuccess = true;
      window._stripeSubscriptionTier = subTier;
      window._stripeReturnProcessed = true;
      try { localStorage.setItem('roweos_tier_selected', subTier || 'solo'); } catch(e) {}
      window.history.replaceState({}, document.title, window.location.pathname);
      var subTierLabel = subTier ? subTier.charAt(0).toUpperCase() + subTier.slice(1) : '';
      setTimeout(function() {
        if (typeof showToast === 'function') {
          showToast('Welcome to RoweOS' + (subTierLabel ? ' ' + subTierLabel : '') + '! Check your email for your access key.', 'success', 8000);
        }
      }, 2000);
    }
    // v20.9: Handle API key purchase success redirect
    var apiPurchase = subParams.get('api_key_purchase');
    if (apiPurchase === 'success') {
      var apiProvider = subParams.get('provider') || '';
      window.history.replaceState({}, document.title, window.location.pathname);
      var providerLabel = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' }[apiProvider] || apiProvider;
      setTimeout(function() {
        if (typeof showToast === 'function') {
          showToast(providerLabel + ' API key purchased! It will auto-activate on your next sign-in, or check your email.', 'success', 8000);
        }
      }, 2000);
    }
  } catch(e) {}

  // v10.2: Initialize launch mode from localStorage
  initLaunchMode();

  // v15.3: Set mode class on <html> early so CSS targeting works from the start
  var earlyMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (earlyMode === 'life') {
    document.documentElement.classList.add('life-mode');
    document.documentElement.classList.remove('brand-mode');
  } else {
    document.documentElement.classList.add('brand-mode');
    document.documentElement.classList.remove('life-mode');
  }

  // v10.5.25: Initialize LifeAI accent color from storage
  initLifeAccentColor();

  // v15.37: Migrate shared LifeAI logo to per-profile key (one-time, prevents BrandAI bleed)
  if (typeof migrateSharedLifeLogoToProfile === 'function') {
    migrateSharedLifeLogoToProfile();
  }

  // v10.5.25: Initialize BrandAI custom logo from storage
  initBrandLogo();
  // v24.20: Initialize welcome logo size from storage
  if (typeof initWelcomeLogoSize === 'function') initWelcomeLogoSize();
  if (typeof initLogoZoom === 'function') initLogoZoom();
  if (typeof initBlobSettings === 'function') initBlobSettings();
  if (typeof updateWelcomeCardPreview === 'function') setTimeout(updateWelcomeCardPreview, 200);

  // v22.39: Initialize accessibility preferences
  if (typeof initAppZoom === 'function') initAppZoom();
  if (typeof initTextSize === 'function') initTextSize();

  // v15.1: Initialize brand accent color from current brand
  if (typeof initBrandAccentColor === 'function') {
    initBrandAccentColor();
  }

  // v24.26: Initialize promo font style preference
  if (typeof initPromoFonts === 'function') initPromoFonts();

  // v12.0.3: Load response cache and auto-pilot data
  loadResponseCache();
  loadAutoPilotData();
  loadNanobananaUsage(); // v15.7: Load usage tracking data

  // v12.2.4: Load sync settings
  loadSyncSettings();

  // CRITICAL: Clear any residual conversation state on fresh load
  currentConversation = [];
  conversationStartBrand = null;
  
  // Clear conversation thread DOM
  var thread = document.getElementById('conversationThread');
  if (thread) thread.innerHTML = '';
  
  // Ensure landing view is shown, not conversation view
  var agentView = document.getElementById('agentView');
  if (agentView) {
    agentView.classList.remove('conversation-active');
    agentView.classList.add('landing-view');
  }
  
  // Clean up any test/demo brands that shouldn't have been saved
  cleanupTestBrands();
  
  // Sync all brand dropdowns with brands array
  syncBrandDropdowns();
  
  loadRuns();
  migrateCustomOpsKey(); // v16.11: Migrate old key before loading
  loadCustomOperations();
  loadBrandAIGeneratedOps(); // v9.1.14: Load AI-generated operations
  loadGeneratedLifeOps();    // v10.5.25: Load AI-generated LifeAI operations
  renderOperations();
  initCollapsedSections(); // v9.1.14: Initialize collapsible sections
  initStudioControls(); // v9.1.14: Initialize model/length controls
  
  // v9.1.16: Ensure image provider selector is hidden on load and clear any selected op
  selectedOp = null;
  updateSelectedOpDisplay();
  initImageReferenceDragDrop();
  initChatDragDrop(); // v10.5.25: Drag-and-drop file upload for BrandAI / LifeAI chat
  
  showHistory();
  renderAgentHistory();
  initLibrary();
  initTodos();
  initTodoCategories();
  // v13.9: Defer Focus init to prevent blocking page load with large datasets
  setTimeout(function() {
    try { if (typeof initFocus2 === 'function') initFocus2(); } catch(e) { console.warn('[Init] initFocus2 error:', e.message); }
  }, 100);
  initDeletedBrands();
  initCalendar();
  initJournal(); // v12.2.4
  initScheduledPrompts();
  initScheduledTasksEngine(); // Start scheduled task execution engine
  updateAPIsStatus();

  // v17.0: Initialize social media integration
  if (typeof initSocialMedia === 'function') initSocialMedia();

  // v16.12: 15-minute auto-refresh for external calendars
  setInterval(function() {
    if (_gcalConnected || _icloudConnected) {
      var currentView = document.querySelector('.panel-view:not(.hidden)');
      if (currentView && currentView.id === 'rhythmView') {
        syncAllExternalCalendars();
      }
    }
  }, 900000); // 15 minutes
  
  // Set initial brand selectors (only if brands exist)
  // v15.3: Restore last selected brand instead of always defaulting to 0
  if (brands && brands.length > 0) {
    var savedBrandIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
    if (isNaN(savedBrandIdx) || savedBrandIdx < 0 || savedBrandIdx >= brands.length) savedBrandIdx = 0;
    document.getElementById('brand').value = String(savedBrandIdx);
    document.getElementById('agentBrand').value = String(savedBrandIdx);
    document.getElementById('studioBrand').value = String(savedBrandIdx);
    selectedBrand = savedBrandIdx;
    studioSelectedBrand = savedBrandIdx;

    // v15.3: Re-apply brand accent color for restored brand (initBrandAccentColor ran before brand was set)
    if (typeof applyCurrentBrandAccent === 'function') {
      applyCurrentBrandAccent();
    }
    // v15.3: Re-apply brand logo for restored brand (initBrandLogo ran before brand selector was populated)
    if (typeof initBrandLogo === 'function') {
      initBrandLogo();
    }

    // v9.1.14: Ensure diamond icon is gold by default (brand is selected)
    // Use setTimeout to ensure button exists in DOM
    setTimeout(function() {
      updateBrandIconState(false);
    }, 100);
  }
  
  // v9.1.14: Update star buttons with current provider color
  setTimeout(function() {
    if (typeof updateStarButtonProvider === 'function') {
      updateStarButtonProvider();
    }
    // v13.9: Show Nanobanana in chat dropdowns if key is configured
    if (typeof updateNanobananaChatSections === 'function') {
      updateNanobananaChatSections();
    }
    // v15.7: Show deep research toggle on landing if supported model is selected
    if (typeof updateDeepResearchButton === 'function') {
      updateDeepResearchButton();
    }
  }, 200);
  
  // Load text size preference (default to compact on mobile)
  try {
    var savedPref = localStorage.getItem('roweosCompactText');
    var isMobile = window.innerWidth <= 768;
    var useCompact = savedPref === 'true' || (savedPref === null && isMobile);
    
    if (useCompact) {
      document.body.classList.add('compact-text');
      var btn = document.getElementById('textSizeBtn');
      if (btn) btn.style.opacity = '1';
    }
  } catch (e) {}
  
  // Check for updates (once per day)
  checkForUpdates();
  
  // v15.0: Determine what to show on startup
  // Auth gate is shown by default. The handleAuthState callback
  // (triggered by Firebase onAuthStateChanged) will hide it when appropriate.
  setTimeout(function() {
    var pendingAuth = sessionStorage.getItem('roweos_firebase_auth_pending');
    if (pendingAuth === 'true') {
      console.log('Pending Firebase auth detected - waiting for auth result...');
      setTimeout(function() {
        var stillPending = sessionStorage.getItem('roweos_firebase_auth_pending');
        if (stillPending === 'true') {
          console.log('Firebase auth timeout - showing auth gate');
          sessionStorage.removeItem('roweos_firebase_auth_pending');
          showAuthGate();
        }
      }, 5000);
      return;
    }
    // If Firebase hasn't initialized yet, show splash gateway.
    // handleAuthState will take over once onAuthStateChanged fires.
    // v20.14: Always show splash (no email fields = no autofill trigger on mobile).
    // For returning users, Firebase auth resolves in background → auto-loads app.
    if (!firebaseUser) {
      showAuthGate();
    }
    // v30.5: Poll every 500ms until auth resolves. If user is logged in with no brands
    // and no access key flow has shown tier selection, force it.
    // Skip if Stripe return already handled or tier already selected.
    var _tierCheckInterval = setInterval(function() {
      // v30.5: Stop polling if Stripe return was processed or tier already selected
      if (window._stripeReturnProcessed) {
        clearInterval(_tierCheckInterval);
        return;
      }
      var _tierDone = false;
      try { _tierDone = !!localStorage.getItem('roweos_tier_selected'); } catch(e) {}
      if (_tierDone) {
        clearInterval(_tierCheckInterval);
        return;
      }
      if (firebaseUser && (!brands || brands.length === 0)) {
        var tierEl = document.getElementById('authGateTierSelect');
        var gate = document.getElementById('authGate');
        // If tier select exists but isn't visible, and gate is hidden or invisible, force show
        if (tierEl && (tierEl.style.display === 'none' || tierEl.style.display === '')) {
          if (!gate || gate.style.display === 'none' || gate.style.opacity === '0') {
            console.log('[Auth] Poll: forcing tier selection for logged-in user with no brands');
            if (typeof showTierSelection === 'function') showTierSelection();
          }
        }
        // If tier select IS visible, stop polling
        if (tierEl && tierEl.style.display === 'block') {
          clearInterval(_tierCheckInterval);
        }
      }
      // If user has brands, they're past onboarding - stop polling
      if (brands && brands.length > 0) {
        clearInterval(_tierCheckInterval);
      }
    }, 500);
  }, 100);
}

// Helper to show appropriate startup screen
function showStartupScreen() {
  // v22.53: Remove boot screen - app is ready
  var boot = document.getElementById('bootScreen');
  if (boot) boot.remove();
  // v20.4: Check pending join FIRST - load brands before routing to avoid onboarding race
  try {
    var pendingJoin = localStorage.getItem('roweos_pending_join');
    if (pendingJoin && firebaseUser && !window._pendingJoinInProgress) {
      window._pendingJoinInProgress = true;
      claimBrandConfig(pendingJoin).then(function() {
        window._pendingJoinInProgress = false;
        // Re-run startup now that brands are loaded
        showStartupScreen();
      }).catch(function() {
        window._pendingJoinInProgress = false;
        // Config failed - continue normal startup
        showStartupScreen();
      });
      return; // Don't route yet - wait for config
    }
  } catch(e) {}

  // v24.26: Set data-view on body for CSS targeting (helix full-screen)
  document.body.setAttribute('data-view', 'agent');

  if (brands && brands.length > 0) {
    hideWelcomeScreen();
    // v30.1: Auto-login - returning users go straight to chat with last selected brand
    // Skip both the landing blob screen and the welcome overlay for faster access
    if (!window._showedPostLoginWelcome) {
      window._showedPostLoginWelcome = true;
      localStorage.setItem('roweos_has_launched', 'true');
    }
    showView('agent');
    // v30.1: Focus the chat input for immediate typing
    setTimeout(function() {
      var chatInput = document.getElementById('agentCommand') || document.getElementById('followupCommand');
      if (chatInput && typeof chatInput.focus === 'function') chatInput.focus();
    }, 500);
    // Update sidebar brand name display
    updateBrandName();
    populateSidebarBrandDropdown();
    // v30.2: Ensure logo matches resolved selectedBrand after restore
    if (typeof initBrandLogo === 'function') initBrandLogo();
  } else if (isFirstLaunch()) {
    showWelcomeScreen();
  } else {
    showOnboarding();
  }

  // v11.0.5: Start aggressive auto-save system for conversation protection
  startConversationAutoSave();

  // v24.24: Bloom prefetch removed - only loads when user navigates to Bloom view (saves API tokens)

  // v22.44: Start scheduled email checker
  if (typeof startMailScheduleChecker === 'function') startMailScheduleChecker();

  // v21.0: Floating feedback button removed
}

// v16.5: Post-login welcome overlay - shows personalized profile cards
function showPostLoginWelcome() {
  var overlay = document.getElementById('postLoginWelcome');
  if (!overlay) { showLaunchScreen(); return; }

  var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  var hasBrands = brands && brands.length > 0;
  var hasLife = profiles.length > 0;

  // No data at all - fall back to launch screen
  if (!hasBrands && !hasLife) { showLaunchScreen(); return; }

  // Greeting
  var greeting = 'Welcome';
  try {
    if (typeof firebaseUser !== 'undefined' && firebaseUser) {
      var displayName = firebaseUser.displayName || firebaseUser.email || '';
      var firstName = displayName.split(/[\s@]/)[0];
      if (firstName) greeting = 'Welcome, ' + escapeHtml(firstName);
    }
  } catch (e) {}
  document.getElementById('welcomeGreeting').textContent = greeting;

  // Helper: hex to "r, g, b" for rgba()
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex, 16);
    return ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255);
  }

  // Helper: build gradient card style string
  var isLight = document.documentElement.classList.contains('light-mode');
  function cardStyle(color) {
    var rgb = hexToRgb(color);
    if (isLight) {
      return 'background: linear-gradient(135deg, rgba(' + rgb + ', 0.08) 0%, rgba(' + rgb + ', 0.02) 100%);'
        + '--card-accent:' + color + ';'
        + '--card-border: rgba(' + rgb + ', 0.25);'
        + 'box-shadow: 0 2px 20px rgba(' + rgb + ', 0.06);';
    }
    return 'background: linear-gradient(135deg, rgba(' + rgb + ', 0.12) 0%, rgba(' + rgb + ', 0.04) 100%);'
      + '--card-accent:' + color + ';'
      + '--card-border: rgba(' + rgb + ', 0.3);'
      + 'box-shadow: 0 2px 24px rgba(' + rgb + ', 0.08);';
  }

  // v16.5 / v28.5: Primary brand - resolve by ID first (survives reorder), fall back to index
  var primaryBrandIdx = 0;
  var _primaryId = localStorage.getItem('roweos_primary_brand_id');
  if (_primaryId && brands && brands.length > 0) {
    var _foundPrimary = false;
    for (var _pi = 0; _pi < brands.length; _pi++) {
      if (brands[_pi] && brands[_pi].id === _primaryId) { primaryBrandIdx = _pi; _foundPrimary = true; break; }
    }
    if (!_foundPrimary) {
      // ID not found in brands - stale, clear it and fall back to index
      try { localStorage.removeItem('roweos_primary_brand_id'); } catch(e) {}
      primaryBrandIdx = parseInt(localStorage.getItem('roweos_primary_brand') || '0');
      if (isNaN(primaryBrandIdx) || primaryBrandIdx < 0 || !brands || primaryBrandIdx >= brands.length) primaryBrandIdx = 0;
    }
  } else {
    primaryBrandIdx = parseInt(localStorage.getItem('roweos_primary_brand') || '0');
    if (isNaN(primaryBrandIdx) || primaryBrandIdx < 0 || !brands || primaryBrandIdx >= brands.length) primaryBrandIdx = 0;
  }

  // Build cards
  var cardsHtml = '';

  // Primary BrandAI card
  if (hasBrands) {
    var brand = brands[primaryBrandIdx];
    var brandName = escapeHtml(brand.shortName || brand.name || 'Brand');
    var brandColor = typeof getBrandColorForTheme === 'function' ? getBrandColorForTheme(primaryBrandIdx) : '#a89878';
    // v28.2: Use brand ID directly -- don't go through getCurrentLogoKey which checks isLifeMode()
    // Try ID-based key first, then fall back to old index key and migrate if found
    var brandLogo = null;
    if (brand && brand.id) {
      brandLogo = localStorage.getItem(getBrandLogoKeyById(brand.id));
      if (!brandLogo) {
        var _origPIdx = (typeof brand._order === 'number') ? brand._order : primaryBrandIdx;
        brandLogo = localStorage.getItem('roweos_brand_' + _origPIdx + '_logo');
      }
    } else {
      brandLogo = localStorage.getItem('roweos_brand_' + primaryBrandIdx + '_logo');
    }
    var brandLogoHtml = brandLogo
      ? '<div class="welcome-logo-wrap"><img src="' + escapeHtml(brandLogo) + '" class="welcome-card-logo" alt=""></div>'
      : '<div class="welcome-card-fallback" style="color:' + brandColor + ';">&#9670;</div>';
    cardsHtml += '<div class="welcome-profile-card" style="' + cardStyle(brandColor) + '" onclick="enterFromWelcome(\'brand\', ' + primaryBrandIdx + ')">'
      + brandLogoHtml
      + '<div class="welcome-card-name">' + brandName + '</div>'
      + '<div class="welcome-card-mode">BrandAI</div>'
      + '</div>';
  }

  // Primary LifeAI card
  if (hasLife) {
    var lifeProfile = profiles[0];
    var lifeName = escapeHtml(lifeProfile.name || 'Life');
    // v24.21: Read actual life accent (per-theme) instead of stale profile field
    var lifeColor = (function() {
      var isLt = document.documentElement.classList.contains('light-mode');
      var saved = localStorage.getItem(isLt ? 'roweos_life_accent_light_mode' : 'roweos_life_accent_dark_mode');
      return saved || lifeProfile.accentColor || '#22c55e';
    })();
    var lifeLogo = localStorage.getItem('roweos_lifeai_logo_profile_0');
    var lifeLogoHtml = lifeLogo
      ? '<div class="welcome-logo-wrap"><img src="' + escapeHtml(lifeLogo) + '" class="welcome-card-logo" alt=""></div>'
      : '<div class="welcome-card-fallback" style="color:' + lifeColor + ';">&#9671;</div>';
    cardsHtml += '<div class="welcome-profile-card" style="' + cardStyle(lifeColor) + '" onclick="enterFromWelcome(\'life\', 0)">'
      + lifeLogoHtml
      + '<div class="welcome-card-name">' + lifeName + '</div>'
      + '<div class="welcome-card-mode">LifeAI</div>'
      + '</div>';
  }

  document.getElementById('welcomeCards').innerHTML = cardsHtml;

  // Extra brand pills (all brands except primary)
  var extraHtml = '';
  if (hasBrands && brands.length > 1) {
    for (var i = 0; i < brands.length; i++) {
      if (i === primaryBrandIdx) continue;
      var b = brands[i];
      var bName = escapeHtml(b.shortName || b.name || 'Brand ' + i);
      var bColor = typeof getBrandColorForTheme === 'function' ? getBrandColorForTheme(i) : '#a89878';
      var rgb = hexToRgb(bColor);
      var pillBg = isLight
        ? 'background: rgba(' + rgb + ', 0.06);'
        : 'background: rgba(' + rgb + ', 0.08);';
      extraHtml += '<div class="welcome-extra-pill" style="--pill-accent:' + bColor + ';' + pillBg + '" onclick="enterFromWelcome(\'brand\', ' + i + ')">'
        + bName + '</div>';
    }
  }
  document.getElementById('welcomeExtraBrands').innerHTML = extraHtml;

  // Show overlay
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// v16.5: Enter from welcome card - sets mode and navigates to Chat
function enterFromWelcome(mode, idx) {
  var overlay = document.getElementById('postLoginWelcome');
  if (overlay) {
    overlay.classList.remove('active');
  }
  document.body.style.overflow = '';

  hideLaunchScreen();

  // v24.4: Flag explicit user mode selection - prevents loadFromFirebaseV2 from overwriting
  window._userSelectedMode = true;
  stampLocalSave();

  if (mode === 'brand') {
    // Pre-set brand index so switchToBrandMode picks it up
    window.lastActiveBrandIdx = idx;
    // v29.0: Store by ID, not just index
    var _brandObj = brands[idx];
    if (_brandObj && _brandObj.id) {
      setSelectedBrand(_brandObj.id);
    } else {
      localStorage.setItem('roweos_selected_brand', String(idx));
    }
    switchToBrandMode();
    showView('agent');
  } else if (mode === 'life') {
    switchToLifeMode(idx);
    showView('agent');
  }

  // v28.3: Trigger full brand change including Identity view and logo refresh
  var _welBrandIdx = typeof getBrandIndex === 'function' ? getBrandIndex(getSelectedBrandId()) : 0;
  var _welBrandSelect = document.getElementById('brand');
  if (_welBrandSelect) _welBrandSelect.value = _welBrandIdx;
  if (typeof onBrandChange === 'function') onBrandChange();
  if (typeof initBrandLogo === 'function') initBrandLogo();
}

/**
 * v11.0.5: Auto-save system to prevent conversation loss
 * Saves every 3 seconds if there are unsaved changes, and syncs to Firebase
 */
var _lastSavedConversationLength = 0;
var _lastSavedAgentCommandsLength = 0;
var _autoSaveInterval = null;

function startConversationAutoSave() {
  // Clear any existing interval
  if (_autoSaveInterval) {
    clearInterval(_autoSaveInterval);
  }
  
  // Save state every 3 seconds
  _autoSaveInterval = setInterval(function() {
    autoSaveConversation();
  }, 3000);
  
  // Also save on visibility change (tab switch, minimize)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      console.log('[AutoSave] Tab hidden - force saving');
      autoSaveConversation(true);
    }
  });
  
  // Save before page unload
  window.addEventListener('beforeunload', function(e) {
    console.log('[AutoSave] Page unloading - force saving');
    autoSaveConversation(true);
    // v26.4: Flush pending LifeAI sync
    if (typeof _flushLifeAISync === 'function') _flushLifeAISync();
    // Warn if writes still pending
    if (_lifeAIPendingWrites > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // v26.4: Flush LifeAI sync on visibility change (critical for iOS Safari)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden' && typeof _flushLifeAISync === 'function') {
      _flushLifeAISync();
    }
  });

  console.log('[AutoSave] ✓ Conversation auto-save started (3s interval)');
}

function autoSaveConversation(forceSync) {
  try {
    var hasConversationChanges = currentConversation && currentConversation.length !== _lastSavedConversationLength;
    var hasHistoryChanges = agentCommands && agentCommands.length !== _lastSavedAgentCommandsLength;
    
    if (hasConversationChanges || hasHistoryChanges || forceSync) {
      // v11.0.5: If we have a conversation but no history entry, create one NOW
      if (currentConversation && currentConversation.length > 0) {
        var targetIdx = window._continuedHistoryIndex;
        if (targetIdx === null || targetIdx === undefined) {
          targetIdx = window._currentPreliminaryIndex;
        }
        if (targetIdx === null || targetIdx === undefined) {
          targetIdx = agentCommands.length - 1;
        }
        
        // If no valid history entry exists, create one immediately
        if (targetIdx < 0 || !agentCommands[targetIdx]) {
          console.log('[AutoSave] No history entry found, creating emergency entry');
          var mode = document.documentElement.classList.contains('life-mode') ? 'life' : 'brand';
          var brandName = mode === 'life' ? 'LifeAI' : (brands[selectedBrand] ? brands[selectedBrand].name : 'BrandAI');
          var firstMsg = currentConversation[0];
          
          var emergencyEntry = {
            id: Date.now(),
            brand: brandName,
            brandIndex: selectedBrand,
            mode: mode,
            command: (firstMsg.displayContent || (typeof firstMsg.content === 'string' ? firstMsg.content : '[Image]') || '').substring(0, 200),
            conversation: JSON.parse(JSON.stringify(currentConversation)),
            time: new Date().toLocaleString(),
            autoSaveRecovery: true
          };
          agentCommands.push(emergencyEntry);
          targetIdx = agentCommands.length - 1;
          window._currentPreliminaryIndex = targetIdx;
          console.log('[AutoSave] Created emergency entry at index', targetIdx);
        }
        
        // Update the history entry
        if (targetIdx >= 0 && agentCommands[targetIdx]) {
          agentCommands[targetIdx].conversation = JSON.parse(JSON.stringify(currentConversation));
          agentCommands[targetIdx].lastAutoSave = new Date().toISOString();
        }
      }
      
      // Save to localStorage
      saveRuns();
      
      // Update tracking vars
      _lastSavedConversationLength = currentConversation ? currentConversation.length : 0;
      _lastSavedAgentCommandsLength = agentCommands ? agentCommands.length : 0;
      
      console.log('[AutoSave] Saved - conversation:', _lastSavedConversationLength, 'msgs, history:', _lastSavedAgentCommandsLength, 'entries');
      
      // Sync to Firebase in background (don't wait for it)
      if (typeof syncToFirebase === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
        syncToFirebase().catch(function(e) {
          console.warn('[AutoSave] Firebase sync error:', e.message);
        });
      }
    }
  } catch (e) {
    console.error('[AutoSave] Error:', e);
  }
}

function createOpCard(op, container, enableHighlight, isAIGenerated) {
  // v10.5.25: New card-based format
  var card = document.createElement('div');
  card.className = 'studio-v2-card' + (op.aiGenerated || isAIGenerated ? ' ai-generated' : '');
  card.dataset.opId = op.id;
  
  // Category for gradient styling
  var categoryLabel = (op.category || 'operations').toLowerCase();
  card.dataset.category = categoryLabel;
  if (op.isImageOp) card.dataset.category = 'image';
  if (op.isSocialOp) card.dataset.category = 'social';
  if (op.isConversational) card.dataset.category = 'guided';

  // Badge styling
  var badgeClass = categoryLabel;
  if (op.isImageOp) badgeClass = 'image';
  if (op.isSocialOp) badgeClass = 'social';
  if (op.isConversational) badgeClass = 'guided';
  if (op.requiresDeepResearch || categoryLabel === 'research') badgeClass = 'research';
  if (categoryLabel === 'intelligence') badgeClass = 'intelligence';

  // Badge text
  var badgeText = categoryLabel.toUpperCase();
  if (op.isImageOp) badgeText = 'IMAGE';
  if (op.isSocialOp) badgeText = 'SOCIAL';
  if (op.isConversational) badgeText = 'GUIDED';
  if (op.requiresDeepResearch || categoryLabel === 'research') badgeText = 'RESEARCH';
  if (categoryLabel === 'intelligence') badgeText = 'INTEL';
  
  // Optionally highlight search matches
  var displayName = op.name;
  var displayDesc = op.desc || '';
  if (enableHighlight && opsSearchQuery) {
    displayName = highlightMatch(op.name, opsSearchQuery);
    displayDesc = highlightMatch(op.desc || '', opsSearchQuery);
  }
  
  // v10.5.25: Add sparkle icon for AI-generated operations
  var sparkleIcon = (op.aiGenerated || isAIGenerated) ? '<svg class="ai-sparkle-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px; color: var(--accent, #a89878);"><path d="M8 0l1.5 4.5L14 6l-4.5 1.5L8 12l-1.5-4.5L2 6l4.5-1.5L8 0z"/><path d="M13 9l.75 2.25L16 12l-2.25.75L13 15l-.75-2.25L10 12l2.25-.75L13 9z" opacity="0.6"/></svg>' : '';
  // v22.9: Magnifying glass icon for dedicated Deep Research op
  var deepResearchIcon = (op.id === 53) ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#a78bfa" stroke-width="2" style="margin-right:4px;vertical-align:-2px;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>' : '';
  
  // v13.4: Map category to agent
  var agentMap = { strategy: 'Strategy', marketing: 'Marketing', content: 'Marketing', operations: 'Operations', documents: 'Documents', guided: 'Strategy', research: 'Strategy', image: 'Marketing', social: 'Social', intelligence: 'Intelligence' };
  var agentColorMap = { Strategy: '#a78bfa', Marketing: '#f472b6', Operations: '#4ade80', Documents: '#fbbf24', Social: '#1DA1F2', Intel: '#22d3ee' };
  var agentName = agentMap[categoryLabel] || 'Operations';
  var agentColor = agentColorMap[agentName] || 'var(--accent)';

  card.innerHTML =
    '<div class="studio-v2-card-header">' +
      '<span class="studio-v2-card-name">' + deepResearchIcon + sparkleIcon + displayName + '</span>' +
      '<span class="studio-v2-card-badge ' + badgeClass + '">' + badgeText + '</span>' +
    '</div>' +
    '<div class="studio-v2-card-desc">' + displayDesc + '</div>' +
    '<div style="margin-top:6px;"><span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:var(--radius-sm);background:' + agentColor + '15;color:' + agentColor + ';font-size:10px;font-weight:500;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0113 0"/></svg> ' + agentName + '</span></div>';
  
  // Click handler - select card and show config panel
  card.onclick = function(e) {
    // Deselect all cards
    document.querySelectorAll('.studio-v2-card').forEach(function(c) { 
      c.classList.remove('selected'); 
    });
    
    // Select this card
    card.classList.add('selected');
    selectedOp = op;
    
    // Show config panel
    showConfigPanel(op);
    
    // Track recent
    addToRecent(op.id);
    
    updateRunButton();
  };
  
  // v24.13: Right-click to hide/unhide operation
  card.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    var _hiddenOps = [];
    try { _hiddenOps = JSON.parse(localStorage.getItem('roweos_hidden_ops') || '[]'); } catch(e) {}
    var isHidden = _hiddenOps.indexOf(op.id) !== -1;
    if (isHidden) {
      _hiddenOps = _hiddenOps.filter(function(id) { return id !== op.id; });
      showToast('Operation unhidden: ' + op.name, 'success');
    } else {
      _hiddenOps.push(op.id);
      showToast('Operation hidden: ' + op.name, 'info');
    }
    localStorage.setItem('roweos_hidden_ops', JSON.stringify(_hiddenOps));
    renderOperations();
  });
  // v24.13: Dim hidden ops when "Show Hidden" is active
  try {
    var _ho = JSON.parse(localStorage.getItem('roweos_hidden_ops') || '[]');
    if (_ho.indexOf(op.id) !== -1) card.style.opacity = '0.4';
  } catch(e) {}

  if (selectedOp && selectedOp.id === op.id) {
    card.classList.add('selected');
  }
  
  container.appendChild(card);
}

// v10.5.25: Show configuration panel for selected operation
function showConfigPanel(op) {
  var panel = document.getElementById('studioConfigPanel');
  if (!panel) return;
  
  panel.style.display = 'block';
  
  // Update title and badge
  var badgeEl = document.getElementById('configAgentBadge');
  var nameEl = document.getElementById('configTaskName');
  
  var categoryLabel = (op.category || 'operations').toLowerCase();
  var badgeText = categoryLabel.toUpperCase();
  if (op.isImageOp) badgeText = 'IMAGE';
  if (op.isSocialOp) badgeText = 'SOCIAL';
  if (op.isConversational) badgeText = 'GUIDED';
  
  if (badgeEl) {
    badgeEl.textContent = badgeText;
    badgeEl.className = 'studio-v2-config-badge';
    badgeEl.style.color = '#ffffff';
    badgeEl.style.textShadow = '';
    if (op.isImageOp) {
      badgeEl.style.background = '#7c3aed';
    } else if (op.isSocialOp) {
      badgeEl.style.background = '#1DA1F2';
    } else if (op.isConversational) {
      badgeEl.style.background = '#ec4899';
    } else if (categoryLabel === 'marketing') {
      badgeEl.style.background = '#10b981';
    } else if (categoryLabel === 'operations') {
      badgeEl.style.background = '#6366f1';
    } else if (categoryLabel === 'strategic') {
      badgeEl.style.background = '#0d9488';
    } else if (categoryLabel === 'documents') {
      badgeEl.style.background = '#8b5cf6';
    } else if (categoryLabel === 'research') {
      badgeEl.style.background = '#06b6d4';
    } else {
      badgeEl.style.background = '#0d9488';
    }
  }
  if (nameEl) nameEl.textContent = op.name;

  // v13.9: Show agent name and description in config panel
  var agentMap = { strategy: 'Strategy', marketing: 'Marketing', content: 'Marketing', operations: 'Operations', documents: 'Documents', guided: 'Strategy', research: 'Strategy', image: 'Marketing', social: 'Social', video: 'Video' };
  var agentColorMap = { Strategy: '#a78bfa', Marketing: '#f472b6', Operations: '#4ade80', Documents: '#fbbf24', Social: '#1DA1F2', Video: '#8b5cf6' };
  var agentDescMap = { Strategy: 'Positioning, competitive intel, brand analysis', Marketing: 'Content creation, campaigns, social media', Operations: 'Workflows, efficiency, process optimization', Documents: 'Business writing, proposals, reports', Social: 'Platform-optimized social content and publishing', Video: 'AI video generation with Google Veo' };
  var catLabel = (op.category || 'operations').toLowerCase();
  if (op.isImageOp) catLabel = 'image';
  if (op.isConversational) catLabel = 'guided';
  var configAgentName = agentMap[catLabel] || 'Operations';
  var configAgentColor = agentColorMap[configAgentName] || 'var(--accent)';
  var configAgentDesc = agentDescMap[configAgentName] || '';
  var agentInfoEl = document.getElementById('configAgentInfo');
  if (!agentInfoEl) {
    var header = nameEl ? nameEl.parentElement : null;
    if (header) {
      var infoDiv = document.createElement('div');
      infoDiv.id = 'configAgentInfo';
      infoDiv.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;width:100%;flex-basis:100%;';
      header.parentElement.insertBefore(infoDiv, header.nextSibling);
      agentInfoEl = infoDiv;
    }
  }
  if (agentInfoEl) {
    agentInfoEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:var(--radius-md);background:' + configAgentColor + '15;color:' + configAgentColor + ';font-size:11px;font-weight:600;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0113 0"/></svg> Agent: ' + configAgentName + '</span>' +
      '<span style="font-size:11px;color:var(--text-muted);">' + configAgentDesc + '</span>';
  }

  // v12.2.6: Show edit/delete for custom operations
  var editBtn = document.getElementById('studioEditOpBtn');
  var deleteBtn = document.getElementById('studioDeleteOpBtn');
  if (editBtn) editBtn.style.display = op.customCreated || op.aiGenerated ? 'inline-flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = op.customCreated || op.aiGenerated ? 'inline-flex' : 'none';

  // Show/hide model controls, image provider, video settings
  var modelControls = document.getElementById('studioModelControlsRow');
  var imageProvider = document.getElementById('imageProviderSelector');
  var imageReference = document.getElementById('imageReferenceSection');
  var videoSettings = document.getElementById('videoSettingsRow');
  var lengthGroup = document.getElementById('studioLengthGroup');

  if (op.isVideoOp) {
    // v22.0: Video ops - show model dropdown (has Veo models) + video settings, hide length
    if (modelControls) modelControls.style.display = 'flex';
    if (lengthGroup) lengthGroup.style.display = 'none';
    if (imageProvider) imageProvider.style.display = 'none';
    if (imageReference) imageReference.style.display = 'none';
    if (videoSettings) videoSettings.style.display = 'flex';
    // Auto-select Veo 3.1 Fast if current model isn't a Veo model
    if (studioModelOverride && studioModelOverride.indexOf('veo') === -1) {
      selectStudioModel('veo', 'veo-3.1-fast-generate-preview', 'Veo 3.1 Fast');
    } else if (!studioModelOverride) {
      selectStudioModel('veo', 'veo-3.1-fast-generate-preview', 'Veo 3.1 Fast');
    }
  } else if (op.isImageOp) {
    if (modelControls) modelControls.style.display = 'none';
    if (lengthGroup) lengthGroup.style.display = '';
    if (imageProvider) imageProvider.style.display = 'flex';
    if (imageReference) imageReference.style.display = 'flex';
    if (videoSettings) videoSettings.style.display = 'none';
  } else {
    if (modelControls) modelControls.style.display = 'flex';
    if (lengthGroup) lengthGroup.style.display = '';
    if (imageProvider) imageProvider.style.display = 'none';
    if (imageReference) imageReference.style.display = 'none';
    if (videoSettings) videoSettings.style.display = 'none';
    // If switching from video op, reset to text model
    if (studioProviderOverride === 'veo') {
      selectStudioModel('anthropic', 'claude-sonnet-4-6', 'Sonnet 4.6');
    }
  }
  
  // v18.5: Swap length toggle for social/raw output ops (character-based)
  var lengthToggle = document.getElementById('studioLengthToggle');
  if (lengthToggle) {
    if (op.isRawOutput && !op.isEmailOp) {
      lengthToggle.innerHTML = '<button class="length-btn" data-length="social-100" onclick="setOutputLength(\'social-100\')">100 chars</button>' +
        '<button class="length-btn active" data-length="social-250" onclick="setOutputLength(\'social-250\')">250 chars</button>' +
        '<button class="length-btn" data-length="social-500" onclick="setOutputLength(\'social-500\')">500 chars</button>';
      studioOutputLength = 'social-250';
    } else {
      lengthToggle.innerHTML = '<button class="length-btn" data-length="brief" onclick="setOutputLength(\'brief\')">Brief</button>' +
        '<button class="length-btn active" data-length="standard" onclick="setOutputLength(\'standard\')">Standard</button>' +
        '<button class="length-btn" data-length="comprehensive" onclick="setOutputLength(\'comprehensive\')">Detailed</button>';
      var savedLen = '';
      try { savedLen = localStorage.getItem('roweos_studio_output_length') || ''; } catch(e) {}
      if (savedLen && savedLen.indexOf('social') === -1) {
        studioOutputLength = savedLen;
        lengthToggle.querySelectorAll('.length-btn').forEach(function(btn) {
          btn.classList.toggle('active', btn.dataset.length === savedLen);
        });
      } else {
        studioOutputLength = 'standard';
      }
    }
  }

  // v17.0: Show/hide social platform selector
  if (typeof updateSocialPlatformSelector === 'function') updateSocialPlatformSelector(op);

  // v10.5.25: Update live prompt preview
  updateLivePromptPreview();

  // v22.9: Update Deep Research toggle visibility
  updateDeepResearchToggle();

  // Scroll to config panel
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// v12.2.6: Edit custom operation prompt from config panel
function editCustomOpPrompt() {
  if (!selectedOp) return;
  // Switch prompt preview to edit mode
  var preview = document.getElementById('studioPromptPreview');
  var edit = document.getElementById('studioPromptEdit');
  if (preview) preview.classList.add('hidden');
  if (edit) {
    edit.classList.remove('hidden');
    edit.value = selectedOp.userPrompt || selectedOp.desc || '';
    edit.focus();
  }
  var toggleText = document.getElementById('promptEditToggleText');
  if (toggleText) toggleText.textContent = 'Save';
}

// v12.2.6: Delete custom operation from config panel
function deleteCustomOp() {
  if (!selectedOp) return;
  if (!confirm('Delete "' + selectedOp.name + '"?')) return;

  var opId = String(selectedOp.id);
  var isLife = getCurrentMode() === 'life';

  if (isLife) {
    // v30.1: Guard with try/catch and Array.isArray per CLAUDE.md rule
    var lifeOps = [];
    try { lifeOps = JSON.parse(localStorage.getItem('roweos_generated_life_ops') || '[]'); if (!Array.isArray(lifeOps)) lifeOps = []; } catch(e) { lifeOps = []; }
    lifeOps = lifeOps.filter(function(o) { return String(o.id) !== opId; });
    localStorage.setItem('roweos_generated_life_ops', JSON.stringify(lifeOps));
    if (typeof generatedLifeOps !== 'undefined') {
      generatedLifeOps.length = 0;
      lifeOps.forEach(function(o) { generatedLifeOps.push(o); });
    }
  } else {
    generatedBrandOps = generatedBrandOps.filter(function(o) { return String(o.id) !== opId; });
    saveBrandAIGeneratedOps();
  }

  selectedOp = null;
  closeConfigPanel();
  renderOperations();
  showToast('Operation deleted', 'success');
}

// v10.5.25: Close configuration panel
function closeConfigPanel() {
  var panel = document.getElementById('studioConfigPanel');
  if (panel) panel.style.display = 'none';

  // v17.0: Reset social platform selector
  var socialSelector = document.getElementById('socialPlatformSelector');
  if (socialSelector) socialSelector.style.display = 'none';
  window._selectedSocialPlatforms = [];

  // Deselect all cards
  document.querySelectorAll('.studio-v2-card').forEach(function(c) { 
    c.classList.remove('selected'); 
  });
  
  selectedOp = null;
  updateRunButton();
}

// v10.5.25: Open Library selector for attaching content
var selectingForStudio = false;

function openSubjectSelector() {
  openRoweOSLibraryPicker();
}

// v10.5.25: Open RoweOS Library Picker Modal
function openRoweOSLibraryPicker() {
  var modal = document.getElementById('roweoSLibraryPicker');
  if (!modal) return;
  
  modal.classList.add('open');
  renderLibraryPickerContent();
}

function closeRoweOSLibraryPicker() {
  var modal = document.getElementById('roweoSLibraryPicker');
  if (modal) modal.classList.remove('open');
}

// v11.0.5: Global state for selected inventory items
window.selectedInventoryItems = [];

/**
 * v11.0.5: Open Studio Inventory Picker Modal
 */
function openStudioInventoryPicker() {
  var modal = document.getElementById('studioInventoryPickerModal');
  if (modal) {
    modal.classList.add('open');
    renderStudioInventoryGrid();
  }
}

/**
 * v11.0.5: Close Studio Inventory Picker Modal
 */
function closeStudioInventoryPicker() {
  var modal = document.getElementById('studioInventoryPickerModal');
  if (modal) modal.classList.remove('open');
}

/**
 * v11.0.5: Render inventory items in picker grid
 */
function renderStudioInventoryGrid() {
  var container = document.getElementById('studioInventoryGrid');
  if (!container) return;

  // v11.0.5: Get inventory items from global inventory (not brand-specific)
  // v15.18: Use mode-aware storage key
  var inventoryData = JSON.parse(localStorage.getItem(getInventoryStorageKey()) || '{"items":[]}');
  var inventory = inventoryData.items || [];
  
  if (inventory.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1/-1;">No products or services in inventory.<br><br><button class="btn btn-small" onclick="closeStudioInventoryPicker(); showView(\'inventory\');">Go to Inventory</button></div>';
    return;
  }
  
  var html = inventory.map(function(item, idx) {
    var isSelected = window.selectedInventoryItems.some(function(s) { return String(s.id) === String(item.id); });
    // v11.0.5: Use imageData with better sizing - show full image, larger container
    var imageHtml = item.imageData ? 
      '<div style="width: 100%; height: 120px; background: #1a1a1a; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; overflow: hidden;"><img src="' + item.imageData + '" style="max-width: 100%; max-height: 100%; object-fit: contain;"></div>' :
      '<div style="width: 100%; height: 120px; background: var(--bg-tertiary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-muted);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
    
    var typeBadge = item.type === 'service' ? 
      '<span style="background: var(--accent); color: #fff; padding: 2px 6px; border-radius: var(--radius-xs); font-size: var(--text-2xs);">Service</span>' :
      '<span style="background: var(--text-muted); color: #fff; padding: 2px 6px; border-radius: var(--radius-xs); font-size: var(--text-2xs);">Product</span>';
    
    return '<div class="inventory-picker-item" data-id="' + item.id + '" onclick="toggleInventoryItemSelection(\'' + item.id + '\')" style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 10px; cursor: pointer; border: 2px solid ' + (isSelected ? 'var(--accent)' : 'transparent') + '; position: relative;">' +
      (isSelected ? '<div style="position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>' : '') +
      imageHtml +
      '<div style="margin-top: var(--space-2);">' +
        '<div style="font-size: var(--text-base); font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (item.name || 'Unnamed') + '</div>' +
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-1);">' +
          typeBadge +
          '<span style="font-size: var(--text-sm); color: var(--text-secondary);">' + (item.price ? '$' + item.price : '') + '</span>' +
        '</div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (item.description || '').substring(0, 40) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
  updateInventoryConfirmButton();
}

/**
 * v11.0.5: Toggle inventory item selection
 */
window.toggleInventoryItemSelection = function(itemId) {
  console.log('[Studio Picker] toggleInventoryItemSelection called with:', itemId, typeof itemId);
  
  // v11.0.5: Get inventory items from global inventory (not brand-specific)
  var inventoryData = JSON.parse(localStorage.getItem('roweos_inventory') || '{"items":[]}');
  var inventoryItems = inventoryData.items || [];
  
  // v11.0.5: Convert to string for comparison (IDs can be number or string)
  var itemIdStr = String(itemId);
  var item = inventoryItems.find(function(i) { return String(i.id) === itemIdStr; });
  
  console.log('[Studio Picker] Found item:', item ? item.name : 'NOT FOUND');
  console.log('[Studio Picker] Inventory has', inventoryItems.length, 'items');
  
  if (!item) {
    console.warn('[Studio Picker] Item not found in inventory:', itemId);
    console.log('[Studio Picker] Available IDs:', inventoryItems.map(function(i) { return i.id; }));
    return;
  }
  
  var existingIdx = window.selectedInventoryItems.findIndex(function(s) { return String(s.id) === itemIdStr; });
  
  if (existingIdx >= 0) {
    // Remove from selection
    window.selectedInventoryItems.splice(existingIdx, 1);
    console.log('[Studio Picker] Removed from selection');
  } else {
    // Add to selection
    window.selectedInventoryItems.push(item);
    console.log('[Studio Picker] Added to selection');
  }
  
  console.log('[Studio Picker] Selected items:', window.selectedInventoryItems.length);
  renderStudioInventoryGrid();
};

/**
 * v11.0.5: Update confirm button text with count
 */
function updateInventoryConfirmButton() {
  var btn = document.getElementById('inventoryConfirmBtn');
  if (btn) {
    var count = window.selectedInventoryItems.length;
    btn.textContent = 'Add Selected (' + count + ')';
    btn.disabled = count === 0;
  }
}

/**
 * v11.0.5: Confirm inventory selection and update UI
 */
function confirmInventorySelection() {
  closeStudioInventoryPicker();
  updateStudioSelectedItemsPreview();
  updateLivePromptPreview();
  
  var count = window.selectedInventoryItems.length;
  if (count > 0) {
    showToast('Added ' + count + ' item(s) from inventory', 'success');
  }
}

/**
 * v11.0.5: Update preview of selected Library/Inventory items
 */
function updateStudioSelectedItemsPreview() {
  var container = document.getElementById('studioSelectedItemsPreview');
  if (!container) return;
  
  var items = [];
  
  // Add library attachment if exists
  if (window.studioAttachedContent) {
    items.push({
      type: 'library',
      name: window.studioAttachedContent.title || window.studioAttachedContent.name || 'Library Content',
      icon: '📄'
    });
  }
  
  // Add inventory items
  window.selectedInventoryItems.forEach(function(item) {
    items.push({
      type: 'inventory',
      name: item.name || 'Product',
      icon: item.type === 'service' ? '🔧' : '📦',
      id: item.id
    });
  });
  
  if (items.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  var html = '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
  items.forEach(function(item, idx) {
    html += '<div style="display: flex; align-items: center; gap: var(--space-1); background: var(--bg-tertiary); padding: 4px 8px; border-radius: var(--radius-sm); font-size: var(--text-sm);">' +
      '<span>' + item.icon + '</span>' +
      '<span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + item.name + '</span>' +
      '<button onclick="' + (item.type === 'library' ? 'clearLibraryAttachment()' : 'removeInventoryItem(' + idx + ')') + '" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 2px;">×</button>' +
    '</div>';
  });
  html += '</div>';
  
  container.innerHTML = html;
}

/**
 * v11.0.5: Remove single inventory item from selection
 */
function removeInventoryItem(idx) {
  // Find the inventory item (accounting for library item at index 0 if present)
  var inventoryIdx = window.studioAttachedContent ? idx - 1 : idx;
  if (inventoryIdx >= 0 && inventoryIdx < window.selectedInventoryItems.length) {
    window.selectedInventoryItems.splice(inventoryIdx, 1);
  }
  updateStudioSelectedItemsPreview();
  updateLivePromptPreview();
}

/**
 * v11.0.5: Clear library attachment
 */
function clearLibraryAttachment() {
  window.studioAttachedContent = null;
  var btn = document.getElementById('subjectButtonText');
  if (btn) btn.textContent = 'Library';
  updateStudioSelectedItemsPreview();
  updateLivePromptPreview();
}

/**
 * v11.0.5: Get inventory context for agent prompts
 */
function getInventoryContextForPrompt() {
  if (!window.selectedInventoryItems || window.selectedInventoryItems.length === 0) {
    return '';
  }
  
  var context = '\n\n=== SELECTED PRODUCTS/SERVICES ===\n';
  window.selectedInventoryItems.forEach(function(item, idx) {
    context += '\n[' + (idx + 1) + '] ' + (item.name || 'Unnamed');
    if (item.type) context += ' (' + item.type + ')';
    if (item.description) context += '\nDescription: ' + item.description;
    if (item.price) context += '\nPrice: $' + item.price;
    if (item.sku) context += '\nSKU: ' + item.sku;
    if (item.category) context += '\nCategory: ' + item.category;
    if (item.imageData) context += '\n[Image attached]';
    context += '\n';
  });
  
  return context;
}

// v10.5.25: Render Library Picker content using correct data source (mode-aware)
function renderLibraryPickerContent() {
  var foldersContainer = document.getElementById('libraryPickerFolders');
  var itemsContainer = document.getElementById('libraryPickerItems');
  if (!foldersContainer || !itemsContainer) return;

  // v10.5.25: Check mode to determine data source
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';

  var files, folders, sourceName;

  if (isLifeMode) {
    var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    files = lifeLib.files || [];
    folders = lifeLib.folders || [];
    sourceName = 'Life Library';
  } else {
    // v31.5: Use the user's currently-selected brand (selectedBrand) as the fallback
    // when studioSelectedBrand is unset. Files uploaded into the active brand were
    // never appearing because studioSelectedBrand could point at a different brand.
    var brandIdx = (typeof studioSelectedBrand === 'number') ? studioSelectedBrand : (typeof selectedBrand === 'number' ? selectedBrand : 0);
    var lib = getLibraryForBrandIndex(brandIdx);
    files = (lib && lib.files) || [];
    folders = (lib && lib.folders) || [];
    sourceName = brands[brandIdx] ? brands[brandIdx].name : 'Brand';
  }

  // v31.5: Folder chips key off folder.id (matches what files store in `folderId`).
  // Previously chips used folder.name, and the file filter compared `f.folder === folderName`
  // — but uploaded files store `folderId`, not `folder`. Newly created folders + uploads
  // never matched, so the picker always looked empty.
  window._libraryPickerFolders = folders; // cache for filter lookup
  var foldersHtml = '<div class="library-picker-folder active" data-folder-id="all" onclick="filterLibraryPicker(\'all\')">All Files</div>';
  folders.forEach(function(folder) {
    var fId = (typeof folder === 'string') ? folder : (folder.id || folder.name);
    var fName = (typeof folder === 'string') ? folder : (folder.name || folder.id || 'Folder');
    var displayName = (fName === 'Root') ? sourceName : fName;
    foldersHtml += '<div class="library-picker-folder" data-folder-id="' + escapeHtml(fId) + '" onclick="filterLibraryPicker(\'' + escapeHtml(fId).replace(/'/g, "\\'") + '\')">' + escapeHtml(displayName) + '</div>';
  });
  foldersContainer.innerHTML = foldersHtml;

  // Render all items
  filterLibraryPicker('all');
}

// v10.5.25: Filter library picker by folder (mode-aware)
// v31.5: Now keyed by folder ID, with image thumbnails for image-type files.
var currentPickerFolder = 'all';
function filterLibraryPicker(folderId) {
  currentPickerFolder = folderId;

  // Update active folder chip by data-folder-id
  document.querySelectorAll('.library-picker-folder').forEach(function(f) {
    f.classList.toggle('active', f.getAttribute('data-folder-id') === folderId);
  });

  var itemsContainer = document.getElementById('libraryPickerItems');
  if (!itemsContainer) return;

  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';

  var allFiles;
  if (isLifeMode) {
    var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[]}');
    allFiles = lifeLib.files || [];
  } else {
    var brandIdx = (typeof studioSelectedBrand === 'number') ? studioSelectedBrand : (typeof selectedBrand === 'number' ? selectedBrand : 0);
    var lib = getLibraryForBrandIndex(brandIdx);
    allFiles = (lib && lib.files) || [];
  }

  // v31.5: Match against folderId (the actual stored property), with legacy fallback
  // for older files that used `folder` (folder name) instead of `folderId`.
  var items;
  if (folderId === 'all') {
    items = allFiles;
  } else {
    items = allFiles.filter(function(f) {
      if (f.folderId && f.folderId === folderId) return true;
      if (f.folder && f.folder === folderId) return true; // legacy
      return false;
    });
  }

  if (items.length === 0) {
    var emptyMsg = isLifeMode
      ? 'No content in this folder yet. Save notes, journals, or upload files to see them here.'
      : 'No content in this folder yet. Upload files in Library or save content from BrandAI chat to see them here.';
    itemsContainer.innerHTML = '<div style="padding: var(--space-6); text-align: center; color: var(--text-muted);">' + emptyMsg + '</div>';
    return;
  }

  var html = '';
  items.forEach(function(item, idx) {
    var date = item.savedAt ? new Date(item.savedAt).toLocaleDateString() : (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '');
    var title = item.title || item.name || 'Untitled';
    var isImage = item.type === 'image' && item.content;
    // v31.5: Real thumbnail for image files (was an emoji placeholder).
    var iconHtml;
    if (isImage) {
      iconHtml = '<div class="library-picker-item-icon" style="width:44px;height:44px;border-radius:6px;overflow:hidden;background:#1a1a1a;display:flex;align-items:center;justify-content:center;">' +
        '<img src="' + item.content + '" style="max-width:100%;max-height:100%;object-fit:cover;" alt="' + escapeHtml(title) + '">' +
        '</div>';
    } else {
      var emoji = item.type === 'conversation' ? '💬' : (item.type === 'note' ? '📝' : (item.type === 'journal' ? '📔' : '📄'));
      iconHtml = '<div class="library-picker-item-icon">' + emoji + '</div>';
    }
    html += '<div class="library-picker-item" data-idx="' + idx + '" data-folder-id="' + escapeHtml(folderId) + '">' +
      iconHtml +
      '<div class="library-picker-item-info">' +
        '<div class="library-picker-item-title">' + escapeHtml(title) + '</div>' +
        '<div class="library-picker-item-meta">' + (item.type || 'Document') + ' • ' + date + '</div>' +
      '</div>' +
      '<button class="library-picker-item-add" onclick="selectLibraryItemForStudio(\'' + escapeHtml(folderId).replace(/'/g, "\\'") + '\', ' + idx + ')">Add</button>' +
    '</div>';
  });

  itemsContainer.innerHTML = html;
}

// v10.5.25: Select item and add to Studio (mode-aware)
// v31.5: Folder param is now folderId (matching renderLibraryPickerContent rewrite).
function selectLibraryItemForStudio(folderId, idx) {
  // Check mode to determine data source
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';

  var allFiles;
  if (isLifeMode) {
    var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[]}');
    allFiles = lifeLib.files || [];
  } else {
    var brandIdx = (typeof studioSelectedBrand === 'number') ? studioSelectedBrand : (typeof selectedBrand === 'number' ? selectedBrand : 0);
    var lib = getLibraryForBrandIndex(brandIdx);
    allFiles = (lib && lib.files) || [];
  }

  var items;
  if (folderId === 'all') {
    items = allFiles;
  } else {
    items = allFiles.filter(function(f) {
      if (f.folderId && f.folderId === folderId) return true;
      if (f.folder && f.folder === folderId) return true; // legacy
      return false;
    });
  }
  var item = items[idx];
  
  if (!item) {
    showToast('Could not find item', 'error');
    return;
  }
  
  // Store attached content
  window.studioAttachedContent = item;
  
  // Update button text
  var btn = document.getElementById('subjectButtonText');
  if (btn) {
    btn.textContent = '📎 ' + (item.title || item.name || 'Content attached').substring(0, 30);
  }
  
  // Close modal
  closeRoweOSLibraryPicker();
  
  // Update live prompt preview
  updateLivePromptPreview();
  
  showToast('Added: ' + (item.title || item.name || 'Content'), 'success');
}

// v10.5.25: Live Prompt Preview functions
var promptEditMode = false;
var addedBrandChips = new Set();

function updateLivePromptPreview() {
  var preview = document.getElementById('studioPromptPreview');
  var editArea = document.getElementById('studioPromptEdit');
  var chipsContainer = document.getElementById('brandIdentityChips');
  if (!preview) return;
  
  // If in edit mode, don't auto-update
  if (promptEditMode && editArea && !editArea.classList.contains('hidden')) {
    return;
  }
  
  // v10.5.25: Check mode for proper data source
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life';
  
  var brand = brands[studioSelectedBrand] || {};
  
  // v10.5.25: In LifeAI mode, use LifeAI profile instead of brand
  var lifeProfile = null;
  if (isLifeMode) {
    lifeProfile = getLifeAIProfile();
  }
  
  // Always render the brand chips (or life chips in life mode)
  if (!isLifeMode) {
    renderBrandIdentityChips(brand, chipsContainer);
  } else if (chipsContainer) {
    // Hide brand chips in life mode
    chipsContainer.style.display = 'none';
  }
  
  if (!selectedOp) {
    preview.innerHTML = '<div class="prompt-preview-placeholder">Select an agent task to see the prompt that will be sent</div>';
    return;
  }
  
  var context = document.getElementById('studioContext') ? document.getElementById('studioContext').value : '';
  
  // v10.5.25: Check if this is an image operation
  var isImageOp = selectedOp.category === 'image' || [40, 41, 42, 43, 44].indexOf(selectedOp.id) !== -1;
  
  if (isImageOp && !isLifeMode) {
    // Build the ACTUAL image prompt that will be sent to DALL-E/Gemini
    var imagePrompt = '';
    var brandName = brand.name || '';
    var brandPhilosophy = brand.philosophy || '';
    var brandPositioning = brand.positioning || '';
    var brandVoice = brand.voice || '';
    var brandTone = brand.tone || '';
    var brandAudience = brand.audience || '';
    
    if (selectedOp.id === 44 || selectedOp.id === 1100) {
      // v13.9: AI Image - use user's prompt as-is, don't inject brand name
      if (context) {
        imagePrompt = context;
      } else {
        imagePrompt = 'A professional brand image for ' + brandName;
      }
    } else {
      // Other image ops
      imagePrompt = 'Create a professional, high-quality image for the brand "' + brandName + '". ';
      if (brandPhilosophy) imagePrompt += 'About this brand: ' + brandPhilosophy + '. ';
      if (brandPositioning) imagePrompt += 'Brand positioning: ' + brandPositioning + '. ';
      if (brandAudience) imagePrompt += 'Target audience: ' + brandAudience + '. ';
      if (brandVoice) imagePrompt += 'Brand voice: ' + brandVoice + '. ';
      if (brandTone) imagePrompt += 'Brand tone: ' + brandTone + '. ';
      
      // Add style based on operation type
      if (selectedOp.id === 40) {
        imagePrompt += 'Style: Brand hero image, lifestyle photography, elegant and sophisticated. ';
      } else if (selectedOp.id === 41) {
        imagePrompt += 'Style: Product mockup, clean background, professional lighting, commercial quality. ';
      } else if (selectedOp.id === 42) {
        imagePrompt += 'Style: Social media visual, eye-catching, modern, Instagram-worthy aesthetic. ';
      } else if (selectedOp.id === 43) {
        imagePrompt += 'Style: Mood board inspiration, artistic, textural, design-forward. ';
      }
      
      if (context) {
        imagePrompt += 'Specific direction from user: ' + context + '. ';
      }
      
      imagePrompt += 'The image should authentically represent this brand\'s identity and values.';
    }
    
    var prompt = '<span class="prompt-label">IMAGE PROMPT:</span>\n\n' + imagePrompt;
    preview.innerHTML = prompt;
    
    if (editArea && !promptEditMode) {
      editArea.value = imagePrompt;
    }
    return;
  }
  
  // Get output length preference (for text operations)
  var outputLength = 'standard';
  var lengthBtns = document.querySelectorAll('.length-btn.active');
  if (lengthBtns.length > 0) {
    outputLength = lengthBtns[0].dataset.length || 'standard';
  }
  
  // v18.5: Handle social character lengths
  var lengthText = outputLength === 'brief' ? '~500 words (Brief)' :
                   outputLength === 'comprehensive' ? '~2000 words (Detailed)' :
                   outputLength === 'social-100' ? '~100 characters' :
                   outputLength === 'social-250' ? '~250 characters' :
                   outputLength === 'social-500' ? '~500 characters' : '~1000 words (Standard)';
  
  // v10.5.25: Build preview based on mode
  var prompt;
  if (isLifeMode && lifeProfile) {
    // LifeAI mode - show life profile info
    var userName = lifeProfile.name || localStorage.getItem('roweos_user_name') || 'User';
    var commStyle = lifeProfile.communicationStyle || 'Supportive and thoughtful';
    
    prompt = '<span class="prompt-label">TASK:</span> ' + selectedOp.name + '\n\n';
    prompt += '<span class="prompt-label">FOR:</span> ' + userName + '\n';
    prompt += '<span class="prompt-label">STYLE:</span> ' + commStyle + '\n';
    prompt += '<span class="prompt-label">LENGTH:</span> ' + lengthText + '\n';
    
    // Add focus areas if any
    if (lifeProfile.focusAreas && lifeProfile.focusAreas.length > 0) {
      prompt += '<span class="prompt-label">FOCUS AREAS:</span> ' + lifeProfile.focusAreas.join(', ') + '\n';
    }
    
    // Add current goals if any
    if (lifeProfile.goals && lifeProfile.goals.length > 0) {
      var goalNames = lifeProfile.goals.map(function(g) { return g.title || g; }).slice(0, 3);
      prompt += '<span class="prompt-label">GOALS:</span> ' + goalNames.join(', ') + '\n';
    }
  } else {
    // BrandAI mode - show brand info
    prompt = '<span class="prompt-label">TASK:</span> ' + selectedOp.name + '\n\n';
    prompt += '<span class="prompt-label">BRAND:</span> ' + brand.name + '\n';
    prompt += '<span class="prompt-label">VOICE:</span> ' + (brand.voice || 'Professional') + '\n';
    prompt += '<span class="prompt-label">LENGTH:</span> ' + lengthText + '\n';
    
    // Add any selected brand identity chips
    addedBrandChips.forEach(function(chipKey) {
      var value = getBrandChipValue(brand, chipKey);
      if (value) {
        prompt += '<span class="prompt-label">' + chipKey.toUpperCase() + ':</span> ' + value + '\n';
      }
    });
  }
  
  if (window.studioAttachedContent) {
    var attachedTitle = window.studioAttachedContent.title || window.studioAttachedContent.name || 'Document';
    var attachedType = window.studioAttachedContent.type || 'content';
    prompt += '\n<span class="prompt-label">ATTACHED:</span> ' + attachedTitle + ' (' + attachedType + ')';
    
    // Show brief summary if content exists
    var contentPreview = '';
    if (window.studioAttachedContent.content) {
      contentPreview = window.studioAttachedContent.content.substring(0, 150).replace(/\n/g, ' ');
      if (window.studioAttachedContent.content.length > 150) contentPreview += '...';
    } else if (window.studioAttachedContent.messages && window.studioAttachedContent.messages.length > 0) {
      var lastMsg = window.studioAttachedContent.messages[window.studioAttachedContent.messages.length - 1];
      contentPreview = (lastMsg.content || '').substring(0, 150).replace(/\n/g, ' ');
      if (contentPreview.length > 150) contentPreview += '...';
    }
    if (contentPreview) {
      prompt += '\n<span style="color: var(--text-muted); font-size: var(--text-sm); font-style: italic;">"' + contentPreview + '"</span>';
    }
    prompt += '\n';
  }
  
  if (context) {
    prompt += '\n<span class="prompt-label">CONTEXT:</span>\n' + context + '\n';
  }
  
  if (selectedOp.prompt) {
    prompt += '\n<span class="prompt-label">OPERATION:</span>\n' + selectedOp.prompt.substring(0, 300) + (selectedOp.prompt.length > 300 ? '...' : '');
  }
  
  preview.innerHTML = prompt;
  
  // Also update the edit area if not in edit mode
  if (editArea && !promptEditMode) {
    var plainPrompt = prompt
      .replace(/<span class="prompt-label">/g, '')
      .replace(/<\/span>/g, '');
    editArea.value = plainPrompt;
  }
}

// v10.5.25: Render brand identity chips as static buttons outside preview
function renderBrandIdentityChips(brand, container) {
  if (!container) return;
  
  var chipOptions = [
    { key: 'tagline', label: 'Tagline' },
    { key: 'audience', label: 'Audience' },
    { key: 'positioning', label: 'Positioning' },
    { key: 'values', label: 'Values' },
    { key: 'philosophy', label: 'Philosophy' },
    { key: 'tone', label: 'Tone' }
  ];
  
  var html = '<span class="brand-chips-label">Add to prompt:</span>';
  
  chipOptions.forEach(function(chip) {
    var brandValue = getBrandChipValue(brand, chip.key);
    if (brandValue && typeof brandValue === 'string') {
      var isAdded = addedBrandChips.has(chip.key);
      var tooltipText = brandValue.length > 100 ? brandValue.substring(0, 100) + '...' : brandValue;
      // Escape quotes for tooltip
      tooltipText = tooltipText.replace(/"/g, '&quot;');
      html += '<button class="brand-identity-chip' + (isAdded ? ' added' : '') + '" onclick="toggleBrandChip(\'' + chip.key + '\')" title="' + tooltipText + '">' +
        '<svg class="chip-icon" width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z"/></svg>' +
        chip.label +
        (isAdded ? '<svg class="chip-check" width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 2L6 9.5 2.5 6 1 7.5l5 5 9-9z"/></svg>' : '') +
        '</button>';
    }
  });
  
  container.innerHTML = html;
}

function getBrandChipValue(brand, key) {
  if (!brand) return '';
  var value = brand[key];
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

function toggleBrandChip(key) {
  if (addedBrandChips.has(key)) {
    addedBrandChips.delete(key);
  } else {
    addedBrandChips.add(key);
  }
  
  // v10.5.25: Update both preview and edit textarea
  updateLivePromptPreview();
  
  // If in edit mode, also update the textarea with the new chip content
  if (promptEditMode) {
    var editArea = document.getElementById('studioPromptEdit');
    var preview = document.getElementById('studioPromptPreview');
    if (editArea && preview) {
      // Get text version of preview (strip HTML)
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = preview.innerHTML;
      editArea.value = tempDiv.textContent || tempDiv.innerText || '';
    }
  }
  
  // Re-render chips to show updated state
  var chipsContainer = document.getElementById('brandIdentityChips');
  if (chipsContainer && brands[studioSelectedBrand]) {
    renderBrandIdentityChips(brands[studioSelectedBrand], chipsContainer);
  }
}

function togglePromptPreviewEdit() {
  var preview = document.getElementById('studioPromptPreview');
  var editArea = document.getElementById('studioPromptEdit');
  var toggleText = document.getElementById('promptEditToggleText');
  
  if (!preview || !editArea) return;
  
  promptEditMode = !promptEditMode;
  
  if (promptEditMode) {
    preview.classList.add('hidden');
    editArea.classList.remove('hidden');
    if (toggleText) toggleText.textContent = 'Save Prompt';
    editArea.focus();
  } else {
    // v10.5.25: Save the edited prompt when switching back to preview
    var editedPrompt = editArea.value.trim();
    if (editedPrompt) {
      // Store the custom prompt to be used when running
      window.customStudioPrompt = editedPrompt;
      // v12.2.6: Also save back to custom op if applicable
      if (selectedOp && (selectedOp.customCreated || selectedOp.aiGenerated)) {
        selectedOp.userPrompt = editedPrompt;
        if (getCurrentMode() === 'life') {
          // v30.1: Guard with try/catch and Array.isArray per CLAUDE.md rule
          var lifeOps = [];
          try { lifeOps = JSON.parse(localStorage.getItem('roweos_generated_life_ops') || '[]'); if (!Array.isArray(lifeOps)) lifeOps = []; } catch(e) { lifeOps = []; }
          var idx = lifeOps.findIndex(function(o) { return String(o.id) === String(selectedOp.id); });
          if (idx >= 0) { lifeOps[idx].userPrompt = editedPrompt; localStorage.setItem('roweos_generated_life_ops', JSON.stringify(lifeOps)); }
        } else {
          var bOp = generatedBrandOps.find(function(o) { return String(o.id) === String(selectedOp.id); });
          if (bOp) { bOp.userPrompt = editedPrompt; saveBrandAIGeneratedOps(); }
        }
      }
      showToast('Prompt saved', 'success');
    }
    preview.classList.remove('hidden');
    editArea.classList.add('hidden');
    if (toggleText) toggleText.textContent = 'Edit';
    // Update preview with the saved prompt
    if (editedPrompt) {
      preview.innerHTML = '<div class="prompt-section"><div class="prompt-label">Custom Prompt (Saved)</div>' + escapeHtml(editedPrompt).replace(/\n/g, '<br>') + '</div>';
    } else {
      updateLivePromptPreview();
    }
  }
}

// v10.5.25: Smart Fill context with AI suggestions
function smartFillContext() {
  if (!selectedOp) {
    showToast('Please select an operation first', 'warning');
    return;
  }
  
  var contextField = document.getElementById('studioContext');
  if (!contextField) return;
  
  // Generate smart context based on selected operation
  var brand = brands[studioSelectedBrand];
  var suggestions = [];
  
  if (selectedOp.category === 'marketing') {
    suggestions.push('Target audience: ' + (brand.audience || 'discerning clients'));
    suggestions.push('Brand voice: ' + (brand.voice || 'professional, warm'));
    suggestions.push('Key differentiators: ' + (brand.positioning || 'excellence in every detail'));
  } else if (selectedOp.category === 'strategic') {
    suggestions.push('Business focus: ' + (brand.industry || 'luxury services'));
    suggestions.push('Core values: ' + (brand.values || 'quality, integrity, excellence'));
  } else if (selectedOp.isImageOp) {
    suggestions.push('Brand aesthetic: minimalist, elegant, premium');
    suggestions.push('Color palette: dark backgrounds, gold accents');
  }
  
  if (suggestions.length > 0) {
    contextField.value = suggestions.join('\n');
    showToast('Context filled with brand intelligence', 'success');
  }
}

// v10.5.25: Update studio brand name display
function updateStudioBrandName() {
  var brandNameEl = document.getElementById('studioBrandName');
  if (brandNameEl && brands[studioSelectedBrand]) {
    // v15.13: Use shortName || name consistently
    brandNameEl.textContent = brands[studioSelectedBrand].shortName || brands[studioSelectedBrand].name;
  }
}

// v9.1.14: Position preview card
function positionPreview(item, preview) {
  var rect = item.getBoundingClientRect();
  var previewWidth = 320;
  var previewHeight = preview.offsetHeight || 300;
  
  // Position to the right of the sidebar
  var left = rect.right + 12;
  var top = rect.top;
  
  // If not enough space on right, position to the left
  if (left + previewWidth > window.innerWidth - 20) {
    left = rect.left - previewWidth - 12;
  }
  
  // Keep within viewport vertically
  if (top + previewHeight > window.innerHeight - 20) {
    top = window.innerHeight - previewHeight - 20;
  }
  if (top < 20) top = 20;
  
  preview.style.left = left + 'px';
  preview.style.top = top + 'px';
}

// v9.1.14: Edit AI-generated operation
function editAIOperation(e, opId) {
  e.stopPropagation();
  // v9.1.14: Redirect to editFromPreview for inline editing
  editFromPreview(e, opId);
}

// v9.1.14: Delete AI-generated operation
function deleteAIOperation(e, opId) {
  e.stopPropagation();
  
  if (!confirm('Delete this AI-generated operation?')) return;
  
  generatedBrandOps = generatedBrandOps.filter(function(o) { return String(o.id) !== String(opId); });
  saveBrandAIGeneratedOps();
  
  // Clear selection if this was selected
  if (selectedOp && String(selectedOp.id) === String(opId)) {
    selectedOp = null;
    updateSelectedOpDisplay();
    updateRunButton();
  }
  
  // Close preview
  document.querySelectorAll('.studio-op-preview.pinned').forEach(function(p) {
    p.classList.remove('pinned', 'visible');
  });
  
  renderOperations();
  showToast('Operation deleted', 'success');
}

// v9.1.14: Edit from preview - selects op and opens inline edit
function editFromPreview(e, opId) {
  e.stopPropagation();
  
  var op = generatedBrandOps.find(function(o) { return String(o.id) === String(opId); });
  if (!op) {
    showToast('Operation not found', 'error');
    return;
  }
  
  // Close preview
  document.querySelectorAll('.studio-op-preview.pinned').forEach(function(p) {
    p.classList.remove('pinned', 'visible');
  });
  
  // Select the operation
  selectedOp = op;
  document.querySelectorAll('.studio-op-item').forEach(function(c) { c.classList.remove('selected'); });
  
  // Find and select the item
  var items = document.querySelectorAll('.studio-op-item');
  items.forEach(function(item) {
    if (item.querySelector('.studio-op-item-name') && 
        item.querySelector('.studio-op-item-name').textContent.replace('✦ ', '') === op.name) {
      item.classList.add('selected');
    }
  });
  
  updateRunButton();
  
  // Start inline edit mode
  var container = document.getElementById('studioSelectedOp');
  if (container) {
    container.dataset.editMode = 'true';
  }
  updateSelectedOpDisplay();
}

// v9.1.14: Show edit operation modal
function showEditOperationModal(op) {
  // Remove any existing modal
  var existingModal = document.getElementById('editOperationModal');
  if (existingModal) existingModal.remove();
  
  var modal = document.createElement('div');
  modal.id = 'editOperationModal';
  modal.className = 'api-key-modal active';
  modal.onclick = function(e) {
    if (e.target === modal) closeEditOperationModal();
  };
  
  var content = document.createElement('div');
  content.className = 'api-key-modal-content';
  content.onclick = function(e) { e.stopPropagation(); };
  
  content.innerHTML = 
    '<div class="api-key-modal-title">Edit Operation</div>' +
    '<div class="api-key-modal-desc">Customize this AI-generated operation</div>' +
    '<div class="api-key-input-group">' +
      '<label class="api-key-input-label">Name</label>' +
      '<input type="text" id="editOpName" class="api-key-input" value="' + (op.name || '').replace(/"/g, '&quot;') + '">' +
    '</div>' +
    '<div class="api-key-input-group">' +
      '<label class="api-key-input-label">Description</label>' +
      '<input type="text" id="editOpDesc" class="api-key-input" value="' + (op.desc || '').replace(/"/g, '&quot;') + '">' +
    '</div>' +
    '<div class="api-key-input-group">' +
      '<label class="api-key-input-label">Category</label>' +
      '<select id="editOpCategory" class="api-key-input">' +
        '<option value="marketing"' + (op.category === 'marketing' ? ' selected' : '') + '>Marketing</option>' +
        '<option value="strategic"' + (op.category === 'strategic' ? ' selected' : '') + '>Strategic</option>' +
        '<option value="operations"' + (op.category === 'operations' ? ' selected' : '') + '>Operations</option>' +
        '<option value="documents"' + (op.category === 'documents' ? ' selected' : '') + '>Documents</option>' +
        '<option value="research"' + (op.category === 'research' ? ' selected' : '') + '>Research</option>' +
        '<option value="intelligence"' + (op.category === 'intelligence' ? ' selected' : '') + '>Intelligence</option>' +
      '</select>' +
    '</div>' +
    '<div class="api-key-input-group">' +
      '<label class="api-key-input-label">Outputs (one per line)</label>' +
      '<textarea id="editOpOutputs" class="api-key-input" rows="5" style="resize: vertical; min-height: 100px;">' + (op.outputs || []).join('\n') + '</textarea>' +
    '</div>' +
    '<div class="api-key-modal-actions">' +
      '<button class="api-key-modal-btn api-key-modal-btn-cancel" onclick="closeEditOperationModal()">Cancel</button>' +
      '<button class="api-key-modal-btn" style="background: var(--gold); color: #000;" onclick="saveEditedOperation(\'' + op.id + '\')">Save Changes</button>' +
    '</div>';
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Focus the name input
  setTimeout(function() {
    var nameInput = document.getElementById('editOpName');
    if (nameInput) nameInput.focus();
  }, 100);
}

function closeEditOperationModal() {
  var modal = document.getElementById('editOperationModal');
  if (modal) modal.remove();
}

function saveEditedOperation(opId) {
  var op = generatedBrandOps.find(function(o) { return String(o.id) === String(opId); });
  if (!op) {
    showToast('Operation not found', 'error');
    return;
  }
  
  op.name = document.getElementById('editOpName').value.trim();
  op.desc = document.getElementById('editOpDesc').value.trim();
  op.category = document.getElementById('editOpCategory').value;
  op.outputs = document.getElementById('editOpOutputs').value.split('\n').filter(function(s) { return s.trim(); });
  
  saveBrandAIGeneratedOps();
  renderOperations();
  closeEditOperationModal();
  showToast('Operation updated', 'success');
}

// v9.1.14: Close pinned preview when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.studio-op-item') && !e.target.closest('.studio-op-preview')) {
    document.querySelectorAll('.studio-op-preview.pinned').forEach(function(p) {
      p.classList.remove('pinned', 'visible');
    });
  }
});

// v9.1.14: Generate preview snippet based on operation type
function getOperationPreviewSnippet(op) {
  var snippets = {
    'marketing': 'Ready to amplify your brand voice with compelling content...',
    'strategic': 'Strategic insights to sharpen your competitive edge...',
    'operations': 'Streamlined processes for peak efficiency...',
    'documents': 'Professional documentation tailored to your brand...',
    'research': 'Deep market intelligence at your fingertips...',
    'platform': 'Master RoweOS and unlock its full potential...',
    'brand-specific': 'Custom solutions built for your unique brand...'
  };
  return snippets[op.category] || 'AI-powered output customized for your brand...';
}

// Display selected operation in workspace
function updateSelectedOpDisplay() {
  var container = document.getElementById('studioSelectedOp');
  if (!container) return;
  
  if (!selectedOp) {
    container.innerHTML = '<div class="studio-selected-op-empty"><div class="studio-selected-op-empty-icon">▤</div><div>Select an Agent and its task</div></div>';
    // v9.1.14: Hide params when no operation
    var paramsContainer = document.getElementById('studioParams');
    if (paramsContainer) paramsContainer.style.display = 'none';
    // v9.1.15: Hide image provider selector when no operation
    showImageProviderSelector(false);
    // v10.5.25: Hide subject selector when no operation
    showStudioSubjectSelector(false);
    return;
  }
  
  var categoryLabel = selectedOp.category || 'operations';
  var categoryDisplay = categoryLabel.replace('-', ' ');
  
  // v9.1.14: Check if in edit mode and if this is an AI-generated op
  var isEditing = container.dataset.editMode === 'true';
  var isAIGenerated = selectedOp.aiGenerated === true;
  
  var outputsHtml = '';
  if (selectedOp.outputs && selectedOp.outputs.length > 0) {
    if (isEditing) {
      outputsHtml = '<div class="studio-selected-op-outputs"><div class="studio-selected-op-outputs-title">Deliverables: <span style="font-weight: 400; font-size: var(--text-sm); color: var(--text-muted);">(one per line)</span></div>';
      outputsHtml += '<textarea id="editOpOutputsInline" class="studio-edit-textarea">' + selectedOp.outputs.join('\n') + '</textarea></div>';
    } else {
      outputsHtml = '<div class="studio-selected-op-outputs"><div class="studio-selected-op-outputs-title">Deliverables:</div><ul>';
      selectedOp.outputs.forEach(function(o) {
        outputsHtml += '<li>' + o + '</li>';
      });
      outputsHtml += '</ul></div>';
    }
  }
  
  // Build category HTML - v9.1.14: Show GUIDED badge for conversational ops, IMAGE badge for image ops
  var categoryHtml = '';
  if (isEditing) {
    categoryHtml = '<select id="editOpCategoryInline" class="studio-edit-category-select">' +
      '<option value="marketing"' + (categoryLabel === 'marketing' ? ' selected' : '') + '>marketing</option>' +
      '<option value="strategic"' + (categoryLabel === 'strategic' ? ' selected' : '') + '>strategic</option>' +
      '<option value="operations"' + (categoryLabel === 'operations' ? ' selected' : '') + '>operations</option>' +
      '<option value="documents"' + (categoryLabel === 'documents' ? ' selected' : '') + '>documents</option>' +
      '<option value="research"' + (categoryLabel === 'research' ? ' selected' : '') + '>research</option>' +
      '<option value="intelligence"' + (categoryLabel === 'intelligence' ? ' selected' : '') + '>intelligence</option>' +
      '<option value="guided"' + (categoryLabel === 'guided' ? ' selected' : '') + '>guided</option>' +
      '<option value="image"' + (categoryLabel === 'image' ? ' selected' : '') + '>image</option>' +
      '</select>';
  } else if (selectedOp.isConversational) {
    categoryHtml = '<span class="studio-op-item-category" style="background: rgba(124, 58, 237, 0.15); color: #a78bfa;">GUIDED</span>';
  } else if (selectedOp.isImageOp) {
    categoryHtml = '<span class="studio-op-item-category image-badge-rainbow">IMAGE</span>';
  } else if (categoryLabel === 'intelligence') {
    // v22.20: Intelligence ops get cyan badge with web search indicator
    categoryHtml = '<span class="studio-op-item-category" style="background: rgba(34, 211, 238, 0.15); color: #22d3ee;">intelligence</span>' +
      '<span class="studio-op-item-category" style="background: rgba(34, 211, 238, 0.10); color: #22d3ee; font-size: 10px; margin-left: 4px;"><svg viewBox="0 0 24 24" width="10" height="10" style="vertical-align: -1px; margin-right: 3px;" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Web Search</span>';
  } else {
    categoryHtml = '<span class="studio-op-item-category ' + categoryLabel + '">' + categoryDisplay + '</span>';
  }
  
  // Build edit controls for AI-generated ops
  var editControlsHtml = '';
  if (isAIGenerated) {
    if (isEditing) {
      editControlsHtml = '<div class="studio-edit-controls"><button class="studio-edit-save-btn" onclick="saveStudioInlineEdit()">Save Changes</button><button class="studio-edit-cancel-btn" onclick="cancelStudioInlineEdit()">Cancel</button></div>';
    } else {
      editControlsHtml = '<div class="studio-edit-controls"><button class="studio-edit-btn" onclick="startInlineEdit()">Edit</button><button class="studio-delete-btn" onclick="deleteSelectedAIOp()">Delete</button></div>';
    }
  }
  
  // Build name/desc HTML
  var nameHtml = '';
  var descHtml = '';
  if (isEditing) {
    nameHtml = '<input type="text" id="editOpNameInline" class="studio-edit-name-input" value="' + (selectedOp.name || '').replace(/"/g, '&quot;') + '">';
    descHtml = '<input type="text" id="editOpDescInline" class="studio-edit-desc-input" value="' + (selectedOp.desc || '').replace(/"/g, '&quot;') + '">';
  } else {
    nameHtml = '<span class="studio-selected-op-name">' + selectedOp.name + '</span>';
    descHtml = '<div class="studio-selected-op-desc">' + selectedOp.desc + '</div>';
  }
  
  container.innerHTML = '<div class="studio-selected-op-card' + (isEditing ? ' editing' : '') + '">' +
    '<div class="studio-selected-op-header">' + nameHtml + categoryHtml + '</div>' +
    descHtml + outputsHtml + editControlsHtml +
    '</div>';
  
  // v9.1.14: Render operation parameters
  renderOperationParams();
  
  // v9.1.15: Show/hide image provider selector
  showImageProviderSelector(selectedOp && selectedOp.isImageOp);
  
  // v10.5.25: Show subject selector for all operations
  showStudioSubjectSelector(true);
}

// v9.1.14: Start inline editing mode
function startInlineEdit() {
  var container = document.getElementById('studioSelectedOp');
  if (container) {
    container.dataset.editMode = 'true';
    updateSelectedOpDisplay();
    setTimeout(function() {
      var nameInput = document.getElementById('editOpNameInline');
      if (nameInput) nameInput.focus();
    }, 50);
  }
}

// v9.1.14: Cancel inline editing (Studio) - v24.27: renamed to avoid Focus2 collision
function cancelStudioInlineEdit() {
  var container = document.getElementById('studioSelectedOp');
  if (container) {
    container.dataset.editMode = 'false';
    updateSelectedOpDisplay();
  }
}

// v9.1.14: Save inline edits (Studio) - v24.27: renamed to avoid Focus2 collision
function saveStudioInlineEdit() {
  if (!selectedOp || !selectedOp.aiGenerated) return;

  var nameInput = document.getElementById('editOpNameInline');
  var descInput = document.getElementById('editOpDescInline');
  var categorySelect = document.getElementById('editOpCategoryInline');
  var outputsTextarea = document.getElementById('editOpOutputsInline');

  var op = generatedBrandOps.find(function(o) { return String(o.id) === String(selectedOp.id); });
  if (!op) {
    showToast('Operation not found', 'error');
    return;
  }

  if (nameInput) op.name = nameInput.value.trim();
  if (descInput) op.desc = descInput.value.trim();
  if (categorySelect) op.category = categorySelect.value;
  if (outputsTextarea) {
    op.outputs = outputsTextarea.value.split('\n').filter(function(s) { return s.trim(); });
  }

  selectedOp = op;
  saveBrandAIGeneratedOps();

  var container = document.getElementById('studioSelectedOp');
  if (container) container.dataset.editMode = 'false';

  updateSelectedOpDisplay();
  updateRunButton();
  renderOperations();
  showToast('Operation updated', 'success');
}

// v9.1.14: Delete selected AI operation
function deleteSelectedAIOp() {
  if (!selectedOp || !selectedOp.aiGenerated) return;
  if (!confirm('Delete this AI-generated operation?')) return;
  
  var opId = selectedOp.id;
  generatedBrandOps = generatedBrandOps.filter(function(o) { return String(o.id) !== String(opId); });
  saveBrandAIGeneratedOps();
  
  selectedOp = null;
  updateSelectedOpDisplay();
  updateRunButton();
  renderOperations();
  showToast('Operation deleted', 'success');
}

// Update run button state
function updateRunButton() {
  var btn = document.getElementById('runBtn');
  if (!btn) return;

  if (selectedOp) {
    btn.disabled = false;
    // v9.1.14: Different button text for different operation types
    if (selectedOp.isImageOp) {
      btn.textContent = 'Generate Image: ' + selectedOp.name;
    } else if (selectedOp.isConversational) {
      btn.textContent = 'Start Guided Builder: ' + selectedOp.name;
    } else {
      btn.textContent = 'Execute: ' + selectedOp.name;
    }
  } else {
    btn.disabled = true;
    btn.textContent = 'Add Content from Library';
  }
}

// ═══════════════════════════════════════════════════════════════
// v28.4: VISUAL ASSET LIBRARY
// ═══════════════════════════════════════════════════════════════

/**
 * v28.4: Switch between Files and Visual Assets tabs in Library
 */
function switchLibraryMainTab(tab) {
  // Update tab buttons
  var tabBar = document.getElementById('libraryTabBar');
  if (tabBar) {
    var btns = tabBar.querySelectorAll('.library-tab-btn');
    btns.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
  }

  // Toggle sections
  var libraryHeader = document.querySelector('.library-header');
  var brandsGrid = document.getElementById('libraryBrandsGrid');
  var filesSection = document.getElementById('libraryFilesSection');
  var visualAssets = document.getElementById('libraryVisualAssets');

  var gdriveSection = document.getElementById('libraryGoogleDrive');

  if (tab === 'files') {
    if (libraryHeader) libraryHeader.style.display = '';
    if (brandsGrid) brandsGrid.style.display = '';
    if (filesSection) filesSection.classList.add('hidden');
    if (visualAssets) visualAssets.classList.add('hidden');
    if (gdriveSection) gdriveSection.classList.add('hidden');
    renderLibraryView();
  } else if (tab === 'visual-assets') {
    if (libraryHeader) libraryHeader.style.display = 'none';
    if (brandsGrid) brandsGrid.style.display = 'none';
    if (filesSection) filesSection.classList.add('hidden');
    if (visualAssets) visualAssets.classList.remove('hidden');
    if (gdriveSection) gdriveSection.classList.add('hidden');
    renderVisualAssets();
  } else if (tab === 'google-drive') {
    if (libraryHeader) libraryHeader.style.display = 'none';
    if (brandsGrid) brandsGrid.style.display = 'none';
    if (filesSection) filesSection.classList.add('hidden');
    if (visualAssets) visualAssets.classList.add('hidden');
    if (gdriveSection) gdriveSection.classList.remove('hidden');
    updateGoogleDriveUI();
  }
}

/**
 * v28.4: Collect all visual assets from library files + Image Lab
 * Returns array of { id, name, dataUrl, source, date, brandIdx, originalIdx }
 */
function collectVisualAssets() {
  var assets = [];
  var IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|webp)$/i;
  var IMAGE_TYPES = /^image\//;

  // 1. Collect from brand library files (uploaded images)
  brands.forEach(function(brand, brandIdx) {
    var lib = getLibraryForBrandIndex(brandIdx);
    if (!lib || !lib.files) return;
    lib.files.forEach(function(file) {
      var isImage = false;
      if (file.type === 'image') isImage = true;
      else if (file.fileType && IMAGE_TYPES.test(file.fileType)) isImage = true;
      else if (file.name && IMAGE_EXTENSIONS.test(file.name)) isImage = true;
      else if (file.content && typeof file.content === 'string' && file.content.indexOf('data:image') === 0) isImage = true;

      if (isImage && file.content) {
        assets.push({
          id: file.id,
          name: file.name || 'Unnamed Image',
          dataUrl: file.content,
          source: 'Uploaded',
          date: file.savedAt || file.updatedAt || '',
          brandIdx: brandIdx,
          brandName: brand.shortName || brand.name,
          assetType: 'library'
        });
      }
    });
  });

  // 2. Collect from Image Lab (roweos_auto_lab_images)
  var labImages = [];
  try { labImages = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
  if (Array.isArray(labImages)) {
    labImages.forEach(function(img, idx) {
      if (!img || !img.dataUrl) return;
      var sourceName = 'From Image Lab';
      if (img.model === 'infographic') sourceName = 'Infographic';
      else if (img.model === 'auto') sourceName = 'From Automation';
      else if (img.model) sourceName = 'From Image Lab (' + img.model + ')';

      assets.push({
        id: 'lab_' + idx + '_' + (img.createdAt || ''),
        name: img.prompt ? img.prompt.substring(0, 60) : 'Generated Image',
        dataUrl: img.dataUrl,
        source: sourceName,
        date: img.createdAt || '',
        labIndex: idx,
        assetType: 'lab'
      });
    });
  }

  // 3. Collect from LifeAI library if in life mode
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  if (isLifeMode) {
    var lifeLib = null;
    try { lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : null; } catch(e) {}
    if (lifeLib && lifeLib.files) {
      lifeLib.files.forEach(function(file) {
        var isImage = false;
        if (file.type === 'image') isImage = true;
        else if (file.fileType && IMAGE_TYPES.test(file.fileType)) isImage = true;
        else if (file.name && IMAGE_EXTENSIONS.test(file.name)) isImage = true;
        else if (file.content && typeof file.content === 'string' && file.content.indexOf('data:image') === 0) isImage = true;

        if (isImage && file.content) {
          assets.push({
            id: file.id,
            name: file.name || 'Unnamed Image',
            dataUrl: file.content,
            source: 'Uploaded (Life)',
            date: file.savedAt || file.updatedAt || '',
            brandIdx: -1,
            brandName: 'LifeAI',
            assetType: 'library'
          });
        }
      });
    }
  }

  // Sort by date (newest first)
  assets.sort(function(a, b) {
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return assets;
}

/**
 * v28.4: Render the Visual Assets grid
 */
function renderVisualAssets() {
  var grid = document.getElementById('libraryVisualGrid');
  var emptyEl = document.getElementById('libraryVisualEmpty');
  var statsEl = document.getElementById('libraryVisualStats');
  if (!grid) return;

  var assets = collectVisualAssets();

  if (assets.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (statsEl) statsEl.textContent = '';
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  if (statsEl) statsEl.textContent = assets.length + ' image' + (assets.length !== 1 ? 's' : '');

  var html = assets.map(function(asset, idx) {
    var dateStr = '';
    if (asset.date) {
      try {
        dateStr = new Date(asset.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch(e) {}
    }

    return '<div class="visual-asset-card" onclick="openVisualAssetPreview(' + idx + ')">' +
      '<img class="visual-asset-thumb" src="' + escapeHtml(asset.dataUrl) + '" alt="' + escapeHtml(asset.name) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
      '<div class="visual-asset-info">' +
        '<div class="visual-asset-name" title="' + escapeHtml(asset.name) + '">' + escapeHtml(asset.name) + '</div>' +
        '<div class="visual-asset-meta">' +
          '<span class="visual-asset-source">' + escapeHtml(asset.source) + '</span>' +
          (dateStr ? '<span>' + dateStr + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  grid.innerHTML = html;
}

/**
 * v28.4: Open preview lightbox for a visual asset
 */
function openVisualAssetPreview(idx) {
  var assets = collectVisualAssets();
  if (idx < 0 || idx >= assets.length) return;
  var asset = assets[idx];

  // Store for action handlers
  window._visualPreviewAsset = asset;
  window._visualPreviewIdx = idx;

  var titleEl = document.getElementById('visualLightboxTitle');
  var metaEl = document.getElementById('visualLightboxMeta');
  var imageEl = document.getElementById('visualLightboxImage');
  var actionsEl = document.getElementById('visualLightboxActions');

  if (titleEl) titleEl.textContent = asset.name;

  var dateStr = '';
  if (asset.date) {
    try {
      dateStr = new Date(asset.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch(e) {}
  }
  var metaParts = [asset.source];
  if (dateStr) metaParts.push(dateStr);
  if (asset.brandName) metaParts.push(asset.brandName);
  if (metaEl) metaEl.textContent = metaParts.join(' \u00B7 ');

  if (imageEl) {
    var img = document.createElement('img');
    img.src = asset.dataUrl;
    img.alt = asset.name;
    imageEl.innerHTML = '';
    imageEl.appendChild(img);
  }

  // Build action buttons
  if (actionsEl) {
    var actionsHtml = '';
    actionsHtml += '<button class="btn btn-secondary" onclick="downloadVisualAsset()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      ' Download</button>';
    actionsHtml += '<button class="btn btn-secondary" onclick="sendVisualAssetToChat()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
      ' Send to Chat</button>';
    actionsHtml += '<button class="btn btn-secondary" onclick="useVisualAssetInPost()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
      ' Use in Post</button>';
    actionsHtml += '<button class="btn btn-danger" onclick="deleteVisualAsset()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
      ' Delete</button>';
    actionsEl.innerHTML = actionsHtml;
  }

  // v31.9 (iPad sidebar overlap fix): Move the lightbox to be a direct child of body so
  // its position:fixed escapes any positioned/transformed ancestor (libraryView is
  // position:fixed left:sidebar-width — the lightbox was inheriting that left offset on
  // iPad and rendering clipped behind the sidebar).
  var _lb = document.getElementById('libraryVisualLightbox');
  if (_lb && _lb.parentNode !== document.body) {
    document.body.appendChild(_lb);
  }
  if (_lb) _lb.classList.remove('hidden');
}

/**
 * v28.4: Close the visual asset lightbox
 */
function closeVisualLightbox() {
  var lb = document.getElementById('libraryVisualLightbox');
  if (lb) lb.classList.add('hidden');
  window._visualPreviewAsset = null;
  window._visualPreviewIdx = null;
}

/**
 * v28.4: Download the currently previewed visual asset
 */
function downloadVisualAsset() {
  var asset = window._visualPreviewAsset;
  if (!asset || !asset.dataUrl) return;
  var a = document.createElement('a');
  a.href = asset.dataUrl;
  var ext = '.png';
  if (asset.dataUrl.indexOf('data:image/jpeg') === 0) ext = '.jpg';
  else if (asset.dataUrl.indexOf('data:image/gif') === 0) ext = '.gif';
  else if (asset.dataUrl.indexOf('data:image/svg') === 0) ext = '.svg';
  else if (asset.dataUrl.indexOf('data:image/webp') === 0) ext = '.webp';
  a.download = (asset.name || 'roweos-image').replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 50) + ext;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Image downloaded', 'success');
}

/**
 * v28.4: Send visual asset to BrandAI/LifeAI chat
 */
function sendVisualAssetToChat() {
  var asset = window._visualPreviewAsset;
  if (!asset || !asset.dataUrl) return;

  // Set the image as pending attachment in chat
  if (typeof window !== 'undefined') {
    window._pendingChatImage = {
      dataUrl: asset.dataUrl,
      name: asset.name || 'Image from Library'
    };
  }

  closeVisualLightbox();
  showView('agent');
  showToast('Image attached - type a message to send with it', 'success');
}

/**
 * v28.4: Use visual asset in social post
 */
function useVisualAssetInPost() {
  var asset = window._visualPreviewAsset;
  if (!asset || !asset.dataUrl) return;

  // Set as publisher image
  window._socialPublisherImage = asset.dataUrl;

  closeVisualLightbox();
  showView('social');
  showToast('Image ready for social post', 'success');
}

/**
 * v28.4: Delete a visual asset
 */
function deleteVisualAsset() {
  var asset = window._visualPreviewAsset;
  if (!asset) return;
  if (!confirm('Delete this image?')) return;

  if (asset.assetType === 'lab') {
    // Delete from Image Lab storage
    // v31.11: Use cache + Firebase write-through so deletes propagate cross-device.
    var images = [];
    try {
      images = (typeof readStudioGallery === 'function')
        ? readStudioGallery().slice(0)
        : JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]');
    } catch(e) {}
    if (typeof asset.labIndex === 'number' && asset.labIndex >= 0 && asset.labIndex < images.length) {
      images.splice(asset.labIndex, 1);
      if (typeof persistStudioGallery === 'function') {
        persistStudioGallery(images);
      } else {
        localStorage.setItem('roweos_auto_lab_images', JSON.stringify(images));
      }
    }
  } else if (asset.assetType === 'library') {
    // Delete from library files
    var brandIdx = asset.brandIdx;
    var lib;
    if (brandIdx === -1) {
      lib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : null;
    } else {
      lib = getLibraryForBrandIndex(brandIdx);
    }
    if (lib && lib.files) {
      lib.files = lib.files.filter(function(f) { return f.id !== asset.id; });
      if (brandIdx === -1) {
        if (typeof saveLifeLibrary === 'function') saveLifeLibrary();
      } else {
        saveBrandLibrary(brandIdx, lib);
      }
    }
  }

  closeVisualLightbox();
  renderVisualAssets();
  showToast('Image deleted', 'success');
}

/**
 * v28.4: Upload a new image to the Visual Assets section
 */
function uploadVisualAsset() {
  var brandIdx = selectedBrand || 0;
  var isLifeMode = document.documentElement.classList.contains('life-mode');

  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/gif,image/svg+xml,image/webp';
  input.multiple = true;
  var MAX_FILE_SIZE = 5 * 1024 * 1024;

  input.onchange = function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;

    var oversized = Array.from(files).filter(function(f) { return f.size > MAX_FILE_SIZE; });
    if (oversized.length > 0) {
      showToast('Files over 5MB not supported: ' + oversized.map(function(f) { return f.name; }).join(', '), 'error');
      return;
    }

    var lib;
    if (isLifeMode) {
      lib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : null;
      if (!lib) lib = { files: [], folders: [] };
    } else {
      lib = getLibraryForBrandIndex(brandIdx);
      if (!lib) lib = { files: [], folders: [] };
    }

    var processedCount = 0;
    Array.from(files).forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function(evt) {
        var newFile = {
          id: 'visual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: 'image',
          content: evt.target.result,
          fileType: file.type,
          fileSize: file.size,
          folderId: null,
          savedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isUploaded: true
        };
        lib.files.push(newFile);
        processedCount++;
        if (processedCount === files.length) {
          if (isLifeMode) {
            if (typeof saveLifeLibrary === 'function') saveLifeLibrary();
          } else {
            saveBrandLibrary(brandIdx, lib);
          }
          showToast(files.length + ' image' + (files.length > 1 ? 's' : '') + ' uploaded', 'success');
          renderVisualAssets();
        }
      };
      reader.readAsDataURL(file);
    });
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════════
// v29.0: GOOGLE DRIVE INTEGRATION
// ═══════════════════════════════════════════════════════════════

var _gdriveAccessToken = null;
var _gdriveConnected = false;
var _gdriveTokenClient = null;
var _gdriveFolderStack = [{ id: 'root', name: 'My Drive' }];
var _gdriveSelectedFiles = []; // v29.0: Multi-select state
var GDRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
var GDRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

function initGoogleDriveAuth() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) return;
  if (!GCAL_CLIENT_ID) return;
  try {
    _gdriveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID,
      scope: GDRIVE_SCOPES,
      callback: handleGDriveTokenResponse,
      error_callback: function(err) {
        var errType = (err && err.type) || 'unknown';
        if (errType === 'popup_closed') return;
        showToast('Google Drive: Sign-in error (' + errType + ')', 'error');
      }
    });
    // v29.0: Do NOT auto-reconnect on startup - Drive tokens are short-lived
    // and silent re-auth opens a popup. Only connect when user explicitly clicks.
    // The flag is kept so the UI shows the browser (not connect card) when they navigate to the tab.
  } catch(e) {
    console.warn('[GDrive] Init error:', e.message);
  }
}

function handleGDriveTokenResponse(resp) {
  if (resp.error) {
    console.warn('[GDrive] Token error:', resp.error);
    _gdriveConnected = false;
    localStorage.removeItem('roweos_gdrive_connected');
    updateGoogleDriveUI();
    if (resp.error === 'access_denied' || resp.error === 'org_internal') {
      showToast('Google Drive access denied. Your Workspace admin may need to allow this app, or try a personal Gmail.', 'error');
    } else if (resp.error !== 'popup_closed_by_user') {
      showToast('Google Drive sign-in failed: ' + (resp.error_description || resp.error), 'error');
    }
    return;
  }
  _gdriveAccessToken = resp.access_token;
  _gdriveConnected = true;
  localStorage.setItem('roweos_gdrive_connected', 'true');
  updateGoogleDriveUI();
  browseGoogleDrive('root');
  showToast('Google Drive connected', 'success');
}

function connectGoogleDrive() {
  if (!_gdriveTokenClient) initGoogleDriveAuth();
  if (_gdriveTokenClient) {
    try {
      _gdriveTokenClient.requestAccessToken({ prompt: 'consent' });
    } catch(e) {
      showToast('Google Drive sign-in failed. Try refreshing.', 'error');
    }
  } else {
    showToast('Google Sign-In library not loaded. Check your internet connection.', 'error');
  }
}

function disconnectGoogleDrive() {
  if (_gdriveAccessToken) {
    try { google.accounts.oauth2.revoke(_gdriveAccessToken); } catch(e) {}
  }
  _gdriveAccessToken = null;
  _gdriveConnected = false;
  _gdriveFolderStack = [{ id: 'root', name: 'My Drive' }];
  localStorage.removeItem('roweos_gdrive_connected');
  updateGoogleDriveUI();
  showToast('Google Drive disconnected', 'info');
}

function updateGoogleDriveUI() {
  var connectCard = document.getElementById('gdriveConnectCard');
  var browser = document.getElementById('gdriveBrowser');
  if (!connectCard || !browser) return;
  if (_gdriveConnected && _gdriveAccessToken) {
    connectCard.classList.add('hidden');
    browser.classList.remove('hidden');
  } else {
    connectCard.classList.remove('hidden');
    browser.classList.add('hidden');
  }
}

function browseGoogleDrive(folderId) {
  if (!_gdriveAccessToken) { connectGoogleDrive(); return; }

  var fileList = document.getElementById('gdriveFileList');
  var loading = document.getElementById('gdriveLoading');
  var empty = document.getElementById('gdriveEmpty');
  if (fileList) fileList.innerHTML = '';
  if (loading) loading.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');

  if (folderId === 'root') {
    _gdriveFolderStack = [{ id: 'root', name: 'My Drive' }];
  }
  renderGDriveBreadcrumb();

  var query = "'" + folderId + "' in parents and trashed=false";
  var fields = 'files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink)';
  var orderBy = 'folder,name';
  var url = GDRIVE_API_BASE + '/files?q=' + encodeURIComponent(query) + '&fields=' + encodeURIComponent(fields) + '&orderBy=' + encodeURIComponent(orderBy) + '&pageSize=100';

  fetch(url, {
    headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken }
  })
  .then(function(r) {
    if (r.status === 401) {
      _gdriveConnected = false;
      localStorage.removeItem('roweos_gdrive_connected');
      updateGoogleDriveUI();
      showToast('Google Drive session expired. Please reconnect.', 'error');
      throw new Error('Unauthorized');
    }
    return r.json();
  })
  .then(function(data) {
    if (loading) loading.classList.add('hidden');
    var files = data.files || [];
    if (files.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    renderGDriveFiles(files);
  })
  .catch(function(err) {
    if (loading) loading.classList.add('hidden');
    if (err.message !== 'Unauthorized') {
      console.warn('[GDrive] Browse error:', err);
      showToast('Failed to load Drive files', 'error');
    }
  });
}

function renderGDriveBreadcrumb() {
  var bc = document.getElementById('gdriveBreadcrumb');
  if (!bc) return;
  var html = '';
  _gdriveFolderStack.forEach(function(item, idx) {
    var isLast = idx === _gdriveFolderStack.length - 1;
    if (isLast) {
      html += '<span class="gdrive-breadcrumb-item active">' + escapeHtml(item.name) + '</span>';
    } else {
      html += '<span class="gdrive-breadcrumb-item"><a href="#" onclick="navigateGDriveBreadcrumb(' + idx + '); return false;">' + escapeHtml(item.name) + '</a></span>';
      html += '<span class="gdrive-breadcrumb-sep">/</span>';
    }
  });
  bc.innerHTML = html;
}

function navigateGDriveBreadcrumb(idx) {
  _gdriveFolderStack = _gdriveFolderStack.slice(0, idx + 1);
  browseGoogleDrive(_gdriveFolderStack[idx].id);
}

function renderGDriveFiles(files) {
  var container = document.getElementById('gdriveFileList');
  if (!container) return;
  // Store files for multi-select
  window._gdriveCurrentFiles = files;
  _gdriveSelectedFiles = [];
  updateGDriveSelectionBar();

  var html = '';
  files.forEach(function(file, idx) {
    var isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    var fileIcon = getGDriveFileIcon(file.mimeType);
    var sizeStr = file.size ? formatGDriveFileSize(parseInt(file.size)) : '';
    var dateStr = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '';

    html += '<div class="gdrive-file-row' + (isFolder ? ' gdrive-folder-row' : '') + '" data-idx="' + idx + '">';
    if (!isFolder) {
      html += '<label class="gdrive-checkbox" onclick="event.stopPropagation();"><input type="checkbox" onchange="toggleGDriveSelect(' + idx + ', this.checked)" /><span class="gdrive-checkmark"></span></label>';
    }
    if (isFolder) {
      html += '<div class="gdrive-file-icon" onclick="openGDriveFolder(\'' + file.id + '\', \'' + escapeHtml(file.name).replace(/'/g, "\\'") + '\')" style="cursor:pointer;">' + fileIcon + '</div>';
      html += '<div class="gdrive-file-info" onclick="openGDriveFolder(\'' + file.id + '\', \'' + escapeHtml(file.name).replace(/'/g, "\\'") + '\')" style="cursor:pointer;">';
    } else {
      html += '<div class="gdrive-file-icon">' + fileIcon + '</div>';
      html += '<div class="gdrive-file-info">';
    }
    html += '<div class="gdrive-file-name">' + escapeHtml(file.name) + '</div>';
    html += '<div class="gdrive-file-meta">' + (sizeStr ? sizeStr + ' &middot; ' : '') + dateStr + '</div>';
    html += '</div>';
    if (!isFolder) {
      html += '<button class="gdrive-import-btn" id="gdriveImportBtn_' + idx + '" onclick="event.stopPropagation(); showGdriveImportFolderPicker(\'' + file.id + '\', \'' + escapeHtml(file.name).replace(/'/g, "\\'") + '\', \'' + file.mimeType + '\', this)" title="Import to Library">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      html += ' Import';
      html += '</button>';
    }
    html += '</div>';
  });
  container.innerHTML = html;
}

function toggleGDriveSelect(idx, checked) {
  if (checked) {
    if (_gdriveSelectedFiles.indexOf(idx) === -1) _gdriveSelectedFiles.push(idx);
  } else {
    _gdriveSelectedFiles = _gdriveSelectedFiles.filter(function(i) { return i !== idx; });
  }
  updateGDriveSelectionBar();
}

function toggleGDriveSelectAll() {
  var files = window._gdriveCurrentFiles || [];
  var nonFolders = [];
  files.forEach(function(f, idx) {
    if (f.mimeType !== 'application/vnd.google-apps.folder') nonFolders.push(idx);
  });
  var allSelected = _gdriveSelectedFiles.length === nonFolders.length;
  _gdriveSelectedFiles = allSelected ? [] : nonFolders.slice();
  // Update checkboxes
  var checkboxes = document.querySelectorAll('#gdriveFileList .gdrive-checkbox input[type="checkbox"]');
  checkboxes.forEach(function(cb) { cb.checked = !allSelected; });
  updateGDriveSelectionBar();
}

function updateGDriveSelectionBar() {
  var bar = document.getElementById('gdriveSelectionBar');
  if (!bar) return;
  if (_gdriveSelectedFiles.length > 0) {
    bar.classList.remove('hidden');
    var countEl = document.getElementById('gdriveSelectedCount');
    if (countEl) countEl.textContent = _gdriveSelectedFiles.length + ' file' + (_gdriveSelectedFiles.length > 1 ? 's' : '') + ' selected';
  } else {
    bar.classList.add('hidden');
  }
}

function openGDriveFolder(folderId, folderName) {
  _gdriveFolderStack.push({ id: folderId, name: folderName });
  browseGoogleDrive(folderId);
}

function getGDriveFileIcon(mimeType) {
  if (mimeType === 'application/vnd.google-apps.folder') return '<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--brand-accent, #a89878)" stroke="none"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>';
  if (mimeType.indexOf('image/') === 0 || mimeType === 'application/vnd.google-apps.photo') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  if (mimeType === 'application/vnd.google-apps.document') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285f4" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f9d58" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>';
  if (mimeType === 'application/vnd.google-apps.presentation') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f4b400" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>';
  if (mimeType === 'application/pdf') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea4335" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>';
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>';
}

function formatGDriveFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// v29.x: Pending GDrive import state for folder picker
var _pendingGdriveImport = null;
var _pendingGdriveBatchImport = null;
var _gdriveImportSelectedFolder = 'root';

function showGdriveImportFolderPicker(fileId, fileName, mimeType, btn) {
  _pendingGdriveImport = { fileId: fileId, fileName: fileName, mimeType: mimeType, btn: btn };
  _pendingGdriveBatchImport = null;
  var modal = document.getElementById('gdriveImportFolderModal');
  if (!modal) { importGDriveFile(fileId, fileName, mimeType, btn); return; }
  document.getElementById('gdriveImportFileName').textContent = fileName;
  _gdriveImportSelectedFolder = 'root';
  renderGdriveImportFolderList();
  modal.style.display = '';
  modal.classList.add('open');
}

function showGdriveImportFolderPickerBatch() {
  var files = window._gdriveCurrentFiles || [];
  if (_gdriveSelectedFiles.length === 0) { showToast('No files selected', 'info'); return; }
  var toImport = _gdriveSelectedFiles.map(function(idx) { return files[idx]; }).filter(Boolean);
  _pendingGdriveImport = null;
  _pendingGdriveBatchImport = toImport;
  var modal = document.getElementById('gdriveImportFolderModal');
  if (!modal) { importSelectedGDriveFilesToFolder('root'); return; }
  document.getElementById('gdriveImportFileName').textContent = toImport.length + ' file' + (toImport.length > 1 ? 's' : '') + ' selected';
  _gdriveImportSelectedFolder = 'root';
  renderGdriveImportFolderList();
  modal.style.display = '';
  modal.classList.add('open');
}

function renderGdriveImportFolderList() {
  var container = document.getElementById('gdriveImportFolderList');
  if (!container) return;
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var isLifeMode = currentMode === 'life';
  var lib, libraryName;
  if (isLifeMode) {
    lib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
    libraryName = profile && profile.name ? profile.name + "'s Library" : 'My Life Library';
  } else {
    lib = typeof getLibraryForBrandIndex === 'function' ? getLibraryForBrandIndex(selectedBrand) : getCurrentBrandLibrary();
    var brand = brands[selectedBrand];
    libraryName = brand ? (brand.shortName || brand.name) : 'Library';
  }
  var folderSvg = icon('folder', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'});
  var html = '<div class="save-library-folder root selected" data-id="root" onclick="selectGdriveImportFolder(\'root\')">' + folderSvg + escapeHtml(libraryName) + ' (All Files)</div>';
  var defaultFolders;
  if (isLifeMode) {
    defaultFolders = [
      { id: 'journals', icon: 'note', name: 'Journals' },
      { id: 'notes', icon: 'document', name: 'Notes' },
      { id: 'reflections', icon: 'chat', name: 'Reflections' },
      { id: 'goals', icon: 'lightning', name: 'Goals' },
      { id: 'ideas', icon: 'sparkles', name: 'Ideas' },
      { id: 'plans', icon: 'chart', name: 'Plans' }
    ];
  } else {
    defaultFolders = [
      { id: 'brandai-chats', icon: 'chat', name: 'BrandAI Chats' },
      { id: 'documents', icon: 'document', name: 'Documents' },
      { id: 'presentations', icon: 'sparkles', name: 'Presentations' },
      { id: 'emails', icon: 'envelope', name: 'Emails' },
      { id: 'social', icon: 'phone', name: 'Social Media' },
      { id: 'strategy', icon: 'chart', name: 'Strategy' },
      { id: 'scheduled-outputs', icon: 'lightning', name: 'Scheduled Outputs' }
    ];
  }
  var saveFolderIcons = {
    'folder': folderSvg,
    'chat': icon('chat', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'sparkles': icon('sparkles', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'envelope': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>',
    'phone': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
    'chart': icon('chart', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'lightning': icon('lightning', {size: 16, strokeWidth: 1.5, style: 'vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;'}),
    'document': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    'note': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align: middle; margin-right: var(--space-2); flex-shrink: 0;"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h8l6-6V5a2 2 0 00-2-2z"/><path d="M13 21v-6h6M7 7h10M7 11h10M7 15h4"/></svg>'
  };
  var customFolderNames = [];
  if (lib && lib.folders) {
    lib.folders.filter(function(f) { return f.id !== 'root'; }).forEach(function(f) {
      customFolderNames.push(f.name.toLowerCase());
    });
  }
  defaultFolders.forEach(function(folder) {
    if (customFolderNames.indexOf(folder.name.toLowerCase()) !== -1) return;
    var iconSvg = saveFolderIcons[folder.icon] || saveFolderIcons['folder'];
    html += '<div class="save-library-folder" data-id="' + folder.id + '" onclick="selectGdriveImportFolder(\'' + folder.id + '\')" style="padding-left: 32px; display: flex; align-items: center;">' + iconSvg + escapeHtml(folder.name) + '</div>';
  });
  if (lib && lib.folders) {
    lib.folders.forEach(function(folder) {
      if (folder.id === 'root') return;
      var iconSvg = saveFolderIcons[folder.icon] || saveFolderIcons['folder'];
      html += '<div class="save-library-folder" data-id="' + folder.id + '" onclick="selectGdriveImportFolder(\'' + folder.id + '\')" style="padding-left: 32px; display: flex; align-items: center;">' + iconSvg + escapeHtml(folder.name) + '</div>';
    });
  }
  container.innerHTML = html;
}

function selectGdriveImportFolder(folderId) {
  _gdriveImportSelectedFolder = folderId;
  var modal = document.getElementById('gdriveImportFolderModal');
  if (!modal) return;
  modal.querySelectorAll('.save-library-folder').forEach(function(el) {
    el.classList.remove('selected');
  });
  var sel = modal.querySelector('.save-library-folder[data-id="' + folderId + '"]');
  if (sel) sel.classList.add('selected');
}

function closeGdriveImportFolderModal() {
  var modal = document.getElementById('gdriveImportFolderModal');
  if (modal) { modal.classList.remove('open'); modal.style.display = 'none'; }
  _pendingGdriveImport = null;
  _pendingGdriveBatchImport = null;
}

function confirmGdriveImportWithFolder() {
  var folderId = _gdriveImportSelectedFolder || 'root';
  if (_pendingGdriveImport) {
    var p = _pendingGdriveImport;
    closeGdriveImportFolderModal();
    importGDriveFile(p.fileId, p.fileName, p.mimeType, p.btn, folderId);
  } else if (_pendingGdriveBatchImport) {
    var batch = _pendingGdriveBatchImport;
    closeGdriveImportFolderModal();
    importSelectedGDriveFilesToFolder(folderId);
  }
}

function createNewFolderInGdriveImportModal() {
  var container = document.getElementById('gdriveImportFolderList');
  if (!container) return;
  var existingInput = container.querySelector('.new-folder-inline-input');
  if (existingInput) { existingInput.querySelector('input').focus(); return; }
  var inputHtml = '<div class="new-folder-inline-input" style="display:flex;gap:var(--space-2);padding:var(--space-2) var(--space-2) var(--space-2) 32px;align-items:center;">';
  inputHtml += '<input type="text" placeholder="Folder name..." style="flex:1;padding:var(--space-1) var(--space-2);border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-primary);font-size:var(--text-sm);" onkeydown="if(event.key===\'Enter\')confirmNewGdriveImportFolder();if(event.key===\'Escape\')this.parentElement.remove();">';
  inputHtml += '<button onclick="confirmNewGdriveImportFolder()" style="background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);font-size:var(--text-sm);cursor:pointer;">Add</button>';
  inputHtml += '</div>';
  container.insertAdjacentHTML('beforeend', inputHtml);
  container.querySelector('.new-folder-inline-input input').focus();
}

function confirmNewGdriveImportFolder() {
  var container = document.getElementById('gdriveImportFolderList');
  var input = container.querySelector('.new-folder-inline-input input');
  if (!input) return;
  var name = input.value.trim();
  if (!name) { showToast('Enter a folder name', 'error'); return; }
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var isLifeMode = currentMode === 'life';
  var lib;
  if (isLifeMode) {
    lib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
  } else {
    lib = typeof getLibraryForBrandIndex === 'function' ? getLibraryForBrandIndex(selectedBrand) : getCurrentBrandLibrary();
  }
  if (!lib.folders) lib.folders = [{ id: 'root', name: 'Root', parentId: null }];
  var newId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  lib.folders.push({ id: newId, name: name, parentId: 'root', icon: 'folder' });
  if (isLifeMode) {
    if (typeof saveLifeLibrary === 'function') saveLifeLibrary();
  } else {
    saveLibrary();
  }
  renderGdriveImportFolderList();
  selectGdriveImportFolder(newId);
}

function importGDriveFile(fileId, fileName, mimeType, btn, targetFolderId) {
  if (!_gdriveAccessToken) { showToast('Not connected to Google Drive', 'error'); return; }
  var folderId = targetFolderId || 'root';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="gdrive-spinner-sm"></span> Importing...';
  }

  var isGoogleDoc = mimeType.indexOf('application/vnd.google-apps.') === 0;
  var downloadUrl;
  var exportMime;
  // Binary formats that need blob download (not text)
  var isBinary = mimeType.indexOf('image/') === 0 ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.ms-excel';

  if (mimeType === 'application/vnd.google-apps.document') {
    exportMime = 'text/plain';
    downloadUrl = GDRIVE_API_BASE + '/files/' + fileId + '/export?mimeType=' + encodeURIComponent(exportMime);
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    exportMime = 'text/csv';
    downloadUrl = GDRIVE_API_BASE + '/files/' + fileId + '/export?mimeType=' + encodeURIComponent(exportMime);
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    exportMime = 'text/plain';
    downloadUrl = GDRIVE_API_BASE + '/files/' + fileId + '/export?mimeType=' + encodeURIComponent(exportMime);
  } else if (isGoogleDoc) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import';
    }
    showToast('This Google file type is not supported for import', 'info');
    return Promise.resolve(false);
  } else {
    downloadUrl = GDRIVE_API_BASE + '/files/' + fileId + '?alt=media';
  }

  var isImage = mimeType.indexOf('image/') === 0;

  return fetch(downloadUrl, {
    headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken }
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Download failed: ' + r.status);
    if (isBinary) return r.blob();
    return r.text();
  })
  .then(function(data) {
    if (isBinary) {
      return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function() {
          var type = isImage ? 'image' : 'document';
          resolve({ content: reader.result, type: type, fileType: mimeType });
        };
        reader.readAsDataURL(data);
      });
    }
    return { content: data, type: 'text', fileType: exportMime || mimeType };
  })
  .then(function(result) {
    var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
    var key = currentMode === 'life' ? '_life' : (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand] ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'default');
    if (typeof fileLibrary === 'undefined') window.fileLibrary = {};
    if (!fileLibrary[key]) fileLibrary[key] = { folders: [{ id: 'root', name: 'Root', parentId: null }], files: [] };
    if (!fileLibrary[key].files) fileLibrary[key].files = [];

    fileLibrary[key].files.push({
      id: 'gdrive_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: fileName,
      type: result.type,
      content: result.content,
      fileType: result.fileType,
      folderId: folderId,
      savedAt: new Date().toISOString(),
      isUploaded: true,
      storageMode: 'local',
      metadata: { source: 'google-drive', driveFileId: fileId }
    });

    if (currentMode === 'life') {
      if (typeof saveLifeLibrary === 'function') saveLifeLibrary();
    } else {
      try { localStorage.setItem('roweosLibrary', JSON.stringify(fileLibrary)); } catch(e) {}
      if (typeof writeDB === 'function') writeDB('library/brand', { data: JSON.stringify(fileLibrary) });
    }

    if (btn) {
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Imported';
      btn.style.color = '#22c55e';
      btn.style.borderColor = '#22c55e';
    }
    showToast(fileName + ' imported to Library', 'success');
    return true;
  })
  .catch(function(err) {
    console.warn('[GDrive] Import error:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import';
    }
    showToast('Failed to import: ' + err.message, 'error');
    return false;
  });
}

// v29.0: Batch import selected files (legacy, now routes through folder picker)
function importSelectedGDriveFiles() {
  showGdriveImportFolderPickerBatch();
}

// v29.x: Batch import with folder target
function importSelectedGDriveFilesToFolder(targetFolderId) {
  var files = window._gdriveCurrentFiles || [];
  var toImport = (_pendingGdriveBatchImport && _pendingGdriveBatchImport.length > 0)
    ? _pendingGdriveBatchImport
    : _gdriveSelectedFiles.map(function(idx) { return files[idx]; }).filter(Boolean);
  var total = toImport.length;
  var done = 0;

  showToast('Importing ' + total + ' file' + (total > 1 ? 's' : '') + '...', 'info');

  function importNext(i) {
    if (i >= toImport.length) {
      showToast(done + ' of ' + total + ' files imported', 'success');
      _gdriveSelectedFiles = [];
      updateGDriveSelectionBar();
      var checkboxes = document.querySelectorAll('#gdriveFileList .gdrive-checkbox input[type="checkbox"]');
      checkboxes.forEach(function(cb) { cb.checked = false; });
      return;
    }
    var file = toImport[i];
    var btn = document.getElementById('gdriveImportBtn_' + _gdriveSelectedFiles[i]);
    importGDriveFile(file.id, file.name, file.mimeType, btn, targetFolderId).then(function(success) {
      if (success) done++;
      setTimeout(function() { importNext(i + 1); }, 300);
    });
  }
  importNext(0);
}

// v29.0: Export a library file to Google Drive
function exportLibraryFileToDrive() {
  if (!_gdriveConnected || !_gdriveAccessToken) {
    showToast('Connect Google Drive first (Library > Google Drive tab)', 'info');
    return;
  }
  // Get current preview file
  var file = null;
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  if (currentMode === 'life') {
    var lifeLib = getLifeLibrary();
    if (lifeLib && lifeLib.files) {
      file = lifeLib.files.find(function(f) { return f.id === libraryPreviewFileId; });
    }
  } else {
    var key = (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'default';
    if (fileLibrary[key] && fileLibrary[key].files) {
      file = fileLibrary[key].files.find(function(f) { return f.id === libraryPreviewFileId; });
    }
  }
  if (!file || !file.content) { showToast('No file content to export', 'error'); return; }

  var fileName = file.name || 'RoweOS Export';
  var content = file.content;
  var mimeType = 'text/plain';
  var isBase64 = content.indexOf('data:') === 0;

  if (isBase64) {
    // Extract MIME from dataURL
    var match = content.match(/^data:([^;]+);base64,/);
    mimeType = match ? match[1] : 'application/octet-stream';
  } else if (file.fileType) {
    mimeType = file.fileType;
  }

  // Use multipart upload for metadata + content
  var metadata = { name: fileName, mimeType: mimeType };
  var boundary = 'roweos_drive_upload_' + Date.now();
  var body;

  if (isBase64) {
    var base64Data = content.split(',')[1];
    body = '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: ' + mimeType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data + '\r\n' +
      '--' + boundary + '--';
  } else {
    body = '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: ' + mimeType + '\r\n\r\n' +
      content + '\r\n' +
      '--' + boundary + '--';
  }

  showToast('Uploading to Google Drive...', 'info');

  fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + _gdriveAccessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: body
  })
  .then(function(r) {
    if (!r.ok) throw new Error('Upload failed: ' + r.status);
    return r.json();
  })
  .then(function(data) {
    showToast(fileName + ' saved to Google Drive', 'success');
  })
  .catch(function(err) {
    console.warn('[GDrive] Export error:', err);
    if (err.message.indexOf('401') !== -1 || err.message.indexOf('403') !== -1) {
      showToast('Drive access expired. Please reconnect in Library > Google Drive.', 'error');
    } else {
      showToast('Failed to save to Drive: ' + err.message, 'error');
    }
  });
}

// v29.0: Scan selected Drive files and add content to brand identity
function scanSelectedGDriveToIdentity() {
  var files = window._gdriveCurrentFiles || [];
  if (_gdriveSelectedFiles.length === 0) { showToast('No files selected', 'info'); return; }
  if (!_gdriveAccessToken) { showToast('Not connected to Google Drive', 'error'); return; }

  var toScan = _gdriveSelectedFiles.map(function(idx) { return files[idx]; }).filter(function(f) {
    return f && f.mimeType !== 'application/vnd.google-apps.folder';
  });
  if (toScan.length === 0) { showToast('No scannable files selected', 'info'); return; }

  showToast('Scanning ' + toScan.length + ' file' + (toScan.length > 1 ? 's' : '') + ' for brand identity...', 'info');

  // Download all file contents as text - use export for Office/Google docs, skip binary
  var downloads = toScan.map(function(file) {
    var mime = file.mimeType;
    var isGoogleDoc = mime.indexOf('application/vnd.google-apps.') === 0;
    var isOfficeDoc = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mime === 'application/msword' || mime === 'application/vnd.ms-excel';
    var isImage = mime.indexOf('image/') === 0;
    var isPdf = mime === 'application/pdf';
    // Skip images and PDFs (can't extract text in browser)
    if (isImage) return Promise.resolve({ name: file.name, content: '' });
    var url;
    if (mime === 'application/vnd.google-apps.document' || mime === 'application/vnd.google-apps.presentation') {
      url = GDRIVE_API_BASE + '/files/' + file.id + '/export?mimeType=text/plain';
    } else if (mime === 'application/vnd.google-apps.spreadsheet') {
      url = GDRIVE_API_BASE + '/files/' + file.id + '/export?mimeType=text/csv';
    } else if (isGoogleDoc) {
      url = GDRIVE_API_BASE + '/files/' + file.id + '/export?mimeType=text/plain';
    } else if (isOfficeDoc) {
      // Office docs (.docx, .xlsx) must be exported via Google's conversion
      var exportMime = mime.indexOf('spreadsheet') !== -1 ? 'text/csv' : 'text/plain';
      url = GDRIVE_API_BASE + '/files/' + file.id + '/export?mimeType=' + encodeURIComponent(exportMime);
    } else if (isPdf) {
      // PDFs: try alt=media as text (will be garbled but better than nothing)
      return Promise.resolve({ name: file.name, content: '[PDF file - cannot extract text in browser]' });
    } else {
      // Plain text, CSV, markdown, etc.
      url = GDRIVE_API_BASE + '/files/' + file.id + '?alt=media';
    }
    return fetch(url, { headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken } })
      .then(function(r) {
        if (!r.ok && isOfficeDoc) {
          // Export failed (file not uploaded via Google, can't convert) - try direct download
          return fetch(GDRIVE_API_BASE + '/files/' + file.id + '?alt=media', {
            headers: { 'Authorization': 'Bearer ' + _gdriveAccessToken }
          }).then(function(r2) { return r2.ok ? r2.text() : ''; });
        }
        return r.ok ? r.text() : '';
      })
      .then(function(text) {
        // Filter out binary garbage (if text has too many non-printable chars, it's binary)
        if (text && text.length > 50) {
          var nonPrintable = 0;
          for (var ci = 0; ci < Math.min(text.length, 500); ci++) {
            var cc = text.charCodeAt(ci);
            if (cc < 32 && cc !== 10 && cc !== 13 && cc !== 9) nonPrintable++;
          }
          if (nonPrintable > 50) return { name: file.name, content: '' }; // binary, skip
        }
        return { name: file.name, content: text || '' };
      })
      .catch(function() { return { name: file.name, content: '' }; });
  });

  Promise.all(downloads).then(function(results) {
    var combined = results.filter(function(r) { return r.content && r.content.length > 10; });
    if (combined.length === 0) {
      showToast('No readable text content found in selected files', 'info');
      return;
    }

    // v29.0: Attach files as proper document entries (shows as file chip thumbnails)
    // instead of pasting raw text into the input
    if (typeof currentAgentFiles === 'undefined') window.currentAgentFiles = [];
    combined.forEach(function(doc) {
      var fileId = 'gdrive_scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      currentAgentFiles.push({
        id: fileId,
        name: doc.name,
        type: 'text/plain',
        content: doc.content,
        status: 'ready',
        pages: null
      });
    });
    if (typeof renderAgentFileChips === 'function') renderAgentFileChips();

    var brandName = (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'this brand';
    var prompt = 'Scan the attached documents and extract information relevant to the brand identity of ' + brandName + '. For each relevant identity section, output a ```roweos-identity-update block. Only include sections where the documents contain directly relevant, factual information. Be precise and do not extrapolate.';

    // Navigate to BrandAI chat and send with attached files
    if (typeof showView === 'function') showView('agent');
    setTimeout(function() {
      var input = document.getElementById('followupCommand') || document.getElementById('agentCommand');
      if (input) {
        input.value = prompt;
        if (typeof autoResizeTextarea === 'function') autoResizeTextarea(input);
        if (document.getElementById('followupCommand') && typeof sendFollowup === 'function') {
          sendFollowup();
        } else if (typeof sendAgentMessage === 'function') {
          sendAgentMessage();
        }
      }
    }, 500);
  });
}

// v29.3: Open library file in Scribe
function openLibraryFileInScribe(fileId) {
  var lib = getCurrentBrandLibrary();
  if (!lib || !lib.files) return;
  var file = null;
  for (var i = 0; i < lib.files.length; i++) {
    if (lib.files[i].id === fileId) { file = lib.files[i]; break; }
  }
  if (!file) return;

  if (typeof createScribeNotebook === 'function') {
    createScribeNotebook();
    var nb = null;
    if (typeof scribeNotebooks !== 'undefined' && scribeNotebooks.length > 0) {
      nb = scribeNotebooks[0]; // createScribeNotebook unshifts the new one
    }
    if (nb) {
      nb.title = file.name || 'From Library';
      if (!nb.linkedLibraryItems) nb.linkedLibraryItems = [];
      nb.linkedLibraryItems.push(fileId);
      if (typeof saveScribeNotebooks === 'function') saveScribeNotebooks();
      setTimeout(function() {
        var editor = typeof tinymce !== 'undefined' ? tinymce.get('scribeContentArea') : null;
        if (editor && file.content) {
          editor.setContent(file.content);
          if (typeof saveActiveScribeNotebook === 'function') saveActiveScribeNotebook();
        }
      }, 500);
      showView('scribe');
      if (typeof showToast === 'function') showToast('Opened in Scribe', 'success');
    }
  }
}
