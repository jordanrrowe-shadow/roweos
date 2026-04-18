// ============================================================================
// 33-scribe.js — Scribe Notebook System
// v29.0: Complete notebook system with CRUD, rich editing, metadata, knowledge mode
// ============================================================================

// === DATA === // v29.0:
var scribeNotebooks = []; // v29.0: loaded from localStorage
var _scribeActiveId = null; // v29.0: currently selected notebook ID
var _scribeAutoSaveTimer = null; // v29.0: debounce timer for auto-save
var _scribeKnowledgeMode = true; // v29.2: knowledge panel ON by default
var _scribeKnowledgeThread = []; // v29.0: Q&A thread messages

var SCRIBE_STORAGE_KEY = 'roweos_scribe_notebooks'; // v29.0:

// === LOAD / SAVE === // v29.0:

function loadScribeNotebooks() { // v29.0:
  try {
    var raw = localStorage.getItem(SCRIBE_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        scribeNotebooks = parsed;
      } else {
        scribeNotebooks = [];
      }
    } else {
      scribeNotebooks = [];
    }
  } catch (e) {
    console.warn('[Scribe] Failed to load notebooks:', e);
    scribeNotebooks = [];
  }
}

function saveScribeNotebooks() { // v29.0:
  try {
    localStorage.setItem(SCRIBE_STORAGE_KEY, JSON.stringify(scribeNotebooks));
  } catch (e) {
    console.warn('[Scribe] Failed to save notebooks:', e);
  }
  // v29.0: Write-through to Firebase (same pattern as Pulse goals)
  if (typeof writeDB === 'function') {
    writeDB('scribe/notebooks', { notebooks: scribeNotebooks }, { category: 'scribe' });
  }
}

// v29.2: TinyMCE state
var _scribeTinymceReady = false;

// === INIT === // v29.0:

function initScribe() { // v29.2:
  loadScribeNotebooks();
  renderScribeNotebookList();
  if (scribeNotebooks.length > 0) {
    var lastActive = _scribeActiveId;
    var found = false;
    if (lastActive) {
      for (var i = 0; i < scribeNotebooks.length; i++) {
        if (scribeNotebooks[i].id === lastActive) { found = true; break; }
      }
    }
    if (!found) {
      var sorted = scribeNotebooks.filter(function(nb) { return !nb.archived; });
      sorted.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
      if (sorted.length > 0) {
        selectScribeNotebook(sorted[0].id);
      } else {
        _showScribeEmptyState();
      }
    } else {
      selectScribeNotebook(lastActive);
    }
  } else {
    _showScribeEmptyState();
  }
  // v29.2: Defer TinyMCE init — view needs to be fully visible first
  setTimeout(function() {
    initScribeTinymce();
  }, 200);
}

// v29.2: Initialize TinyMCE for Scribe editor
function initScribeTinymce() {
  if (_scribeTinymceReady) return;
  if (typeof tinymce === 'undefined') return;

  tinymce.init({
    selector: '#scribeContentArea',
    skin: 'oxide-dark',
    content_css: 'dark',
    height: '100%',
    min_height: 400,
    menubar: false,
    statusbar: true,
    branding: false,
    promotion: false,
    resize: false,
    plugins: 'lists link image table code wordcount searchreplace fullscreen autolink autoresize preview',
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | hr blockquote | code fullscreen searchreplace wordcount',
    toolbar_mode: 'wrap',
    content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #e8e0d4; background: #1a1816; line-height: 1.7; padding: 16px; } a { color: #a89878; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #333; padding: 8px; } blockquote { border-left: 3px solid #a89878; margin: 12px 0; padding: 8px 16px; opacity: 0.85; } img { max-width: 100%; height: auto; } code { background: rgba(168,152,120,0.15); padding: 2px 6px; border-radius: 4px; font-family: monospace; } pre { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; overflow-x: auto; }',
    setup: function(editor) {
      editor.on('change keyup', function() {
        scheduleScribeAutoSave();
      });
      editor.on('init', function() {
        _scribeTinymceReady = true;
        // v29.2: If a notebook was selected before TinyMCE was ready, load its content now
        if (_scribeActiveId) {
          var nb = null;
          for (var i = 0; i < scribeNotebooks.length; i++) {
            if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
          }
          if (nb) editor.setContent(nb.content || '');
        }
      });
    }
  });
}

function _showScribeEmptyState() { // v29.0:
  _scribeActiveId = null;
  var editorArea = document.getElementById('scribeActiveEditor');
  var emptyState = document.getElementById('scribeEmptyState');
  if (editorArea) editorArea.style.display = 'none';
  if (emptyState) emptyState.style.display = 'flex';
}

// === CRUD === // v29.0:

function createScribeNotebook() { // v29.0:
  var now = new Date().toISOString();
  var ts = Date.now();
  var nb = {
    id: 'nb_' + ts + '_' + Math.random().toString(36).substr(2, 6),
    title: 'Untitled Notebook',
    content: '',
    sources: [],
    linkedPeople: [],
    linkedLibraryItems: [],
    tags: [],
    brandIdx: (typeof currentBrandIdx !== 'undefined' ? currentBrandIdx : null),
    source: (typeof currentMode !== 'undefined' && currentMode === 'lifeai') ? 'lifeai' : 'brandai',
    createdAt: now,
    updatedAt: now,
    _modifiedAt: ts,
    archived: false
  };
  scribeNotebooks.unshift(nb);
  saveScribeNotebooks();
  renderScribeNotebookList();
  selectScribeNotebook(nb.id);
  // v29.0: Focus the title input
  var titleInput = document.getElementById('scribeTitleInput');
  if (titleInput) {
    titleInput.focus();
    titleInput.select();
  }
}

function deleteScribeNotebook(id) { // v29.0:
  if (!confirm('Delete this notebook? This cannot be undone.')) return;
  scribeNotebooks = scribeNotebooks.filter(function(nb) { return nb.id !== id; });
  saveScribeNotebooks();
  if (_scribeActiveId === id) {
    _scribeActiveId = null;
    _showScribeEmptyState();
  }
  renderScribeNotebookList();
  if (typeof showToast === 'function') showToast('Notebook deleted', 'success');
}

function archiveScribeNotebook(id) { // v29.0:
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === id) {
      scribeNotebooks[i].archived = !scribeNotebooks[i].archived;
      scribeNotebooks[i].updatedAt = new Date().toISOString();
      scribeNotebooks[i]._modifiedAt = Date.now();
      var isArchived = scribeNotebooks[i].archived;
      saveScribeNotebooks();
      renderScribeNotebookList();
      if (isArchived && _scribeActiveId === id) {
        _scribeActiveId = null;
        _showScribeEmptyState();
      }
      if (typeof showToast === 'function') {
        showToast(isArchived ? 'Notebook archived' : 'Notebook restored', 'success');
      }
      break;
    }
  }
}

// === LIST RENDERING === // v29.0:

function renderScribeNotebookList() { // v29.0:
  var listEl = document.getElementById('scribeNotebookList');
  if (!listEl) return;

  // v29.0: Filter out archived, sort by updatedAt descending
  var visible = scribeNotebooks.filter(function(nb) { return !nb.archived; });
  visible.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });

  if (visible.length === 0) {
    listEl.innerHTML = '<div class="scribe-list-empty" style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">No notebooks yet. Create one to get started.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < visible.length; i++) {
    var nb = visible[i];
    var isActive = (nb.id === _scribeActiveId) ? ' active' : '';
    // v29.0: Strip HTML tags for preview snippet
    var snippet = (nb.content || '').replace(/<[^>]*>/g, '').substring(0, 80);
    if (snippet.length >= 80) snippet += '...';
    // v29.0: Format date
    var dateStr = '';
    try {
      var d = new Date(nb.updatedAt);
      dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { dateStr = ''; }

    html += '<div class="scribe-nb-item' + isActive + '" data-nb-id="' + nb.id + '" onclick="selectScribeNotebook(\'' + nb.id + '\')">';
    html += '<div class="scribe-nb-item-title">' + _escapeScribeHtml(nb.title || 'Untitled') + '</div>';
    html += '<div class="scribe-nb-item-meta">';
    html += '<span class="scribe-nb-item-date">' + dateStr + '</span>';
    if (nb.tags && nb.tags.length > 0) {
      html += '<span class="scribe-nb-item-tags">' + nb.tags.length + ' tag' + (nb.tags.length !== 1 ? 's' : '') + '</span>';
    }
    html += '</div>';
    if (snippet) {
      html += '<div class="scribe-nb-item-snippet">' + _escapeScribeHtml(snippet) + '</div>';
    }
    html += '</div>';
  }
  listEl.innerHTML = html;
}

function filterScribeNotebooks(query) { // v29.0:
  var listEl = document.getElementById('scribeNotebookList');
  if (!listEl) return;
  var q = (query || '').toLowerCase().trim();
  if (!q) {
    renderScribeNotebookList();
    return;
  }
  var visible = scribeNotebooks.filter(function(nb) {
    if (nb.archived) return false;
    return (nb.title || '').toLowerCase().indexOf(q) !== -1;
  });
  visible.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });

  if (visible.length === 0) {
    listEl.innerHTML = '<div class="scribe-list-empty" style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">No matching notebooks.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < visible.length; i++) {
    var nb = visible[i];
    var isActive = (nb.id === _scribeActiveId) ? ' active' : '';
    var snippet = (nb.content || '').replace(/<[^>]*>/g, '').substring(0, 80);
    if (snippet.length >= 80) snippet += '...';
    var dateStr = '';
    try {
      var d = new Date(nb.updatedAt);
      dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { dateStr = ''; }
    html += '<div class="scribe-nb-item' + isActive + '" data-nb-id="' + nb.id + '" onclick="selectScribeNotebook(\'' + nb.id + '\')">';
    html += '<div class="scribe-nb-item-title">' + _escapeScribeHtml(nb.title || 'Untitled') + '</div>';
    html += '<div class="scribe-nb-item-meta"><span class="scribe-nb-item-date">' + dateStr + '</span></div>';
    if (snippet) html += '<div class="scribe-nb-item-snippet">' + _escapeScribeHtml(snippet) + '</div>';
    html += '</div>';
  }
  listEl.innerHTML = html;
}

// === EDITOR === // v29.0:

function selectScribeNotebook(id) { // v29.0:
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === id) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) return;

  _scribeActiveId = id;

  // v29.0: Show editor, hide empty state
  var editorArea = document.getElementById('scribeActiveEditor');
  var emptyState = document.getElementById('scribeEmptyState');
  if (editorArea) editorArea.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  // v29.2: Defer TinyMCE init until editor is visible (can't init on hidden element)
  if (!_scribeTinymceReady) {
    initScribeTinymce();
  }

  // v29.0: Populate title
  var titleInput = document.getElementById('scribeTitleInput');
  if (titleInput) titleInput.value = nb.title || '';

  // v29.2: Populate TinyMCE content (with retry for init timing)
  var _nbContent = nb.content || '';
  var tinymceEditor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (tinymceEditor && _scribeTinymceReady) {
    tinymceEditor.setContent(_nbContent);
  } else {
    // TinyMCE not ready yet — retry after init completes
    setTimeout(function() {
      var ed = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
      if (ed) ed.setContent(_nbContent);
    }, 500);
  }

  // v29.0: Render metadata panel
  renderScribeMetadata(nb);

  // v29.0: Update list highlighting
  renderScribeNotebookList();

  // v29.0: Reset knowledge thread
  _scribeKnowledgeThread = [];
  renderScribeKnowledgeThread();
}

function onScribeTitleChange() { // v29.0:
  scheduleScribeAutoSave();
}

function onScribeContentChange() { // v29.0:
  scheduleScribeAutoSave();
}

function scheduleScribeAutoSave() { // v29.0:
  if (_scribeAutoSaveTimer) clearTimeout(_scribeAutoSaveTimer);
  _scribeAutoSaveTimer = setTimeout(function() {
    saveActiveScribeNotebook();
  }, 1000);
}

function saveActiveScribeNotebook() { // v29.0:
  if (!_scribeActiveId) return;
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) return;

  var titleInput = document.getElementById('scribeTitleInput');
  var tinymceEditor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;

  if (titleInput) nb.title = titleInput.value || 'Untitled Notebook';
  if (tinymceEditor) {
    nb.content = tinymceEditor.getContent() || '';
  }
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();

  saveScribeNotebooks();
  // v29.0: Update list item without full re-render to avoid losing scroll position
  var listItem = document.querySelector('.scribe-nb-item[data-nb-id="' + _scribeActiveId + '"] .scribe-nb-item-title');
  if (listItem) listItem.textContent = nb.title || 'Untitled';
}

// === KNOWLEDGE MODE === // v29.0:

function toggleScribeKnowledgeMode() { // v29.2:
  _scribeKnowledgeMode = !_scribeKnowledgeMode;
  var panel = document.getElementById('scribeKnowledgePanel');
  if (panel) {
    if (_scribeKnowledgeMode) {
      panel.style.maxHeight = '300px';
      panel.style.padding = '12px 16px';
      panel.style.borderTop = '1px solid var(--border-color)';
    } else {
      panel.style.maxHeight = '0';
      panel.style.padding = '0 16px';
      panel.style.borderTop = 'none';
    }
  }
}

function askScribeQuestion() { // v29.0:
  var inputEl = document.getElementById('scribeKnowledgeInput');
  if (!inputEl) return;
  var question = inputEl.value.trim();
  if (!question) return;

  // v29.0: Get active notebook content for context
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) {
    if (typeof showToast === 'function') showToast('No notebook selected', 'warning');
    return;
  }

  // v29.0: Add user message to thread
  _scribeKnowledgeThread.push({ role: 'user', content: question });
  inputEl.value = '';
  renderScribeKnowledgeThread();

  // v29.0: Build context from notebook
  var plainContent = (nb.content || '').replace(/<[^>]*>/g, '');
  var sourcesText = '';
  if (nb.sources && nb.sources.length > 0) {
    sourcesText = '\n\nSources:\n' + nb.sources.join('\n');
  }

  var systemPrompt = 'You are a knowledgeable assistant. Answer the user\'s question based on the following notebook content. ' +
    'Be concise and accurate. If the answer is not found in the content, say so. ' +
    'Use hyphens instead of em-dashes or en-dashes in your writing.\n\n' +
    'NOTEBOOK TITLE: ' + (nb.title || 'Untitled') + '\n\n' +
    'NOTEBOOK CONTENT:\n' + plainContent + sourcesText;

  // v29.0: Build messages for API call
  var messages = [];
  for (var j = 0; j < _scribeKnowledgeThread.length; j++) {
    messages.push({
      role: _scribeKnowledgeThread[j].role,
      content: _scribeKnowledgeThread[j].content
    });
  }

  // v29.0: Try to use existing AI infrastructure
  if (typeof callAnthropicStreaming === 'function' && typeof getApiKey === 'function') {
    // v29.0: Add placeholder for assistant response
    _scribeKnowledgeThread.push({ role: 'assistant', content: '' });
    renderScribeKnowledgeThread();
    var threadIdx = _scribeKnowledgeThread.length - 1;

    getApiKey('anthropic').then(function(apiKey) {
      if (!apiKey) {
        _scribeKnowledgeThread[threadIdx].content = 'API key not configured. Please set up your Anthropic API key in Settings.';
        renderScribeKnowledgeThread();
        return;
      }
      var model = 'claude-sonnet-4-20250514';
      callAnthropicStreaming(
        model,
        apiKey,
        messages,
        systemPrompt,
        function(chunk) { // v29.0: onChunk
          _scribeKnowledgeThread[threadIdx].content += chunk;
          renderScribeKnowledgeThread();
        },
        function() { // v29.0: onComplete
          renderScribeKnowledgeThread();
        },
        function(err) { // v29.0: onError
          _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get response');
          renderScribeKnowledgeThread();
        }
      );
    }).catch(function(err) {
      _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get API key');
      renderScribeKnowledgeThread();
    });
  } else {
    // v29.0: Fallback if streaming not available
    _scribeKnowledgeThread.push({ role: 'assistant', content: 'AI features require API key configuration. Please check Settings.' });
    renderScribeKnowledgeThread();
    if (typeof showToast === 'function') showToast('AI features coming soon', 'info');
  }
}

function synthesizeScribeNotebook() { // v29.0:
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) {
    if (typeof showToast === 'function') showToast('No notebook selected', 'warning');
    return;
  }
  var plainContent = (nb.content || '').replace(/<[^>]*>/g, '').trim();
  if (!plainContent) {
    if (typeof showToast === 'function') showToast('Notebook is empty', 'warning');
    return;
  }

  // v29.0: Add synthesis request to thread
  _scribeKnowledgeThread.push({ role: 'user', content: '[Synthesize notebook]' });
  _scribeKnowledgeThread.push({ role: 'assistant', content: '' });
  renderScribeKnowledgeThread();
  var threadIdx = _scribeKnowledgeThread.length - 1;

  var systemPrompt = 'You are a helpful assistant. Provide a clear, well-structured summary of the following notebook content. ' +
    'Highlight key themes, insights, and action items. Use hyphens instead of em-dashes or en-dashes.\n\n' +
    'NOTEBOOK TITLE: ' + (nb.title || 'Untitled') + '\n\n' +
    'NOTEBOOK CONTENT:\n' + plainContent;

  var messages = [{ role: 'user', content: 'Please synthesize and summarize this notebook.' }];

  if (typeof callAnthropicStreaming === 'function' && typeof getApiKey === 'function') {
    getApiKey('anthropic').then(function(apiKey) {
      if (!apiKey) {
        _scribeKnowledgeThread[threadIdx].content = 'API key not configured.';
        renderScribeKnowledgeThread();
        return;
      }
      var model = 'claude-sonnet-4-20250514';
      callAnthropicStreaming(
        model,
        apiKey,
        messages,
        systemPrompt,
        function(chunk) {
          _scribeKnowledgeThread[threadIdx].content += chunk;
          renderScribeKnowledgeThread();
        },
        function() { renderScribeKnowledgeThread(); },
        function(err) {
          _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Synthesis failed');
          renderScribeKnowledgeThread();
        }
      );
    }).catch(function(err) {
      _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get API key');
      renderScribeKnowledgeThread();
    });
  } else {
    _scribeKnowledgeThread[threadIdx].content = 'AI features require API key configuration.';
    renderScribeKnowledgeThread();
    if (typeof showToast === 'function') showToast('AI features coming soon', 'info');
  }
}

function renderScribeKnowledgeThread() { // v29.0:
  var threadEl = document.getElementById('scribeKnowledgeThread');
  if (!threadEl) return;

  if (_scribeKnowledgeThread.length === 0) {
    threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">Ask a question about this notebook, or synthesize its contents.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < _scribeKnowledgeThread.length; i++) {
    var msg = _scribeKnowledgeThread[i];
    var roleClass = msg.role === 'user' ? 'user' : 'ai';
    var roleLabel = msg.role === 'user' ? 'You' : 'AI';
    html += '<div class="scribe-knowledge-msg ' + roleClass + '">';
    html += '<div class="scribe-km-role">' + roleLabel + '</div>';
    html += '<div class="scribe-km-content">' + _escapeScribeHtml(msg.content || '...') + '</div>';
    html += '</div>';
  }
  threadEl.innerHTML = html;
  // v29.0: Auto-scroll to bottom
  threadEl.scrollTop = threadEl.scrollHeight;
}

// === METADATA PANEL === // v29.0:

function renderScribeMetadata(notebook) { // v29.2: Render tags inline
  var tagsEl = document.getElementById('scribeTagsList');
  if (!tagsEl || !notebook) return;
  var html = '';
  if (notebook.tags && notebook.tags.length > 0) {
    for (var t = 0; t < notebook.tags.length; t++) {
      html += '<span class="scribe-tag-pill">' + _escapeScribeHtml(notebook.tags[t]);
      html += '<span class="scribe-tag-remove" onclick="removeScribeTag(\'' + _escapeScribeAttr(notebook.tags[t]) + '\')">&times;</span>';
      html += '</span>';
    }
  }
  tagsEl.innerHTML = html;
}

function addScribeSource() { // v29.0:
  var source = prompt('Enter source (URL or description):');
  if (!source || !source.trim()) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.sources) nb.sources = [];
  nb.sources.push(source.trim());
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function linkScribePerson() { // v29.0:
  var name = prompt('Enter person name:');
  if (!name || !name.trim()) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.linkedPeople) nb.linkedPeople = [];
  nb.linkedPeople.push(name.trim());
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function linkScribeLibraryItem() { // v29.0:
  var name = prompt('Enter library item name:');
  if (!name || !name.trim()) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.linkedLibraryItems) nb.linkedLibraryItems = [];
  nb.linkedLibraryItems.push(name.trim());
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function addScribeTag() { // v29.0:
  var inputEl = document.getElementById('scribeTagInput');
  if (!inputEl) return;
  var tag = inputEl.value.trim();
  if (!tag) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.tags) nb.tags = [];
  // v29.0: Prevent duplicates
  for (var i = 0; i < nb.tags.length; i++) {
    if (nb.tags[i].toLowerCase() === tag.toLowerCase()) {
      if (typeof showToast === 'function') showToast('Tag already exists', 'warning');
      return;
    }
  }
  nb.tags.push(tag);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  inputEl.value = '';
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function removeScribeTag(tag) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.tags) return;
  nb.tags = nb.tags.filter(function(t) { return t !== tag; });
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function removeScribeSource(idx) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.sources) return;
  nb.sources.splice(idx, 1);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function unlinkScribePerson(idx) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.linkedPeople) return;
  nb.linkedPeople.splice(idx, 1);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function unlinkScribeLibraryItem(idx) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.linkedLibraryItems) return;
  nb.linkedLibraryItems.splice(idx, 1);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

// === HELPERS === // v29.0:

function _getActiveScribeNotebook() { // v29.0:
  if (!_scribeActiveId) return null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) return scribeNotebooks[i];
  }
  return null;
}

function _escapeScribeHtml(str) { // v29.0:
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _escapeScribeAttr(str) { // v29.0:
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function _formatScribeDate(isoStr) { // v29.0:
  if (!isoStr) return '-';
  try {
    var d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoStr;
  }
}
