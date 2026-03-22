# Social Hub Phase 2B-3: Blog Tab -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Blog tab with website analyzer, rich text editor with AI writing assistant, and four delivery options.

**Architecture:** All logic lives in `RoweOS/dist/index.html` as a single-file addition. The Blog tab replaces the placeholder `#socialTabBlog` div with a full four-section layout: Drafts bar, Website Analyzer, Rich Text Editor, and Delivery section. The Website Analyzer fetches via the existing `/api/fetch-site-meta` proxy, parses HTML client-side with DOMParser, and stores context in `window._blogAnalysisContext`. The rich text editor uses `document.execCommand()` for formatting (matching the Mail compose pattern) with a `<font size="7">` to `<span style="font-size:Npx">` workaround for pixel font sizes.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), Firebase SDK, fetch-site-meta proxy

**Spec:** `docs/superpowers/specs/2026-03-22-social-hub-phase-2b3-blog-design.md`

**Codebase conventions:**
- ES5 only (no arrow functions, no let/const, no template literals)
- var for all declarations
- No emoji -- SVG icons only
- Tag changes with `// v25.4:` comments

**Base path:** `/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project`

---

## Task 1: Blog Tab HTML

Replace the existing placeholder `#socialTabBlog` div with the full four-section HTML.

**File:** `RoweOS/dist/index.html`

**Find** (around line 57418):
```html
    <div id="socialTabBlog" class="social-tab-panel" style="display:none;">
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <h3 style="color:var(--text-primary);margin-bottom:8px;">Blog</h3>
        <p>Analyze websites, generate rich-text blog posts, and publish or email them.</p>
        <p style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Coming in Phase 2B</p>
      </div>
    </div>
```

**Replace with:**
```html
    <!-- v25.4: Blog tab -- Phase 2B-3 -->
    <div id="socialTabBlog" class="social-tab-panel" style="display:none;">

      <!-- Drafts bar -->
      <div id="blogDraftsBar" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;">Drafts</span>
          <button onclick="blogNewPost()" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;background:var(--brand-accent,#a89878);color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:600;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Post
          </button>
        </div>
        <div id="blogDraftsList" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;"></div>
      </div>

      <!-- Website Analyzer -->
      <div id="blogAnalyzerSection" style="margin-bottom:16px;border:1px solid var(--border-color);border-radius:10px;overflow:hidden;">
        <div onclick="toggleBlogAnalyzer()" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);cursor:pointer;user-select:none;">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Website Analyzer
          </span>
          <svg id="blogAnalyzerChevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div id="blogAnalyzerBody" style="display:none;padding:14px;">
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <input type="url" id="blogAnalyzerUrl" placeholder="https://example.com" style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;outline:none;">
            <button onclick="blogAnalyzeWebsite()" id="blogAnalyzeBtn" style="padding:8px 14px;border-radius:8px;background:var(--brand-accent,#a89878);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;">Analyze</button>
          </div>
          <div id="blogAnalyzerStatus" style="display:none;font-size:12px;color:var(--text-secondary);margin-bottom:8px;"></div>
          <div id="blogAnalyzerResults" style="display:none;">
            <!-- Content Analysis -->
            <div style="margin-bottom:10px;border:1px solid var(--border-color);border-radius:8px;overflow:hidden;">
              <div onclick="toggleBlogAnalysisSection('content')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-tertiary);cursor:pointer;">
                <span style="font-size:12px;font-weight:600;color:var(--text-primary);">Content Analysis</span>
                <svg id="blogContentChevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div id="blogContentAnalysisBody" style="padding:10px 12px;"></div>
            </div>
            <!-- SEO Analysis -->
            <div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden;">
              <div onclick="toggleBlogAnalysisSection('seo')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-tertiary);cursor:pointer;">
                <span style="font-size:12px;font-weight:600;color:var(--text-primary);">SEO + Competitive Analysis</span>
                <svg id="blogSeoChevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div id="blogSeoAnalysisBody" style="padding:10px 12px;display:none;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rich Text Editor -->
      <div id="blogEditorSection" style="margin-bottom:16px;border:1px solid var(--border-color);border-radius:10px;overflow:hidden;">
        <!-- Title -->
        <div style="padding:10px 14px 0;">
          <input type="text" id="blogTitleInput" placeholder="Blog post title..." style="width:100%;padding:8px 0;border:none;border-bottom:1px solid var(--border-color);background:transparent;color:var(--text-primary);font-size:18px;font-weight:600;outline:none;margin-bottom:8px;">
        </div>

        <!-- Toolbar Row 1 -->
        <div style="display:flex;flex-wrap:wrap;gap:2px;padding:8px 10px;border-bottom:1px solid var(--border-color);background:var(--bg-secondary);">
          <button class="blog-tb-btn" title="Bold" onclick="blogExecCommand('bold')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg></button>
          <button class="blog-tb-btn" title="Italic" onclick="blogExecCommand('italic')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg></button>
          <button class="blog-tb-btn" title="Underline" onclick="blogExecCommand('underline')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg></button>
          <button class="blog-tb-btn" title="Strikethrough" onclick="blogExecCommand('strikeThrough')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4s-5 1-5 4c0 1.5.8 2.5 2 3"/><path d="M8 18c0 0 1.5 2 4 2s5-1 5-4c0-1.5-.8-2.5-2-3"/></svg></button>
          <div style="width:1px;background:var(--border-color);margin:2px 4px;"></div>
          <select onchange="blogSetHeading(this.value)" style="padding:3px 6px;border-radius:5px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;cursor:pointer;">
            <option value="p">Paragraph</option>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
          </select>
          <div style="width:1px;background:var(--border-color);margin:2px 4px;"></div>
          <button class="blog-tb-btn" title="Bullet list" onclick="blogExecCommand('insertUnorderedList')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg></button>
          <button class="blog-tb-btn" title="Numbered list" onclick="blogExecCommand('insertOrderedList')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10H6"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg></button>
          <div style="width:1px;background:var(--border-color);margin:2px 4px;"></div>
          <button class="blog-tb-btn" title="Align left" onclick="blogExecCommand('justifyLeft')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
          <button class="blog-tb-btn" title="Align center" onclick="blogExecCommand('justifyCenter')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
          <button class="blog-tb-btn" title="Align right" onclick="blogExecCommand('justifyRight')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
          <button class="blog-tb-btn" title="Justify" onclick="blogExecCommand('justifyFull')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        </div>

        <!-- Toolbar Row 2 -->
        <div style="display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;border-bottom:1px solid var(--border-color);background:var(--bg-secondary);">
          <button class="blog-tb-btn" title="Insert link" onclick="blogInsertLink()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
          <button class="blog-tb-btn" title="Insert image" onclick="blogInsertImagePicker()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
          <button class="blog-tb-btn" title="Blockquote" onclick="blogExecCommand('formatBlock','blockquote')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg></button>
          <button class="blog-tb-btn" title="Code block" onclick="blogInsertCodeBlock()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>
          <button class="blog-tb-btn" title="Horizontal rule" onclick="blogInsertHR()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          <button class="blog-tb-btn" title="Insert table" onclick="blogShowTableModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg></button>
          <div style="width:1px;background:var(--border-color);margin:2px 4px;"></div>
          <select id="blogFontFamilySelect" onchange="blogSetFontFamily(this.value)" style="padding:3px 6px;border-radius:5px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;cursor:pointer;">
            <option value="inherit">Sans-serif</option>
            <option value="Georgia,serif">Serif</option>
            <option value="monospace">Monospace</option>
            <option value="'Geist Sans',sans-serif">Geist Sans</option>
            <option value="'Geist Mono',monospace">Geist Mono</option>
          </select>
          <select id="blogFontSizeSelect" onchange="blogSetFontSize(this.value)" style="padding:3px 6px;border-radius:5px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;cursor:pointer;">
            <option value="">Size</option>
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="24">24</option>
            <option value="28">28</option>
            <option value="32">32</option>
            <option value="36">36</option>
            <option value="48">48</option>
          </select>
          <div style="width:1px;background:var(--border-color);margin:2px 4px;"></div>
          <!-- Color palette -->
          <div style="display:flex;align-items:center;gap:2px;">
            <span style="font-size:11px;color:var(--text-secondary);margin-right:2px;">Color:</span>
            <button class="blog-color-swatch" style="background:#000;" onclick="blogSetTextColor('#000000')" title="Black"></button>
            <button class="blog-color-swatch" style="background:#fff;border:1px solid #ccc;" onclick="blogSetTextColor('#ffffff')" title="White"></button>
            <button class="blog-color-swatch" style="background:#ef4444;" onclick="blogSetTextColor('#ef4444')" title="Red"></button>
            <button class="blog-color-swatch" style="background:#3b82f6;" onclick="blogSetTextColor('#3b82f6')" title="Blue"></button>
            <button class="blog-color-swatch" style="background:#22c55e;" onclick="blogSetTextColor('#22c55e')" title="Green"></button>
            <button class="blog-color-swatch" style="background:#f97316;" onclick="blogSetTextColor('#f97316')" title="Orange"></button>
            <button class="blog-color-swatch" style="background:#a855f7;" onclick="blogSetTextColor('#a855f7')" title="Purple"></button>
            <button class="blog-color-swatch" style="background:#6b7280;" onclick="blogSetTextColor('#6b7280')" title="Grey"></button>
            <input type="text" id="blogColorHex" placeholder="#hex" maxlength="7" style="width:52px;padding:2px 5px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:11px;" onblur="blogSetTextColorHex(this.value)">
          </div>
          <div style="width:1px;background:var(--border-color);margin:2px 4px;"></div>
          <!-- AI Writing -->
          <button class="blog-tb-btn blog-ai-btn" title="Write with AI" onclick="blogShowAIWriteModal()" style="background:rgba(var(--brand-accent-rgb,168,152,120),0.15);border-color:var(--brand-accent,#a89878);color:var(--brand-accent,#a89878);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/></svg>
            Write with AI
          </button>
        </div>

        <!-- Editor area -->
        <div id="blogEditor" contenteditable="true" data-placeholder="Start writing your blog post..." style="min-height:400px;padding:16px 18px;color:var(--text-primary);font-size:15px;line-height:1.7;outline:none;font-family:inherit;" oninput="updateBlogWordCount();scheduleBlogAutosave();" onmouseup="blogCheckSelection()" onkeyup="blogCheckSelection()"></div>

        <!-- Word count -->
        <div style="padding:8px 14px;border-top:1px solid var(--border-color);background:var(--bg-secondary);display:flex;gap:12px;">
          <span id="blogWordCount" style="font-size:11px;color:var(--text-tertiary);">0 words</span>
          <span id="blogReadingTime" style="font-size:11px;color:var(--text-tertiary);">0 min read</span>
          <span id="blogAutosaveStatus" style="font-size:11px;color:var(--text-tertiary);margin-left:auto;">Not saved</span>
        </div>
      </div>

      <!-- Delivery section -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">
        <button onclick="blogDeliverEmail()" style="flex:1;min-width:120px;padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Email
        </button>
        <button onclick="blogDeliverCopyHTML()" style="flex:1;min-width:120px;padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy HTML
        </button>
        <button onclick="blogDeliverPostSummary()" style="flex:1;min-width:120px;padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Post Summary
        </button>
        <button onclick="blogDeliverSaveToLibrary()" style="flex:1;min-width:120px;padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Save to Library
        </button>
      </div>

      <!-- Hidden image input for blog editor -->
      <input type="file" id="blogImageInput" accept="image/*" style="display:none;" onchange="blogHandleImageUpload(this)">

      <!-- Table insert modal -->
      <div id="blogTableModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:20px;width:240px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;color:var(--text-primary);">Insert Table</h4>
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-secondary);">Rows</label><br>
            <input type="number" id="blogTableRows" value="3" min="1" max="20" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;"></div>
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-secondary);">Columns</label><br>
            <input type="number" id="blogTableCols" value="3" min="1" max="10" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;"></div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="blogInsertTable()" style="flex:1;padding:7px;border-radius:6px;background:var(--brand-accent,#a89878);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Insert</button>
          <button onclick="document.getElementById('blogTableModal').style.display='none'" style="flex:1;padding:7px;border-radius:6px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">Cancel</button>
        </div>
      </div>

      <!-- AI Write modal -->
      <div id="blogAIWriteModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:20px;width:320px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <h4 style="margin:0 0 10px;font-size:14px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent,#a89878)" stroke-width="1.5"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg>
          Write with AI
        </h4>
        <textarea id="blogAIWritePrompt" placeholder="Describe what you want to write about..." style="width:100%;min-height:80px;padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;resize:vertical;font-family:inherit;outline:none;box-sizing:border-box;"></textarea>
        <div id="blogAIContextNote" style="font-size:11px;color:var(--brand-accent,#a89878);margin-top:6px;display:none;">Website context will be included.</div>
        <div id="blogAIWriteStatus" style="display:none;font-size:12px;color:var(--text-secondary);margin-top:6px;"></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button onclick="blogAIWrite()" id="blogAIWriteBtn" style="flex:1;padding:8px;border-radius:6px;background:var(--brand-accent,#a89878);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Generate</button>
          <button onclick="document.getElementById('blogAIWriteModal').style.display='none'" style="flex:1;padding:8px;border-radius:6px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">Cancel</button>
        </div>
      </div>

      <!-- AI selection floating toolbar -->
      <div id="blogSelectionToolbar" style="display:none;position:fixed;z-index:9999;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;gap:2px;">
        <button onclick="blogAISelectionAction('improve')" style="padding:4px 8px;border-radius:5px;border:none;background:none;color:var(--text-primary);font-size:11px;cursor:pointer;white-space:nowrap;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">Improve</button>
        <button onclick="blogAISelectionAction('expand')" style="padding:4px 8px;border-radius:5px;border:none;background:none;color:var(--text-primary);font-size:11px;cursor:pointer;white-space:nowrap;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">Expand</button>
        <button onclick="blogAISelectionAction('shorten')" style="padding:4px 8px;border-radius:5px;border:none;background:none;color:var(--text-primary);font-size:11px;cursor:pointer;white-space:nowrap;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">Shorten</button>
      </div>

    </div>
    <!-- /v25.4: Blog tab -->
```

**Steps:**
- [ ] Locate placeholder `#socialTabBlog` div (around line 57418)
- [ ] Replace it with the HTML block above
- [ ] Verify the HTML is nested correctly (still inside `.social-tab-panel`)

---

## Task 2: Blog Tab CSS

Add CSS for blog editor toolbar, color swatches, editor area styles, and placeholder text. Add in the CSS section (before `</style>`, around line 15000).

**File:** `RoweOS/dist/index.html`

**Find** a suitable CSS anchor near other social CSS. Search for `.social-tab-panel` in the CSS section to find insertion point. Add the block immediately after:

```css
/* v25.4: Blog editor styles */
.blog-tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background .15s, border-color .15s, color .15s;
}
.blog-tb-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
  color: var(--text-primary);
}
.blog-ai-btn {
  width: auto;
  padding: 0 8px;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}
.blog-color-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid transparent;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: transform .1s;
}
.blog-color-swatch:hover { transform: scale(1.2); }
#blogEditor:empty:before {
  content: attr(data-placeholder);
  color: var(--text-tertiary);
  pointer-events: none;
}
#blogEditor {
  -webkit-user-modify: read-write-plaintext-only;
  word-break: break-word;
}
#blogEditor blockquote {
  border-left: 3px solid var(--brand-accent, #a89878);
  margin: 8px 0;
  padding: 4px 0 4px 12px;
  color: var(--text-secondary);
  font-style: italic;
}
#blogEditor pre, #blogEditor code {
  font-family: monospace;
  background: var(--bg-tertiary);
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 13px;
}
#blogEditor pre { padding: 10px 14px; white-space: pre-wrap; }
#blogEditor table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}
#blogEditor td, #blogEditor th {
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  font-size: 13px;
}
#blogEditor th { background: var(--bg-secondary); font-weight: 600; }
#blogEditor img { max-width: 100%; height: auto; border-radius: 6px; margin: 4px 0; }
#blogEditor a { color: var(--brand-accent, #a89878); }
.blog-draft-card {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
  min-width: 120px;
  max-width: 160px;
  transition: border-color .15s;
}
.blog-draft-card:hover { border-color: var(--brand-accent, #a89878); }
.blog-draft-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}
.blog-draft-card-meta {
  font-size: 10px;
  color: var(--text-tertiary);
}
```

**Steps:**
- [ ] Find the CSS section (before line ~15000) and locate `.social-tab-panel` or a nearby social block
- [ ] Insert the CSS block above immediately after that rule
- [ ] Confirm no style conflicts with existing `.social-*` rules

---

## Task 3: Website Analyzer JS

Add functions to fetch a URL via the proxy, parse HTML, run content analysis, SEO scoring, and keyword extraction.

**File:** `RoweOS/dist/index.html`

**Location:** In the JS section, find `function showSocialTab(tab)` (around line 175094) and add the following block IMMEDIATELY before it:

```javascript
// v25.4: Blog Tab -- Website Analyzer
var _blogAnalysisContext = null;

function toggleBlogAnalyzer() {
  var body = document.getElementById('blogAnalyzerBody');
  var chevron = document.getElementById('blogAnalyzerChevron');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

function toggleBlogAnalysisSection(section) {
  var body = document.getElementById(section === 'content' ? 'blogContentAnalysisBody' : 'blogSeoAnalysisBody');
  var chevron = document.getElementById(section === 'content' ? 'blogContentChevron' : 'blogSeoChevron');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

async function blogAnalyzeWebsite() {
  var urlEl = document.getElementById('blogAnalyzerUrl');
  var btn = document.getElementById('blogAnalyzeBtn');
  var status = document.getElementById('blogAnalyzerStatus');
  var results = document.getElementById('blogAnalyzerResults');
  if (!urlEl) return;
  var url = (urlEl.value || '').trim();
  if (!url) { showToast('Enter a URL to analyze', 'warning'); return; }
  if (url.indexOf('http') !== 0) url = 'https://' + url;

  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
  if (status) { status.style.display = 'block'; status.textContent = 'Fetching page...'; }
  if (results) results.style.display = 'none';

  try {
    var resp = await fetch('/api/fetch-site-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, mode: 'content' })
    });
    if (!resp.ok) throw new Error('Fetch failed: HTTP ' + resp.status);
    var data = await resp.json();

    if (status) status.textContent = 'Parsing content...';
    var analysis = blogParsePageContent(data, url);

    if (status) status.textContent = 'Analyzing SEO...';
    analysis.seo = blogCalculateSEOScore(analysis);

    blogRenderAnalysisResults(analysis);
    _blogAnalysisContext = analysis;
    window._blogAnalysisContext = analysis;

    if (results) results.style.display = '';
    if (status) { status.style.display = 'none'; }
    showToast('Analysis complete', 'success');
  } catch(e) {
    console.error('[Blog Analyzer]', e);
    showToast('Could not analyze: ' + e.message, 'error');
    if (status) { status.style.display = 'none'; }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Analyze'; }
}

function blogParsePageContent(fetchData, url) {
  var html = fetchData.rawHtml || '';
  var title = fetchData.title || '';
  var description = fetchData.description || '';
  var bodyText = fetchData.content || '';

  // Parse with DOMParser if raw HTML available
  var headings = [];
  var imageCount = 0;
  var ogTags = {};
  var canonical = '';

  if (html && typeof DOMParser !== 'undefined') {
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      // Meta tags
      var metaDesc = doc.querySelector('meta[name="description"]');
      if (metaDesc) description = metaDesc.getAttribute('content') || description;
      var ogTitle = doc.querySelector('meta[property="og:title"]');
      var ogDesc = doc.querySelector('meta[property="og:description"]');
      var ogImage = doc.querySelector('meta[property="og:image"]');
      var ogType = doc.querySelector('meta[property="og:type"]');
      ogTags = {
        title: ogTitle ? ogTitle.getAttribute('content') : '',
        description: ogDesc ? ogDesc.getAttribute('content') : '',
        image: ogImage ? ogImage.getAttribute('content') : '',
        type: ogType ? ogType.getAttribute('content') : ''
      };
      var canonEl = doc.querySelector('link[rel="canonical"]');
      if (canonEl) canonical = canonEl.getAttribute('href') || '';

      // Headings
      var hEls = doc.querySelectorAll('h1,h2,h3,h4,h5,h6');
      for (var hi = 0; hi < hEls.length && hi < 30; hi++) {
        headings.push({ level: parseInt(hEls[hi].tagName[1], 10), text: (hEls[hi].textContent || '').trim() });
      }

      // Images
      imageCount = doc.querySelectorAll('img').length;

      // Body text
      var bodyEl = doc.querySelector('article') || doc.querySelector('main') || doc.body;
      if (bodyEl) {
        var clone = bodyEl.cloneNode(true);
        var scripts = clone.querySelectorAll('script,style,nav,header,footer');
        for (var si = 0; si < scripts.length; si++) scripts[si].parentNode.removeChild(scripts[si]);
        bodyText = (clone.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 3000);
      }
    } catch(pe) { console.warn('[Blog] DOMParser error', pe); }
  }

  var wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
  var keywords = blogExtractKeywords(bodyText);

  return {
    url: url,
    title: title,
    description: description,
    bodyText: bodyText,
    headings: headings,
    imageCount: imageCount,
    wordCount: wordCount,
    keywords: keywords,
    ogTags: ogTags,
    canonical: canonical
  };
}

var _blogStopWords = 'a,an,the,and,or,but,in,on,at,to,for,of,with,by,from,is,was,are,were,be,been,have,has,had,do,does,did,will,would,could,should,may,might,that,this,these,those,it,its,i,we,you,he,she,they,their,our,your,my,not,no,so,if,as,up,out,into,about,than,more,also,after,before,when,then,there,here,all,any,some,can,just,been,being,such,each,over,under,within,without,through,during,because,while,although,though,however,but,yet,nor,either,neither,both,whether,other,another,every,many,much,very,well,even,still,back,way,same,own,since,until,only,both,between,through,need,want,get,make,take,use,know,see,look,come,go,say,tell,give,find,think,feel,try,keep,let,put,set,turn,show,ask,work,seem,leave,call,become,move,live,believe,hold,bring,happen,play,run,write,provide,consider,appear,include,continue,follow,build,place,help'.split(',');

function blogExtractKeywords(text) {
  if (!text) return [];
  var words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  var freq = {};
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (w.length < 3) continue;
    if (_blogStopWords.indexOf(w) !== -1) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  var sorted = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
  var result = [];
  for (var j = 0; j < Math.min(10, sorted.length); j++) {
    result.push({ word: sorted[j], count: freq[sorted[j]] });
  }
  return result;
}

function blogCalculateSEOScore(analysis) {
  var score = 0;
  var issues = [];
  var passes = [];

  // Title length
  var titleLen = (analysis.title || '').length;
  if (titleLen >= 50 && titleLen <= 60) { score += 20; passes.push('Title length: ' + titleLen + ' chars (ideal 50-60)'); }
  else if (titleLen > 0 && titleLen < 50) { score += 10; issues.push('Title too short: ' + titleLen + ' chars (aim for 50-60)'); }
  else if (titleLen > 60) { score += 10; issues.push('Title too long: ' + titleLen + ' chars (aim for 50-60)'); }
  else { issues.push('No title tag found'); }

  // Description
  var descLen = (analysis.description || '').length;
  if (descLen >= 150 && descLen <= 160) { score += 20; passes.push('Meta description: ' + descLen + ' chars (ideal 150-160)'); }
  else if (descLen > 0 && descLen < 150) { score += 10; issues.push('Meta description short: ' + descLen + ' chars (aim for 150-160)'); }
  else if (descLen > 160) { score += 10; issues.push('Meta description long: ' + descLen + ' chars (aim for 150-160)'); }
  else { issues.push('No meta description found'); }

  // OG tags
  var ogPresent = !!(analysis.ogTags && (analysis.ogTags.title || analysis.ogTags.description || analysis.ogTags.image));
  if (ogPresent) { score += 20; passes.push('Open Graph tags present'); }
  else { issues.push('No Open Graph tags found'); }

  // Canonical
  if (analysis.canonical) { score += 10; passes.push('Canonical URL set'); }
  else { issues.push('No canonical URL found'); }

  // H1
  var h1s = (analysis.headings || []).filter(function(h) { return h.level === 1; });
  if (h1s.length === 1) { score += 20; passes.push('One H1 tag found'); }
  else if (h1s.length === 0) { issues.push('No H1 tag found'); }
  else { score += 10; issues.push('Multiple H1 tags found (' + h1s.length + ')'); }

  // Heading hierarchy
  var hasH2 = (analysis.headings || []).some(function(h) { return h.level === 2; });
  if (hasH2) { score += 10; passes.push('H2 subheadings present'); }
  else { issues.push('No H2 subheadings found'); }

  // Readability (rough: based on avg word length)
  var readability = 'Unknown';
  if (analysis.bodyText) {
    var words = analysis.bodyText.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      var avgLen = words.reduce(function(acc, w) { return acc + w.length; }, 0) / words.length;
      if (avgLen < 4.5) readability = 'Easy';
      else if (avgLen < 5.5) readability = 'Medium';
      else readability = 'Advanced';
    }
  }

  return { score: score, issues: issues, passes: passes, readability: readability };
}

function blogRenderAnalysisResults(analysis) {
  var contentEl = document.getElementById('blogContentAnalysisBody');
  var seoEl = document.getElementById('blogSeoAnalysisBody');
  if (!contentEl || !seoEl) return;

  // Content Analysis
  var ch = '';
  ch += '<div style="margin-bottom:8px;">';
  ch += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px;">' + escapeHtml(analysis.title || '(no title)') + '</div>';
  ch += '<div style="font-size:11px;color:var(--text-secondary);">' + escapeHtml((analysis.description || '').substring(0, 200) || '(no description)') + '</div>';
  ch += '</div>';
  ch += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">';
  ch += '<span style="font-size:11px;color:var(--text-tertiary);">' + analysis.wordCount + ' words</span>';
  ch += '<span style="font-size:11px;color:var(--text-tertiary);">' + analysis.imageCount + ' images</span>';
  ch += '<span style="font-size:11px;color:var(--text-tertiary);">' + (analysis.headings || []).length + ' headings</span>';
  ch += '</div>';
  if (analysis.headings && analysis.headings.length > 0) {
    ch += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Heading Structure</div>';
    ch += '<div style="margin-bottom:8px;">';
    for (var hi = 0; hi < Math.min(10, analysis.headings.length); hi++) {
      var h = analysis.headings[hi];
      ch += '<div style="padding-left:' + ((h.level - 1) * 10) + 'px;font-size:11px;color:var(--text-primary);border-left:2px solid var(--border-color);padding-left:' + (6 + (h.level - 1) * 8) + 'px;margin-bottom:2px;">H' + h.level + ': ' + escapeHtml((h.text || '').substring(0, 60)) + '</div>';
    }
    ch += '</div>';
  }
  if (analysis.keywords && analysis.keywords.length > 0) {
    ch += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Top Keywords</div>';
    ch += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
    for (var ki = 0; ki < analysis.keywords.length; ki++) {
      var kw = analysis.keywords[ki];
      ch += '<span style="padding:2px 7px;border-radius:4px;background:rgba(var(--brand-accent-rgb,168,152,120),0.12);font-size:11px;color:var(--text-primary);">' + escapeHtml(kw.word) + ' <span style="opacity:.6;">(' + kw.count + ')</span></span>';
    }
    ch += '</div>';
  }
  ch += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
  ch += '<button onclick="blogUseAsContext()" style="padding:5px 10px;border-radius:6px;background:rgba(var(--brand-accent-rgb,168,152,120),0.15);border:1px solid var(--brand-accent,#a89878);color:var(--brand-accent,#a89878);font-size:11px;font-weight:600;cursor:pointer;">Use as Context</button>';
  ch += '<button onclick="blogWriteBetterVersion()" style="padding:5px 10px;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-primary);font-size:11px;font-weight:600;cursor:pointer;">Write a Better Version</button>';
  ch += '</div>';
  contentEl.innerHTML = ch;

  // SEO Analysis
  var seo = analysis.seo || {};
  var sh = '';
  var scoreColor = seo.score >= 70 ? '#22c55e' : (seo.score >= 40 ? '#f97316' : '#ef4444');
  sh += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
  sh += '<div style="font-size:24px;font-weight:700;color:' + scoreColor + ';">' + (seo.score || 0) + '</div>';
  sh += '<div style="font-size:12px;color:var(--text-secondary);">SEO Score<br><span style="font-size:11px;color:var(--text-tertiary);">Readability: ' + escapeHtml(seo.readability || 'Unknown') + '</span></div>';
  sh += '</div>';
  if (seo.passes && seo.passes.length > 0) {
    sh += '<div style="margin-bottom:6px;">';
    for (var pi = 0; pi < seo.passes.length; pi++) {
      sh += '<div style="font-size:11px;color:#22c55e;display:flex;align-items:center;gap:4px;margin-bottom:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' + escapeHtml(seo.passes[pi]) + '</div>';
    }
    sh += '</div>';
  }
  if (seo.issues && seo.issues.length > 0) {
    sh += '<div>';
    for (var ii = 0; ii < seo.issues.length; ii++) {
      sh += '<div style="font-size:11px;color:#f97316;display:flex;align-items:center;gap:4px;margin-bottom:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' + escapeHtml(seo.issues[ii]) + '</div>';
    }
    sh += '</div>';
  }
  seoEl.innerHTML = sh;
}

function blogUseAsContext() {
  if (!_blogAnalysisContext) { showToast('Run analysis first', 'warning'); return; }
  window._blogAnalysisContext = _blogAnalysisContext;
  showToast('Website context saved for AI writing', 'success');
  // Show context note in AI write modal if open
  var note = document.getElementById('blogAIContextNote');
  if (note) note.style.display = 'block';
}

function blogWriteBetterVersion() {
  if (!_blogAnalysisContext) { showToast('Run analysis first', 'warning'); return; }
  blogUseAsContext();
  blogShowAIWriteModal();
  var promptEl = document.getElementById('blogAIWritePrompt');
  if (promptEl) {
    promptEl.value = 'Write a comprehensive, well-structured blog post that covers the same topic as the analyzed website but with better depth, clarity, and SEO optimization. Improve on their headings, add more detail, and make the content more engaging.';
  }
}
```

**Steps:**
- [ ] Find `function showSocialTab(tab)` (around line 175094)
- [ ] Insert the entire JS block immediately before it
- [ ] Verify no duplicate function names (search for `blogAnalyzeWebsite`, `blogParsePageContent`, `blogExtractKeywords`, `blogCalculateSEOScore`, `blogRenderAnalysisResults` before adding)

---

## Task 4: Rich Text Editor JS

Add all editor formatting functions, the `execCommand` workaround, and image/table/link insertion.

**File:** `RoweOS/dist/index.html`

**Location:** Immediately after the Website Analyzer block from Task 3 (before `function showSocialTab`).

```javascript
// v25.4: Blog Tab -- Rich Text Editor

function blogGetEditor() {
  return document.getElementById('blogEditor');
}

function blogExecCommand(cmd, value) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand(cmd, false, value || null);
}

function blogSetHeading(tag) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  if (tag === 'p') {
    document.execCommand('formatBlock', false, '<p>');
  } else {
    document.execCommand('formatBlock', false, '<' + tag + '>');
  }
}

function blogSetFontFamily(font) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  // Use execCommand fontName; it generates <font face="..."> which is OK for blog HTML
  document.execCommand('fontName', false, font);
}

function blogSetFontSize(sizePx) {
  if (!sizePx) return;
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  // Use size 7 as a sentinel, then replace the <font size="7"> with <span style="font-size:Npx">
  document.execCommand('fontSize', false, 7);
  var fontEls = editor.querySelectorAll('font[size="7"]');
  for (var i = 0; i < fontEls.length; i++) {
    var span = document.createElement('span');
    span.style.fontSize = sizePx + 'px';
    span.innerHTML = fontEls[i].innerHTML;
    fontEls[i].parentNode.replaceChild(span, fontEls[i]);
  }
}

function blogSetTextColor(color) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand('foreColor', false, color);
}

function blogSetTextColorHex(val) {
  if (!val) return;
  val = val.trim();
  if (val.charAt(0) !== '#') val = '#' + val;
  if (/^#[0-9a-fA-F]{3,6}$/.test(val)) blogSetTextColor(val);
}

function blogInsertLink() {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  var url = window.prompt('Enter URL:');
  if (url) {
    if (url.indexOf('http') !== 0) url = 'https://' + url;
    document.execCommand('createLink', false, url);
  }
}

function blogInsertImagePicker() {
  var input = document.getElementById('blogImageInput');
  if (input) input.click();
}

function blogHandleImageUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    var editor = blogGetEditor();
    if (!editor) return;
    editor.focus();
    var img = '<img src="' + e.target.result + '" alt="" style="max-width:100%;height:auto;">';
    document.execCommand('insertHTML', false, img);
    updateBlogWordCount();
  };
  reader.readAsDataURL(file);
  // Reset input so same file can be re-selected
  input.value = '';
}

function blogInsertCodeBlock() {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand('insertHTML', false, '<pre style="background:var(--bg-tertiary);padding:12px 14px;border-radius:6px;font-family:monospace;font-size:13px;overflow-x:auto;"><code>// code here</code></pre><p><br></p>');
}

function blogInsertHR() {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand('insertHTML', false, '<hr style="border:none;border-top:1px solid var(--border-color);margin:16px 0;">');
}

function blogShowTableModal() {
  var modal = document.getElementById('blogTableModal');
  if (modal) modal.style.display = 'block';
}

function blogInsertTable() {
  var rowsEl = document.getElementById('blogTableRows');
  var colsEl = document.getElementById('blogTableCols');
  var rows = parseInt((rowsEl && rowsEl.value) || '3', 10);
  var cols = parseInt((colsEl && colsEl.value) || '3', 10);
  if (isNaN(rows) || rows < 1) rows = 3;
  if (isNaN(cols) || cols < 1) cols = 3;

  var html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">';
  // Header row
  html += '<tr>';
  for (var c = 0; c < cols; c++) {
    html += '<th style="border:1px solid var(--border-color);padding:6px 10px;background:var(--bg-secondary);font-weight:600;font-size:13px;">Header ' + (c + 1) + '</th>';
  }
  html += '</tr>';
  // Data rows
  for (var r = 1; r < rows; r++) {
    html += '<tr>';
    for (var cc = 0; cc < cols; cc++) {
      html += '<td style="border:1px solid var(--border-color);padding:6px 10px;font-size:13px;">Cell</td>';
    }
    html += '</tr>';
  }
  html += '</table><p><br></p>';

  var editor = blogGetEditor();
  if (editor) {
    editor.focus();
    document.execCommand('insertHTML', false, html);
  }
  var modal = document.getElementById('blogTableModal');
  if (modal) modal.style.display = 'none';
}
```

**Steps:**
- [ ] Add this block immediately after the Website Analyzer JS from Task 3
- [ ] Search for duplicate function names (`blogExecCommand`, `blogSetFontSize`, `blogInsertTable`, etc.) before adding

---

## Task 5: AI Writing Assistant JS

Add the "Write with AI" modal logic and the floating selection toolbar (Improve/Expand/Shorten).

**File:** `RoweOS/dist/index.html`

**Location:** Immediately after the Rich Text Editor JS block (still before `function showSocialTab`).

```javascript
// v25.4: Blog Tab -- AI Writing Assistant

function blogShowAIWriteModal() {
  var modal = document.getElementById('blogAIWriteModal');
  if (!modal) return;
  modal.style.display = 'block';
  var note = document.getElementById('blogAIContextNote');
  if (note) note.style.display = window._blogAnalysisContext ? 'block' : 'none';
  var promptEl = document.getElementById('blogAIWritePrompt');
  if (promptEl) promptEl.focus();
}

async function blogAIWrite() {
  var promptEl = document.getElementById('blogAIWritePrompt');
  var statusEl = document.getElementById('blogAIWriteStatus');
  var btn = document.getElementById('blogAIWriteBtn');
  var userPrompt = (promptEl && promptEl.value || '').trim();
  if (!userPrompt) { showToast('Enter a prompt first', 'warning'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Calling AI...'; }

  try {
    var settings = (typeof brandSettings !== 'undefined' && brandSettings[selectedBrand]) ? brandSettings[selectedBrand] : {};
    var provider = settings.provider || 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    var apiKey = typeof getAPIKey === 'function' ? getAPIKey(provider) : '';

    var systemPrompt = 'You are an expert blog writer. Write in a clear, engaging, and well-structured style. Return the blog post as HTML using h1, h2, h3, p, ul, ol, blockquote, and strong tags as appropriate. Do not include html/body/head wrapper tags -- just the content HTML. Never use em-dashes or en-dashes; use commas, colons, semicolons, or hyphens instead.';

    var contextBlock = '';
    if (window._blogAnalysisContext) {
      var ctx = window._blogAnalysisContext;
      contextBlock = '\n\nWebsite context for reference:\nURL: ' + (ctx.url || '') +
        '\nTitle: ' + (ctx.title || '') +
        '\nDescription: ' + (ctx.description || '') +
        '\nMain content excerpt: ' + ((ctx.bodyText || '').substring(0, 1500)) +
        '\nTop keywords: ' + ((ctx.keywords || []).map(function(k) { return k.word; }).join(', '));
    }

    var messages = [{ role: 'user', content: userPrompt + contextBlock }];
    var result = '';

    if (provider === 'anthropic') {
      result = await callAnthropicAPI(model, apiKey, messages, systemPrompt);
    } else if (provider === 'openai') {
      result = await callOpenAIAPI(model, apiKey, messages, systemPrompt);
    } else if (provider === 'google') {
      if (typeof callGeminiAPI === 'function') result = await callGeminiAPI(model, apiKey, messages, systemPrompt);
    }

    if (result) {
      var editor = blogGetEditor();
      if (editor) {
        editor.focus();
        document.execCommand('insertHTML', false, result);
        updateBlogWordCount();
        scheduleBlogAutosave();
      }
      var modal = document.getElementById('blogAIWriteModal');
      if (modal) modal.style.display = 'none';
      showToast('Content generated', 'success');
    } else {
      throw new Error('No content returned from AI');
    }
  } catch(e) {
    console.error('[Blog AI]', e);
    showToast('AI error: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Generate'; }
  if (statusEl) statusEl.style.display = 'none';
}

// v25.4: Selection-based AI actions (Improve/Expand/Shorten)
var _blogSavedRange = null;

function blogCheckSelection() {
  var sel = window.getSelection ? window.getSelection() : null;
  var text = sel ? sel.toString() : '';
  var toolbar = document.getElementById('blogSelectionToolbar');
  if (!toolbar) return;

  if (text && text.length > 2) {
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    toolbar.style.display = 'flex';
    toolbar.style.top = (rect.top + window.scrollY - 44) + 'px';
    toolbar.style.left = (rect.left + window.scrollX + (rect.width / 2) - 70) + 'px';
    _blogSavedRange = range.cloneRange();
  } else {
    toolbar.style.display = 'none';
    _blogSavedRange = null;
  }
}

document.addEventListener('mousedown', function(e) {
  var toolbar = document.getElementById('blogSelectionToolbar');
  if (toolbar && !toolbar.contains(e.target)) {
    toolbar.style.display = 'none';
  }
});

async function blogAISelectionAction(action) {
  if (!_blogSavedRange) { showToast('Select some text first', 'warning'); return; }
  var selectedText = _blogSavedRange.toString();
  if (!selectedText) return;

  var toolbar = document.getElementById('blogSelectionToolbar');
  if (toolbar) toolbar.style.display = 'none';
  showToast(action.charAt(0).toUpperCase() + action.slice(1) + 'ing...', 'info');

  try {
    var settings = (typeof brandSettings !== 'undefined' && brandSettings[selectedBrand]) ? brandSettings[selectedBrand] : {};
    var provider = settings.provider || 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    var apiKey = typeof getAPIKey === 'function' ? getAPIKey(provider) : '';

    var prompts = {
      improve: 'Rewrite the following text to improve clarity, impact, and readability. Keep roughly the same length. Return only the improved HTML (no wrapper tags):',
      expand: 'Expand the following text with more detail, examples, and depth. Return only the expanded HTML (no wrapper tags):',
      shorten: 'Condense the following text to its essential points in about half the length. Return only the shortened HTML (no wrapper tags):'
    };
    var systemPrompt = 'You are an expert editor. Return only the rewritten content as clean HTML. Never use em-dashes or en-dashes.';
    var messages = [{ role: 'user', content: prompts[action] + '\n\n' + selectedText }];

    var result = '';
    if (provider === 'anthropic') result = await callAnthropicAPI(model, apiKey, messages, systemPrompt);
    else if (provider === 'openai') result = await callOpenAIAPI(model, apiKey, messages, systemPrompt);
    else if (provider === 'google' && typeof callGeminiAPI === 'function') result = await callGeminiAPI(model, apiKey, messages, systemPrompt);

    if (result && _blogSavedRange) {
      _blogSavedRange.deleteContents();
      var fragment = document.createRange().createContextualFragment(result);
      _blogSavedRange.insertNode(fragment);
      _blogSavedRange = null;
      updateBlogWordCount();
      scheduleBlogAutosave();
      showToast('Text ' + action + 'd', 'success');
    } else {
      showToast('No result from AI', 'warning');
    }
  } catch(e) {
    console.error('[Blog AI Selection]', e);
    showToast('AI error: ' + e.message, 'error');
  }
}
```

**Steps:**
- [ ] Add this block immediately after Task 4's Rich Text Editor JS
- [ ] Verify `callAnthropicAPI`, `callOpenAIAPI`, `callGeminiAPI` all exist in the codebase (they do -- confirmed at lines 79499, 79553)
- [ ] Verify `getAPIKey` function exists (search for `function getAPIKey`)

---

## Task 6: Drafts System JS

Add the auto-save, draft load/list/resume, and word count functions.

**File:** `RoweOS/dist/index.html`

**Location:** Immediately after the AI Writing Assistant JS block (still before `function showSocialTab`).

```javascript
// v25.4: Blog Tab -- Drafts System

var _blogAutosaveTimer = null;
var _blogCurrentDraftId = null;

function updateBlogWordCount() {
  var editor = blogGetEditor();
  var wordEl = document.getElementById('blogWordCount');
  var timeEl = document.getElementById('blogReadingTime');
  if (!editor || !wordEl || !timeEl) return;
  var text = (editor.textContent || editor.innerText || '').trim();
  var words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  var minutes = Math.max(1, Math.round(words / 200));
  wordEl.textContent = words + ' word' + (words !== 1 ? 's' : '');
  timeEl.textContent = minutes + ' min read';
}

function scheduleBlogAutosave() {
  clearTimeout(_blogAutosaveTimer);
  _blogAutosaveTimer = setTimeout(function() {
    autosaveBlogDraft();
  }, 2000);
}

function autosaveBlogDraft() {
  var editor = blogGetEditor();
  var titleEl = document.getElementById('blogTitleInput');
  if (!editor) return;

  var htmlContent = editor.innerHTML || '';
  var title = (titleEl && titleEl.value) || '';
  var text = (editor.textContent || editor.innerText || '').trim();
  var wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  // Skip saving empty posts
  if (!htmlContent.replace(/<[^>]+>/g, '').trim() && !title) return;

  try {
    var drafts = JSON.parse(localStorage.getItem('roweos_blog_drafts') || '[]');
    var now = new Date().toISOString();

    if (_blogCurrentDraftId) {
      var found = false;
      for (var i = 0; i < drafts.length; i++) {
        if (drafts[i].id === _blogCurrentDraftId) {
          drafts[i].title = title;
          drafts[i].htmlContent = htmlContent;
          drafts[i].wordCount = wordCount;
          drafts[i].updatedAt = now;
          drafts[i].analysisContext = window._blogAnalysisContext || null;
          found = true;
          break;
        }
      }
      if (!found) {
        // Draft was deleted -- create new
        _blogCurrentDraftId = null;
      }
    }

    if (!_blogCurrentDraftId) {
      _blogCurrentDraftId = 'blog_' + Date.now();
      drafts.unshift({
        id: _blogCurrentDraftId,
        title: title,
        htmlContent: htmlContent,
        wordCount: wordCount,
        createdAt: now,
        updatedAt: now,
        analysisContext: window._blogAnalysisContext || null
      });
    }

    // Keep max 20 drafts
    if (drafts.length > 20) drafts = drafts.slice(0, 20);
    localStorage.setItem('roweos_blog_drafts', JSON.stringify(drafts));

    var statusEl = document.getElementById('blogAutosaveStatus');
    if (statusEl) {
      var d = new Date();
      statusEl.textContent = 'Saved ' + d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    renderBlogDraftsList();
  } catch(e) { console.warn('[Blog autosave]', e); }
}

function renderBlogDraftsList() {
  var container = document.getElementById('blogDraftsList');
  if (!container) return;
  var drafts = [];
  try { drafts = JSON.parse(localStorage.getItem('roweos_blog_drafts') || '[]'); } catch(e) {}

  if (!drafts || drafts.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-tertiary);padding:8px 0;">No drafts yet. Start writing to auto-save.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < drafts.length; i++) {
    var d = drafts[i];
    var dateStr = '';
    try {
      var dt = new Date(d.updatedAt || d.createdAt);
      dateStr = (dt.getMonth() + 1) + '/' + dt.getDate();
    } catch(e) {}
    var isActive = d.id === _blogCurrentDraftId;
    html += '<div class="blog-draft-card" style="' + (isActive ? 'border-color:var(--brand-accent,#a89878);' : '') + '" onclick="blogLoadDraft(\'' + d.id + '\')" data-id="' + d.id + '">';
    html += '<div class="blog-draft-card-title">' + escapeHtml(d.title || 'Untitled') + '</div>';
    html += '<div class="blog-draft-card-meta">' + (d.wordCount || 0) + ' words &middot; ' + dateStr + '</div>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function blogLoadDraft(id) {
  var drafts = [];
  try { drafts = JSON.parse(localStorage.getItem('roweos_blog_drafts') || '[]'); } catch(e) {}
  var draft = null;
  for (var i = 0; i < drafts.length; i++) {
    if (drafts[i].id === id) { draft = drafts[i]; break; }
  }
  if (!draft) { showToast('Draft not found', 'error'); return; }

  var editor = blogGetEditor();
  var titleEl = document.getElementById('blogTitleInput');
  if (editor) editor.innerHTML = draft.htmlContent || '';
  if (titleEl) titleEl.value = draft.title || '';
  _blogCurrentDraftId = id;
  if (draft.analysisContext) {
    window._blogAnalysisContext = draft.analysisContext;
    _blogAnalysisContext = draft.analysisContext;
  }
  updateBlogWordCount();
  renderBlogDraftsList();
  showToast('Draft loaded', 'success');
}

function blogNewPost() {
  var editor = blogGetEditor();
  var titleEl = document.getElementById('blogTitleInput');
  if (editor) editor.innerHTML = '';
  if (titleEl) titleEl.value = '';
  _blogCurrentDraftId = null;
  window._blogAnalysisContext = null;
  _blogAnalysisContext = null;
  updateBlogWordCount();
  var statusEl = document.getElementById('blogAutosaveStatus');
  if (statusEl) statusEl.textContent = 'Not saved';
  if (editor) editor.focus();
}

function initBlogTab() {
  renderBlogDraftsList();
  updateBlogWordCount();
  var statusEl = document.getElementById('blogAutosaveStatus');
  if (statusEl && !_blogCurrentDraftId) statusEl.textContent = 'Not saved';
}
```

**Steps:**
- [ ] Add this block after Task 5's AI Writing Assistant JS (still before `function showSocialTab`)
- [ ] Confirm no duplicate: `autosaveBlogDraft`, `blogLoadDraft`, `renderBlogDraftsList`, `blogNewPost`, `initBlogTab`

---

## Task 7: Delivery Options JS

Add the four delivery functions: Email, Copy HTML, Post Summary, Save to Library.

**File:** `RoweOS/dist/index.html`

**Location:** Immediately after the Drafts System JS block (still before `function showSocialTab`).

```javascript
// v25.4: Blog Tab -- Delivery Options

function blogDeliverEmail() {
  var titleEl = document.getElementById('blogTitleInput');
  var editor = blogGetEditor();
  if (!editor) return;
  var subject = (titleEl && titleEl.value) || 'Blog Post';
  var bodyHtml = editor.innerHTML || '';
  if (!bodyHtml.replace(/<[^>]+>/g, '').trim()) {
    showToast('Nothing to email -- write something first', 'warning');
    return;
  }
  // Navigate to Mail > Compose and pre-fill
  showView('mail');
  setTimeout(function() {
    if (typeof switchMailTab === 'function') switchMailTab('compose');
    setTimeout(function() {
      var subEl = document.getElementById('mailComposeSubject');
      var bodyEl = document.getElementById('mailComposeBody');
      if (subEl) subEl.value = subject;
      if (bodyEl) {
        bodyEl.innerHTML = bodyHtml;
        bodyEl.style.minHeight = '200px';
      }
      window._mailTransferredHtml = bodyHtml;
      showToast('Blog loaded into Mail compose', 'success');
    }, 200);
  }, 100);
}

function blogDeliverCopyHTML() {
  var editor = blogGetEditor();
  if (!editor) return;
  var html = editor.innerHTML || '';
  if (!html.replace(/<[^>]+>/g, '').trim()) {
    showToast('Nothing to copy -- write something first', 'warning');
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(html).then(function() {
        showToast('HTML copied to clipboard', 'success');
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = html;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('HTML copied to clipboard', 'success');
    }
  } catch(e) {
    showToast('Copy failed: ' + e.message, 'error');
  }
}

async function blogDeliverPostSummary() {
  var titleEl = document.getElementById('blogTitleInput');
  var editor = blogGetEditor();
  if (!editor) return;
  var htmlContent = editor.innerHTML || '';
  var textContent = (editor.textContent || editor.innerText || '').trim();
  if (!textContent) {
    showToast('Write something first', 'warning');
    return;
  }

  showToast('Summarizing for social...', 'info');

  try {
    var settings = (typeof brandSettings !== 'undefined' && brandSettings[selectedBrand]) ? brandSettings[selectedBrand] : {};
    var provider = settings.provider || 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    var apiKey = typeof getAPIKey === 'function' ? getAPIKey(provider) : '';

    var title = (titleEl && titleEl.value) || '';
    var excerpt = textContent.substring(0, 3000);
    var prompt = 'Summarize this blog post in exactly two formats:\n1. X/Twitter: under 280 characters, punchy and engaging\n2. Threads: under 500 characters, conversational\n\nReturn ONLY a JSON object with keys "x" and "threads".\n\nBlog title: ' + title + '\n\nContent:\n' + excerpt;

    var systemPrompt = 'Return only valid JSON. No markdown fences. Never use em-dashes or en-dashes.';
    var messages = [{ role: 'user', content: prompt }];

    var result = '';
    if (provider === 'anthropic') result = await callAnthropicAPI(model, apiKey, messages, systemPrompt);
    else if (provider === 'openai') result = await callOpenAIAPI(model, apiKey, messages, systemPrompt);
    else if (provider === 'google' && typeof callGeminiAPI === 'function') result = await callGeminiAPI(model, apiKey, messages, systemPrompt);

    var parsed = {};
    try {
      var clean = result.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(pe) {
      // Fallback: use raw result as X text
      parsed = { x: result.substring(0, 280), threads: result.substring(0, 500) };
    }

    // Extract first image from blog if available
    var firstImg = null;
    var imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) firstImg = imgMatch[1];

    // Navigate to Publish tab with pre-filled content
    window._socialPublisherContent = parsed.x || parsed.threads || result;
    if (firstImg) window._socialPublisherImage = firstImg;
    showView('social');
    showSocialTab('publish');
    setTimeout(function() {
      if (typeof renderPublishTab === 'function') renderPublishTab();
      // Set per-platform texts
      var xEl = document.getElementById('publishPlatformText_x');
      var threadsEl = document.getElementById('publishPlatformText_threads');
      if (xEl && parsed.x) xEl.value = parsed.x;
      if (threadsEl && parsed.threads) threadsEl.value = parsed.threads;
      // Show per-platform editor
      var perPlat = document.getElementById('publishPerPlatformEdits');
      if (perPlat) perPlat.style.display = 'block';
      showToast('Summary posted to Publish', 'success');
    }, 100);

  } catch(e) {
    console.error('[Blog Post Summary]', e);
    showToast('AI error: ' + e.message, 'error');
  }
}

function blogDeliverSaveToLibrary() {
  var titleEl = document.getElementById('blogTitleInput');
  var editor = blogGetEditor();
  if (!editor) return;
  var htmlContent = editor.innerHTML || '';
  var text = (editor.textContent || editor.innerText || '').trim();
  if (!text) { showToast('Write something first', 'warning'); return; }

  var title = (titleEl && titleEl.value) || 'Untitled Blog Post';
  var wordCount = text.split(/\s+/).filter(Boolean).length;
  var readingTime = Math.max(1, Math.round(wordCount / 200)) + ' min read';

  try {
    var lib = JSON.parse(localStorage.getItem('roweos_library') || '[]');
    var item = {
      id: 'lib_blog_' + Date.now(),
      type: 'blog',
      title: title,
      content: htmlContent,
      wordCount: wordCount,
      readingTime: readingTime,
      createdAt: new Date().toISOString()
    };
    lib.unshift(item);
    localStorage.setItem('roweos_library', JSON.stringify(lib));
    // Sync to Firestore
    if (typeof writeDB === 'function') {
      writeDB('library/brand', { data: JSON.stringify(lib) }, { category: 'library' });
    }
    showToast('Blog saved to Library', 'success');
  } catch(e) {
    console.error('[Blog Save Library]', e);
    showToast('Save failed: ' + e.message, 'error');
  }
}
```

**Steps:**
- [ ] Add this block after the Drafts System JS from Task 6
- [ ] Confirm no duplicate function names

---

## Task 8: Wire Up `showSocialTab` to `initBlogTab`

**File:** `RoweOS/dist/index.html`

**Find** (around line 175105-175111):
```javascript
  // v25.4: Render tab content on switch
  if (tab === 'publish' && typeof renderPublishTab === 'function') renderPublishTab();
  if (tab === 'media' && typeof showMediaSubTab === 'function') showMediaSubTab('image');
  if (tab === 'settings' && typeof renderSocialSettings === 'function') renderSocialSettings();
  if (tab === 'engage' && typeof initEngageTab === 'function') initEngageTab();
  if (tab === 'activity' && typeof initSocialActivityLog === 'function') initSocialActivityLog();
```

**Replace with:**
```javascript
  // v25.4: Render tab content on switch
  if (tab === 'publish' && typeof renderPublishTab === 'function') renderPublishTab();
  if (tab === 'media' && typeof showMediaSubTab === 'function') showMediaSubTab('image');
  if (tab === 'settings' && typeof renderSocialSettings === 'function') renderSocialSettings();
  if (tab === 'engage' && typeof initEngageTab === 'function') initEngageTab();
  if (tab === 'activity' && typeof initSocialActivityLog === 'function') initSocialActivityLog();
  if (tab === 'blog' && typeof initBlogTab === 'function') initBlogTab();
```

**Steps:**
- [ ] Locate the five `if (tab === ...)` lines inside `showSocialTab`
- [ ] Add the `blog` line as shown above

---

## Task 9: Deploy

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
./deploy.sh
```

If deploy.sh fails on git push, use the manual fallback:
```bash
export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)"
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project/RoweOS/dist"
npx vercel --prod
```

**Steps:**
- [ ] Run `./deploy.sh` from the project root
- [ ] Confirm Vercel deploy URL returns 200
- [ ] Open Social Hub > Blog tab and verify:
  - [ ] Drafts bar renders (shows "No drafts yet" initially)
  - [ ] "New Post" button clears editor
  - [ ] Website Analyzer expands/collapses on click
  - [ ] Entering a URL and clicking Analyze runs the fetch
  - [ ] Content Analysis and SEO sections render results
  - [ ] "Use as Context" toast appears
  - [ ] Rich text toolbar buttons work (Bold, Italic, font size, color)
  - [ ] Font size workaround replaces `<font size="7">` with `<span style="font-size:Npx">`
  - [ ] Insert Table modal opens, inserts an HTML table
  - [ ] "Write with AI" opens modal, generates content
  - [ ] Selecting text shows floating Improve/Expand/Shorten toolbar
  - [ ] Auto-save fires after typing (check localStorage `roweos_blog_drafts`)
  - [ ] Draft cards appear in drafts bar; clicking a card reloads it
  - [ ] Email button navigates to Mail > Compose with subject + body pre-filled
  - [ ] Copy HTML copies innerHTML to clipboard
  - [ ] Post Summary navigates to Publish tab with caption pre-filled
  - [ ] Save to Library writes to `roweos_library` localStorage

---

## Quick Reference: Key IDs and Functions

| ID | Purpose |
|---|---|
| `#socialTabBlog` | Blog tab panel (replaces placeholder) |
| `#blogDraftsList` | Draft card scroll row |
| `#blogAnalyzerBody` | Collapsible analyzer body |
| `#blogAnalyzerUrl` | URL input |
| `#blogAnalyzerResults` | Results container (hidden until analyzed) |
| `#blogContentAnalysisBody` | Content analysis HTML output |
| `#blogSeoAnalysisBody` | SEO analysis HTML output |
| `#blogEditor` | `contenteditable` editor div |
| `#blogTitleInput` | Blog post title input |
| `#blogWordCount` / `#blogReadingTime` | Stats display |
| `#blogAutosaveStatus` | "Saved HH:MM" label |
| `#blogTableModal` | Table insert modal |
| `#blogAIWriteModal` | AI write prompt modal |
| `#blogSelectionToolbar` | Floating Improve/Expand/Shorten toolbar |
| `#blogImageInput` | Hidden file input for image upload |

| Function | Purpose |
|---|---|
| `blogAnalyzeWebsite()` | Fetches URL via proxy, parses, renders |
| `blogParsePageContent(data, url)` | DOMParser extraction |
| `blogExtractKeywords(text)` | Frequency analysis, returns top 10 |
| `blogCalculateSEOScore(analysis)` | Scores meta/heading/OG, returns issues/passes |
| `blogRenderAnalysisResults(analysis)` | Renders both analysis sections |
| `blogExecCommand(cmd, value)` | Wrapper for `document.execCommand` |
| `blogSetFontSize(sizePx)` | `execCommand('fontSize',7)` + replace `<font size="7">` with `<span>` |
| `blogSetFontFamily(font)` | `execCommand('fontName', font)` |
| `blogSetTextColor(color)` | `execCommand('foreColor', color)` |
| `blogInsertTable()` | Inserts NxM table from modal values |
| `blogInsertLink()` | `window.prompt` + `execCommand('createLink')` |
| `blogHandleImageUpload(input)` | FileReader -> base64 -> `insertHTML` |
| `blogAIWrite()` | Calls brand AI provider, inserts HTML result |
| `blogCheckSelection()` | Shows/positions floating selection toolbar |
| `blogAISelectionAction(action)` | Improve/Expand/Shorten via AI, replaces range |
| `updateBlogWordCount()` | Counts words, calculates reading time |
| `scheduleBlogAutosave()` | Debounced 2s autosave trigger |
| `autosaveBlogDraft()` | Saves to `roweos_blog_drafts` localStorage |
| `renderBlogDraftsList()` | Renders draft cards in `#blogDraftsList` |
| `blogLoadDraft(id)` | Loads draft HTML/title into editor |
| `blogNewPost()` | Clears editor for fresh post |
| `initBlogTab()` | Called by `showSocialTab('blog')` |
| `blogDeliverEmail()` | `showView('mail')` + `switchMailTab('compose')` + pre-fill |
| `blogDeliverCopyHTML()` | `navigator.clipboard.writeText(editor.innerHTML)` |
| `blogDeliverPostSummary()` | AI summarize -> `window._socialPublisherContent` -> Publish tab |
| `blogDeliverSaveToLibrary()` | Writes to `roweos_library` localStorage + Firestore `writeDB` |
