# Social Hub Phase 2B-3: Blog Tab (Website Analyzer + Rich Text Writer)

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Build the Blog tab with website content/SEO/competitive analysis, a full rich text editor with AI writing assistant, and four delivery options (email, copy HTML, post summary, save to Library).

---

## Design

### 1. Overall Layout

The Blog tab has four sections stacked vertically:

1. **Drafts bar** (top) -- saved drafts with resume editing
2. **Website Analyzer** (collapsible) -- URL input + content/SEO/competitive analysis
3. **Rich Text Editor** (main) -- formatting toolbar + contenteditable editor + AI writing tools
4. **Delivery section** (bottom) -- Email, Copy HTML, Post Summary, Save to Library

---

### 2. Drafts Bar

- Horizontal scrollable row of saved draft cards at the top
- Each card shows: title (or "Untitled"), word count, date
- Click to load draft into the editor
- "New Post" button to start fresh
- Auto-save every 30 seconds to localStorage: `roweos_blog_drafts` (JSON array)
- Draft data model:
  ```
  {
    id: string,
    title: string,
    htmlContent: string,
    wordCount: number,
    createdAt: string,
    updatedAt: string,
    analysisContext: object  // saved website analysis if used
  }
  ```

---

### 3. Website Analyzer

#### Layout

- URL input bar: `<input placeholder="Enter a URL to analyze...">` + "Analyze" button
- Results in two collapsible sections below

#### Content Analysis Section

- Fetches page via existing `/api/fetch-site-meta.js` proxy (avoids CORS)
- Extracts and displays:
  - Page title and meta description
  - Main body text (first 2000 chars)
  - Heading structure (H1-H6 hierarchy)
  - Image count
  - Word count
  - Key topics/phrases (top 10 by frequency)
- "Use as context" button: stores the extracted content in `window._blogAnalysisContext` for the AI to reference when writing

#### SEO + Competitive Analysis Section

- Meta tags audit: title length (ideal 50-60 chars), description length (ideal 150-160), OG tags present, canonical URL
- Heading hierarchy: proper nesting check
- Keyword density: top 10 words/phrases with frequency counts
- Readability: estimated reading level based on sentence length and word complexity
- "Write a better version" button: prompts the AI with the analyzed content + instructions to create an improved, more comprehensive blog post

#### Implementation

- All analysis is client-side: proxy fetches HTML, JS parses it using DOMParser
- `analyzeWebsite(url)` -- main function, returns analysis object
- `renderAnalysisResults(analysis)` -- renders both sections
- `parsePageContent(html)` -- extracts text, headings, meta from HTML string
- `calculateSEOScore(analysis)` -- scores meta tags, headings, etc.
- `extractKeywords(text)` -- frequency analysis of meaningful words (excludes stop words)

---

### 4. Rich Text Editor

#### Formatting Toolbar

Two rows of toolbar buttons:

**Row 1 (Text formatting):**
- Bold (B), Italic (I), Underline (U), Strikethrough (S)
- Heading dropdown: H1, H2, H3, Paragraph
- Bullet list, Numbered list
- Align: Left, Center, Right, Justify

**Row 2 (Insert + Style):**
- Link (chain icon) -- prompt for URL
- Image (upload from device, or pick from Library)
- Blockquote
- Code block
- Horizontal rule
- Table (insert NxM grid)
- Font family dropdown: Sans-serif (default), Serif, Monospace, Geist Sans, Geist Mono
- Font size dropdown: 12, 14, 16, 18, 20, 24, 28, 32, 36, 48
- Text color picker (simple palette: black, white, red, blue, green, orange, purple, grey + custom hex input)

#### Editor Area

- `contenteditable="true"` div (same approach as Mail compose)
- Styled with `min-height: 400px`, proper typography, padding
- Placeholder text: "Start writing your blog post..."
- Word count + estimated reading time displayed below editor
- Title input above editor: `<input placeholder="Blog post title...">`

#### AI Writing Assistant (integrated into toolbar)

- "Write with AI" button (sparkle icon) in toolbar:
  - Opens a small prompt input overlay/modal
  - User describes what they want
  - AI generates full blog post as formatted HTML
  - Uses `_blogAnalysisContext` if website was analyzed
  - Inserts generated content into editor
  - Uses current brand's AI provider/model

- Selection-based actions (appear when text is selected):
  - "Improve" -- AI rewrites selected text for clarity/impact
  - "Expand" -- AI expands the selection with more detail
  - "Shorten" -- AI condenses the selection
  - **Implementation:** Listen for `mouseup` on the editor. If `window.getSelection().toString()` is non-empty, show a floating toolbar near the selection with Improve/Expand/Shorten buttons. To replace: save the range, get AI result, call `range.deleteContents()` then insert the new HTML via `range.insertNode()`. Hide floating toolbar on `mousedown` outside it.

#### Implementation

All formatting uses `document.execCommand()` (standard for contenteditable):
- `blogExecCommand(cmd, value)` -- wrapper for execCommand with value
- `blogInsertLink()` -- prompt for URL, insert anchor
- `blogInsertImage()` -- file picker or Library modal, insert img tag
- `blogInsertTable(rows, cols)` -- insert HTML table
- `blogSetFontFamily(font)` -- execCommand('fontName', font)
- `blogSetFontSize(size)` -- `execCommand('fontSize')` only accepts values 1-7 (not pixel values). Workaround: call `execCommand('fontSize', false, 7)`, then find the generated `<font size="7">` element and replace it with `<span style="font-size:{size}px">`. Same approach needed for `fontName` which generates `<font face="...">` tags.
- `blogSetTextColor(color)` -- execCommand('foreColor', color)
- `blogAIWrite(prompt)` -- call AI, insert result as HTML
- `blogAIImprove/Expand/Shorten(selectedText)` -- call AI, replace selection
- `updateBlogWordCount()` -- count words, calc reading time (200 wpm)
- `autosaveBlogDraft()` -- save current editor state to localStorage. Uses `setInterval(autosaveBlogDraft, 30000)`. Clear interval when leaving Blog tab (`clearInterval` in tab-switch logic).
- `blogInsertTable(rows, cols)` -- show a small modal with rows/cols number inputs (default 3x3), insert an HTML table with borders

---

### 5. Delivery Options

Four buttons below the editor:

#### Email
- Opens a modal pre-filled with:
  - Subject: blog title
  - Body: editor HTML content
  - To: empty (user enters recipient)
- Uses existing Mail compose infrastructure: navigates to Mail view, switches to Compose tab, pre-fills subject and body. The Mail system handles sending via Gmail API or MS Graph. Call `showView('mail')` then populate the compose fields programmatically.
- Formats the blog HTML with email-safe inline styles

#### Copy HTML
- Copies `blogEditor.innerHTML` to clipboard
- Shows toast: "HTML copied to clipboard"

#### Post Summary
- Calls AI: "Summarize this blog post in under 280 characters for X and 500 characters for Threads"
- Navigates to Publish tab with summary pre-filled
- Attaches first image from blog content if available

#### Save to Library
- Extracts blog title, HTML content, word count, reading time
- Creates a Library item:
  ```
  {
    title: blogTitle,
    type: 'blog',
    content: htmlContent,
    wordCount: number,
    readingTime: string,
    createdAt: ISO string
  }
  ```
- Uses existing Library save mechanism (implementer must search for the actual Library add function in index.html -- look for `addLibraryItem`, `saveLibraryItem`, or `libraryItems.push`). If no suitable function exists, create a simple one that writes to `roweos_library` localStorage + Firestore `library` subcollection.
- Shows toast: "Blog saved to Library"

---

## Files to Modify

| File | Change |
|---|---|
| `RoweOS/dist/index.html` | (1) Replace Blog placeholder with Drafts bar + Website Analyzer + Rich Text Editor + Delivery section HTML. (2) Add CSS for blog editor toolbar, editor area, analysis cards. (3) Add JS: website analyzer (fetch, parse, analyze, render), editor (formatting commands, AI writing, autosave, word count), delivery (email, copy, post summary, save to library), drafts (load, save, list, resume). (4) Update `showSocialTab()` to call `initBlogTab()`. |

---

## Out of Scope

- Server-side blog hosting / CMS
- Blog scheduling (future feature)
- Collaborative editing
- Blog templates / themes
- RSS feed generation
- SEO optimization of the user's own blog (this analyzes OTHER sites)
