# Social Hub Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Social Publisher, Image/Video Lab, and Social Connectors into Social Hub tabs. Add Imagen 3 and TikTok API integration.

**Architecture:** Move existing UI code from Studio (publisher), Automations (image/video lab), and System Settings (social connectors) into the Social Hub view's Publish, Media, and Settings tabs. Add redirect cards in old locations. Add TikTok OAuth + posting and Imagen 3 image generation.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), Firebase SDK, X/Threads/Instagram/TikTok APIs, Google Generative Language API (Imagen 3)

**Spec:** `docs/superpowers/specs/2026-03-22-social-hub-phase-2a-design.md`

**Codebase conventions:**
- ES5 only (no arrow functions, no let/const, no template literals, no .find(), no .includes())
- `var` for all declarations, explicit `function` declarations
- No emoji -- SVG icons only
- Tag changes with `// v25.4:` comments
- Single-file app: `RoweOS/dist/index.html` (~181K lines)

**Base path:** `/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `RoweOS/dist/index.html` | Main app (CSS, HTML, JS) | Modify -- update Social Hub tabs, move publisher/media/settings HTML & JS, add redirects |
| `RoweOS/dist/api/social-auth.js` | OAuth token exchange API | Modify -- add TikTok to platform whitelist |
| `RoweOS/dist/social-callback.html` | OAuth callback handler | Modify -- add TikTok platform detection |

---

## Task 1: Update Social Hub Tab Structure

**Files:**
- Modify: `RoweOS/dist/index.html`

Update the tab buttons and panel containers to include all 8 tabs, rename Chat to Create.

- [ ] **Step 1: Update tab buttons HTML**

Find the tab buttons at line ~57384-57388. Replace the 5-tab block with 8 tabs:

```html
      <button class="social-hub-tab" onclick="showSocialTab('scavenger')" data-tab="scavenger">Scavenger</button>
      <button class="social-hub-tab" onclick="showSocialTab('publish')" data-tab="publish">Publish</button>
      <button class="social-hub-tab" onclick="showSocialTab('create')" data-tab="create">Create</button>
      <button class="social-hub-tab active" onclick="showSocialTab('activity')" data-tab="activity">Activity</button>
      <button class="social-hub-tab" onclick="showSocialTab('media')" data-tab="media">Media</button>
      <button class="social-hub-tab" onclick="showSocialTab('blog')" data-tab="blog">Blog</button>
      <button class="social-hub-tab" onclick="showSocialTab('analytics')" data-tab="analytics">Analytics</button>
      <button class="social-hub-tab" onclick="showSocialTab('settings')" data-tab="settings">Settings</button>
```

- [ ] **Step 2: Update placeholder tab panels**

Find the placeholder panels at lines ~57408-57411. Replace with updated placeholders including the new tabs. Rename `socialTabChat` to `socialTabCreate`:

```html
    <!-- v25.4: Placeholder tabs -->
    <div id="socialTabScavenger" class="social-tab-panel" style="display:none;">
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <h3 style="color:var(--text-primary);margin-bottom:8px;">Scavenger</h3>
        <p>Auto-discover and engage with relevant social posts. Search for keywords, score targets, and draft AI-powered replies.</p>
        <p style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Coming in Phase 2B</p>
      </div>
    </div>
    <div id="socialTabPublish" class="social-tab-panel" style="display:none;">
      <!-- Populated by Task 2 -->
    </div>
    <div id="socialTabCreate" class="social-tab-panel" style="display:none;">
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>
        <h3 style="color:var(--text-primary);margin-bottom:8px;">Create</h3>
        <p>AI-powered post crafting with image generation. Plus read and reply to social DMs.</p>
        <p style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Coming in Phase 2B</p>
      </div>
    </div>
    <div id="socialTabMedia" class="social-tab-panel" style="display:none;">
      <!-- Populated by Task 3 -->
    </div>
    <div id="socialTabBlog" class="social-tab-panel" style="display:none;">
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <h3 style="color:var(--text-primary);margin-bottom:8px;">Blog</h3>
        <p>Analyze websites, generate rich-text blog posts, and publish or email them.</p>
        <p style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Coming in Phase 2B</p>
      </div>
    </div>
    <div id="socialTabAnalytics" class="social-tab-panel" style="display:none;">
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <h3 style="color:var(--text-primary);margin-bottom:8px;">Analytics</h3>
        <p>Full social performance dashboard with follower trends, engagement metrics, and AI-powered insights.</p>
        <p style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Coming in Phase 2C</p>
      </div>
    </div>
    <div id="socialTabSettings" class="social-tab-panel" style="display:none;">
      <!-- Populated by Task 4 -->
    </div>
```

- [ ] **Step 3: Add tab scrolling CSS for mobile**

Add to the `.social-hub-tabs` CSS rule (in the Social Hub CSS section around line 46437):

```css
.social-hub-tabs{display:flex;gap:0;border-bottom:1px solid var(--border-color,rgba(255,255,255,0.08));margin-bottom:20px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.social-hub-tabs::-webkit-scrollbar{display:none;}
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
git add RoweOS/dist/index.html
git commit -m "feat: update Social Hub to 8 tabs with placeholders for Phase 2B/2C"
```

---

## Task 2: Move Social Publisher into Publish Tab

**Files:**
- Modify: `RoweOS/dist/index.html`

Move the publisher from Studio into the Social Hub Publish tab. Update `showSocialPublisher()` to navigate to Social Hub.

- [ ] **Step 1: Build Publish tab HTML**

Find `socialTabPublish` (the empty panel from Task 1) and populate it. The content is based on the existing `showSocialPublisher()` function's dynamically generated HTML (line ~103670), but rendered statically as the tab's default content:

```html
    <div id="socialTabPublish" class="social-tab-panel" style="display:none;">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text-primary);">Compose Post</h3>
      <div id="socialPublishCompose">
        <!-- v25.4: Compose area rendered by renderPublishTab() -->
      </div>
      <div style="margin-top:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:8px 0;" onclick="togglePublishOutbox()">
          <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);" id="publishOutboxHeader">Outbox (0 pending)</h3>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-secondary);transition:transform 0.2s;" id="publishOutboxChevron"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div id="publishOutboxList" style="display:none;"></div>
      </div>
    </div>
```

- [ ] **Step 2: Add renderPublishTab() function**

Add this JavaScript function near the other Social Hub functions (around line ~174573):

```javascript
// v25.4: Render Publish tab compose area
function renderPublishTab() {
  var el = document.getElementById('socialPublishCompose');
  if (!el) return;

  var platforms = ['x', 'threads', 'instagram', 'tiktok'];
  var html = '';

  // Caption input
  html += '<textarea id="publishCaption" placeholder="What do you want to share?" style="width:100%;min-height:100px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:14px;resize:vertical;font-family:inherit;" oninput="updatePublishCharCount()"></textarea>';
  html += '<div id="publishCharCount" style="text-align:right;font-size:11px;color:var(--text-tertiary);margin-top:4px;"></div>';

  // Image attachment
  html += '<div style="margin:12px 0;">';
  html += '<div id="publishImagePreview" style="display:none;margin-bottom:8px;"></div>';
  html += '<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-size:13px;">';
  html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  html += 'Attach Image';
  html += '<input type="file" accept="image/*" onchange="attachPublishImage(this)" style="display:none;">';
  html += '</label>';
  html += '</div>';

  // Platform cards
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:12px 0;">';
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    var connected = isSocialConnected(p);
    var handle = getSocialHandle(p);
    var names = { x: 'X', threads: 'Threads', instagram: 'Instagram', tiktok: 'TikTok' };
    html += '<div class="social-platform-card' + (connected ? ' connected' : '') + '" id="publishPlatform_' + p + '" onclick="togglePublishPlatform(\'' + p + '\')" style="padding:10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;text-align:center;">';
    html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);">' + names[p] + '</div>';
    if (connected) {
      html += '<div style="font-size:11px;color:var(--accent);">@' + escapeHtml(handle || '') + '</div>';
    } else {
      html += '<div style="font-size:11px;color:var(--text-tertiary);">Not connected</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Per-platform text editing
  html += '<div style="margin:8px 0;">';
  html += '<button onclick="togglePerPlatformEdit()" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border-color);background:none;color:var(--text-secondary);cursor:pointer;font-size:11px;">Per-platform text editing</button>';
  html += '<div id="publishPerPlatformEdits" style="display:none;margin-top:8px;">';
  var platNames = { x: 'X (280)', threads: 'Threads (500)', instagram: 'Instagram (2200)', tiktok: 'TikTok (2200)' };
  var platKeys = ['x', 'threads', 'instagram', 'tiktok'];
  for (var pe = 0; pe < platKeys.length; pe++) {
    html += '<div style="margin-bottom:6px;"><label style="font-size:11px;color:var(--text-tertiary);">' + platNames[platKeys[pe]] + '</label>';
    html += '<textarea id="publishPlatformText_' + platKeys[pe] + '" placeholder="Leave blank to use main caption" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;min-height:40px;resize:vertical;font-family:inherit;"></textarea></div>';
  }
  html += '</div></div>';

  // Platform icons and connection dots
  var platformIcons = {
    x: '<path d="M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-7-8.5L19.5 4H18l-5 6.2L9 4z"/>',
    threads: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/>',
    tiktok: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>'
  };

  // (Update the platform card rendering above to include SVG icons and connection dots)
  // Each card should show:
  //   <svg>icon</svg> + name + green dot if connected + @handle

  // Action buttons (3 buttons per spec)
  html += '<div style="display:flex;gap:8px;margin-top:16px;">';
  html += '<button onclick="publishPostNow()" style="padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Post Now</button>';
  html += '<button onclick="publishSchedulePost()" style="padding:8px 20px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">Schedule</button>';
  html += '<button onclick="addToPublishOutbox()" style="padding:8px 20px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">Add to Outbox</button>';
  html += '</div>';

  el.innerHTML = html;

  // Pre-fill if content was passed via showSocialPublisher()
  if (window._socialPublisherContent) {
    var caption = document.getElementById('publishCaption');
    if (caption) caption.value = window._socialPublisherContent;
    window._socialPublisherContent = null;
    updatePublishCharCount();
  }
  if (window._socialPublisherImage) {
    showPublishImagePreview(window._socialPublisherImage);
    window._socialPublisherImage = null;
  }

  // Render outbox
  renderPublishOutbox();
}
```

- [ ] **Step 3: Add Publish tab helper functions**

Add these below `renderPublishTab()`:

```javascript
var _publishSelectedPlatforms = { x: true, threads: true, instagram: true, tiktok: false };
var _publishAttachedImage = null;

function togglePerPlatformEdit() {
  var el = document.getElementById('publishPerPlatformEdits');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function getPublishTextForPlatform(platform) {
  var perPlat = document.getElementById('publishPlatformText_' + platform);
  if (perPlat && perPlat.value.trim()) return perPlat.value.trim();
  var main = document.getElementById('publishCaption');
  return main ? main.value.trim() : '';
}

function togglePublishPlatform(platform) {
  _publishSelectedPlatforms[platform] = !_publishSelectedPlatforms[platform];
  var card = document.getElementById('publishPlatform_' + platform);
  if (card) {
    card.style.borderColor = _publishSelectedPlatforms[platform] ? 'var(--accent)' : 'var(--border-color)';
    card.style.opacity = _publishSelectedPlatforms[platform] ? '1' : '0.5';
  }
}

function updatePublishCharCount() {
  var caption = document.getElementById('publishCaption');
  var countEl = document.getElementById('publishCharCount');
  if (!caption || !countEl) return;
  var len = caption.value.length;
  var limits = { x: 280, threads: 500, instagram: 2200, tiktok: 2200 };
  var parts = [];
  var keys = Object.keys(limits);
  for (var i = 0; i < keys.length; i++) {
    if (_publishSelectedPlatforms[keys[i]]) {
      var color = len > limits[keys[i]] ? '#ef4444' : 'var(--text-tertiary)';
      parts.push('<span style="color:' + color + ';">' + keys[i].charAt(0).toUpperCase() + keys[i].slice(1) + ': ' + len + '/' + limits[keys[i]] + '</span>');
    }
  }
  countEl.innerHTML = parts.join(' &middot; ');
}

function attachPublishImage(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _publishAttachedImage = e.target.result;
    showPublishImagePreview(e.target.result);
  };
  reader.readAsDataURL(input.files[0]);
}

function showPublishImagePreview(src) {
  _publishAttachedImage = src;
  var preview = document.getElementById('publishImagePreview');
  if (!preview) return;
  preview.style.display = 'block';
  preview.innerHTML = '<div style="position:relative;display:inline-block;"><img src="' + src + '" style="max-height:120px;border-radius:8px;border:1px solid var(--border-color);"><button onclick="removePublishImage()" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-secondary);cursor:pointer;font-size:14px;line-height:18px;">&times;</button></div>';
}

function removePublishImage() {
  _publishAttachedImage = null;
  var preview = document.getElementById('publishImagePreview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
}

function publishPostNow() {
  var caption = document.getElementById('publishCaption');
  if (!caption || !caption.value.trim()) {
    showToast('Enter a caption first', 'error');
    return;
  }
  var content = caption.value.trim();
  var platforms = [];
  var keys = Object.keys(_publishSelectedPlatforms);
  for (var i = 0; i < keys.length; i++) {
    if (_publishSelectedPlatforms[keys[i]]) platforms.push(keys[i]);
  }
  if (platforms.length === 0) {
    showToast('Select at least one platform', 'error');
    return;
  }

  // Check TikTok requires media
  if (_publishSelectedPlatforms.tiktok && !_publishAttachedImage) {
    showToast('TikTok requires an image or video', 'error');
    return;
  }

  showToast('Posting to ' + platforms.join(', ') + '...', 'info');

  var posted = 0;
  var errors = [];
  for (var j = 0; j < platforms.length; j++) {
    (function(p) {
      var platContent = getPublishTextForPlatform(p);
      postToSocial(p, platContent, { image: _publishAttachedImage })
        .then(function(result) {
          posted++;
          if (result && result.success) {
            showToast(p + ': Posted!', 'success');
          } else {
            errors.push(p + ': ' + (result ? result.error : 'Failed'));
          }
          if (posted === platforms.length && errors.length > 0) {
            showToast(errors.join(', '), 'error');
          }
        })
        .catch(function(err) {
          posted++;
          errors.push(p + ': ' + err.message);
          if (posted === platforms.length) showToast(errors.join(', '), 'error');
        });
    })(platforms[j]);
  }

  // Clear compose area
  caption.value = '';
  removePublishImage();
  updatePublishCharCount();
}

function togglePublishOutbox() {
  var list = document.getElementById('publishOutboxList');
  var chevron = document.getElementById('publishOutboxChevron');
  if (!list) return;
  var showing = list.style.display !== 'none';
  list.style.display = showing ? 'none' : 'block';
  if (chevron) chevron.style.transform = showing ? '' : 'rotate(180deg)';
}

function addToPublishOutbox() {
  var caption = document.getElementById('publishCaption');
  if (!caption || !caption.value.trim()) {
    showToast('Enter a caption first', 'error');
    return;
  }
  var platforms = [];
  var keys = Object.keys(_publishSelectedPlatforms);
  for (var i = 0; i < keys.length; i++) {
    if (_publishSelectedPlatforms[keys[i]]) platforms.push(keys[i]);
  }
  addToSocialOutbox(platforms.join(','), caption.value.trim(), _publishAttachedImage);
  caption.value = '';
  removePublishImage();
  updatePublishCharCount();
  renderPublishOutbox();
  showToast('Added to outbox', 'success');
}

function editOutboxItem(itemId) {
  var outbox = getSocialOutbox();
  var item = null;
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) { item = outbox[i]; break; }
  }
  if (!item) return;
  var newContent = prompt('Edit post content:', item.content || '');
  if (newContent === null) return;
  item.content = newContent;
  saveSocialOutbox(outbox);
  renderPublishOutbox();
  showToast('Outbox item updated', 'success');
}

function renderPublishOutbox() {
  var outbox = getSocialOutbox();
  var header = document.getElementById('publishOutboxHeader');
  if (header) header.textContent = 'Outbox (' + outbox.length + ' pending)';
  var list = document.getElementById('publishOutboxList');
  if (!list) return;
  if (outbox.length === 0) {
    list.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;padding:8px 0;">No posts in outbox</p>';
    return;
  }
  var html = '';
  for (var i = 0; i < outbox.length; i++) {
    var item = outbox[i];
    html += '<div style="padding:10px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;background:var(--bg-secondary);">';
    html += '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px;">' + escapeHtml(item.platform || '') + ' &middot; ' + (item.timestamp ? new Date(item.timestamp).toLocaleString() : '') + '</div>';
    html += '<div style="font-size:13px;color:var(--text-primary);margin-bottom:8px;">' + escapeHtml((item.content || '').substring(0, 100)) + '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="socialOutboxSend(\'' + item.id + '\');renderPublishOutbox();" style="padding:4px 10px;border-radius:6px;background:rgba(74,222,128,0.15);color:#16a34a;border:none;cursor:pointer;font-size:12px;">Post Now</button>';
    html += '<button onclick="editOutboxItem(\'' + item.id + '\')" style="padding:4px 10px;border-radius:6px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:12px;">Edit</button>';
    html += '<button onclick="socialOutboxDelete(\'' + item.id + '\');renderPublishOutbox();" style="padding:4px 10px;border-radius:6px;background:rgba(239,68,68,0.1);color:#dc2626;border:none;cursor:pointer;font-size:12px;">Delete</button>';
    html += '</div></div>';
  }
  list.innerHTML = html;
}
```

- [ ] **Step 3b: Add missing Publish helper functions**

Add `publishSchedulePost()` function that routes to Automations scheduler with the current caption/platforms pre-filled (same pattern as existing `scheduleSocialPost()` at line ~104603):

```javascript
function publishSchedulePost() {
  var caption = document.getElementById('publishCaption');
  if (!caption || !caption.value.trim()) {
    showToast('Enter a caption first', 'error');
    return;
  }
  // Route to automation scheduler with social post data
  scheduleSocialPost('all');
}
```

Add post history section to the bottom of `renderPublishTab()` (after the outbox section):

```javascript
  // Post history
  html += '<div style="margin-top:24px;">';
  html += '<h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Recent Posts</h3>';
  var history = [];
  try { history = JSON.parse(localStorage.getItem('roweos_social_post_history') || '[]'); } catch(e) {}
  if (history.length === 0) {
    html += '<p style="color:var(--text-tertiary);font-size:13px;">No posts yet.</p>';
  } else {
    for (var h = 0; h < Math.min(history.length, 10); h++) {
      var post = history[h];
      html += '<div style="padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px;">';
      html += '<span style="color:var(--text-tertiary);">' + escapeHtml(post.platform || '') + '</span> &middot; ';
      html += '<span style="color:var(--text-secondary);">' + escapeHtml((post.content || '').substring(0, 80)) + '</span>';
      if (post.postUrl) html += ' <a href="' + escapeHtml(post.postUrl) + '" target="_blank" style="color:var(--accent);font-size:11px;">View</a>';
      html += '</div>';
    }
  }
  html += '</div>';
```

- [ ] **Step 3c: Remove old Social Publisher panel from Studio HTML**

Find `#socialPublisherPanel` in Studio view (line ~51862-51873) and remove the entire div. This prevents duplicate UI.

- [ ] **Step 4: Update showSocialPublisher() to redirect**

Find `showSocialPublisher()` at line ~103670. Replace the function body to redirect to Social Hub:

```javascript
function showSocialPublisher(content, platforms) {
  // v25.4: Redirect to Social Hub Publish tab
  window._socialPublisherContent = content || null;
  window._socialPublisherImage = window._socialPublisherImage || null;
  showView('social');
  showSocialTab('publish');
  // Re-render after tab switch to pick up pre-filled content
  setTimeout(function() { renderPublishTab(); }, 50);
}
```

Keep the old `closeSocialPublisher()` function but make it a no-op:

```javascript
function closeSocialPublisher() {
  // v25.4: No-op — publisher is now a permanent tab in Social Hub
}
```

- [ ] **Step 5: Add renderPublishTab() call in showView**

In the `showView` function, find the social view handler (around line ~63332) and add `renderPublishTab()`:

```javascript
  // v26.3: Social Hub view
  if (view === 'social') {
    if (typeof initScavengerActivity === 'function') initScavengerActivity();
    if (typeof loadScavengerConfigsFromFirestore === 'function') loadScavengerConfigsFromFirestore();
    if (typeof renderPublishTab === 'function') renderPublishTab();
  }
```

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: move Social Publisher into Publish tab with compose, outbox, and platform cards"
```

---

## Task 3: Move Image/Video Lab into Media Tab

**Files:**
- Modify: `RoweOS/dist/index.html`

Move Image Lab and Video Lab from Automations into the Media tab with Image/Video sub-tabs.

- [ ] **Step 1: Build Media tab HTML container**

Find `socialTabMedia` (the empty panel from Task 1) and add sub-tab structure:

```html
    <div id="socialTabMedia" class="social-tab-panel" style="display:none;">
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="scavenger-filter-btn active" id="mediaSubImage" onclick="showMediaSubTab('image')">Image Lab</button>
        <button class="scavenger-filter-btn" id="mediaSubVideo" onclick="showMediaSubTab('video')">Video Lab</button>
      </div>
      <div id="mediaImagePanel"></div>
      <div id="mediaVideoPanel" style="display:none;"></div>
    </div>
```

- [ ] **Step 2: Add showMediaSubTab() and render functions**

```javascript
// v25.4: Media tab sub-tab switching
function showMediaSubTab(tab) {
  var imgPanel = document.getElementById('mediaImagePanel');
  var vidPanel = document.getElementById('mediaVideoPanel');
  var imgBtn = document.getElementById('mediaSubImage');
  var vidBtn = document.getElementById('mediaSubVideo');
  if (tab === 'image') {
    if (imgPanel) imgPanel.style.display = '';
    if (vidPanel) vidPanel.style.display = 'none';
    if (imgBtn) imgBtn.classList.add('active');
    if (vidBtn) vidBtn.classList.remove('active');
    renderMediaImageTab();
  } else {
    if (imgPanel) imgPanel.style.display = 'none';
    if (vidPanel) vidPanel.style.display = '';
    if (imgBtn) imgBtn.classList.remove('active');
    if (vidBtn) vidBtn.classList.add('active');
    renderMediaVideoTab();
  }
}

// v25.4: Render Image Lab in Media tab
// IMPORTANT: Do NOT use ID-swapping. Instead, modify renderAutoLabImageLab() to accept
// an optional targetId parameter. Find the function (line ~107962) and change:
//   function renderAutoLabImageLab() {
//     var el = document.getElementById('autoLabImageLab');
// To:
//   function renderAutoLabImageLab(targetId) {
//     var el = document.getElementById(targetId || 'autoLabImageLab');
// Also update ALL internal onclick handlers that call renderAutoLabImageLab() to pass
// the same targetId. For example:
//   onclick="renderAutoLabImageLab()" becomes onclick="renderAutoLabImageLab('mediaImagePanel')"
// when rendered inside the Media tab context.
// Do the same for renderAutoLabVideoLab().

function renderMediaImageTab() {
  renderAutoLabImageLab('mediaImagePanel');
}

function renderMediaVideoTab() {
  renderAutoLabVideoLab('mediaVideoPanel');
}
```

- [ ] **Step 3: Add Media tab init to showView**

Update the social view handler in `showView()`:

```javascript
  if (view === 'social') {
    if (typeof initScavengerActivity === 'function') initScavengerActivity();
    if (typeof loadScavengerConfigsFromFirestore === 'function') loadScavengerConfigsFromFirestore();
    if (typeof renderPublishTab === 'function') renderPublishTab();
  }
```

- [ ] **Step 4: Also init Media tab in showSocialTab**

Update `showSocialTab()` (line ~174573) to render content when tabs are switched:

```javascript
function showSocialTab(tab) {
  var tabs = document.querySelectorAll('.social-hub-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
  }
  var panels = document.querySelectorAll('.social-tab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].style.display = 'none';
  }
  var panel = document.getElementById('socialTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.style.display = '';
  // v25.4: Render tab content on switch
  if (tab === 'publish' && typeof renderPublishTab === 'function') renderPublishTab();
  if (tab === 'media' && typeof renderMediaImageTab === 'function') renderMediaImageTab();
  if (tab === 'settings' && typeof renderSocialSettings === 'function') renderSocialSettings();
  if (tab === 'activity' && typeof initScavengerActivity === 'function') initScavengerActivity();
}
```

- [ ] **Step 4b: Add "Post this" action on generated media**

In the Image Lab and Video Lab chat thread rendering, each generated image/video should get a "Post" button. Find where generated images are rendered in the chat thread (inside `renderImageLabChatThread()` or similar) and add after each image:

```javascript
// v25.4: "Post this" button on generated media
html += '<button onclick="postMediaToPublish(\'' + imgSrc + '\')" style="margin-top:4px;padding:4px 10px;border-radius:6px;background:var(--brand-accent-10);color:var(--accent);border:1px solid var(--accent);cursor:pointer;font-size:11px;">Post this</button>';
```

Add the `postMediaToPublish()` function:

```javascript
function postMediaToPublish(mediaSrc) {
  window._socialPublisherImage = mediaSrc;
  showView('social');
  showSocialTab('publish');
  setTimeout(function() { renderPublishTab(); }, 50);
  showToast('Image attached to Publish', 'success');
}
```

Do the same for Video Lab generated videos.

- [ ] **Step 5: Add redirect cards in Automations**

In `showAutoLabTab()` (line ~96883), update the imagelab/videolab branches to show redirects:

```javascript
  else if (tabName === 'imagelab') {
    // v25.4: Redirect to Social Hub Media
    var target = document.getElementById(map[tabName]);
    if (target) {
      target.classList.add('active');
      target.innerHTML = '<div style="text-align:center;padding:60px 20px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><h3 style="color:var(--text-primary);margin-bottom:8px;">Image Lab has moved</h3><p style="color:var(--text-secondary);margin-bottom:16px;">Image Lab is now in Social Hub > Media</p><button onclick="showView(\'social\');showSocialTab(\'media\');showMediaSubTab(\'image\');" style="padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;">Go to Media</button></div>';
    }
  }
  else if (tabName === 'videolab') {
    var target = document.getElementById(map[tabName]);
    if (target) {
      target.classList.add('active');
      target.innerHTML = '<div style="text-align:center;padding:60px 20px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg><h3 style="color:var(--text-primary);margin-bottom:8px;">Video Lab has moved</h3><p style="color:var(--text-secondary);margin-bottom:16px;">Video Lab is now in Social Hub > Media</p><button onclick="showView(\'social\');showSocialTab(\'media\');showMediaSubTab(\'video\');" style="padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;">Go to Media</button></div>';
    }
  }
```

Replace the existing `else if (tabName === 'imagelab') renderAutoLabImageLab();` and `else if (tabName === 'videolab') renderAutoLabVideoLab();` lines.

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: move Image/Video Lab into Social Hub Media tab with redirects in Automations"
```

---

## Task 4: Move Social Connectors into Settings Tab + Scavenger Config Editor

**Files:**
- Modify: `RoweOS/dist/index.html`

Move the social account connector grid from System Settings into the Social Hub Settings tab.

- [ ] **Step 1: Build Settings tab with renderSocialSettings()**

```javascript
// v25.4: Render Social Hub Settings tab
function renderSocialSettings() {
  var el = document.getElementById('socialTabSettings');
  if (!el) return;

  var html = '';
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text-primary);">Connected Accounts</h3>';

  // Scope indicator
  var scope = getSocialKeyScope();
  var brands = JSON.parse(localStorage.getItem('roweos_brands') || '[]');
  var brandIdx = parseInt(scope.replace('_brand_', '').replace('_life_', ''));
  var brandName = '';
  if (scope.indexOf('_brand_') >= 0 && brands[brandIdx]) {
    brandName = brands[brandIdx].shortName || brands[brandIdx].name || '';
  }
  if (brandName) {
    html += '<p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Connections for: ' + escapeHtml(brandName) + '</p>';
  }

  // Platform cards
  var platforms = [
    { id: 'x', name: 'X', icon: '<path d="M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-7-8.5L19.5 4H18l-5 6.2L9 4z"/>' },
    { id: 'threads', name: 'Threads', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M8.5 9.5C9.5 8.5 10.5 8 12 8s2.5.5 3.5 1.5"/>' },
    { id: 'instagram', name: 'Instagram', icon: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/>' },
    { id: 'tiktok', name: 'TikTok', icon: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>' }
  ];

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px;">';
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    var connected = isSocialConnected(p.id);
    var handle = getSocialHandle(p.id);
    html += '<div style="padding:16px;border-radius:12px;border:1px solid var(--border-color);background:var(--bg-secondary);">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + p.icon + '</svg>';
    html += '<span style="font-weight:600;color:var(--text-primary);">' + p.name + '</span>';
    if (connected) {
      html += '<span style="width:8px;height:8px;border-radius:50%;background:#4ade80;margin-left:auto;"></span>';
    }
    html += '</div>';
    if (connected) {
      html += '<div style="font-size:12px;color:var(--accent);margin-bottom:8px;">@' + escapeHtml(handle || '') + '</div>';
      html += '<button onclick="disconnectSocialAccount(\'' + p.id + '\');renderSocialSettings();" style="padding:4px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#dc2626;cursor:pointer;font-size:12px;">Disconnect</button>';
    } else {
      html += '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px;">Not connected</div>';
      html += '<button onclick="connectSocialAccount(\'' + p.id + '\')" style="padding:4px 12px;border-radius:6px;border:1px solid var(--accent);background:var(--brand-accent-10);color:var(--accent);cursor:pointer;font-size:12px;">Connect</button>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Scavenger configs section with full CRUD
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px;margin-top:32px;color:var(--text-primary);">Scavenger Configs</h3>';
  html += '<button onclick="addScavengerConfig()" style="padding:6px 14px;border-radius:8px;background:var(--brand-accent-10);color:var(--accent);border:1px solid var(--accent);cursor:pointer;font-size:12px;margin-bottom:12px;">+ Add Config</button>';
  var configs = getScavengerConfigs();
  if (configs.length === 0) {
    html += '<p style="color:var(--text-tertiary);font-size:13px;">No scavenger configs yet.</p>';
  } else {
    for (var c = 0; c < configs.length; c++) {
      var cfg = configs[c];
      html += '<div style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;background:var(--bg-secondary);">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-weight:600;color:var(--text-primary);">' + escapeHtml(cfg.configName || 'Unnamed') + '</span>';
      html += '<div style="display:flex;gap:8px;align-items:center;">';
      html += '<span class="scavenger-status-badge ' + (cfg.active ? 'posted' : 'rejected') + '">' + (cfg.active ? 'Active' : 'Inactive') + '</span>';
      html += '<button onclick="editScavengerConfig(' + c + ')" style="padding:2px 8px;border-radius:4px;border:1px solid var(--border-color);background:none;color:var(--text-secondary);cursor:pointer;font-size:11px;">Edit</button>';
      html += '<button onclick="deleteScavengerConfig(' + c + ')" style="padding:2px 8px;border-radius:4px;border:1px solid rgba(239,68,68,0.3);background:none;color:#dc2626;cursor:pointer;font-size:11px;">Delete</button>';
      html += '</div></div>';
      html += '<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">' + escapeHtml((cfg.keywords || []).join(', ')) + '</div>';
      // Inline editor (hidden by default, shown on Edit click)
      html += '<div id="scavConfigEditor_' + c + '" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">';
      html += '<div style="display:grid;gap:8px;">';
      html += '<input id="scavCfg_name_' + c + '" value="' + escapeHtml(cfg.configName || '') + '" placeholder="Config Name" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_keywords_' + c + '" value="' + escapeHtml((cfg.keywords || []).join(', ')) + '" placeholder="Keywords (comma-separated)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<select id="scavCfg_tone_' + c + '" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      var tones = ['Thought Leader', 'Conversational', 'Professional'];
      for (var tn = 0; tn < tones.length; tn++) {
        html += '<option' + (cfg.tonePriority === tones[tn] ? ' selected' : '') + '>' + tones[tn] + '</option>';
      }
      html += '</select>';
      html += '<textarea id="scavCfg_prompt_' + c + '" placeholder="Custom Prompt" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;min-height:60px;">' + escapeHtml(cfg.customPrompt || '') + '</textarea>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
      html += '<input id="scavCfg_interval_' + c + '" type="number" value="' + (cfg.pollingIntervalMin || 15) + '" placeholder="Poll interval (min)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_maxHour_' + c + '" type="number" value="' + (cfg.maxPerHour || 5) + '" placeholder="Max/hour" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_maxDay_' + c + '" type="number" value="' + (cfg.maxPerDay || 20) + '" placeholder="Max/day" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '</div>';
      html += '<input id="scavCfg_threshold_' + c + '" type="number" value="' + (cfg.autoPostThreshold || '') + '" placeholder="Auto-post threshold (0-100, blank=manual)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_avoid_' + c + '" value="' + escapeHtml((cfg.avoidAccounts || []).join(', ')) + '" placeholder="Avoid accounts (comma-separated)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);"><input type="checkbox" id="scavCfg_active_' + c + '"' + (cfg.active ? ' checked' : '') + '> Active</label>';
      html += '<button onclick="saveScavengerConfigEdit(' + c + ')" style="padding:6px 14px;border-radius:6px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:13px;">Save</button>';
      html += '</div></div>';
      html += '</div>';
    }
  }

  el.innerHTML = html;
}
```

- [ ] **Step 1b: Add Scavenger config CRUD functions**

```javascript
function editScavengerConfig(index) {
  var editor = document.getElementById('scavConfigEditor_' + index);
  if (!editor) return;
  editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
}

function saveScavengerConfigEdit(index) {
  var configs = getScavengerConfigs();
  if (!configs[index]) return;
  configs[index].configName = document.getElementById('scavCfg_name_' + index).value;
  configs[index].keywords = document.getElementById('scavCfg_keywords_' + index).value.split(',').map(function(k) { return k.trim(); }).filter(function(k) { return k; });
  configs[index].tonePriority = document.getElementById('scavCfg_tone_' + index).value;
  configs[index].customPrompt = document.getElementById('scavCfg_prompt_' + index).value;
  configs[index].pollingIntervalMin = parseInt(document.getElementById('scavCfg_interval_' + index).value) || 15;
  configs[index].maxPerHour = parseInt(document.getElementById('scavCfg_maxHour_' + index).value) || 5;
  configs[index].maxPerDay = parseInt(document.getElementById('scavCfg_maxDay_' + index).value) || 20;
  configs[index].autoPostThreshold = parseInt(document.getElementById('scavCfg_threshold_' + index).value) || 0;
  configs[index].avoidAccounts = document.getElementById('scavCfg_avoid_' + index).value.split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a; });
  configs[index].active = document.getElementById('scavCfg_active_' + index).checked;
  saveScavengerConfigs(configs);
  renderSocialSettings();
  showToast('Config saved', 'success');
}

function addScavengerConfig() {
  var configs = getScavengerConfigs();
  configs.push({
    id: String(Date.now()),
    configName: 'New Config',
    keywords: [],
    tonePriority: 'Thought Leader',
    customPrompt: '',
    pollingIntervalMin: 15,
    maxPerHour: 5,
    maxPerDay: 20,
    autoPostThreshold: 0,
    avoidAccounts: [],
    active: false
  });
  saveScavengerConfigs(configs);
  renderSocialSettings();
}

function deleteScavengerConfig(index) {
  if (!confirm('Delete this scavenger config?')) return;
  var configs = getScavengerConfigs();
  configs.splice(index, 1);
  saveScavengerConfigs(configs);
  renderSocialSettings();
  showToast('Config deleted', 'info');
}
```

- [ ] **Step 2: Add redirect in System Settings**

Find the `#socialAccountsGrid` HTML in System Settings (line ~56708-56764). Replace the entire grid with a redirect card:

```html
            <!-- v25.4: Social connections moved to Social Hub -->
            <div style="text-align:center;padding:24px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);">
              <p style="color:var(--text-primary);font-weight:600;margin-bottom:4px;">Social Connections</p>
              <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">Manage your social media connections in Social Hub > Settings</p>
              <button onclick="showView('social');showSocialTab('settings');" style="padding:6px 16px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:13px;">Go to Social Settings</button>
            </div>
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: move Social Connectors and Scavenger Configs into Social Hub Settings tab"
```

---

## Task 5: Add Imagen 3 Model Option

**Files:**
- Modify: `RoweOS/dist/index.html`

Add Google Imagen 3 as a model option in Image Lab and implement the API call.

- [ ] **Step 1: Add generateImageWithImagen3() function**

Add near the existing `generateImageWithGemini()` function (around line ~81081):

```javascript
// v25.4: Google Imagen 3 image generation
async function generateImageWithImagen3(prompt, aspectRatio) {
  var apiKey = '';
  try {
    apiKey = getNanobananaKey ? getNanobananaKey() : '';
  } catch(e) {}
  if (!apiKey) {
    return { success: false, error: 'No Google API key configured' };
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=' + apiKey;

  try {
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: { text: prompt },
        config: {
          numberOfImages: 1,
          aspectRatio: aspectRatio || '1:1',
          personGeneration: 'ALLOW_ADULT'
        }
      })
    });
    var data = await resp.json();
    if (!resp.ok) {
      console.error('[Imagen3] API error:', JSON.stringify(data));
      return { success: false, error: 'Imagen 3 error: ' + (data.error ? data.error.message : resp.status) };
    }
    if (data.generatedImages && data.generatedImages.length > 0) {
      var base64 = data.generatedImages[0].image.imageBytes;
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
```

- [ ] **Step 2: Add Imagen 3 to Image Lab model selector**

Find the Image Lab model selector in `renderAutoLabImageLab()` (around line ~107973). The existing models are rendered as buttons. Add "Google Imagen 3" as a third option. Search for the model selector HTML and add:

```javascript
html += '<button class="imagelab-subtab' + (window._imageLabChatModel === 'imagen3' ? ' active' : '') + '" onclick="window._imageLabChatModel=\'imagen3\';renderAutoLabImageLab();">Imagen 3</button>';
```

- [ ] **Step 3: Wire Imagen 3 into sendImageLabMessage()**

Find `sendImageLabMessage()` (line ~108202). Add an Imagen 3 branch. Before the existing Nano Banana API call, add:

```javascript
    // v25.4: Imagen 3 path — follows same pattern as Nano Banana result handling
    if (window._imageLabChatModel === 'imagen3') {
      var imgResult = await generateImageWithImagen3(userMessage, window._imageLabAspectRatio || '1:1');
      if (imgResult.success && imgResult.images && imgResult.images.length > 0) {
        var imgSrc = 'data:' + imgResult.images[0].mimeType + ';base64,' + imgResult.images[0].base64;
        // Add AI message with image to chat thread (same pattern as existing Nano Banana handler)
        _imageLabChatMessages.push({
          role: 'assistant',
          content: imgSrc,
          type: 'image',
          model: 'imagen3',
          aspectRatio: window._imageLabAspectRatio || '1:1',
          timestamp: new Date().toISOString()
        });
        saveImageLabChatMessages();
        renderImageLabChatThread();
        window._nanobananaLastImage = imgSrc;
      } else {
        _imageLabChatMessages.push({
          role: 'assistant',
          content: 'Image generation failed: ' + (imgResult.error || 'Unknown error'),
          type: 'text',
          timestamp: new Date().toISOString()
        });
        saveImageLabChatMessages();
        renderImageLabChatThread();
      }
      window._imageLabChatSending = false;
      return; // Skip the Nano Banana path below
    }
```

The exact insertion depends on the existing control flow -- the implementer should read `sendImageLabMessage()` fully and add the Imagen 3 branch following the same pattern as the Nano Banana branch.

- [ ] **Step 4: Hide reference images when Imagen 3 selected**

In the Image Lab render, add a check to hide the reference image upload area when Imagen 3 is selected (it doesn't support image-to-image):

```javascript
// v25.4: Hide ref images for Imagen 3 (no image-to-image support)
if (window._imageLabChatModel === 'imagen3') {
  // Don't render the reference image upload section
}
```

- [ ] **Step 5: Add Imagen 3 to usage tracking**

Find the usage tracking system (around line ~81293). Add `imagen3` alongside `nanobanana` in the stats tracking.

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: add Google Imagen 3 as Image Lab model option"
```

---

## Task 6: Add TikTok API Integration

**Files:**
- Modify: `RoweOS/dist/index.html`
- Modify: `RoweOS/dist/api/social-auth.js`
- Modify: `RoweOS/dist/social-callback.html`

- [ ] **Step 1: Add connectTikTok() function in index.html**

Add near `connectX()` (around line ~102940):

```javascript
// v25.4: TikTok OAuth (Login Kit)
function connectTikTok() {
  var clientKey = '';
  // Check for own API keys first
  var ownKeys = localStorage.getItem('roweos_social_own_keys');
  if (ownKeys) {
    try {
      var parsed = JSON.parse(ownKeys);
      if (parsed.tiktok_client_key) clientKey = parsed.tiktok_client_key;
    } catch(e) {}
  }
  if (!clientKey) {
    clientKey = ROWEOS_SOCIAL_APP_IDS.tiktok || '';
  }
  if (!clientKey) {
    showToast('TikTok app key not configured', 'error');
    return;
  }

  var scope = getSocialKeyScope();
  var state = 'tiktok' + scope + '_' + Math.random().toString(36).substring(2, 10);
  // v20.12: Append UID for Firestore token storage
  if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
    state += '~u:' + firebase.auth().currentUser.uid;
  }
  localStorage.setItem('roweos_tiktok_state', state);

  var redirectUri = encodeURIComponent(window.location.origin + '/social-callback.html');
  var authUrl = 'https://www.tiktok.com/v2/auth/authorize/' +
    '?client_key=' + clientKey +
    '&scope=user.info.basic,video.publish,video.upload' +
    '&response_type=code' +
    '&redirect_uri=' + redirectUri +
    '&state=' + state;

  window.open(authUrl, '_blank', 'width=600,height=700');
}
```

- [ ] **Step 2: Add TikTok to connectSocialAccount() router**

Find `connectSocialAccount()` (line ~102912) and add a TikTok case:

```javascript
  } else if (platform === 'tiktok') {
    connectTikTok();
  }
```

- [ ] **Step 3: Add TikTok app ID to ROWEOS_SOCIAL_APP_IDS**

Find `ROWEOS_SOCIAL_APP_IDS` (line ~102934) and add:

```javascript
  tiktok: '' // v25.4: Requires developer app approval — user provides own key
```

- [ ] **Step 4: Remove TikTok API guard**

Find `var isApiPlatform = p !== 'tiktok';` (line ~103688) and change to:

```javascript
  var isApiPlatform = true; // v25.4: All platforms now support direct API posting
```

- [ ] **Step 5: Add TikTok to social-auth.js**

In `RoweOS/dist/api/social-auth.js`, find the allowed URLs array (line ~89) and add TikTok:

```javascript
  var allowed = ['https://threads.net/', 'https://www.threads.net/',
                 'https://www.threads.com/', 'https://threads.com/',
                 'https://api.instagram.com/', 'https://x.com/',
                 'https://open.tiktokapis.com/', 'https://www.tiktok.com/'];
```

Also add TikTok token exchange logic after the Instagram section. TikTok uses `POST https://open.tiktokapis.com/v2/oauth/token/` with `client_key`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`.

- [ ] **Step 6: Add TikTok to social-callback.html**

Find the platform detection section (line ~127-142) and add TikTok:

```javascript
    var tkState = localStorage.getItem('roweos_tiktok_state');

    if (stateBase === xState) platform = 'x';
    else if (state === tState) platform = 'threads';
    else if (state === igState) platform = 'instagram';
    else if (stateBase === tkState) platform = 'tiktok';

    // Fallback
    if (!platform && stateBase) {
      if (stateBase.indexOf('x_') === 0) platform = 'x';
      else if (stateBase.indexOf('threads_') === 0) platform = 'threads';
      else if (stateBase.indexOf('ig_') === 0) platform = 'instagram';
      else if (stateBase.indexOf('tiktok') === 0) platform = 'tiktok';
    }
```

- [ ] **Step 7: Add postToTikTok() function**

Add near `postToSocial()` (around line ~104277). TikTok posting uses the Content Posting API:

```javascript
// v25.4: Post to TikTok via Content Posting API
function postToTikTok(content, imageBase64) {
  // TikTok requires media — text-only not supported
  if (!imageBase64) {
    return Promise.resolve({ success: false, platform: 'tiktok', error: 'TikTok requires an image or video' });
  }
  // For now, use Photo Mode for image posts
  // Video posting requires more complex upload flow
  var token = getSocialToken('tiktok');
  if (!token) {
    return Promise.resolve({ success: false, platform: 'tiktok', error: 'TikTok not connected' });
  }

  // TikTok Photo Mode: POST /v2/post/publish/content/init/
  return fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      post_info: {
        title: content.substring(0, 2200),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: [imageBase64]
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO'
    })
  })
  .then(function(resp) { return resp.json(); })
  .then(function(data) {
    if (data.error && data.error.code !== 'ok') {
      return { success: false, platform: 'tiktok', error: data.error.message || 'TikTok post failed' };
    }
    return { success: true, platform: 'tiktok', postId: data.data ? data.data.publish_id : null };
  })
  .catch(function(err) {
    return { success: false, platform: 'tiktok', error: err.message };
  });
}
```

- [ ] **Step 8: Wire TikTok into postToSocial()**

Find the client-side `postToSocial()` function and add a TikTok branch alongside the existing X/Threads/Instagram cases.

- [ ] **Step 9: Commit**

```bash
git add RoweOS/dist/index.html RoweOS/dist/api/social-auth.js RoweOS/dist/social-callback.html
git commit -m "feat: add TikTok OAuth + Content Posting API integration"
```

---

## Task 7: Deploy and Verify

- [ ] **Step 1: Deploy to Vercel**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project/RoweOS/dist"
export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)" && vercel --prod --yes
```

- [ ] **Step 2: Push to git**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
git push origin main
```

- [ ] **Step 3: Verify**

Check on roweos.com:
- Social Hub > Publish tab shows compose area with platform cards
- Social Hub > Media tab shows Image Lab and Video Lab sub-tabs
- Social Hub > Settings tab shows social connector cards
- Automations > Image Lab shows redirect card
- System Settings > Social section shows redirect card
- Placeholder tabs (Scavenger, Create, Blog, Analytics) show descriptions
- Image Lab model selector includes "Imagen 3"
- TikTok card appears in Settings (with Connect button)
