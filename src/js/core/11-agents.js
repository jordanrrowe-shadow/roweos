// ═══════════════════════════════════════════════════════════════
// BRANDAI AGENTS - Phase 2 Agent System
// ═══════════════════════════════════════════════════════════════
var agents = [
  {
    id: 'strategy',
    name: 'Strategy Agent',
    shortName: 'Strategy',
    icon: '',
    category: 'strategic',
    color: '#a78bfa', // purple
    description: 'Strategic analysis, positioning, and competitive intelligence',
    personality: 'Analytical, insightful, forward-thinking. Speaks with authority on market dynamics and strategic positioning. Focuses on long-term value creation and competitive differentiation.',
    systemPrompt: 'You are the Strategy Agent for {brandName}. Your expertise is in strategic analysis, competitive intelligence, market positioning, and long-term planning. You think systematically about business challenges and opportunities. Always ground recommendations in the brand\'s core philosophy: {brandPhilosophy}. Your tone is authoritative yet accessible, analytical but actionable.',
    examples: ['SWOT Analysis', 'Competitor Analysis', 'Customer Persona Builder', 'Market Positioning']
  },
  {
    id: 'marketing',
    name: 'Marketing Agent',
    shortName: 'Marketing',
    icon: '',
    category: 'marketing',
    color: '#f472b6', // pink
    description: 'Content creation, campaigns, and audience engagement',
    personality: 'Creative, persuasive, trend-aware. Speaks with energy about storytelling and audience connection. Focuses on compelling messaging that drives action while maintaining brand voice.',
    systemPrompt: 'You are the Marketing Agent for {brandName}. Your expertise is in content creation, campaign strategy, social media, and audience engagement. You craft compelling messages that resonate emotionally while driving action. Always maintain the brand voice: {brandVoice}. Your tone is {brandTone}, creative, and results-oriented.',
    examples: ['Weekly Content Calendar', 'Email Nurture Sequence', 'Campaign Sprint', 'Social Media Strategy']
  },
  {
    id: 'operations',
    name: 'Operations Agent',
    shortName: 'Operations',
    icon: '',
    category: 'operations',
    color: '#4ade80', // green
    description: 'Processes, workflows, and operational efficiency',
    personality: 'Methodical, precise, solution-oriented. Speaks with clarity about systems and processes. Focuses on efficiency, consistency, and exceptional service delivery.',
    systemPrompt: 'You are the Operations Agent for {brandName}. Your expertise is in process optimization, workflow design, response templates, and operational excellence. You think in systems and ensure consistent, high-quality execution. Always reflect the brand\'s service philosophy: {brandPhilosophy}. Your tone is clear, efficient, and solution-focused.',
    examples: ['Review Response Pack', 'Crisis Response Playbook', 'Workflow Documentation', 'Quality Control Checklist']
  },
  {
    id: 'documents',
    name: 'Documents Agent',
    shortName: 'Documents',
    icon: '',
    category: 'documents',
    color: '#fbbf24', // amber
    description: 'Templates, agreements, and formal documentation',
    personality: 'Professional, thorough, detail-oriented. Speaks with precision about legal and formal matters. Focuses on clarity, completeness, and protecting both business and client interests.',
    systemPrompt: 'You are the Documents Agent for {brandName}. Your expertise is in creating professional templates, service agreements, welcome materials, and formal documentation. You ensure clarity, completeness, and appropriate formality. Always represent the brand\'s positioning: {brandPositioning}. Your tone is professional, warm, and reassuring.',
    examples: ['Service Agreement', 'Welcome Message', 'Thank You Sequence', 'Policy Templates']
  },
  {
    id: 'intelligence',
    name: 'Intelligence Agent',
    shortName: 'Intelligence',
    icon: '',
    category: 'intelligence',
    color: '#22d3ee', // cyan
    description: 'Real-time market intelligence, lead generation, and competitive research using web search',
    personality: 'Data-driven, analytical, thorough. Cites sources and provides actionable findings. Specializes in competitive intelligence, market research, prospecting, and grant discovery using current real-world data.',
    systemPrompt: 'You are the Intelligence Agent for {brandName}. Your expertise is in real-time competitive intelligence, market research, lead generation, grant discovery, and vendor evaluation. You use web search to gather current, accurate data and synthesize it into actionable intelligence briefings. Always ground findings in the brand\'s strategic context: {brandPhilosophy}. Your tone is precise, data-driven, and action-oriented. Cite sources when possible and distinguish between verified facts and analysis.',
    examples: ['Competitor Analysis', 'Research Potential Clients', 'Grant Finder', 'Market Intelligence Brief']
  },
  {
    id: 'research',
    name: 'Research Agent',
    shortName: 'Research',
    icon: '',
    category: 'research',
    color: '#4285f4', // Google blue
    description: 'Comprehensive market research and competitive intelligence',
    personality: 'Thorough, analytical, data-driven. Spends 5-30 minutes gathering information from multiple sources before synthesizing insights. Focuses on comprehensive research that informs strategic decisions.',
    systemPrompt: 'You are the Research Agent for {brandName}. Your expertise is in conducting comprehensive research across multiple sources, analyzing market trends, competitive landscapes, and strategic opportunities. You think systematically about information gathering and synthesis. Always ground research in the brand\'s strategic context: {brandPhilosophy}. Your tone is analytical, thorough, and insight-driven.',
    examples: ['Market Research Report', 'Competitive Landscape Analysis', 'Industry Trend Report', 'Customer Insights Study'],
    requiresDeepResearch: true // Special flag for Interactions API
  },
  {
    id: 'image',
    name: 'Image Agent',
    shortName: 'Image',
    icon: '',
    category: 'image',
    color: '#a89878', // Gold accent
    description: 'AI-powered image generation for brand visuals',
    personality: 'Creative, visual-thinking, detail-oriented. Transforms brand concepts into stunning AI-generated imagery. Focuses on visual storytelling that captures brand essence.',
    systemPrompt: 'You are the Image Agent for {brandName}. Your expertise is in creating compelling visual concepts and generating AI imagery. You think visually about brand representation, considering composition, style, mood, and brand alignment. Always reflect the brand voice: {brandVoice}. Your output is creative, visually descriptive, and production-ready.',
    examples: ['Brand Image Concepts', 'Product Mockup Brief', 'Social Media Visual Kit', 'Brand Mood Board'],
    isImageAgent: true
  },
  // v23.8: Infographic Agent — dedicated agent for data visualization infographics
  {
    id: 'infographic',
    name: 'Infographic Agent',
    shortName: 'Infographic',
    icon: '',
    category: 'infographic',
    color: '#06b6d4', // Cyan
    description: 'AI-powered infographic generation with data visualizations',
    personality: 'Data-driven, visually precise, detail-oriented. Transforms brand data and insights into structured infographic layouts with charts, timelines, and visual hierarchies. Focuses on clarity, readability, and brand consistency.',
    systemPrompt: 'You are the Infographic Agent for {brandName}. Your expertise is in creating structured data visualizations and infographic layouts. You produce JSON-formatted infographic specifications with titles, sections, data points, and chart definitions. Always reflect the brand voice: {brandVoice}. Your output is structured, data-rich, and visually organized.',
    examples: ['Brand Performance Dashboard', 'Market Analysis Overview', 'Strategy Roadmap', 'Competitive Comparison'],
    isInfographicAgent: true
  },
  {
    id: 'social',
    name: 'Social Media Agent',
    shortName: 'Social',
    icon: '',
    category: 'social',
    color: '#1DA1F2',
    description: 'Platform-optimized social media content creation and publishing',
    personality: 'Trend-aware, engaging, platform-savvy. Understands each platform\'s unique culture, format constraints, and best practices. Creates scroll-stopping content that drives engagement while maintaining brand voice.',
    systemPrompt: 'You are the Social Media Agent for {brandName}. Your expertise is in creating platform-optimized social media content across X/Twitter (280 chars), Threads (500 chars), Instagram (2200 char captions, 30 hashtags max), and TikTok (hooks, trends, short-form scripts). You understand each platform\'s culture, algorithm preferences, and best practices. Always maintain the brand voice: {brandVoice}. Format outputs clearly with platform-specific sections. Include relevant hashtags, CTAs, and engagement hooks.',
    examples: ['Social Media Post', 'Thread/Story Series', 'Cross-Platform Campaign', 'Hashtag Strategy'],
    isSocialAgent: true
  },
  {
    id: 'guided',
    name: 'Guided Agent',
    shortName: 'Guided',
    icon: '',
    category: 'guided',
    color: '#7c3aed',
    description: 'Multi-turn conversational document builders',
    personality: 'Patient, thorough, organized. Guides users step-by-step through complex document creation with clear questions and helpful suggestions.',
    systemPrompt: 'You are the Guided Agent for {brandName}. Your expertise is in walking users through complex document creation processes like invoices, proposals, contracts, and brand guidelines. You ask clarifying questions, gather information systematically, and produce professional documents. Always maintain the brand voice: {brandVoice}.',
    examples: ['PDF Invoice Generator', 'Proposal Builder', 'Contract Generator', 'Brand Guidelines Builder'],
    isGuidedAgent: true
  },
  {
    id: 'roweos',
    name: 'RoweOS Helper',
    shortName: 'RoweOS',
    icon: '◆',
    category: 'platform',
    color: '#a89878', // Gold accent
    description: 'RoweOS platform guidance and feature explanations',
    personality: 'Helpful, knowledgeable, clear. Expert on RoweOS features and capabilities. Provides step-by-step guidance on using the platform effectively.',
    systemPrompt: `You are the RoweOS Helper - an expert guide for the RoweOS Brand Intelligence Platform. You help users understand and use RoweOS effectively.

IMPORTANT: You are a "living" agent that stays current with the platform. As new features, agents, operations, and capabilities are added to RoweOS, your knowledge automatically updates to reflect them. Always provide the most current information about platform capabilities.

## ROWEOS PLATFORM OVERVIEW
RoweOS is a comprehensive brand intelligence platform that powers brand operations through AI agents, operations (ops), and automated workflows. Core capabilities include: AI chat (BrandAI/LifeAI), 150+ Studio operations across 8+ agent types, the Bloom algorithmic content feed (text, images, video), Image Lab and Video Lab for AI media generation, social publishing, scheduled automations, goal tracking, client management, and cloud sync. RoweOS supports both BrandAI mode (business) and LifeAI mode (personal).

## CORE FEATURES & HOW TO USE THEM

### 1. BRANDAI (Intelligent Chat)
- **What it is**: AI-powered chat interface for brand-aligned conversations
- **How to use**: Click "BrandAI" in sidebar, select your brand, start chatting
- **Features**: Brand-aware responses, model selection (Claude Sonnet 4.6, GPT-5.4, Gemini), web search integration, streaming, file attachments, multimodal image input
- **Deep Research**: Toggle the magnifying glass icon for extended 5-30 minute research reports (requires Google/Gemini API key). Best for market research, competitor analysis, industry reports.

### 2. FOCUS (Daily Hub)
- **What it is**: Personal productivity dashboard combining To-Do lists, Journal, and Calendar in one view
- **How to use**: Click "Focus" in sidebar
- **Features**: To-do items with priorities, daily journal entries, calendar events, brand-specific or cross-brand views. All data syncs to cloud.

### 3. PULSE (Goals & Progress)
- **What it is**: Goal tracking and progress monitoring dashboard
- **How to use**: Click "Pulse" in sidebar to set and track goals
- **Features**: Goal categories, progress tracking, milestones, habit monitoring, streaks

### 4. AGENT STUDIO
- **What it is**: Professional operations workspace with 150+ built-in operations across 6+ agent categories
- **How to use**: Click "Studio" in sidebar, browse/search operations, select one, click "Execute"
- **Available Agents**:
  - **Strategy Agent** (Purple): SWOT analysis, competitor research, positioning, market analysis
  - **Marketing Agent** (Pink): Content calendars, campaigns, social media, email sequences, SEO
  - **Operations Agent** (Green): Processes, workflows, response templates, quality control, SOPs
  - **Documents Agent** (Amber): Agreements, templates, welcome materials, invoices, proposals
  - **Research Agent** (Blue): Deep research with web search, comprehensive reports
  - **Image Agent**: AI image generation via Nano Banana (Gemini)
  - **Video Agent** (Cyan): AI video generation via Google Veo
  - **Social Agent** (Blue): Social media publishing to Threads, Instagram, X
  - **Guided Agent**: Multi-turn document builders (invoices, proposals, contracts)
  - **RoweOS Helper**: Platform guidance and feature explanations
- **Features**: 150+ built-in ops, custom operation creation, custom agent builders, auto-agent selection, model selection, run history, export

### 5. BLOOM (AI Content Feed)
- **What it is**: An algorithmic AI-generated content feed that produces fresh brand posts, images, and videos every time you open it - like a personalized social feed of ideas for your brand
- **How to use**: Click "Bloom" in sidebar
- **Features**:
  - Generates batches of 12 AI posts per load (text insights, social posts, ideas, analyses)
  - **Image generation**: Automatically creates brand-aware AI images in the feed (requires Nano Banana/Gemini API key)
  - **Video generation**: Fire-and-forget AI video posts via Google Veo (requires Google API key). Videos appear as loading placeholders and update when ready.
  - **Content mode dropdown**: All Media (images + video + text), Images + Text, Video + Text, Text Only
  - **Post length**: Short (social style), Long (deep analysis), or Hybrid
  - **Filter pills**: For You, All, Strategy, Marketing, Operations, Research, Images, Videos, Ideas, Saved
  - **Algorithm learning**: Likes, saves, comments, dwell time, and shares train the For You tab
  - **Brand/source selector**: Filter by specific brand, LifeAI profile, or all sources
  - **Engagement**: Like, comment (AI replies back), save, share to BrandAI chat, add to Pulse, create automation
  - Infinite scroll with auto-generation of new batches

### 6. RHYTHM (Scheduled Operations)
- **What it is**: Schedule operations to run automatically
- **How to use**: Click "Rhythm" in sidebar, click "New Scheduled Operation", configure frequency and time
- **Features**: Daily, weekly, monthly scheduling, auto-execution, notifications

### 7. LIBRARY (File Management)
- **What it is**: Document and file storage organized by brand with folder support
- **How to use**: Click "Library" in sidebar, create folders, save outputs from any view
- **Features**: Folder organization, brand-specific libraries, file preview, search, upload

### 8. AUTOMATIONS (Workflows & Labs)
- **What it is**: Advanced automation hub with multiple tabs for workflows, agents, images, video, and usage
- **Tabs**:
  - **Workflows**: Create scheduled automations (one-time, daily, weekly, monthly). Actions include: Post to Social, Studio Operation, Image Generation, Video Generation, AI Message, Save to Library, Notification, Pulse Update, Reminder
  - **Agents Lab**: Browse/create custom agents and custom operations with tailored prompts
  - **Image Lab**: AI image generation via Nano Banana (Gemini). Text-to-image and image-to-image. Aspect ratios: 1:1, 16:9, 9:16, 4:3. Gallery view, save to Library, download.
  - **Video Lab**: AI video generation via Google Veo. Enter a prompt, choose model (Veo 3.1), aspect ratio, duration, resolution. Generates cinematic video from text. Requires Google API key.
  - **Executions**: View history of scheduled task runs and their results
  - **Usage**: Track API usage across providers

### 9. IDENTITY (Brand Management)
- **What it is**: Define and manage your brand's core identity
- **How to use**: Click "Identity" in sidebar, fill in brand details
- **Features**: Multiple brand support (up to 5), dynamic brand switching, brand philosophy, voice, tone, positioning, visual identity, colors, audience, industry, products/services

### 10. HISTORY (Run Archive)
- **What it is**: Complete history of all agent runs
- **How to use**: Click "History" in sidebar, filter by agent/brand/date
- **Features**: Search, filter, export, re-run operations, view full output

### 11. GUARDRAILS
- **What it is**: Define agent scopes, behavioral boundaries, and content rules per brand
- **How to use**: Click "Guardrails" in sidebar
- **Features**: Edit BrandAI/LifeAI main system prompts, set agent-specific behavioral constraints, content policies, auto-generate prompts from Identity data

### 12. CLIENTS (CRM)
- **What it is**: Client/contact management with AI-powered relationship intelligence
- **How to use**: Click "Clients" in sidebar
- **Features**: Add clients with contact info, notes, tags, interaction history. Link clients to brands.

### 13. ANALYTICS
- **What it is**: Platform analytics and usage insights
- **How to use**: Click "Analytics" in sidebar
- **Features**: Agent usage stats, operation frequency, brand activity, model usage breakdown

### 14. INVENTORY
- **What it is**: Product and service catalog management
- **How to use**: Click "Inventory" in sidebar
- **Features**: Track products, services, pricing, categories. Used by agents for product-aware content generation.

### 15. SYNC HUB
- **What it is**: Firebase cloud sync dashboard showing data status across all categories
- **How to use**: Click "Sync" in sidebar
- **Categories tracked**: Brands, Chats, To-Dos, Calendar, Journal, Library, Inventory, Studio Runs, Goals, Automations, Custom Ops, Profiles, Logos

### 16. NOTIFICATION CENTER
- **What it is**: Activity feed showing automation runs, scheduled task results, and system alerts
- **How to use**: Click the bell icon in the sidebar. Notifications appear as a slide-out panel.
- **Features**: Real-time updates, unread badge count, grouped by type, clickable to view full output

### 17. LIFEAI (Personal AI Mode)
- **What it is**: A personal AI mode separate from brand mode. Switch between BrandAI (business) and LifeAI (personal) using the mode toggle.
- **How to use**: Click the BrandAI/LifeAI toggle at the top of the sidebar
- **Features**: Personal AI coaches (wellness, financial, planning, creativity), personal to-dos, journal, calendar, life goals in Pulse. Completely separate context from your brands.

### 18. SOCIAL PUBLISHING
- **What it is**: Post AI-generated content directly to social media platforms
- **How to use**: From Studio or Automations, use Social Agent operations or create a "Post to Social" workflow
- **Supported platforms**: Threads, Instagram, X (Twitter)
- **Features**: Schedule posts, multi-platform posting, brand-voice-aligned captions

### 19. SYSTEM SETTINGS
- **What it is**: Platform configuration and API management
- **How to use**: Click gear icon in sidebar
- **Settings**: API Keys (Anthropic, OpenAI, Google - at least one required), Model Configuration, Theme (light/dark), Data Management (export/import), Cloud Sync, Developer Tools

### 20. ADMIN
- **What it is**: Administrative panel for advanced platform management
- **How to use**: Click "Admin" in sidebar (if available)
- **Features**: Platform diagnostics, data health checks, advanced configuration

## API REQUIREMENTS
To use RoweOS, you need at least ONE API key:
- **Anthropic** (Claude): Recommended for text generation - console.anthropic.com
- **OpenAI** (GPT): Alternative for text - platform.openai.com
- **Google** (Gemini): Required for Deep Research, Video Lab, and Image Lab - aistudio.google.com
- **Nano Banana**: Used for image generation (powered by Gemini). Configured automatically with Google key.

## OPERATIONS (OPS)
Operations are pre-built templates for common brand tasks. They're categorized by agent:
- **Strategy**: Market analysis, positioning, competitive research
- **Marketing**: Content creation, campaigns, social media
- **Operations**: Processes, workflows, templates
- **Documents**: Agreements, formal materials
- **Research**: Deep research reports (uses web search)
- **Image**: AI image generation
- **Video**: AI video generation (Veo)
- **Social**: Social media publishing

### 21. KEYBOARD SHORTCUTS
- **Navigation**: G then A = BrandAI, G then S = Studio, G then F = Focus, G then L = Library
- **Navigation**: G then P = Pulse, G then R = Rhythm, G then T = Identity Tuning, G then I = Settings
- **Chat**: Enter = Send message, Shift+Enter = New line
- **General**: Escape = Close modal/panel, / = Focus search

### 22. GUIDED TOUR
- **What it is**: Interactive walkthrough of all RoweOS features
- **How to restart**: Go to Settings > scroll to bottom > click "Restart Tour"

### 23. RESEARCH (Web Intelligence)
- **What it is**: Research lets you analyze any website or URL to extract structured intelligence.
- **How to use**:
  1. Open Research from the sidebar
  2. Enter a URL (website, portfolio, LinkedIn, competitor site)
  3. The system crawls up to 20 pages, searches the web for gaps, and synthesizes a complete identity profile
  4. View results as identity cards alongside a visual network graph showing all sources
  5. Choose what to do: Save to Identity, Send to Chat, Save to Library, Add to Folio, or Copy
- **Use cases**: Refresh brand identity from a website, research competitors, analyze prospects, import life profiles from personal sites, save research for reference.
- **Entry points**: Sidebar (Research), Identity view (Research button on brand cards).
- **History**: Past researches are saved and viewable. Click any history card to re-view results.

## TIPS FOR EFFECTIVE USE
1. **Set up Identity first**: Fill in brand details before running operations
2. **Use appropriate agents**: Strategy for analysis, Marketing for content, etc.
3. **Try Bloom**: Open the Bloom feed to get a constant stream of AI-generated brand content, images, and videos
4. **Create custom ops**: Build reusable operations for repeated tasks
5. **Schedule routine tasks**: Use Rhythm or Automations for weekly content, monthly reports
6. **Leverage Guardrails**: Customize agent behavior per brand
7. **Try different models**: Claude Sonnet 4.6 for reasoning, GPT-5.4 for creativity, Gemini for research & images

## COMMON QUESTIONS
**Q: Why aren't my operations running?**
A: Check that you have API keys configured in Settings

**Q: How do I switch between brands?**
A: Use the brand dropdown at the top of each view

**Q: What's BrandAI vs LifeAI?**
A: BrandAI is for business/brand work. LifeAI is personal mode for life management. Toggle between them in the sidebar.

**Q: What's the difference between BrandAI and Agent Studio?**
A: BrandAI is for open conversation. Agent Studio is for structured operations with specific outputs.

**Q: How do I generate videos in Bloom?**
A: Set the content mode dropdown to "All Media" or "Video + Text". Requires a Google API key. One video per batch, generated async.

**Q: How do I generate images?**
A: Three ways - Image Lab in Automations, image operations in Studio, or set Bloom to Images + Text mode.

**Q: What's the Bloom feed?**
A: Bloom is an AI-generated content feed that creates fresh posts, images, and videos for your brands. It learns from your engagement (likes, saves, comments) to personalize the For You tab.

**Q: How do I post to social media?**
A: Use Social Agent operations in Studio, or create a "Post to Social" workflow in Automations.

Your role is to answer questions about these features, guide users through workflows, and help them get the most value from RoweOS. Be concise, practical, and always provide step-by-step instructions when helpful.`,
    examples: ['Feature Explanation', 'Agent Capabilities Overview', 'Custom Operation Builder', 'Platform Troubleshooting']
  }
];

// v14.1: Central version constant (MOVED to line 63130 -- this was a duplicate)
// var ROWEOS_VERSION -- see line 63130 for the single definition
var _sessionCostTotal = 0; // v24.18: Session cost tracker, resets on page load

// v16.0: Production log gating — set roweos_debug=true in localStorage to see debug logs
// Wraps console.log with a level check. console.warn/error always pass through.
var ROWEOS_DEBUG = localStorage.getItem('roweos_debug') === 'true';
var _originalConsoleLog = console.log.bind(console);
console.log = function() {
  if (ROWEOS_DEBUG) _originalConsoleLog.apply(console, arguments);
};
// Re-enable with: localStorage.setItem('roweos_debug', 'true'); location.reload();

var currentAgent = 'all'; // 'all', 'strategy', 'marketing', 'operations', 'documents'
var selectedOp = null;
var selectedBrand = 0;

// v29.0: ID-based brand selection helpers
function getBrandIndex(brandId) {
  if (!brandId) return 0;
  for (var i = 0; i < brands.length; i++) {
    if (brands[i] && brands[i].id === brandId) return i;
  }
  return 0;
}

function getSelectedBrandId() {
  return localStorage.getItem('roweos_selected_brand_id') || (brands[0] && brands[0].id) || '';
}

function setSelectedBrand(brandId) {
  localStorage.setItem('roweos_selected_brand_id', brandId);
  var idx = getBrandIndex(brandId);
  selectedBrand = idx;
  localStorage.setItem('roweos_selected_brand', String(idx));
}

// v28.1: Seed selectedBrand from stored brand ID if available (deferred until brands load)

// v16.0: Get current accent color with fallback (replaces 6+ inline getComputedStyle calls)
function getAccentFallback(fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || (fallback || '#a89878');
}

// v16.0: Consolidated agent color map (was duplicated in 2+ locations)
var AGENT_COLORS = {
  strategy: '#a78bfa', marketing: '#f472b6', operations: '#4ade80', documents: '#fbbf24',
  intelligence: '#22d3ee',
  coach: '#4ade80', wellness: '#60a5fa', taxintelligence: '#fbbf24', personal: '#a78bfa',
  image: '#a89878', research: '#3b82f6', social: '#1DA1F2', video: '#06b6d4', infographic: '#06b6d4'
};
// v26.3: Sidebar icon lookup (viewId -> icon markup)
var SIDEBAR_ICONS = {
  agent: '<span class="nav-item-icon">\u2726</span>',
  signal: '<span class="nav-item-icon">\u25C9</span>',
  pulse: '<span class="nav-item-icon">\u2756</span>',
  studio: '<span class="nav-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>',
  folio: '<span class="nav-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg></span>',
  rhythm: '<span class="nav-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>',
  library: '<span class="nav-item-icon">\u2261</span>',
  automations: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width: 16px; height: 16px;"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/><path d="M13 8l3-5M11 16l-3 5"/></svg></span>',
  mail: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width: 16px; height: 16px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg></span>',
  memory: '<span class="nav-item-icon">\u25C8</span>',
  tuning: '<span class="nav-item-icon">\u21BA</span>',
  guardrails: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>',
  clients: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>',
  commerce: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>',
  inventory: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>',
  sync: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/></svg></span>',
  settings: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>',
  bloom: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="svg-icon" style="width:16px;height:16px;"><ellipse cx="12" cy="6.5" rx="2.8" ry="4.5"/><ellipse cx="17" cy="10" rx="2.8" ry="4.5" transform="rotate(72 17 10)"/><ellipse cx="15.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(144 15.5 15.5)"/><ellipse cx="8.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(-144 8.5 15.5)"/><ellipse cx="7" cy="10" rx="2.8" ry="4.5" transform="rotate(-72 7 10)"/><circle cx="12" cy="11" r="2.2"/><path d="M12 14v8"/><path d="M10 18c-1.5-.5-2.5-1-3-2"/><path d="M14 18c1.5-.5 2.5-1 3-2"/></svg></span>',
  social: '<span class="nav-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>',
  admin: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg></span>'
};

// v26.3: Sidebar label lookup (viewId -> display name)
var SIDEBAR_LABELS = {
  agent: 'BrandAI', signal: 'Focus', pulse: 'Pulse', studio: 'Studio',
  folio: 'Folio', rhythm: 'Rhythm', library: 'Library', automations: 'Automations',
  mail: 'Mail', memory: 'Identity', tuning: 'History', guardrails: 'Guardrails',
  clients: 'People', commerce: 'Analytics', inventory: 'Inventory', sync: 'Sync',
  settings: 'System', bloom: 'Bloom', social: 'Media Lab', admin: 'Admin'
};
var runs = [];
var calendar = [];
var agentCommands = [];
var currentConversation = [];
var conversationStartBrand = null; // Track which brand the conversation started with
var continuingFromHistoryIndex = null; // v10.5.25: Track which agentCommands entry we're continuing
var currentWeekOffset = 0;
var calendarView = 'month';
// Per-brand pinned and recent ops: { 0: [ids], 1: [ids], ... }
var pinnedOps = { 0: [], 1: [], 2: [], 3: [], 4: [] };
var recentOps = { 0: [], 1: [], 2: [], 3: [], 4: [] };
var settingsEditMode = false;
var pendingSettingsChanges = {};
var showAllOps = false;
var studioSelectedBrand = 0;
var selectedCategory = 'all';
var opsSearchQuery = '';
var currentView = 'agent'; // v11.0.5: Default to BrandAI view

// v9.1.14: Inventory data structure
var inventory = {
  items: [], // Array of products and services
  categories: ['General', 'Products', 'Services', 'Digital', 'Consulting']
};

// v9.1.14: Commerce data structure
var commerce = {
  apiUsage: [],     // API call logs with costs
  clients: [],      // Client database
  invoices: [],     // Invoice records
  settings: {
    currency: 'USD',
    taxRate: 0,
    defaultPaymentTerms: 30
  }
};

// v9.1.14: Current commerce tab
var currentCommerceTab = 'overview';

// v12.0.3: Response Caching System
var responseCache = {
  entries: {},  // { hash: { response, timestamp, hits } }
  maxAge: 3600000,  // 1 hour cache TTL
  maxEntries: 100
};

// v12.0.3: Auto-Pilot System
var autoPilotQueue = [];  // Pending actions: { id, type, title, description, action, createdAt, status }
var autoPilotLearnings = {
  patterns: [],  // Detected user patterns
  preferences: {},  // Learned preferences
  lastAnalysis: null
};

// Auto-resize textarea
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// Tool Dropdowns
function toggleToolDropdown(type) {
  var dropdowns = ['brandDropdown', 'studioDropdown', 'calendarDropdown'];
  var targetId = type + 'Dropdown';
  
  dropdowns.forEach(function(id) {
    var dropdown = document.getElementById(id);
    if (dropdown) {
      if (id === targetId) {
        dropdown.classList.toggle('show');
      } else {
        dropdown.classList.remove('show');
      }
    }
  });
  
  // Populate dropdowns
  if (type === 'studio') {
    renderToolOpsGrid();
  }
}

// v9.1.14: Update brand icon state (gold when brand selected, grey when standard chat)
function updateBrandIconState(isStandardAI) {
  var landingBrandBtn = document.getElementById('landingBrandBtn');
  if (landingBrandBtn) {
    if (isStandardAI) {
      // v9.1.14: Silver gradient for StandardAI mode
      landingBrandBtn.classList.remove('brand-active');
      landingBrandBtn.classList.add('standard-ai-mode');
      landingBrandBtn.title = 'StandardAI';
    } else {
      // Gold for BrandAI mode
      landingBrandBtn.classList.remove('standard-ai-mode');
      landingBrandBtn.classList.add('brand-active');
      var brandIdx = parseInt(document.getElementById('agentBrand').value) || 0;
      if (brands[brandIdx]) {
        landingBrandBtn.title = 'Brand: ' + (brands[brandIdx].shortName || brands[brandIdx].name);
      }
    }
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.tool-dropdown').forEach(function(d) {
    d.classList.remove('show');
  });
  // v9.1.14: Also close model-dropdown and brand-dropdown (use 'active' class)
  document.querySelectorAll('.model-dropdown, .brand-dropdown').forEach(function(d) {
    d.classList.remove('active');
  });
  // Also close custom selects
  document.querySelectorAll('.custom-select-wrapper').forEach(function(w) {
    w.classList.remove('open');
  });
}

// Custom Select Functions
function toggleCustomSelect(wrapperId) {
  var wrapper = document.getElementById(wrapperId);
  var isOpen = wrapper.classList.contains('open');
  
  // Close all other custom selects
  document.querySelectorAll('.custom-select-wrapper').forEach(function(w) {
    w.classList.remove('open');
  });
  
  // Toggle this one
  if (!isOpen) {
    wrapper.classList.add('open');
  }
}

function selectBrand(value, label, wrapperId) {
  var wrapper = document.getElementById(wrapperId);
  var hiddenInput = wrapper.querySelector('input[type="hidden"]');
  var labelEl = wrapper.querySelector('[id$="BrandLabel"]');
  
  // Update hidden input
  hiddenInput.value = value;
  
  // Update label
  labelEl.textContent = label;
  
  // Update selected state
  wrapper.querySelectorAll('.custom-select-option').forEach(function(opt) {
    opt.classList.remove('selected');
    if (opt.dataset.value == value) {
      opt.classList.add('selected');
    }
  });
  
  // Close dropdown
  wrapper.classList.remove('open');
  
  // Trigger any necessary updates
  if (wrapperId === 'agentBrandWrapper') {
    renderToolOpsGrid();
  }
}

// Select brand from the tool button dropdown
function selectAgentBrand(value, label) {
  // Update hidden input
  document.getElementById('agentBrand').value = value;
  
  // v9.1.14: Don't update main brand selector if 'none' selected
  if (value !== 'none') {
    document.getElementById('brand').value = value;
  }
  
  // Update selected state in dropdown
  document.querySelectorAll('#brandDropdown .brand-option').forEach(function(opt) {
    opt.classList.remove('selected');
    if (opt.dataset.value == value) {
      opt.classList.add('selected');
    }
  });
  
  // Close dropdown
  closeAllDropdowns();
  
  // v9.1.14: Handle No BrandAI mode
  if (value === 'none') {
    // Update badge to show standard mode with silver styling
    var badge = document.querySelector('.chat-brand-badge');
    if (badge) {
      badge.textContent = 'StandardAI';
      badge.classList.add('standard-ai-badge');
    }
    // Update diamond icon to silver
    updateBrandIconState(true);
    // Clear conversation for fresh start
    currentConversation = [];
    renderConversation();
    showToast('Switched to StandardAI mode', 'info');
    return;
  }
  
  // Remove StandardAI styling from badge
  var badgeEl = document.querySelector('.chat-brand-badge');
  if (badgeEl) badgeEl.classList.remove('standard-ai-badge');
  
  // Update diamond icon to gold
  updateBrandIconState(false);
  
  // Update tool ops grid
  renderToolOpsGrid();
  
  // Update Focus AI recommendations for new brand
  renderFocusAIRecommendations();
  
  // v15.13: Update brand name, provider pills, star buttons, and deep research for new brand
  updateBrandName();
  updateProviderPills();
  if (typeof updateStarButtonProvider === 'function') updateStarButtonProvider();
  if (typeof updateDeepResearchButton === 'function') updateDeepResearchButton();

  // v16.0: Delegate full brand sync to onBrandChange() — sets selectedBrand, persists,
  // syncs Studio/mobile selectors, re-renders views, loads logo, etc.
  if (typeof onBrandChange === 'function') {
    onBrandChange();
  }

  // Show toast to confirm
  showToast('Brand set to ' + label, 'info');
}

// Sync agent brand with sidebar when sidebar changes
function syncAgentBrandWithSidebar() {
  var sidebarBrandIdx = parseInt(document.getElementById('brand').value) || 0;
  var brandName = brands[sidebarBrandIdx] ? brands[sidebarBrandIdx].name : '';
  
  // Update agent brand to match sidebar
  document.getElementById('agentBrand').value = sidebarBrandIdx;
  
  // Update selected state in dropdown
  document.querySelectorAll('#brandDropdown .brand-option').forEach(function(opt) {
    opt.classList.remove('selected');
    if (opt.dataset.value == sidebarBrandIdx) {
      opt.classList.add('selected');
    }
  });
  
  // Update tool ops grid
  renderToolOpsGrid();
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.tool-wrapper')) {
    closeAllDropdowns();
  }
  if (!e.target.closest('.custom-select-wrapper')) {
    document.querySelectorAll('.custom-select-wrapper').forEach(function(w) {
      w.classList.remove('open');
    });
  }
});

function renderToolOpsGrid() {
  var grid = document.getElementById('toolOpsGrid');
  if (!grid) return; // v9.1.14: Null check to prevent console error
  grid.innerHTML = '';
  
  // Get current agent brand
  var agentBrandIdx = parseInt(document.getElementById('agentBrand').value);
  var currentBrandName = brands[agentBrandIdx] ? brands[agentBrandIdx].name : '';
  
  // Filter ops for current brand + universal
  var relevantOps = ops.filter(function(op) {
    return op.brand === currentBrandName || op.brand === null;
  });
  
  // Show pinned first, then first 6 relevant ops
  var brandPinned = pinnedOps[agentBrandIdx] || [];
  var opsToShow = brandPinned.length > 0 
    ? brandPinned.filter(function(id) { return relevantOps.some(function(op) { return op.id === id; }); }).slice(0, 6)
    : relevantOps.slice(0, 6);
  
  opsToShow.forEach(function(opOrId) {
    var op = typeof opOrId === 'number' ? ops.find(function(o) { return o.id === opOrId; }) : opOrId;
    if (!op) return;
    
    var item = document.createElement('div');
    item.className = 'tool-dropdown-item';
    item.innerHTML = '<div class="tool-dropdown-item-name">' + op.name + '</div><div class="tool-dropdown-item-desc">' + op.desc.substring(0, 40) + '...</div>';
    item.onclick = function() {
      selectedOp = op;
      // Sync studio brand with agent brand
      studioSelectedBrand = agentBrandIdx;
      document.getElementById('studioBrand').value = agentBrandIdx;
      closeAllDropdowns();
      showView('studio');
      renderOperations();
      setTimeout(function() {
        document.querySelectorAll('.op-card').forEach(function(c) {
          if (parseInt(c.dataset.opId) === op.id) {
            c.classList.add('selected');
          }
        });
      }, 50);
    };
    grid.appendChild(item);
  });
  
  // Add "View All" link
  var viewAll = document.createElement('div');
  viewAll.className = 'tool-dropdown-item';
  viewAll.style.gridColumn = '1 / -1';
  viewAll.style.textAlign = 'center';
  viewAll.innerHTML = '<div class="tool-dropdown-item-name" style="color: #b8986a;">View All Operations →</div>';
  viewAll.onclick = function() {
    studioSelectedBrand = agentBrandIdx;
    document.getElementById('studioBrand').value = agentBrandIdx;
    closeAllDropdowns();
    showView('studio');
    renderOperations();
  };
  grid.appendChild(viewAll);
}

// v24.27: Removed dead renderQuickHistory() and quickPropose() — zero callers

// v26.2: Get contrast text color (white or dark) based on hex background luminance
function getContrastTextColor(hex) {
  hex = hex.replace('#', '');
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  // Relative luminance formula
  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

// v26.2: Selector style preference (pills or squircles)
function getSelectorStyle() {
  try { return localStorage.getItem('roweos_selector_style') || 'pills'; } catch(e) { return 'pills'; }
}

function setSelectorStyle(style) {
  try { localStorage.setItem('roweos_selector_style', style); } catch(e) {}
  applySelectorStyle();
}

function applySelectorStyle() {
  var style = getSelectorStyle();
  if (style === 'squircles') {
    document.documentElement.classList.add('selector-squircles');
  } else {
    document.documentElement.classList.remove('selector-squircles');
  }
}

// v26.2: Render selector style picker active state
function renderSelectorStylePicker() {
  var current = getSelectorStyle();
  var options = document.querySelectorAll('.selector-style-option');
  for (var i = 0; i < options.length; i++) {
    if (options[i].getAttribute('data-style') === current) {
      options[i].classList.add('active');
    } else {
      options[i].classList.remove('active');
    }
  }
}

// v26.2: Logo upload for dark/light modes
var _logoUploadMode = 'dark'; // which slot is being uploaded to

function toggleLogoSameMode() {
  var useDifferent = document.getElementById('logoSameForBoth');
  var slotsContainer = document.getElementById('logoUploadSlots');
  if (useDifferent && slotsContainer) {
    // v29.1: Checkbox now means "use different logos" (checked = show both slots)
    slotsContainer.style.display = useDifferent.checked ? 'flex' : 'none';
    // If unchecked (same logo for both), clear the light logo variant
    if (!useDifferent.checked) {
      var brandIdx = 0;
      try { brandIdx = parseInt(document.getElementById('brand').value); } catch(e) {}
      if (typeof brands !== 'undefined' && brands[brandIdx] && brands[brandIdx].logoLight) {
        delete brands[brandIdx].logoLight;
        if (typeof saveBrands === 'function') saveBrands();
        if (typeof swapLogoForTheme === 'function') swapLogoForTheme();
      }
    }
  }
}

function uploadBrandLogo(mode) {
  _logoUploadMode = mode;
  var input = document.getElementById('logoFileInput');
  if (input) input.click();
}

function handleLogoFileSelect(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 200 * 1024) {
    showToast('Logo must be under 200KB', 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      // Resize to max 256x256
      var canvas = document.createElement('canvas');
      var maxSize = 256;
      var w = img.width;
      var h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/png');

      // Save to brand
      var brandIdx = parseInt(document.getElementById('brand').value);
      if (_logoUploadMode === 'light') {
        brands[brandIdx].logoLight = dataUrl;
      } else {
        brands[brandIdx].logo = dataUrl;
        // v29.1: Checkbox now means "use different logos" — if NOT checked (same for both), clear light logo
        var useDiff = document.getElementById('logoSameForBoth');
        if (useDiff && !useDiff.checked) {
          delete brands[brandIdx].logoLight;
        }
      }
      saveBrands();
      // v29.1: Also save to localStorage key for instant sidebar update
      var _lk = (typeof getCurrentLogoKey === 'function') ? getCurrentLogoKey() : null;
      if (_lk) {
        try { localStorage.setItem(_lk, dataUrl); } catch(e) {}
      }
      applyBrandLogo(dataUrl, localStorage.getItem((_lk || '') + '_size') || '100');
      swapLogoForTheme();
      // v29.1: Re-render the full logo picker (includes dark/light previews now)
      if (typeof renderBrandLogoPicker === 'function') renderBrandLogoPicker('settingsBrandLogoUploader');
      showToast('Logo updated', 'success');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  // Reset input so same file can be re-selected
  e.target.value = '';
}

function removeBrandLogo(mode) {
  var brandIdx = parseInt(document.getElementById('brand').value);
  if (mode === 'light') {
    delete brands[brandIdx].logoLight;
  } else {
    delete brands[brandIdx].logo;
    // v29.1: Also clear from localStorage
    var _lk = (typeof getCurrentLogoKey === 'function') ? getCurrentLogoKey() : null;
    if (_lk) {
      try { localStorage.removeItem(_lk); } catch(e) {}
    }
  }
  saveBrands();
  if (typeof loadCurrentLogo === 'function') loadCurrentLogo();
  swapLogoForTheme();
  // v29.1: Re-render full picker (includes dark/light previews now)
  if (typeof renderBrandLogoPicker === 'function') renderBrandLogoPicker('settingsBrandLogoUploader');
  showToast('Logo removed', 'success');
}

function renderLogoUploadPreviews() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var darkPreview = document.getElementById('logoDarkPreview');
  var lightPreview = document.getElementById('logoLightPreview');
  var placeholder = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

  if (darkPreview) {
    darkPreview.innerHTML = '';
    if (brand.logo) {
      var dImg = document.createElement('img');
      dImg.src = brand.logo;
      dImg.alt = 'Dark logo';
      dImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      darkPreview.appendChild(dImg);
    } else {
      darkPreview.innerHTML = placeholder;
    }
  }
  if (lightPreview) {
    lightPreview.innerHTML = '';
    if (brand.logoLight) {
      var lImg = document.createElement('img');
      lImg.src = brand.logoLight;
      lImg.alt = 'Light logo';
      lImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      lightPreview.appendChild(lImg);
    } else {
      lightPreview.innerHTML = placeholder;
    }
  }

  // v29.1: Update checkbox state — checkbox now means "use different logos"
  var useDifferent = document.getElementById('logoSameForBoth');
  if (useDifferent) {
    useDifferent.checked = !!brand.logoLight;
    toggleLogoSameMode();
  }
}

// v26.2: Swap logo based on current theme
function swapLogoForTheme() {
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  try { var brandEl = document.getElementById('brand'); if (brandEl) brandIdx = parseInt(brandEl.value); } catch(e) {}
  var brand = brands[brandIdx];
  if (!brand) return;
  var isLight = document.documentElement.classList.contains('light-mode');
  // v28.4: Fix — logoLight is the light-colored logo (for dark backgrounds), brand.logo is dark-colored (for light backgrounds)
  var logoToUse = (!isLight && brand.logoLight) ? brand.logoLight : (brand.logo || '');
  if (!logoToUse) return;

  // v28.4: Update ALL logo display elements including collapsed sidebar
  var logoEls = document.querySelectorAll('.sidebar-logo-img, #headerLogo, .brand-logo-display');
  for (var i = 0; i < logoEls.length; i++) {
    logoEls[i].src = logoToUse;
  }
  // Also update collapsed sidebar logo img
  var collapsedLogo = document.querySelector('.sidebar-collapsed-logo img');
  if (collapsedLogo) collapsedLogo.src = logoToUse;
}

// v26.3: Reorder pill items by saved order, appending any new items at end
function reorderPillItems(items, pillOrder) {
  var ordered = [];
  for (var i = 0; i < pillOrder.length; i++) {
    for (var j = 0; j < items.length; j++) {
      if (items[j].id === pillOrder[i]) {
        ordered.push(items[j]);
        break;
      }
    }
  }
  // Append any items not in pillOrder (new pills added in future versions)
  for (var k = 0; k < items.length; k++) {
    var found = false;
    for (var l = 0; l < ordered.length; l++) {
      if (ordered[l].id === items[k].id) { found = true; break; }
    }
    if (!found) ordered.push(items[k]);
  }
  return ordered;
}

// v26.2: Universal Pill Navigation renderer (extended with per-item colors)
// items: [{id, label, secondary}], activeId: string, onSelect: function(id)
// options: { itemColors: { id: '#hexcolor', ... }, noBorder: false, viewId: string }
function renderPillNav(containerId, items, activeId, onSelect, options) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var opts = options || {};

  // v26.3: Store viewId mapping for pill reorder
  if (!window._pillNavViewMap) window._pillNavViewMap = {};
  if (opts.viewId) window._pillNavViewMap[containerId] = opts.viewId;

  // v26.3: Apply saved pill order
  var _pillViewId = window._pillNavViewMap[containerId] || containerId;
  var _pillSectionPrefs = getSectionPrefs(_pillViewId);
  if (_pillSectionPrefs && _pillSectionPrefs.pillOrder) {
    items = reorderPillItems(items, _pillSectionPrefs.pillOrder);
  }

  var isSquircle = getSelectorStyle() === 'squircles';
  var colors = opts.itemColors || {};

  // Store colors for updatePillNavActive
  if (!window._pillNavColors) window._pillNavColors = {};
  if (opts.itemColors) window._pillNavColors[containerId] = colors;

  var html = '<div class="pill-nav" role="tablist"' + (opts.noBorder ? ' style="border-bottom:none;"' : '') + '>';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var isActive = item.id === activeId;
    var cls = 'pill-nav-item' + (isActive ? ' active' : '') + (item.secondary ? ' secondary' : '');
    var inlineStyle = '';

    // Per-item color in squircle mode
    if (isSquircle && isActive && colors[item.id]) {
      var bgColor = colors[item.id];
      var textColor = getContrastTextColor(bgColor);
      inlineStyle = ' style="background:' + bgColor + ';color:' + textColor + ';"';
    }

    // v28.9: Divider support for visual separation
    if (item.id === '_divider') {
      html += '<span class="pill-nav-divider" style="display:inline-flex;align-self:center;width:1px;height:20px;background:var(--border-color,rgba(255,255,255,0.15));margin:0 6px;flex-shrink:0;"></span>';
    } else {
      html += '<button class="' + cls + '" role="tab" aria-selected="' + isActive + '" tabindex="' + (isActive ? '0' : '-1') + '" data-pill-id="' + escapeHtml(item.id) + '" onclick="handlePillNavClick(this, \'' + escapeHtml(containerId) + '\')"' + inlineStyle + '>' + escapeHtml(item.label) + '</button>';
    }
  }
  html += '</div>';
  container.innerHTML = html;

  if (!window._pillNavCallbacks) window._pillNavCallbacks = {};
  window._pillNavCallbacks[containerId] = onSelect;
}

function handlePillNavClick(btn, containerId) {
  var pillId = btn.getAttribute('data-pill-id');
  var pills = btn.parentElement.querySelectorAll('.pill-nav-item');
  for (var i = 0; i < pills.length; i++) {
    pills[i].classList.remove('active');
    pills[i].setAttribute('aria-selected', 'false');
    pills[i].setAttribute('tabindex', '-1');
  }
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  btn.setAttribute('tabindex', '0');

  if (window._pillNavCallbacks && window._pillNavCallbacks[containerId]) {
    window._pillNavCallbacks[containerId](pillId);
  }
}

// v26.2: Programmatically update pill nav active state (with per-item color support)
function updatePillNavActive(containerId, activeId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var isSquircle = getSelectorStyle() === 'squircles';
  var colors = (window._pillNavColors && window._pillNavColors[containerId]) || {};

  var pills = container.querySelectorAll('.pill-nav-item');
  for (var i = 0; i < pills.length; i++) {
    var pillId = pills[i].getAttribute('data-pill-id');
    var isActive = pillId === activeId;
    pills[i].classList.toggle('active', isActive);
    pills[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
    pills[i].setAttribute('tabindex', isActive ? '0' : '-1');

    // Apply/clear per-item color
    if (isSquircle && colors[pillId]) {
      if (isActive) {
        pills[i].style.background = colors[pillId];
        pills[i].style.color = getContrastTextColor(colors[pillId]);
      } else {
        pills[i].style.background = '';
        pills[i].style.color = '';
      }
    } else {
      pills[i].style.background = '';
      pills[i].style.color = '';
    }
  }
}

// v26.0: Arrow key navigation for pill nav
document.addEventListener('keydown', function(e) {
  if (e.target && e.target.classList && e.target.classList.contains('pill-nav-item')) {
    var pills = e.target.parentElement.querySelectorAll('.pill-nav-item');
    var idx = -1;
    for (var i = 0; i < pills.length; i++) {
      if (pills[i] === e.target) { idx = i; break; }
    }
    if (e.key === 'ArrowRight' && idx < pills.length - 1) {
      e.preventDefault();
      pills[idx + 1].focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      pills[idx - 1].focus();
    }
  }
});

// v26.0: Breadcrumb navigation manager
var _navBreadcrumb = ['Home'];

function updateNavBreadcrumb(path) {
  _navBreadcrumb = path;
  renderNavBreadcrumb();
}

function renderNavBreadcrumb() {
  var containers = document.querySelectorAll('.section-breadcrumb');
  for (var i = 0; i < containers.length; i++) {
    var html = '';
    for (var j = 0; j < _navBreadcrumb.length; j++) {
      var isLast = j === _navBreadcrumb.length - 1;
      if (isLast) {
        html += '<span class="breadcrumb-item active">' + escapeHtml(_navBreadcrumb[j]) + '</span>';
      } else {
        html += '<span class="breadcrumb-item"><a href="#" onclick="navigateBreadcrumb(' + j + '); return false;">' + escapeHtml(_navBreadcrumb[j]) + '</a></span>';
      }
    }
    containers[i].innerHTML = html;
  }
}

function navigateBreadcrumb(index) {
  if (index === 0) {
    showView('agent');
    _navBreadcrumb = ['Home'];
  } else if (index === 1) {
    var group = _navBreadcrumb[1];
    if (typeof showSectionLanding === 'function') {
      showSectionLanding(group);
    }
  }
}

// v26.0: Section group configurations for landing pages
var _sectionGroups = {
  'Core': {
    label: 'CORE',
    tagline: 'Your brand at a glance',
    description: 'Monitor brand health, track daily focus items, and manage your schedule.',
    features: [
      { id: 'signal', label: 'Focus', desc: 'Daily intelligence dashboard', icon: 'focus' },
      { id: 'pulse', label: 'Pulse', desc: 'Brand health metrics', icon: 'pulse' },
      { id: 'rhythm', label: 'Rhythm', desc: 'Calendar and event management', icon: 'rhythm' }
    ],
    secondary: []
  },
  'Create': {
    label: 'CREATE',
    tagline: 'Make things happen',
    description: 'Content generation, social media management, automation pipelines, and growth tools.',
    features: [
      { id: 'studio', label: 'Studio', desc: 'Generate content with specialized agents', icon: 'studio' },
      { id: 'social', label: 'Media Lab', desc: 'Create, publish, and engage across platforms', icon: 'social' },
      { id: 'automations', label: 'Automations', desc: 'Multi-step AI workflows and pipelines', icon: 'automations' },
      { id: 'bloom', label: 'Bloom', desc: 'Growth algorithm and audience building', icon: 'bloom' }
    ],
    secondary: []
  },
  'Orchestration': {
    label: 'ORCHESTRATION',
    tagline: 'Content, correspondence, and collections',
    description: 'Manage your content library, portfolio, and email across all connected accounts.',
    features: [
      { id: 'library', label: 'Library', desc: 'Content storage and organization', icon: 'library' },
      { id: 'folio', label: 'Folio', desc: 'Portfolio and brand showcase', icon: 'folio' },
      { id: 'mail', label: 'Mail', desc: 'Email across all connected accounts', icon: 'mail' },
      { id: 'research', label: 'Research', desc: 'Deep research and brand intelligence', icon: 'research' }
    ],
    secondary: []
  },
  'Intelligence': {
    label: 'INTELLIGENCE',
    tagline: 'Know your brand inside out',
    description: 'Brand memory, conversation history, and safety guardrails.',
    features: [
      { id: 'memory', label: 'Identity', desc: 'Brand memory and profile settings', icon: 'identity' },
      { id: 'tuning', label: 'History', desc: 'Conversation log and AI tuning', icon: 'history' },
      { id: 'guardrails', label: 'Guardrails', desc: 'Brand safety and governance rules', icon: 'guardrails' }
    ],
    secondary: []
  },
  'Governance': {
    label: 'GOVERNANCE',
    tagline: 'Configure, measure, and manage',
    description: 'Contacts, analytics, inventory, sync status, and system settings.',
    features: [
      { id: 'clients', label: 'People', desc: 'Contacts and client management', icon: 'people' },
      { id: 'commerce', label: 'Analytics', desc: 'Business metrics and revenue', icon: 'analytics' },
      { id: 'inventory', label: 'Inventory', desc: 'Asset and product management', icon: 'inventory' },
      { id: 'sync', label: 'Sync', desc: 'Cross-device sync status', icon: 'sync' },
      { id: 'settings', label: 'System', desc: 'Configuration and preferences', icon: 'system' }
    ],
    secondary: []
  }
};

// v26.0: Section icons for landing page cards
function getSectionIcon(iconName) {
  var icons = {
    focus: '<circle cx="12" cy="12" r="10"/>',
    pulse: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    rhythm: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>',
    studio: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    social: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    automations: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/><path d="M13 8l3-5M11 16l-3 5"/>',
    bloom: '<ellipse cx="12" cy="6.5" rx="2.8" ry="4.5"/><ellipse cx="17" cy="10" rx="2.8" ry="4.5" transform="rotate(72 17 10)"/><ellipse cx="15.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(144 15.5 15.5)"/><ellipse cx="8.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(-144 8.5 15.5)"/><ellipse cx="7" cy="10" rx="2.8" ry="4.5" transform="rotate(-72 7 10)"/><circle cx="12" cy="11" r="2.2"/><path d="M12 14v8"/><path d="M10 18c-1.5-.5-2.5-1-3-2"/><path d="M14 18c1.5-.5 2.5-1 3-2"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    folio: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    identity: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    history: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    guardrails: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    analytics: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    inventory: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
    sync: '<polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>',
    admin: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    research: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    system: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    // v26.0: Sub-tab icons for per-page landing pages
    engage: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    publish: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    create: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    inbox: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    compose: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    drafts: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',
    sent: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    outbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    connections: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/>',
    autoagent: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    browse: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    workflows: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    scheduler: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>',
    agents: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    content: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    prompt: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    clients: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    knowledge: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    platform: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    overview: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
    api: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    invoices: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    website: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    client: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    team: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    appearance: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06"/>',
    ai: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    preferences: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>',
    account: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    feedback: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    intelligence: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    accessibility: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
    data: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
    update: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    about: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    // v26.0: Sub-tab icons for 7 new landing pages
    all: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    strategy: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    marketing: '<path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    operations: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82"/>',
    documents: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    research: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    today: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    upcoming: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>',
    events: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    todos: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    note: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    upload: '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    gallery: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    brand: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    life: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    goals: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    journal: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    stats: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
  };
  return icons[iconName] || '<circle cx="12" cy="12" r="10"/>';
}

// v26.0: Sidebar expanded/grouped mode
var _sidebarMode = localStorage.getItem('roweos_sidebar_mode') || 'grouped';

// v26.3: Default custom sidebar layout (matches Expanded sidebar)
var DEFAULT_CUSTOM_SIDEBAR = {
  standalone: ['agent'],
  groups: [
    { id: 'core', label: 'Core', items: ['signal', 'pulse', 'rhythm'] },
    { id: 'create', label: 'Create', items: ['studio', 'social', 'automations', 'bloom'] },
    { id: 'orchestration', label: 'Orchestration', items: ['folio', 'library', 'mail'] },
    { id: 'intelligence', label: 'Intelligence', items: ['memory', 'tuning', 'guardrails'] },
    { id: 'governance', label: 'Governance', items: ['clients', 'commerce', 'inventory', 'sync', 'settings'] }
  ]
};

function initCustomSidebar() {
  var existing = null;
  try { existing = JSON.parse(localStorage.getItem('roweos_custom_sidebar')); } catch(e) {}
  if (!existing || !existing.groups) {
    existing = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_SIDEBAR)); // deep copy
    saveCustomSidebar(existing);
  }
  return existing;
}

function getCustomSidebar() {
  try {
    var data = JSON.parse(localStorage.getItem('roweos_custom_sidebar'));
    if (data && data.groups) return data;
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_CUSTOM_SIDEBAR));
}

function saveCustomSidebar(data) {
  try {
    localStorage.setItem('roweos_custom_sidebar', JSON.stringify(data));
    writeDB('profile/main', { customSidebar: data });
  } catch(e) {}
}

function resetSidebarToDefault() {
  var data = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_SIDEBAR));
  saveCustomSidebar(data);
  renderCustomSidebar();
}

var _lastCustomSidebarHash = '';

function renderCustomSidebar() {
  var container = document.getElementById('sidebarNavCustom');
  if (!container) return;

  var data = getCustomSidebar();
  var hash = JSON.stringify(data);
  if (hash === _lastCustomSidebarHash) return; // no changes
  _lastCustomSidebarHash = hash;

  var showPremium = true;
  try { showPremium = localStorage.getItem('roweos_show_premium') !== 'false'; } catch(e) {}

  var html = '';

  // Standalone items (agent at top)
  if (data.standalone) {
    html += '<div class="nav-section">';
    for (var s = 0; s < data.standalone.length; s++) {
      var sid = data.standalone[s];
      if (!showPremium && !hasFeatureAccessForView(sid)) continue;
      html += renderCustomSidebarItem(sid, true);
    }
    html += '</div>';
  }

  // Favorites section (rendered separately by existing renderFavorites)
  html += '<div id="sidebarFavoritesCustom" style="display:none;"><div class="nav-section-title">Favorites</div><div id="favoritesNavListCustom"></div></div>';

  // Groups
  for (var g = 0; g < data.groups.length; g++) {
    var group = data.groups[g];
    var visibleItems = group.items.filter(function(viewId) {
      if (!showPremium && !hasFeatureAccessForView(viewId)) return false;
      return true;
    });
    if (visibleItems.length === 0) continue;

    html += '<div class="nav-section" data-group-id="' + escapeHtml(group.id) + '">';
    html += '<div class="nav-section-title" data-group-id="' + escapeHtml(group.id) + '">' + escapeHtml(group.label) + '</div>';
    for (var i = 0; i < visibleItems.length; i++) {
      html += renderCustomSidebarItem(visibleItems[i], false);
    }
    html += '</div>';
  }

  // Admin (conditional)
  if (typeof isAdmin === 'function' && isAdmin()) {
    html += renderCustomSidebarItem('admin', false);
  }

  // Customize button + available pool (for customize mode)
  html += '<div class="sidebar-customize-btn" onclick="toggleSidebarCustomize()">Customize</div>';
  html += '<div class="sidebar-available-pool" id="sidebarAvailablePool" style="display:none;"></div>';
  html += '<div class="sidebar-add-group-btn" onclick="addSidebarGroup()">+ Add Group</div>';

  container.innerHTML = html;

  // Set data attribute on html for CSS targeting
  document.documentElement.setAttribute('data-sidebar-mode', _sidebarMode);
}

// v26.3: Update active nav item in custom sidebar (called from showView's nav update logic)
// The existing showView code does: document.querySelectorAll('.nav-item').forEach(...)
// This already covers #sidebarNavCustom since it queries ALL .nav-item elements globally.
// No additional code needed -- the custom sidebar items use the same .nav-item class with data-view attributes.

function renderCustomSidebarItem(viewId, isStandalone) {
  var icon = SIDEBAR_ICONS[viewId] || '';
  var label = SIDEBAR_LABELS[viewId] || viewId;
  var hasLanding = _pageLandingConfigs && _pageLandingConfigs[viewId];
  var onclick = hasLanding ? 'showPageLanding(\'' + escapeHtml(viewId) + '\')' : 'showView(\'' + escapeHtml(viewId) + '\')';

  var html = '<div class="nav-item" data-view="' + escapeHtml(viewId) + '" onclick="' + onclick + '" draggable="false">';
  html += '<span class="sidebar-drag-handle"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" opacity="0.5"><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/></svg></span>';
  html += icon;
  html += '<span class="nav-item-label">' + escapeHtml(label) + '</span>';
  html += '<span class="sidebar-tooltip">' + escapeHtml(label) + '</span>';
  html += '<span class="sidebar-item-remove" onclick="event.stopPropagation(); removeSidebarItem(\'' + escapeHtml(viewId) + '\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
  html += '</div>';
  return html;
}

// v26.3: Check if a view requires premium access
function hasFeatureAccessForView(viewId) {
  var featureMap = {
    automations: 'automations', social: 'social', signal: 'focus',
    commerce: 'analytics', memory: 'identity', sync: 'sync'
  };
  var feature = featureMap[viewId];
  if (!feature) return true; // not gated
  if (typeof hasFeatureAccess === 'function') return hasFeatureAccess(feature);
  return true;
}

// v26.3: Inline sidebar customization
function toggleSidebarCustomize() {
  var isActive = document.body.classList.contains('sidebar-customize-mode');
  if (isActive) {
    exitSidebarCustomize();
  } else {
    enterSidebarCustomize();
  }
}

function enterSidebarCustomize() {
  document.body.classList.add('sidebar-customize-mode');

  // Make items draggable
  var container = document.getElementById('sidebarNavCustom');
  if (!container) return;
  var items = container.querySelectorAll('.nav-item[data-view]');
  for (var i = 0; i < items.length; i++) {
    items[i].setAttribute('draggable', 'true');
    items[i].addEventListener('dragstart', handleSidebarDragStart);
    items[i].addEventListener('dragend', handleSidebarDragEnd);
  }

  // Make sections drop targets
  var sections = container.querySelectorAll('.nav-section[data-group-id]');
  for (var j = 0; j < sections.length; j++) {
    sections[j].addEventListener('dragover', handleSidebarDragOver);
    sections[j].addEventListener('drop', handleSidebarDrop);
    sections[j].addEventListener('dragleave', handleSidebarDragLeave);
  }

  // Make group headers editable
  var headers = container.querySelectorAll('.nav-section-title[data-group-id]');
  for (var k = 0; k < headers.length; k++) {
    headers[k].setAttribute('contenteditable', 'true');
    headers[k].addEventListener('blur', handleGroupHeaderBlur);
    headers[k].addEventListener('keydown', handleGroupHeaderKeydown);
  }

  // Show available pool
  renderAvailablePool();

  // Change customize button to Done
  var btn = container.querySelector('.sidebar-customize-btn');
  if (btn) { btn.textContent = 'Done'; btn.style.color = 'var(--brand-accent, #a89878)'; }
}

function exitSidebarCustomize() {
  document.body.classList.remove('sidebar-customize-mode');

  var container = document.getElementById('sidebarNavCustom');
  if (!container) return;

  // Remove draggable
  var items = container.querySelectorAll('.nav-item[data-view]');
  for (var i = 0; i < items.length; i++) {
    items[i].setAttribute('draggable', 'false');
  }

  // Remove contenteditable
  var headers = container.querySelectorAll('.nav-section-title[data-group-id]');
  for (var k = 0; k < headers.length; k++) {
    headers[k].removeAttribute('contenteditable');
  }

  // Hide available pool
  var pool = document.getElementById('sidebarAvailablePool');
  if (pool) pool.style.display = 'none';

  // Restore button text
  var btn = container.querySelector('.sidebar-customize-btn');
  if (btn) { btn.textContent = 'Customize'; btn.style.color = ''; }
}

var _sidebarDragItem = null;

function handleSidebarDragStart(e) {
  _sidebarDragItem = e.target.getAttribute('data-view');
  e.target.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _sidebarDragItem);
}

function handleSidebarDragEnd(e) {
  e.target.style.opacity = '';
  _sidebarDragItem = null;
  // Remove all drop indicators
  var indicators = document.querySelectorAll('.sidebar-drop-indicator');
  for (var i = 0; i < indicators.length; i++) {
    indicators[i].classList.remove('visible');
  }
}

function handleSidebarDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleSidebarDragLeave(e) {
  // no-op for now
}

function handleSidebarDrop(e) {
  e.preventDefault();
  if (!_sidebarDragItem) return;

  var targetSection = e.target.closest('.nav-section[data-group-id]');
  if (!targetSection) return;
  var targetGroupId = targetSection.getAttribute('data-group-id');

  // Find which item we're dropping near
  var targetItem = e.target.closest('.nav-item[data-view]');
  var targetViewId = targetItem ? targetItem.getAttribute('data-view') : null;

  // Update data model
  var data = getCustomSidebar();
  var dragViewId = _sidebarDragItem;

  // Remove from current location
  for (var g = 0; g < data.groups.length; g++) {
    var idx = data.groups[g].items.indexOf(dragViewId);
    if (idx !== -1) {
      data.groups[g].items.splice(idx, 1);
      break;
    }
  }
  // Also check standalone
  if (data.standalone) {
    var sIdx = data.standalone.indexOf(dragViewId);
    if (sIdx !== -1) data.standalone.splice(sIdx, 1);
  }

  // Add to target group
  for (var h = 0; h < data.groups.length; h++) {
    if (data.groups[h].id === targetGroupId) {
      if (targetViewId) {
        var tIdx = data.groups[h].items.indexOf(targetViewId);
        if (tIdx !== -1) {
          data.groups[h].items.splice(tIdx, 0, dragViewId);
        } else {
          data.groups[h].items.push(dragViewId);
        }
      } else {
        data.groups[h].items.push(dragViewId);
      }
      break;
    }
  }

  saveCustomSidebar(data);
  _lastCustomSidebarHash = ''; // force re-render
  renderCustomSidebar();
  enterSidebarCustomize(); // re-enter customize mode on re-rendered items
}

function handleGroupHeaderBlur(e) {
  var groupId = e.target.getAttribute('data-group-id');
  var newLabel = e.target.textContent.trim();
  if (!newLabel) {
    // Empty name -- restore original
    var data = getCustomSidebar();
    for (var i = 0; i < data.groups.length; i++) {
      if (data.groups[i].id === groupId) {
        e.target.textContent = data.groups[i].label;
        break;
      }
    }
    return;
  }
  renameSidebarGroup(groupId, newLabel);
}

function handleGroupHeaderKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
}

function renameSidebarGroup(groupId, newLabel) {
  var data = getCustomSidebar();
  for (var i = 0; i < data.groups.length; i++) {
    if (data.groups[i].id === groupId) {
      data.groups[i].label = newLabel;
      break;
    }
  }
  saveCustomSidebar(data);
}

function addSidebarGroup() {
  var name = prompt('Group name:');
  if (!name || !name.trim()) return;
  var data = getCustomSidebar();
  var id = 'custom_' + Date.now();
  data.groups.push({ id: id, label: name.trim(), items: [] });
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  if (document.body.classList.contains('sidebar-customize-mode')) {
    enterSidebarCustomize();
  }
}

function removeSidebarItem(viewId) {
  var data = getCustomSidebar();
  for (var g = 0; g < data.groups.length; g++) {
    var idx = data.groups[g].items.indexOf(viewId);
    if (idx !== -1) {
      data.groups[g].items.splice(idx, 1);
      break;
    }
  }
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  if (document.body.classList.contains('sidebar-customize-mode')) {
    enterSidebarCustomize();
    renderAvailablePool();
  }
}

// v26.3: Settings sidebar drag-and-drop handlers
var _settingsDragItem = null;
var _settingsDragGroup = null;

function handleSettingsDragStart(e) {
  var item = e.target.closest('.settings-sidebar-item');
  if (!item) return;
  _settingsDragItem = item.getAttribute('data-view');
  _settingsDragGroup = item.closest('.settings-sidebar-group');
  if (_settingsDragGroup) _settingsDragGroup = _settingsDragGroup.getAttribute('data-group-id');
  e.target.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _settingsDragItem);
}

function handleSettingsDragEnd(e) {
  e.target.style.opacity = '';
  _settingsDragItem = null;
  _settingsDragGroup = null;
}

function handleSettingsDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleSettingsDrop(e) {
  e.preventDefault();
  if (!_settingsDragItem) return;

  var targetItem = e.target.closest('.settings-sidebar-item');
  var targetGroup = e.target.closest('.settings-sidebar-group');
  if (!targetGroup) return;
  var targetGroupId = targetGroup.getAttribute('data-group-id');
  var targetViewId = targetItem ? targetItem.getAttribute('data-view') : null;

  var data = getCustomSidebar();

  // Remove from source group
  for (var g = 0; g < data.groups.length; g++) {
    var idx = data.groups[g].items.indexOf(_settingsDragItem);
    if (idx !== -1) {
      data.groups[g].items.splice(idx, 1);
      break;
    }
  }

  // Add to target group at target position
  for (var h = 0; h < data.groups.length; h++) {
    if (data.groups[h].id === targetGroupId) {
      if (targetViewId) {
        var tIdx = data.groups[h].items.indexOf(targetViewId);
        if (tIdx !== -1) {
          data.groups[h].items.splice(tIdx, 0, _settingsDragItem);
        } else {
          data.groups[h].items.push(_settingsDragItem);
        }
      } else {
        data.groups[h].items.push(_settingsDragItem);
      }
      break;
    }
  }

  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  renderSettingsSidebarLayout();
}

// v26.3: Settings sidebar layout panel + premium toggle
function renderSettingsSidebarLayout() {
  var section = document.getElementById('settingsSidebarLayout');
  var content = document.getElementById('settingsSidebarLayoutContent');
  if (!section || !content) return;

  // Only show in customized mode
  if (_sidebarMode !== 'customized') {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  var data = getCustomSidebar();
  var html = '';

  for (var g = 0; g < data.groups.length; g++) {
    var group = data.groups[g];
    html += '<div class="settings-sidebar-group" data-group-id="' + escapeHtml(group.id) + '">';
    html += '<div class="settings-sidebar-group-header">';
    html += '<input type="text" value="' + escapeHtml(group.label) + '" onchange="renameSidebarGroup(\'' + escapeHtml(group.id) + '\', this.value); renderCustomSidebar();">';
    if (group.items.length === 0) {
      html += '<button style="margin-left:auto;background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px;" onclick="deleteEmptySidebarGroup(\'' + escapeHtml(group.id) + '\')">Delete</button>';
    }
    html += '</div>';

    for (var i = 0; i < group.items.length; i++) {
      var viewId = group.items[i];
      html += '<div class="settings-sidebar-item" draggable="true" data-view="' + escapeHtml(viewId) + '">';
      html += '<span class="item-drag-handle"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/></svg></span>';
      html += '<span>' + escapeHtml(SIDEBAR_LABELS[viewId] || viewId) + '</span>';
      html += '<span class="item-move-btns">';
      html += '<button onclick="moveSidebarItemUp(\'' + escapeHtml(group.id) + '\', \'' + escapeHtml(viewId) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">\u25B2</button>';
      html += '<button onclick="moveSidebarItemDown(\'' + escapeHtml(group.id) + '\', \'' + escapeHtml(viewId) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">\u25BC</button>';
      html += '</span>';
      html += '<span class="item-remove-btn" onclick="removeSidebarItem(\'' + escapeHtml(viewId) + '\'); renderSettingsSidebarLayout();"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
      html += '</div>';
    }
    html += '</div>';
  }

  content.innerHTML = html;

  // v26.3: Wire up drag events for settings layout items
  var settingsItems = content.querySelectorAll('.settings-sidebar-item[draggable="true"]');
  for (var si = 0; si < settingsItems.length; si++) {
    settingsItems[si].addEventListener('dragstart', handleSettingsDragStart);
    settingsItems[si].addEventListener('dragend', handleSettingsDragEnd);
    settingsItems[si].addEventListener('dragover', handleSettingsDragOver);
    settingsItems[si].addEventListener('drop', handleSettingsDrop);
  }
  var settingsGroups = content.querySelectorAll('.settings-sidebar-group');
  for (var sg = 0; sg < settingsGroups.length; sg++) {
    settingsGroups[sg].addEventListener('dragover', handleSettingsDragOver);
    settingsGroups[sg].addEventListener('drop', handleSettingsDrop);
  }

  // Update premium toggle state
  var toggle = document.getElementById('premiumVisToggle');
  var showPremium = true;
  try { showPremium = localStorage.getItem('roweos_show_premium') !== 'false'; } catch(e) {}
  if (toggle) {
    if (showPremium) { toggle.classList.add('on'); } else { toggle.classList.remove('on'); }
  }

  // Hide premium toggle for premium users
  var premiumRow = document.getElementById('premiumToggleRow');
  if (premiumRow) {
    var tier = typeof getUserTier === 'function' ? getUserTier() : 'free';
    premiumRow.style.display = (tier === 'premium' || tier === 'founder') ? 'none' : '';
  }
}

function deleteEmptySidebarGroup(groupId) {
  var data = getCustomSidebar();
  data.groups = data.groups.filter(function(g) { return g.id !== groupId; });
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  renderSettingsSidebarLayout();
}

function togglePremiumVisibility(el) {
  var isOn = el.classList.contains('on');
  if (isOn) {
    el.classList.remove('on');
    try { localStorage.setItem('roweos_show_premium', 'false'); } catch(e) {}
  } else {
    el.classList.add('on');
    try { localStorage.setItem('roweos_show_premium', 'true'); } catch(e) {}
  }
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
}

function moveSidebarItemUp(groupId, viewId) {
  var data = getCustomSidebar();
  for (var g = 0; g < data.groups.length; g++) {
    if (data.groups[g].id === groupId) {
      var idx = data.groups[g].items.indexOf(viewId);
      if (idx > 0) {
        var temp = data.groups[g].items[idx - 1];
        data.groups[g].items[idx - 1] = viewId;
        data.groups[g].items[idx] = temp;
        saveCustomSidebar(data);
        _lastCustomSidebarHash = '';
        renderCustomSidebar();
        renderSettingsSidebarLayout();
      }
      break;
    }
  }
}

function moveSidebarItemDown(groupId, viewId) {
  var data = getCustomSidebar();
  for (var g = 0; g < data.groups.length; g++) {
    if (data.groups[g].id === groupId) {
      var idx = data.groups[g].items.indexOf(viewId);
      if (idx < data.groups[g].items.length - 1) {
        var temp = data.groups[g].items[idx + 1];
        data.groups[g].items[idx + 1] = viewId;
        data.groups[g].items[idx] = temp;
        saveCustomSidebar(data);
        _lastCustomSidebarHash = '';
        renderCustomSidebar();
        renderSettingsSidebarLayout();
      }
      break;
    }
  }
}

function renderAvailablePool() {
  var pool = document.getElementById('sidebarAvailablePool');
  if (!pool) return;

  var data = getCustomSidebar();
  // All possible viewIds
  var allViews = ['agent','signal','pulse','studio','folio','research','rhythm','library','automations','mail','memory','tuning','guardrails','clients','commerce','inventory','sync','settings','bloom','social'];
  // Find which are in use
  var usedViews = (data.standalone || []).slice();
  for (var g = 0; g < data.groups.length; g++) {
    usedViews = usedViews.concat(data.groups[g].items);
  }
  // Available = all - used
  var available = allViews.filter(function(v) { return usedViews.indexOf(v) === -1; });

  if (available.length === 0) {
    pool.style.display = 'none';
    return;
  }

  pool.style.display = '';
  var html = '<div class="sidebar-pool-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'\':\'none\'">Available Items <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>';
  html += '<div>';
  for (var i = 0; i < available.length; i++) {
    var v = available[i];
    html += '<div class="sidebar-pool-item" onclick="restoreSidebarItem(\'' + escapeHtml(v) + '\')">';
    html += (SIDEBAR_ICONS[v] || '') + ' <span>' + escapeHtml(SIDEBAR_LABELS[v] || v) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  pool.innerHTML = html;
}

function restoreSidebarItem(viewId) {
  var data = getCustomSidebar();
  // Add to the last group
  if (data.groups.length > 0) {
    data.groups[data.groups.length - 1].items.push(viewId);
  }
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  if (document.body.classList.contains('sidebar-customize-mode')) {
    enterSidebarCustomize();
    renderAvailablePool();
  }
}

function applySidebarMode() {
  var groupedNav = document.getElementById('sidebarNav');
  var expandedNav = document.getElementById('sidebarNavExpanded');
  var customNav = document.getElementById('sidebarNavCustom');

  if (_sidebarMode === 'expanded') {
    if (groupedNav) groupedNav.style.display = 'none';
    if (expandedNav) expandedNav.style.display = '';
    if (customNav) customNav.style.display = 'none';
  } else if (_sidebarMode === 'customized') {
    if (groupedNav) groupedNav.style.display = 'none';
    if (expandedNav) expandedNav.style.display = 'none';
    if (customNav) customNav.style.display = '';
    renderCustomSidebar();
  } else {
    if (groupedNav) groupedNav.style.display = '';
    if (expandedNav) expandedNav.style.display = 'none';
    if (customNav) customNav.style.display = 'none';
  }

  document.documentElement.setAttribute('data-sidebar-mode', _sidebarMode);
}

// v26.0: Sidebar Favorites
function getFavoritePages() {
  try {
    return JSON.parse(localStorage.getItem('roweos_sidebar_favorites') || '[]');
  } catch(e) { return []; }
}

function toggleFavorite(viewId, label) {
  var favs = getFavoritePages();
  var idx = -1;
  for (var i = 0; i < favs.length; i++) {
    if (favs[i].id === viewId) { idx = i; break; }
  }
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push({ id: viewId, label: label });
  }
  localStorage.setItem('roweos_sidebar_favorites', JSON.stringify(favs));
  renderFavorites();
}

function isFavorite(viewId) {
  var favs = getFavoritePages();
  for (var i = 0; i < favs.length; i++) {
    if (favs[i].id === viewId) return true;
  }
  return false;
}

// v26.1: View labels for favorite star button
var _viewLabels = {
  agent: 'Chat', signal: 'Focus', pulse: 'Pulse', studio: 'Studio',
  rhythm: 'Rhythm', library: 'Library', memory: 'Identity', tuning: 'History',
  settings: 'Settings', inventory: 'Inventory', clients: 'People',
  commerce: 'Analytics', admin: 'Admin', mail: 'Mail', folio: 'Folio',
  social: 'Media Lab', bloom: 'Bloom', automations: 'Automations',
  brandIntel: 'Guardrails'
};

// v26.1: Inject favorite star button into page header
function updateFavoriteStarButton(viewId) {
  // Don't show star on settings, admin, or sectionLanding
  if (viewId === 'settings' || viewId === 'admin' || viewId === 'sectionLanding') return;

  var viewEl = document.getElementById(viewId + 'View');
  if (!viewEl) return;

  // Remove any existing star
  var existing = viewEl.querySelector('.focus-fav-star-btn');
  if (existing) existing.parentNode.removeChild(existing);

  // Find the panel-header in this view
  var header = viewEl.querySelector('.panel-header');
  if (!header) return;

  var label = _viewLabels[viewId] || viewId;
  var isFav = isFavorite(viewId);

  var btn = document.createElement('button');
  btn.className = 'focus-fav-star-btn';
  btn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
  btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;margin-left:8px;display:flex;align-items:center;';
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="' + (isFav ? 'var(--brand-accent, #a89878)' : 'none') + '" stroke="' + (isFav ? 'var(--brand-accent, #a89878)' : 'var(--text-muted)') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  btn.onclick = function(e) {
    e.stopPropagation();
    toggleFavorite(viewId, label);
    updateFavoriteStarButton(viewId);
  };

  header.appendChild(btn);
}

function renderFavorites() {
  var favs = getFavoritePages();
  var section = document.getElementById('sidebarFavorites');
  var list = document.getElementById('favoritesNavList');
  if (!section || !list) return;

  if (favs.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  var html = '';
  for (var i = 0; i < favs.length; i++) {
    var fav = favs[i];
    html += '<div class="nav-item nav-favorite-item" data-view="' + escapeHtml(fav.id) + '" onclick="showView(\'' + escapeHtml(fav.id) + '\')">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    html += '<span class="nav-label">' + escapeHtml(fav.label) + '</span>';
    html += '</div>';
  }
  list.innerHTML = html;
}

function toggleFavoritesSection() {
  var list = document.getElementById('favoritesNavList');
  var chevron = document.getElementById('favoritesChevron');
  if (!list) return;
  var isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : '';
  if (chevron) chevron.style.transform = isOpen ? 'rotate(-90deg)' : '';
}

// v26.0: Set sidebar navigation mode
function setSidebarMode(mode) {
  _sidebarMode = mode;
  localStorage.setItem('roweos_sidebar_mode', mode);
  applySidebarMode();
}

function toggleSidebarGroup(groupEl) {
  if (_sidebarMode !== 'expanded') return;
  var subitems = groupEl.querySelector('.nav-subitems');
  if (!subitems) return;
  var isOpen = subitems.style.display !== 'none';
  subitems.style.display = isOpen ? 'none' : 'block';
  var group = groupEl.getAttribute('data-group');
  localStorage.setItem('roweos_sidebar_expanded_' + group, isOpen ? 'false' : 'true');
}

// v26.0: Render section landing page
function showSectionLanding(groupName) {
  var group = _sectionGroups[groupName];
  if (!group) { showView('agent'); return; }

  updateNavBreadcrumb(['Home', groupName]);

  var html = '<div class="section-landing">';

  // Left: Info
  html += '<div class="section-landing-info">';
  html += '<div class="section-landing-label">' + escapeHtml(group.label) + '</div>';
  html += '<div class="section-landing-tagline">' + escapeHtml(group.tagline) + '</div>';
  html += '<div class="section-landing-desc">' + escapeHtml(group.description) + '</div>';
  html += '<div class="section-landing-stats" id="sectionLandingStats"></div>';
  html += '</div>';

  // Right: Navigation cards
  // v28.4: Build feature list with admin-only items injected dynamically
  var _landingFeatures = group.features.slice();
  if (groupName === 'Governance' && typeof isAdmin === 'function' && isAdmin()) {
    _landingFeatures.push({ id: 'admin', label: 'Admin', desc: 'Access keys, brand configs, and system controls', icon: 'admin' });
  }
  html += '<div class="section-landing-nav">';
  for (var i = 0; i < _landingFeatures.length; i++) {
    var f = _landingFeatures[i];
    html += '<div class="section-landing-card" tabindex="0" role="link" onclick="navigateToSubSection(\'' + escapeHtml(groupName) + '\', \'' + escapeHtml(f.id) + '\')" onkeydown="if(event.key===\'Enter\')this.click()">';
    html += '<div class="section-landing-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + getSectionIcon(f.icon) + '</svg></div>';
    html += '<div><div class="section-landing-card-title">' + escapeHtml(f.label) + '</div>';
    html += '<div class="section-landing-card-desc">' + escapeHtml(f.desc) + '</div></div>';
    html += '</div>';
  }

  // Secondary pills
  if (group.secondary && group.secondary.length > 0) {
    html += '<div class="section-landing-secondary">';
    for (var j = 0; j < group.secondary.length; j++) {
      var s = group.secondary[j];
      html += '<div class="section-landing-secondary-pill" onclick="navigateToSubSection(\'' + escapeHtml(groupName) + '\', \'' + escapeHtml(s.id) + '\')">' + escapeHtml(s.label) + '</div>';
    }
    html += '</div>';
  }

  html += '</div></div>';

  document.getElementById('sectionLandingContent').innerHTML = html;
  showView('sectionLanding');
}

// v26.0: Navigate from landing page card to sub-section view
function navigateToSubSection(groupName, viewId) {
  var group = _sectionGroups[groupName];
  if (!group) return;
  var featureLabel = viewId;
  for (var i = 0; i < group.features.length; i++) {
    if (group.features[i].id === viewId) { featureLabel = group.features[i].label; break; }
  }
  if (group.secondary) {
    for (var j = 0; j < group.secondary.length; j++) {
      if (group.secondary[j].id === viewId) { featureLabel = group.secondary[j].label; break; }
    }
  }
  updateNavBreadcrumb(['Home', groupName, featureLabel]);
  showView(viewId);
}

// v26.0: Per-page landing configurations (for pages with sub-tabs)
var _pageLandingConfigs = {
  // v28.9: Media Lab merged into Studio — landing config removed
  // v29.0: Scribe - Knowledge Workspace
  'scribe': {
    label: 'SCRIBE',
    tagline: 'Your Knowledge Workspace',
    description: 'Create notebooks, synthesize knowledge, and connect ideas across your brands and life.',
    features: [
      { id: 'notebooks', label: 'Notebooks', desc: 'Create and organize your thoughts' },
      { id: 'knowledge', label: 'Knowledge', desc: 'AI-powered synthesis from your sources' }
    ],
    secondary: [],
    tabHandler: 'showScribeSection'
  },
  'automations': {
    label: 'AUTOMATIONS',
    tagline: 'Build Once, Run Forever',
    description: 'Automated workflows, pipelines, and scheduled intelligence that work while you sleep.',
    features: [
      { id: 'autoagent', label: 'Agent Builder', desc: 'Create and edit automated workflows' },
      { id: 'browse', label: 'Browse', desc: 'Explore automations by category or schedule' },
      { id: 'workflows', label: 'Workflows', desc: 'Manage automation pipelines' },
      { id: 'scheduler', label: 'Executions', desc: 'Monitor pipeline runs with step-by-step detail' }
    ],
    secondary: [
      { id: 'agents', label: 'Studio Lab' },
      { id: 'imagelab', label: 'Image Lab' },
      { id: 'videolab', label: 'Video Lab' },
      { id: 'pending', label: 'Pending' }
    ],
    tabHandler: 'showAutoLabTab'
  },
  'mail': {
    label: 'MAIL',
    tagline: 'Your correspondence, organized',
    description: 'Compose, review, and manage email across all connected accounts.',
    features: [
      { id: 'inbox', label: 'Inbox', desc: 'Read and respond to messages' },
      { id: 'compose', label: 'Compose', desc: 'Write a new message with AI assistance' },
      { id: 'drafts', label: 'Drafts', desc: 'Continue working on saved drafts' }
    ],
    secondary: [
      { id: 'sent', label: 'Sent' },
      { id: 'outbox', label: 'Outbox' },
      { id: 'connections', label: 'Settings' }
    ],
    tabHandler: 'switchMailTab'
  },
  'guardrails': {
    label: 'GUARDRAILS',
    tagline: 'Brand safety and governance',
    description: 'Define rules for AI agents, content, automations, and client interactions.',
    features: [
      { id: 'agents', label: 'Agents', desc: 'AI agent governance rules' },
      { id: 'content', label: 'Content Rules', desc: 'Brand content guidelines' },
      { id: 'automations', label: 'Automations', desc: 'Automation restrictions and limits' },
      { id: 'clients', label: 'Clients', desc: 'Client-specific rules' }
    ],
    secondary: [
      { id: 'prompt', label: 'System Prompt' }
    ],
    tabHandler: 'showGuardrailsTab'
  },
  'memory': {
    label: 'IDENTITY',
    tagline: 'Know your brand inside out',
    description: 'Brand memory, user profiles, knowledge base, and platform intelligence.',
    features: [
      { id: 'user', label: 'Brand User', desc: 'Your role, brand profile, and team access' },
      { id: 'knowledge', label: 'Brand Knowledge', desc: 'Brand essence, messaging, and competitive positioning' },
      { id: 'platform', label: 'Platform Memory', desc: 'Bloom knowledge and automation memory' }
    ],
    secondary: [],
    tabHandler: 'showIdentityCategory'
  },
  'commerce': {
    label: 'ANALYTICS',
    tagline: 'Measure what matters',
    description: 'API costs, invoices, client metrics, and performance analytics.',
    features: [
      { id: 'overview', label: 'Overview', desc: 'Summary dashboard with key metrics' },
      { id: 'api', label: 'API Costs', desc: 'Detailed API spending breakdown' },
      { id: 'invoices', label: 'Invoices', desc: 'Invoice history and billing' }
    ],
    secondary: [
      { id: 'website', label: 'Website' },
      { id: 'social', label: 'Social' }
    ],
    tabHandler: 'showCommerceTab'
  },
  'clients': {
    label: 'PEOPLE',
    tagline: 'Relationships that matter',
    description: 'Client management, team coordination, and relationship tracking.',
    features: [
      { id: 'client', label: 'Clients', desc: 'Pipeline, contacts, and address book' },
      { id: 'team', label: 'Team', desc: 'Team member management and roles' },
      { id: 'report', label: 'Reports', desc: 'Client activity and engagement reports' }
    ],
    secondary: [],
    tabHandler: 'showPeopleType'
  },
  'settings': {
    label: 'SYSTEM',
    tagline: 'Configure, measure, and manage',
    description: 'API keys, appearance, cloud sync, connections, preferences, and account management.',
    features: [
      { id: 'appearance', label: 'Appearance', desc: 'Theme, colors, logos, and visual identity' },
      { id: 'ai', label: 'AI & Models', desc: 'API keys, providers, and model preferences' },
      { id: 'cloud', label: 'Cloud & Sync', desc: 'Sync settings, scheduler, and push notifications' },
      { id: 'connections', label: 'Connections', desc: 'Calendar, social media, and integrations' },
      { id: 'intelligence', label: 'Intelligence', desc: 'Cross-mode sharing and knowledge transfer' },
      { id: 'preferences', label: 'Preferences', desc: 'Sidebar, navigation, shortcuts, and time format' },
      { id: 'accessibility', label: 'Accessibility', desc: 'Display size, text size, and visual adjustments' },
      { id: 'data', label: 'Data & Storage', desc: 'Import, export, reset, and storage management' },
      { id: 'account', label: 'Account', desc: 'Plan, profile, subscription, and billing' },
      { id: 'feedback', label: 'Feedback', desc: 'Report bugs, request features, and share suggestions' },
      { id: 'update', label: 'Update', desc: 'Check for software updates and view changelog' },
      { id: 'about', label: 'About', desc: 'Version info, credits, and legal' }
    ],
    secondary: [],
    tabHandler: 'openSettingsFolder'
  },
  'studio': {
    label: 'STUDIO',
    tagline: 'Create with intelligence',
    description: 'AI-powered operations, content generation, and document creation with specialized agents.',
    features: [
      { id: 'all', label: 'All Agents', desc: 'Browse all available agent operations' },
      { id: 'strategy', label: 'Strategy', desc: 'Business strategy and planning operations' },
      { id: 'marketing', label: 'Marketing', desc: 'Content marketing and campaign tools' },
      { id: 'operations', label: 'Operations', desc: 'Business operations and process automation' },
      { id: 'documents', label: 'Documents', desc: 'Documentation and technical writing' },
      { id: 'research', label: 'Research', desc: 'Market research and competitive analysis' }
    ],
    secondary: [
      { id: 'intelligence', label: 'Intelligence' },
      { id: 'social', label: 'Social' },
      { id: 'image', label: 'Image' },
      { id: 'video', label: 'Video' },
      { id: 'guided', label: 'Guided' }
    ],
    tabHandler: 'filterStudioByCategory'
  },
  // v28.8: signal/Focus landing config removed — retired, redirects to pulse
  'rhythm': {
    label: 'RHYTHM',
    tagline: 'Time well orchestrated',
    description: 'Calendar, events, and task management across all your brands.',
    features: [
      { id: 'calendar', label: 'Calendar', desc: 'Week and month view of all events' },
      { id: 'events', label: 'Events', desc: 'Create and manage events' },
      { id: 'todos', label: 'To-Dos', desc: 'Task list and completion tracking' }
    ],
    secondary: [],
    tabHandler: 'showRhythmSection'
  },
  'library': {
    label: 'LIBRARY',
    tagline: 'Your content, organized',
    description: 'Content storage across all brands. Notes, files, folders, and generated outputs.',
    features: [
      { id: 'visual', label: 'Visual Assets', desc: 'Browse brand images, logos, and generated visuals' },
      { id: 'browse', label: 'Browse All', desc: 'View content across all brands' },
      { id: 'note', label: 'Quick Note', desc: 'Quickly add a new note' },
      { id: 'upload', label: 'Upload File', desc: 'Upload a document or media file' },
      { id: 'folder', label: 'New Folder', desc: 'Create a new folder for organization' }
    ],
    secondary: [],
    tabHandler: 'handleLibraryAction'
  },
  'folio': {
    label: 'FOLIO',
    tagline: 'Your brand showcase',
    description: 'Portfolio canvas for visual brand assets and AI-powered design.',
    features: [
      { id: 'gallery', label: 'Gallery', desc: 'Browse and manage your visual portfolio' },
      { id: 'chat', label: 'Chat', desc: 'AI-assisted design conversation' }
    ],
    secondary: [],
    tabHandler: 'switchFolioTab'
  },
  'research': {
    label: 'RESEARCH',
    tagline: 'Web intelligence on demand',
    description: 'Analyze any website to extract structured intelligence. Crawl pages, search the web, and synthesize complete profiles.',
    features: [
      { id: 'search', label: 'New Search', desc: 'Enter a URL and run the full analysis pipeline' },
      { id: 'history', label: 'History', desc: 'View and revisit past research results' }
    ],
    secondary: [],
    tabHandler: 'switchResearchTab'
  },
  'tuning': {
    label: 'HISTORY',
    tagline: 'Every conversation remembered',
    description: 'Browse and search your AI conversation history across all modes.',
    features: [
      { id: 'all', label: 'All History', desc: 'Complete conversation log' },
      { id: 'brand', label: 'BrandAI', desc: 'Business mode conversations' },
      { id: 'life', label: 'LifeAI', desc: 'Personal mode conversations' }
    ],
    secondary: [],
    tabHandler: 'filterHistoryByMode'
  },
  'pulse': {
    label: 'PULSE',
    tagline: 'Track what matters',
    description: 'Goals, journal, activity tracking, and brand health metrics.',
    features: [
      { id: 'goals', label: 'Goals & Checklists', desc: 'Set and track your brand objectives' },
      { id: 'journal', label: 'Journal', desc: 'Daily reflections and progress notes' },
      { id: 'activity', label: 'Activity Feed', desc: 'Recent actions and milestones' },
      { id: 'stats', label: 'Analytics', desc: 'Performance metrics and trends' }
    ],
    secondary: [],
    tabHandler: 'showPulseSection'
  },
  'bloom': {
    label: 'BLOOM',
    tagline: 'Grow with intelligence',
    description: 'Curated content feed with inspiration, trends, and ideas for your brands.',
    features: [
      { id: 'feed', label: 'Feed', desc: 'AI-curated content feed with trends and inspiration' },
      { id: 'library', label: 'Content Library', desc: 'Your saved and collected content pieces' },
      { id: 'create', label: 'Create', desc: 'Generate custom content from a topic or idea' }
    ],
    secondary: [],
    tabHandler: 'showBloomSection'
  }
};

// v26.0: Landing page tab handlers for views without native tab switching

function filterStudioByCategory(catId) {
  // enterPageSubSection already calls showView -- just do the tab action
  if (typeof selectAgent === 'function') {
    selectAgent(catId);
  }
}

function showFocusSection(sectionId) {
  // enterPageSubSection already calls showView -- just handle pill switching
  showFocusPill(sectionId);
}

// v26.1: Focus pill navigation
function showFocusPill(pillId) {
  // Normalize legacy saved values
  if (pillId === 'upcoming') pillId = 'today';
  if (!pillId) pillId = 'dashboard';

  var dashboard = document.getElementById('focusDashboardContent');
  var today = document.getElementById('focusTodayContent');
  var tasks = document.getElementById('focusTasksContent');

  if (dashboard) dashboard.classList.remove('active');
  if (today) today.classList.remove('active');
  if (tasks) tasks.classList.remove('active');

  if (pillId === 'today' && today) {
    today.classList.add('active');
    renderFocusTodayView();
  } else if (pillId === 'tasks' && tasks) {
    tasks.classList.add('active');
    renderFocusTasksView();
  } else {
    if (dashboard) dashboard.classList.add('active');
    pillId = 'dashboard';
  }

  // Update pill nav active state
  updatePillNavActive('focusPillNavContainer', pillId);

  // Save state
  try { localStorage.setItem('roweos_focus_active_pill', pillId); } catch(e) {}
}

function showRhythmSection(sectionId) {
  // enterPageSubSection already calls showView -- just do the tab action
  if (sectionId === 'events') {
    if (typeof openRhythmAddForm === 'function') openRhythmAddForm('event');
  } else if (sectionId === 'todos') {
    if (typeof openRhythmAddForm === 'function') openRhythmAddForm('todo');
  }
  // 'calendar' = default full view, nothing extra needed
}

function handleLibraryAction(actionId) {
  // enterPageSubSection already calls showView -- just do the tab action
  if (actionId === 'note') {
    if (typeof createModeAwareStickyNote === 'function') createModeAwareStickyNote();
  } else if (actionId === 'upload') {
    var fileInput = document.getElementById('bloomLibraryFileInput');
    if (fileInput) fileInput.click();
  } else if (actionId === 'folder') {
    if (typeof createLibraryFolder === 'function') createLibraryFolder();
  } else if (actionId === 'visual') {
    if (typeof renderVisualAssetsView === 'function') renderVisualAssetsView();
  }
  // 'browse' = default full view, nothing extra needed
}

function showPulseSection(sectionId) {
  // enterPageSubSection already calls showView -- nothing extra needed
  // Pulse is a single scrollable page without sub-tabs
}

function showBloomSection(sectionId) {
  // enterPageSubSection already calls showView -- just do the tab action
  if (sectionId === 'library' || sectionId === 'content') {
    if (typeof toggleBloomLibrary === 'function') toggleBloomLibrary();
  } else if (sectionId === 'create') {
    if (typeof showBloomLaunchModal === 'function') showBloomLaunchModal();
  }
  // 'feed' = default full view, nothing extra needed
}

// v26.0: Show per-page landing page (for individual views with sub-tabs)
function showPageLanding(viewId) {
  var config = _pageLandingConfigs[viewId];
  if (!config) {
    showView(viewId);
    return;
  }

  // v27.0: Global "disable all landing pages" preference
  if (localStorage.getItem('roweos_landing_pages_disabled') === 'true') {
    window._skipPageLanding = true;
    window._landingDisabledRedirect = true; // v27.3: distinguish from sub-section entry
    showView(viewId);
    window._landingDisabledRedirect = false;
    return;
  }

  // v27.0: Per-section skip landing preference (was only checked in showView, not here)
  var _sPrefs = getSectionPrefs(viewId);
  if (_sPrefs && _sPrefs.skipLanding) {
    window._skipPageLanding = true;
    window._landingDisabledRedirect = true; // v27.3: distinguish from sub-section entry
    showView(viewId);
    window._landingDisabledRedirect = false;
    // Apply default pill if configured
    if (_sPrefs.defaultPill && config.tabHandler) {
      if (typeof window[config.tabHandler] === 'function') {
        window[config.tabHandler](_sPrefs.defaultPill);
      }
    }
    return;
  }

  // Build landing HTML using same CSS classes as section landing
  var html = '<div class="section-landing">';

  // Left: Info
  html += '<div class="section-landing-info">';
  html += '<div class="section-landing-label">' + escapeHtml(config.label) + '</div>';
  html += '<div class="section-landing-tagline">' + escapeHtml(config.tagline) + '</div>';
  html += '<div class="section-landing-desc">' + escapeHtml(config.description) + '</div>';
  html += '<div class="section-landing-stats"></div>';
  html += '</div>';

  // Right: Feature cards
  html += '<div class="section-landing-nav">';
  for (var i = 0; i < config.features.length; i++) {
    var f = config.features[i];
    html += '<div class="section-landing-card" tabindex="0" onclick="enterPageSubSection(\'' + escapeHtml(viewId) + '\', \'' + escapeHtml(f.id) + '\')" onkeydown="if(event.key===\'Enter\')this.click()">';
    html += '<div class="section-landing-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + getSectionIcon(f.id) + '</svg></div>';
    html += '<div><div class="section-landing-card-title">' + escapeHtml(f.label) + '</div>';
    html += '<div class="section-landing-card-desc">' + escapeHtml(f.desc) + '</div></div>';
    html += '</div>';
  }

  // Secondary pills
  if (config.secondary && config.secondary.length > 0) {
    html += '<div class="section-landing-secondary">';
    for (var j = 0; j < config.secondary.length; j++) {
      var s = config.secondary[j];
      html += '<div class="section-landing-secondary-pill" onclick="enterPageSubSection(\'' + escapeHtml(viewId) + '\', \'' + escapeHtml(s.id) + '\')">' + escapeHtml(s.label) + '</div>';
    }
    html += '</div>';
  }

  html += '</div></div>';

  document.getElementById('sectionLandingContent').innerHTML = html;

  // Update breadcrumb
  updateNavBreadcrumb(['Home', config.label.charAt(0) + config.label.slice(1).toLowerCase()]);

  showView('sectionLanding');
}

// v26.0: Enter a sub-section from a per-page landing page
function enterPageSubSection(viewId, tabId) {
  var config = _pageLandingConfigs[viewId];
  if (!config) return;

  // Set skip flag so showView doesn't re-intercept
  window._skipPageLanding = true;

  // Show the actual view
  showView(viewId);

  // Then switch to the specific tab
  if (config.tabHandler && typeof window[config.tabHandler] === 'function') {
    window[config.tabHandler](tabId);
  }

  // Update pill nav active state
  var pillContainers = ['socialHubPillNav', 'autoLabPillNav', 'mailPillNav', 'guardrailsPillNav', 'systemPillNav'];
  for (var i = 0; i < pillContainers.length; i++) {
    if (typeof updatePillNavActive === 'function') {
      updatePillNavActive(pillContainers[i], tabId);
    }
  }
}

// View Management
function showView(view) {
  // v10.5.25: Store original view for nav highlighting before redirects
  var originalView = view;

  // v26.0: Per-page landing interception (only in expanded/advanced mode)
  var sidebarMode = localStorage.getItem('roweos_sidebar_mode') || 'grouped';
  // v27.3: _wasSubSectionEntry = true ONLY when user clicked a specific sub-section on landing page,
  // NOT when showPageLanding redirected due to disabled landing pages
  var _wasSubSectionEntry = !!window._skipPageLanding && !window._landingDisabledRedirect;
  if (_pageLandingConfigs[view]) {
    // Don't show if we're coming FROM the landing page (entering a sub-section)
    if (!window._skipPageLanding) {
      // v26.2: Check section prefs for skip landing
      var _sectionPrefs = getSectionPrefs(view);
      if (_sectionPrefs && _sectionPrefs.skipLanding) {
        // v27.2: Don't recurse -- just set flag and fall through to render the view
        window._skipPageLanding = true;
        // Will be handled below when _skipPageLanding is checked
      } else {
      showPageLanding(view);
      return;
    }
    } // v27.3: closes if (!_skipPageLanding)
    window._skipPageLanding = false;
  }

  // v10.5.25: Preserve mode when switching views (except for agent view which has special handling)
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (view !== 'agent') {
    // Ensure life-mode class is present if in life mode
    if (currentMode === 'life') {
      document.documentElement.classList.add('life-mode');
      document.documentElement.classList.remove('brand-mode');
    } else {
      document.documentElement.classList.add('brand-mode');
      document.documentElement.classList.remove('life-mode');
    }
  }
  
  // v9.1.14: Close any open file preview modal when navigating away
  if (typeof closeFilePreview === 'function') {
    closeFilePreview();
  }
  // v9.1.14: Close save library modal when navigating away
  if (typeof closeSaveLibraryModal === 'function') {
    closeSaveLibraryModal();
  }
  
  // v9.1.14: Redirect identity to memory (merged into Brand Identity)
  if (view === 'identity') {
    view = 'memory';
  }
  // v9.1.14: Redirect schedule to rhythm (Automation merged into Rhythm)
  if (view === 'schedule') {
    view = 'rhythm';
  }
  // v9.1.14: Redirect guardrails to brandIntel (view container)
  if (view === 'guardrails') {
    view = 'brandIntel';
  }

  // v24.26: Track current view on body for CSS targeting (helix full-screen fix)
  document.body.setAttribute('data-view', view);

  // v27.3: Removed closeSettingsFolder() call here -- it caused infinite recursion:
  // showView -> closeSettingsFolder -> showPageLanding -> showView -> closeSettingsFolder ...
  // Settings reset is handled by showSettings() + openSettingsFolder('appearance') below

  currentView = view;
  
  // v10.5.25: Update nav items - use originalView for proper highlighting
  document.querySelectorAll('.nav-item').forEach(function(item) {
    var itemView = item.dataset.view;
    // Check both the original view AND the redirected view for matching
    var isActive = (itemView === originalView) || (itemView === view);
    item.classList.toggle('active', isActive);
  });

  // v26.0: Highlight parent group in grouped sidebar mode
  var sidebarMode = localStorage.getItem('roweos_sidebar_mode') || 'grouped';
  if (sidebarMode === 'grouped') {
    var groupItems = document.querySelectorAll('.nav-item[data-group]');
    for (var gi = 0; gi < groupItems.length; gi++) {
      groupItems[gi].classList.remove('active');
      var subitems = groupItems[gi].querySelectorAll('.nav-subitem');
      for (var si = 0; si < subitems.length; si++) {
        if (subitems[si].getAttribute('data-view') === view) {
          groupItems[gi].classList.add('active');
          break;
        }
      }
    }
  }

  // Hide all views
  var allViews = ['agent', 'studio', 'identity', 'signal', 'rhythm', 'pulse', 'brandIntel', 'tuning', 'settings', 'memory', 'export', 'library', 'analytics', 'schedule', 'inventory', 'clients', 'commerce', 'journal', 'sync', 'automations', 'admin', 'bloom', 'mail', 'folio', 'research', 'social', 'sectionLanding', 'scribe']; // v29.0: Added scribe
  allViews.forEach(function(v) {
    var el = document.getElementById(v + 'View');
    if (el) el.classList.add('hidden');
  });

  // Show selected view
  var viewEl = document.getElementById(view + 'View');
  if (viewEl) {
    viewEl.classList.remove('hidden');
  }

  // v12.2.4: Render journal when switching to journal view
  if (view === 'journal') {
    renderJournal();
  }

  // v12.2.4: Initialize sync hub when switching to sync view
  if (view === 'sync') {
    initSyncHub();
  }

  // v15.0: Render settings panels
  if (view === 'settings') {
    // v24.9: Scroll to top when re-clicking Settings in sidebar
    var _settingsPanel = document.getElementById('settingsView');
    if (_settingsPanel) _settingsPanel.scrollTop = 0;
    // v20.6: Render Your Plan section for signed-in users
    if (typeof renderSettingsPlan === 'function') renderSettingsPlan();
    // v20.9: Load API key marketplace for signed-in users
    if (typeof loadApiKeyMarketplace === 'function') loadApiKeyMarketplace();
    // v20.4: Show share brand row for any signed-in user
    var shareRow = document.getElementById('shareBrandSettingsRow');
    if (shareRow) shareRow.style.display = firebaseUser ? '' : 'none';
    // v23.2: Init settings folder drag-and-drop
    if (typeof initSettingsFolderDrag === 'function') initSettingsFolderDrag();
    // v23.5: Render model tier cards
    if (typeof renderModelTierCards === 'function') renderModelTierCards();
    // v24.27: Re-apply cloud scheduler toggle state
    if (typeof initCloudSchedulerState === 'function') initCloudSchedulerState();
    // v23.5: Render advanced mode toggle
    if (typeof renderAdvancedModeToggle === 'function') renderAdvancedModeToggle();
    // v26.0: Init sidebar mode select
    var modeSelect = document.getElementById('sidebarModeSelect');
    if (modeSelect) modeSelect.value = _sidebarMode || 'grouped';
    // v26.2: Render selector style picker and logo upload previews
    if (typeof renderSelectorStylePicker === 'function') renderSelectorStylePicker();
    if (typeof renderLogoUploadPreviews === 'function') renderLogoUploadPreviews();
    // v26.3: Render workspace style picker
    if (typeof renderWorkspaceStylePicker === 'function') renderWorkspaceStylePicker();
    // v26.3: Render sidebar layout panel + premium toggle
    if (typeof renderSettingsSidebarLayout === 'function') renderSettingsSidebarLayout();
    // v27.0: Init landing pages toggle
    if (typeof initLandingPagesToggle === 'function') initLandingPagesToggle();
  }

  // v24.11: Tier-based view access gate
  if (typeof checkViewAccess === 'function' && checkViewAccess(view)) {
    return; // blocked — upgrade modal shown
  }

  // v22.1: Admin view — dedicated panel
  if (view === 'admin') {
    if (!isAdmin()) { showView('settings'); return; }
    if (typeof renderAdminPanel === 'function') renderAdminPanel();
    if (typeof renderAdminFeedback === 'function') renderAdminFeedback();
  }

  // v22.23: Mail view
  if (view === 'mail') {
    if (typeof renderMailView === 'function') renderMailView();
    // v24.13: Restore compact mode preference
    try {
      var _mailView = document.getElementById('mailView');
      if (_mailView && localStorage.getItem('roweos_mail_compact') === '1') {
        _mailView.classList.add('mail-compact');
        var _mcBtn = document.getElementById('mailCompactToggle');
        if (_mcBtn) _mcBtn.style.color = 'var(--accent)';
      }
    } catch(e) {}
    // v22.24: Close any open email detail and auto-fetch inbox
    if (typeof mailCloseDetail === 'function') mailCloseDetail();
    if (typeof mailRefreshInbox === 'function') {
      var mc = typeof getMailConfig === 'function' ? getMailConfig() : {};
      if (mc.gmailEmail || mc.outlookEmail || (mc.gmailAccounts && mc.gmailAccounts.length > 0) || (mc.outlookAccounts && mc.outlookAccounts.length > 0)) mailRefreshInbox();
    }
  }

  // v28.4: Media Lab view (renamed from Social Hub)
  if (view === 'social') {
    // v28.4: Render pill nav for Media Lab (merged Create+Publish into Post)
    renderPillNav('socialHubPillNav', [
      { id: 'engage', label: 'Engage' },
      { id: 'post', label: 'Post' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'blog', label: 'Blog', secondary: true },
      { id: 'activity', label: 'Activity', secondary: true },
      { id: 'media', label: 'Media', secondary: true },
      { id: 'settings', label: 'Settings', secondary: true }
    ], 'engage', function(tabId) { showSocialTab(tabId); }, { viewId: 'social' });
    if (typeof initSocialActivityLog === 'function') initSocialActivityLog();
    if (typeof loadScavengerConfigsFromFirestore === 'function') loadScavengerConfigsFromFirestore();
    if (typeof renderPublishTab === 'function') renderPublishTab();
  }

  // Special handling
  if (view === 'agent') {
    document.getElementById('agentView').classList.remove('hidden');
    document.getElementById('agentView').classList.remove('landing-view');
    document.getElementById('agentView').classList.add('landing-view');
    // v13.9: Ensure Nanobanana sections visible when returning to chat
    if (typeof updateNanobananaChatSections === 'function') updateNanobananaChatSections();
    // v10.5.25: DON'T reset mode on view navigation - preserve user's mode selection
    // The mode is set by user action (clicking mode toggle, selecting from dropdown, etc.)
    // Just sync the UI to match current mode
    syncBrandDropdowns();
    if (typeof syncMobileBrandV2 === 'function') syncMobileBrandV2(); // v10.5.25: Update mobile dropdown
    // v24.26: Resize helix after view is visible to fix bottom gap
    if (typeof resizeHelix === 'function') { setTimeout(resizeHelix, 50); setTimeout(resizeHelix, 300); }
  }
  if (view === 'studio') {
    // v26.2: Render Studio pill nav (unified system)
    var studioAgents = isLifeMode() ? [
      { id: 'all', label: 'All' },
      { id: 'planning', label: 'Planning' },
      { id: 'development', label: 'Development' },
      { id: 'wellness', label: 'Wellness' },
      { id: 'relationships', label: 'Relationships' },
      { id: 'finances', label: 'Finances' },
      { id: 'taxes', label: 'Taxes' },
      { id: 'home', label: 'Home' },
      { id: 'creativity', label: 'Creativity' },
      { id: 'reflection', label: 'Reflection' },
      { id: 'video', label: 'Video', secondary: true },
      { id: 'social', label: 'Social', secondary: true },
      { id: 'guided', label: 'Guided', secondary: true },
      { id: 'research', label: 'Research', secondary: true },
      { id: 'image', label: 'Image', secondary: true }
    ] : [
      { id: 'all', label: 'All Agents' },
      { id: 'strategy', label: 'Strategy' },
      { id: 'marketing', label: 'Marketing' },
      { id: 'operations', label: 'Operations' },
      { id: 'documents', label: 'Documents' },
      { id: 'intelligence', label: 'Intelligence' },
      { id: 'research', label: 'Research' },
      { id: 'guided', label: 'Guided' },
      { id: '_divider', label: '|' },
      { id: 'image', label: 'Image', secondary: true },
      { id: 'imagechat', label: 'Image Chat', secondary: true },
      { id: 'infographic', label: 'Infographic', secondary: true },
      { id: 'video', label: 'Video', secondary: true },
      { id: 'videochat', label: 'Video Chat', secondary: true },
      { id: 'social', label: 'Social', secondary: true },
      { id: 'blog', label: 'Blog', secondary: true }
    ];
    renderPillNav('studioPillNav', studioAgents, currentAgent || 'all', function(id) {
      selectAgent(id);
    }, { itemColors: AGENT_COLORS, noBorder: true, viewId: 'studio' });

    // v10.5.25: Mode-aware Studio
    updateStudioForMode();
    if (!isLifeMode()) {
      renderOperations();
    }
    renderStudioRunHistory(); // v15.33: Populate run history on view open
    updateBreadcrumb();
    updateStudioBrandName(); // v10.0
    if (typeof syncMobileBrandV2 === 'function') syncMobileBrandV2(); // v10.5.25: Sync mobile brand for mode
    if (typeof renderStudioClientSelector === 'function') renderStudioClientSelector(); // v23.3: Client selector
  }
  if (view === 'rhythm') {
    // v10.5.25: Mode-aware Rhythm
    updateRhythmForMode();
    renderRhythm();
    renderRhythmAutomations(); // v9.1.14
    renderAutoPilotActions(); // v12.0.3: Render Auto-Pilot actions
    if (typeof renderNotificationCenter === 'function') renderNotificationCenter(); // v9.1.14: Notification center
    if (typeof syncMobileBrandV2 === 'function') syncMobileBrandV2(); // v10.5.25: Sync mobile brand for mode
    if (typeof generateGoalTasks === 'function') generateGoalTasks(false); // v15.37: AI Goal Tasks
    // v16.12: Sync external calendars on Rhythm view open (if > 5 min since last sync)
    if (_gcalConnected || _icloudConnected || _outlookCalConnected) {
      var lastGSync = localStorage.getItem('roweos_gcal_last_sync');
      var lastISync = localStorage.getItem('roweos_icloud_last_sync');
      var lastOSync = localStorage.getItem('roweos_outlook_cal_last_sync');
      var fiveMinAgo = Date.now() - 300000;
      var needsSync = false;
      if (_gcalConnected && (!lastGSync || new Date(lastGSync).getTime() < fiveMinAgo)) needsSync = true;
      if (_icloudConnected && (!lastISync || new Date(lastISync).getTime() < fiveMinAgo)) needsSync = true;
      if (_outlookCalConnected && (!lastOSync || new Date(lastOSync).getTime() < fiveMinAgo)) needsSync = true;
      if (needsSync) syncAllExternalCalendars();
    }
    updateCalendarIntegrationUI();
    if (typeof updateDriveIntegrationUI === 'function') updateDriveIntegrationUI(); // v28.7
  }
  // v28.8: Signal/Focus retired — redirect to Pulse
  if (view === 'signal') { view = 'pulse'; }
  // v28.9: Media Lab merged into Studio — redirect
  if (view === 'social') { view = 'studio'; }
  if (view === 'signal') {
    renderSignalView();
    if (typeof initFocus2 === 'function') initFocus2(); // v10.5.25: Init Focus 2.0
    if (typeof syncMobileBrandV2 === 'function') syncMobileBrandV2(); // v10.5.25: Sync mobile brand for mode
    if (typeof restoreFocusCardStates === 'function') restoreFocusCardStates(); // v25.0: Restore collapsed/expanded states
  }
  if (view === 'identity') showSettings();
  if (view === 'tuning') {
    showTuning();
    renderTuningHistory();
    renderAgentHistory(); // v15.25: Refresh History on navigation so new Studio runs appear
  }
  if (view === 'settings') {
    showSettings();
    if (typeof initBlobSettings === 'function') initBlobSettings();
    // v26.2: Render pill nav for System settings
    renderPillNav('systemPillNav', [ // v29.1: Alphabetized
      { id: 'about', label: 'About' },
      { id: 'accessibility', label: 'Accessibility' },
      { id: 'account', label: 'Account' },
      { id: 'ai', label: 'AI & Models' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'cloud', label: 'Cloud & Sync' },
      { id: 'connections', label: 'Connections' },
      { id: 'data', label: 'Data & Storage' },
      { id: 'feedback', label: 'Feedback' },
      { id: 'intelligence', label: 'Intelligence' },
      { id: 'preferences', label: 'Preferences' },
      { id: 'update', label: 'Update' }
    ], 'about', function(tabId) { openSettingsFolder(tabId); }, { viewId: 'settings' }); // v29.1: Default to About
    // v26.0: Auto-open appearance (not feedback) as default, skip if entering specific sub-section
    // v27.3: Only check _wasSubSectionEntry (now correctly excludes landing-disabled redirects)
    if (!_wasSubSectionEntry) openSettingsFolder('appearance');
  }
  if (view === 'memory') {
    // v26.1: Render pill nav for Identity
    renderPillNav('identityPillNav', [
      { id: 'user', label: 'Brand User' },
      { id: 'knowledge', label: 'Brand Knowledge' },
      { id: 'platform', label: 'Platform Memory' }
    ], 'user', function(tabId) { showIdentityCategory(tabId); }, { viewId: 'memory' });
    // v10.5.25: Check mode and render appropriate Identity view
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    if (currentMode === 'life') {
      if (typeof renderLifeIdentityView === 'function') {
        renderLifeIdentityView();
      }
    } else {
      if (typeof renderBrandIdentityView === 'function') {
        renderBrandIdentityView();
      } else {
        // Fallback to original behavior
        renderMemoryBrandPills();
        updateMemoryUI();
        loadBrandKnowledge(currentKnowledgeBrand);
      }
      // v20.7: Ensure role badge + Digital Presence render with retry fallback
      setTimeout(function() {
        try { if (typeof renderIdentityRoleBadge === 'function') renderIdentityRoleBadge(); } catch(e) {}
        try { if (typeof renderDigitalPresenceCard === 'function') renderDigitalPresenceCard(); } catch(e) {}
        try { if (typeof renderIdentityBloomKnowledge === 'function') renderIdentityBloomKnowledge(); } catch(e) {}
        try { if (typeof loadUserContactUI === 'function') loadUserContactUI(); } catch(e) {}
        try { if (typeof renderAutomationMemoryList === 'function') renderAutomationMemoryList(); } catch(e) {}
      }, 200);
      setTimeout(function() {
        var rb = document.getElementById('identityRoleBadgeArea');
        if (rb && !rb.innerHTML.trim() && typeof renderIdentityRoleBadge === 'function') {
          try { renderIdentityRoleBadge(); } catch(e) {}
        }
        var dp = document.getElementById('identityDigitalPresenceArea');
        if (dp && !dp.innerHTML.trim() && typeof renderDigitalPresenceCard === 'function') {
          try { renderDigitalPresenceCard(); } catch(e) {}
        }
      }, 600);
    }
  }
  if (view === 'export') generateSystemPrompt();
  if (view === 'library') renderLibraryView();
  if (view === 'brandIntel') {
    // v14.0: Sync selectedBrand from localStorage before generating prompts
    try {
      var savedBrands = JSON.parse(localStorage.getItem('roweos_brands') || '[]');
      if (savedBrands.length > 0 && brands.length > 0) {
        var savedIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
        if (savedIdx >= 0 && savedIdx < brands.length) {
          selectedBrand = savedIdx;
        }
      }
    } catch (e) {}
    // v13.9: Reload guardrails from storage to get current brand/life selection
    loadGuardrails();
    generateSystemPrompt();
    // v10.5.25: Mode-aware Guardrails
    updateGuardrailsForMode();
    // v26.0: Render pill nav for Guardrails
    renderPillNav('guardrailsPillNav', [
      { id: 'agents', label: 'Agents' },
      { id: 'content', label: 'Content Rules' },
      { id: 'automations', label: 'Automations' },
      { id: 'clients', label: 'Clients' },
      { id: 'prompt', label: 'System Prompt', secondary: true }
    ], _guardrailsActiveTab || 'agents', function(tabId) { showGuardrailsTab(tabId); }, { viewId: 'guardrails' });
  }
  if (view === 'pulse') {
    // v28.8: Init Pulse 3.0 (goals, overview, calendar, checklists)
    if (typeof initPulse3 === 'function') initPulse3();
  }
  if (view === 'analytics') {
    updateAnalyticsDashboard();
  }
  if (view === 'schedule') {
    renderScheduleCalendar();
  }
  // v9.1.14: Inventory view
  if (view === 'inventory') {
    if (typeof renderInventoryView === 'function') renderInventoryView();
  }
  // v16.11: Clients view // v25.3: 'people' alias routes to clients
  if (view === 'people') { view = 'clients'; originalView = 'clients'; }
  if (view === 'clients') {
    // v26.1: Render pill nav for People
    renderPillNav('peoplePillNav', [
      { id: 'client', label: 'Clients' },
      { id: 'team', label: 'Team' },
      { id: 'report', label: 'Reports' }
    ], 'client', function(tabId) { showPeopleType(tabId); }, { viewId: 'clients' });
    if (typeof initClientsTabDrag === 'function') initClientsTabDrag();
    // v28.6: Ensure team/report container is hidden on init
    var _ptc = document.getElementById('peopleTypeContent');
    if (_ptc) _ptc.style.display = 'none';
    switchClientsTab(_clientsActiveTab || 'pipeline');
    if (typeof updatePeopleTypeCounts === 'function') updatePeopleTypeCounts();
  }
  // v25.3: Commerce/Analytics view - render overview + costs on open
  if (view === 'commerce') {
    // v26.1: Render pill nav for Analytics
    renderPillNav('analyticsPillNav', [
      { id: 'overview', label: 'Overview' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'api', label: 'API Costs' },
      { id: 'invoices', label: 'Invoices' },
      { id: 'website', label: 'Website', secondary: true },
      { id: 'social', label: 'Social', secondary: true }
    ], 'overview', function(tabId) { showCommerceTab(tabId); }, { viewId: 'commerce' });
    if (typeof renderCommerceView === 'function') renderCommerceView();
  }
  // v13.9: Automations Lab
  if (view === 'automations') {
    if (typeof buildAutoLabTabs === 'function') buildAutoLabTabs(); // v24.16: Rebuild tabs (order + badges)
    if (typeof initAutomationsLab === 'function') initAutomationsLab();
    if (typeof markAutomationsViewed === 'function') markAutomationsViewed(); // v24.13
  }
  // v25.0: Folio - Living Canvas
  if (view === 'folio') {
    if (typeof initFolioView === 'function') initFolioView();
  }

  if (view === 'research') {
    if (typeof renderResearchView === 'function') renderResearchView();
  }

  // v22.11: Bloom - AI Brand Feed
  if (view === 'bloom') {
    if (typeof renderBloom === 'function') renderBloom();
  }

  // v29.0: Scribe - Knowledge Workspace
  if (view === 'scribe') {
    if (typeof initScribe === 'function') initScribe();
  }

  // v28.8: Focus mobile layout block removed — signal retired

  // v26.1: Inject favorite star into page header
  updateFavoriteStarButton(view);

  // v23.5: Sprint 8 — check first-visit help for this section
  if (typeof checkFirstVisitHelp === 'function') checkFirstVisitHelp(view);
}

// v24.27: Removed dead showTab() — zero callers

// Toast Notification System
function dismissToast(toast) {
  if (!toast || toast.classList.contains('hiding')) return;
  
  toast.classList.add('hiding');
  toast.classList.remove('show');
  
  setTimeout(function() {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
  }, 300);
}

// v24.13: Generic confirm modal
function showConfirmModal(title, bodyHtml, onConfirm) {
  var modal = document.getElementById('genericConfirmModal');
  document.getElementById('genericConfirmTitle').textContent = title;
  document.getElementById('genericConfirmBody').innerHTML = bodyHtml;
  var okBtn = document.getElementById('genericConfirmOkBtn');
  var newBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newBtn, okBtn);
  newBtn.addEventListener('click', function() {
    modal.classList.remove('show');
    if (onConfirm) onConfirm();
  });
  modal.classList.add('show');
}

// Clear History Modal Functions
function openClearModal() {
  document.getElementById('clearModal').classList.add('show');
}

function closeClearModal() {
  document.getElementById('clearModal').classList.remove('show');
}

function clearData(type) {
  if (type === 'runs') {
    runs = [];
    showToast('Studio runs cleared', 'success');
  } else if (type === 'agent') {
    agentCommands = [];
    currentConversation = [];
    document.getElementById('agentConversation').classList.add('hidden');
    showToast('BrandAI conversations cleared', 'success');
  } else if (type === 'calendar') {
    calendar = [];
    showToast('Calendar cleared', 'success');
  } else if (type === 'all') {
    runs = [];
    agentCommands = [];
    currentConversation = [];
    calendar = [];
    pinnedOps = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    recentOps = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    document.getElementById('agentConversation').classList.add('hidden');
    showToast('All data cleared', 'success');
  }
  saveRuns();
  showHistory();
  renderAgentHistory();
  renderCalendar();
  renderOperations();
  closeClearModal();
  // v12.2.6: Refresh storage bar after clearing data
  refreshStorageDisplays();
}

// Developer Reset Functions
function openDeveloperResetModal() {
  console.log('🔧 Opening Developer Reset modal...');
  var modal = document.getElementById('developerResetModal');
  if (modal) {
    console.log('✓ Modal found, displaying...');
    modal.style.display = 'flex';
    modal.classList.add('show');  // CRITICAL: Add .show class for visibility!
    // Reset to step 1
    var step1 = document.getElementById('devResetStep1');
    var step2 = document.getElementById('devResetStep2');
    var input = document.getElementById('devResetConfirmInput');
    
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (input) input.value = '';
    
    console.log('✓ Developer Reset modal opened');
  } else {
    console.error('✗ Developer Reset modal not found!');
  }
}

function closeDeveloperResetModal() {
  var modal = document.getElementById('developerResetModal');
  if (modal) {
    modal.classList.remove('show');  // Remove .show class for fade-out
    setTimeout(function() {
      modal.style.display = 'none';
    }, 300);  // Wait for fade-out animation
    document.getElementById('devResetStep1').style.display = 'block';
    document.getElementById('devResetStep2').style.display = 'none';
    document.getElementById('devResetConfirmInput').value = '';
  }
}

// v9.1.14: Version History Modal Functions
function showVersionHistory() {
  var modal = document.getElementById('versionHistoryModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeVersionHistory() {
  var modal = document.getElementById('versionHistoryModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function showDevResetStep2() {
  document.getElementById('devResetStep1').style.display = 'none';
  document.getElementById('devResetStep2').style.display = 'block';
  
  // Enable/disable reset button based on input
  var input = document.getElementById('devResetConfirmInput');
  var btn = document.getElementById('devResetExecuteBtn');
  
  input.addEventListener('input', function() {
    if (input.value === 'RESET') {
      btn.disabled = false;
      btn.style.opacity = '1';
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    }
  });
  
  // Focus the input
  setTimeout(function() {
    input.focus();
  }, 100);
}

function executeDeveloperReset() {
  console.log('🔧 [DEV RESET] Starting execution...');
  var input = document.getElementById('devResetConfirmInput');
  
  if (!input) {
    console.error('✗ [DEV RESET] Input field not found!');
    return;
  }
  
  console.log('🔧 [DEV RESET] Input value:', input.value);
  
  if (input.value !== 'RESET') {
    console.warn('⚠ [DEV RESET] Incorrect confirmation text');
    showToast('Please type RESET to confirm', 'error');
    return;
  }
  
  console.log('✓ [DEV RESET] Confirmation validated');
  console.log('🗑️ [DEV RESET] Wiping all localStorage data...');
  
  // Show loading toast
  showToast('Resetting all data...', 'info');
  
  // Close modal
  closeDeveloperResetModal();
  
  // Wait a moment for visual feedback
  setTimeout(function() {
    // Nuclear option: Clear ALL localStorage
    localStorage.clear();
    
    console.log('✓ [DEV RESET] localStorage cleared');
    console.log('🔄 [DEV RESET] Reloading app as fresh install...');
    
    // Reload the page (will show welcome screen as if fresh install)
    location.reload();
  }, 500);
}

// Brand Transition
function onBrandChange() {
  // v18.3: Close any open modals before processing brand switch to prevent grey overlay stuck state
  try {
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
      if (overlay.style.display === 'flex' || overlay.classList.contains('show') || overlay.classList.contains('open')) {
        closeModal(overlay.id);
      }
    });
    if (typeof closeAllModals === 'function') closeAllModals();
  } catch(e) {}

  // v28.2: Read brand index from DOM first (set by caller), don't let stale ID override it
  var brandIdx = parseInt(document.getElementById('brand').value);

  // v19.0: Validate brand index before applying — prevents sync race conditions from resetting to 0
  if (isNaN(brandIdx) || brandIdx < 0 || brandIdx >= brands.length) {
    // Invalid value — restore dropdown to current selectedBrand
    var brandSelect = document.getElementById('brand');
    if (brandSelect) brandSelect.value = selectedBrand;
    return;
  }

  // v9.1.14: CRITICAL - Update selectedBrand for Memory view and Edit Brand modal
  var prevBrand = selectedBrand;
  selectedBrand = brandIdx;

  // v19.6: Notification Center — brand switch
  try {
    if (typeof window._lastNotifBrand !== 'undefined' && window._lastNotifBrand !== brandIdx && brands[brandIdx]) {
      var newBrandName = brands[brandIdx].shortName || brands[brandIdx].name;
      var fromBrandName = (brands[prevBrand] ? (brands[prevBrand].shortName || brands[prevBrand].name) : '');
      addNotification('brand_switch', 'Brand Switched', 'Now managing ' + newBrandName,
        { fromBrand: fromBrandName, toBrand: newBrandName, brandIdx: brandIdx });
    }
    window._lastNotifBrand = brandIdx;
  } catch(e) {}

  // v15.1: Apply per-brand accent color (theme-aware)
  if (brands[brandIdx]) {
    var brandColor = typeof getBrandColorForTheme === 'function' ? getBrandColorForTheme(brandIdx) : (brands[brandIdx].brandColor || '#a89878');
    applyBrandAccentColor(brandColor);
  }

  // v15.3: Persist last active brand for mode switching
  window.lastActiveBrandIdx = brandIdx;
  try { localStorage.setItem('roweos_selected_brand', String(brandIdx)); } catch(e) {}
  // v28.1: Also persist brand ID for stable resolution after reorder
  try { if (brands[brandIdx] && brands[brandIdx].id) localStorage.setItem('roweos_selected_brand_id', brands[brandIdx].id); } catch(e) {}
  // v29.0: Sync selected brand to Firestore for cross-device consistency
  if (typeof writeDB === 'function' && brands[brandIdx] && brands[brandIdx].id) {
    writeDB('profile/main', { 'settings.selectedBrandId': brands[brandIdx].id, 'settings.selectedBrand': String(brandIdx) });
  }

  // v9.1.14: Update brand icon active state and tooltip
  var landingBrandBtn = document.getElementById('landingBrandBtn');
  if (landingBrandBtn && brands[brandIdx]) {
    landingBrandBtn.classList.add('brand-active');
    landingBrandBtn.title = 'Brand: ' + (brands[brandIdx].shortName || brands[brandIdx].name);
  }
  
  // Sync agent brand selector (hidden input)
  var agentBrand = document.getElementById('agentBrand');
  if (agentBrand) agentBrand.value = brandIdx;
  
  // Update selected state in brand dropdown
  document.querySelectorAll('#brandDropdown .brand-option').forEach(function(opt) {
    opt.classList.remove('selected');
    if (opt.dataset.value == brandIdx) {
      opt.classList.add('selected');
    }
  });
  
  // Sync studio brand selector
  studioSelectedBrand = brandIdx;
  var studioBrand = document.getElementById('studioBrand');
  if (studioBrand) studioBrand.value = brandIdx;
  showAllOps = false;
  // v15.14: Update Studio brand name display on brand switch
  if (typeof updateStudioBrandName === 'function') updateStudioBrandName();

  // Sync mobile brand selector
  var mobileBrand = document.getElementById('mobileBrand');
  if (mobileBrand) mobileBrand.value = brandIdx;
  
  renderOperations();
  
  // Update tool dropdown
  renderToolOpsGrid();
  
  // Reset settings edit mode on brand change
  if (settingsEditMode) {
    settingsEditMode = false;
    pendingSettingsChanges = {};
    var editBtn = document.getElementById('editSettingsBtn');
    if (editBtn) editBtn.textContent = 'Edit';
  }
  
  // Update settings if on that view
  if (currentView === 'settings') {
    showSettings();
  }
  
  // v15.23: Dead code removed — Identity view uses currentView === 'memory', handled below
  
  // v28.3: Wrap Focus render in try/catch — crashes here must not break brand switch chain
  try {
    if (typeof renderFocusView === 'function') renderFocusView();
  } catch(e) { console.warn('[onBrandChange] renderFocusView error:', e.message); }

  // v15.30: Re-render Library view when brand changes so filter follows
  if (currentView === 'library' && typeof renderLibraryView === 'function') {
    renderLibraryView();
  }

  // v15.47: Re-render Inventory view when brand changes so filter follows
  if (currentView === 'inventory' && typeof renderInventoryGrid === 'function') {
    renderInventoryGrid();
  }

  // v16.11: Re-render Clients view when brand changes
  if (currentView === 'clients' && typeof renderClientsView === 'function') {
    renderClientsView();
  }

  // v18.0: Refresh social account cards for new brand's connections
  if (typeof refreshSocialAccountCards === 'function') {
    refreshSocialAccountCards();
  }

  // v15.13: Update brand intelligence title with shortName
  var brandTitle = document.getElementById('brandIntelligenceTitle');
  if (brandTitle && brands[brandIdx]) {
    brandTitle.textContent = brands[brandIdx].shortName || brands[brandIdx].name;
  }
  
  // Update sidebar brand name display
  updateBrandName();

  // v15.3: Load logo for selected brand (was missing, caused stale logos)
  if (typeof loadCurrentLogo === 'function') {
    loadCurrentLogo();
  }

  // Update v7.1 brand pill displays
  var landingBrandName = document.getElementById('landingBrandName');
  var followupBrandName = document.getElementById('followupBrandName');
  var mobileBrandPillText = document.getElementById('mobileBrandPillText');
  // v15.13: Use shortName || name consistently
  if (landingBrandName && brands[brandIdx]) {
    landingBrandName.textContent = brands[brandIdx].shortName || brands[brandIdx].name;
  }
  if (followupBrandName && brands[brandIdx]) {
    followupBrandName.textContent = brands[brandIdx].shortName || brands[brandIdx].name;
  }
  // v9.1.14: Also update mobile header pill
  if (mobileBrandPillText && brands[brandIdx]) {
    mobileBrandPillText.textContent = brands[brandIdx].shortName || brands[brandIdx].name;
  }
  
  // v9.1.14: Sync mobile header brand dropdown
  var mobileBrandDropdown = document.getElementById('mobileBrandDropdown');
  if (mobileBrandDropdown) {
    mobileBrandDropdown.value = brandIdx;
  }
  
  // v9.1.14: Update star buttons with provider color for this brand
  if (typeof updateStarButtonProvider === 'function') {
    updateStarButtonProvider();
  }
  
  // v15.23: Update Identity view if currently visible (includes role data reload)
  if (currentView === 'memory') {
    currentKnowledgeBrand = 'brand_' + brandIdx;
    if (typeof renderBrandIdentityView === 'function') {
      renderBrandIdentityView();
    } else {
      renderMemoryBrandPills();
      updateMemoryUI();
      loadBrandKnowledge(currentKnowledgeBrand);
    }
    // v20.7: Belt-and-suspenders role badge + Digital Presence render on brand change
    setTimeout(function() {
      try { if (typeof renderIdentityRoleBadge === 'function') renderIdentityRoleBadge(); } catch(e) {}
      try { if (typeof renderDigitalPresenceCard === 'function') renderDigitalPresenceCard(); } catch(e) {}
    }, 100);
  }
  
  // v10.5.25: Update BrandAI system prompt when brand changes
  if (typeof generateBrandAIPrompt === 'function') {
    generateBrandAIPrompt();
  }

  // v15.1: Re-render personalization if settings is open
  if (currentView === 'settings' && typeof initPersonalizationUI === 'function') {
    persBrandIdx = brandIdx;
    initPersonalizationUI();
  }
}

// Update Brand Name Display
function updateBrandName() {
  // v10.5.25: Check mode first - don't override Life mode name with Brand name
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  
  if (currentMode === 'life') {
    // In Life mode, show the user's name, not the brand
    var userName = localStorage.getItem('roweos_user_name') || 'My Life';
    var brandNameDisplay = document.getElementById('sidebarBrandName');
    if (brandNameDisplay) {
      brandNameDisplay.innerHTML = userName + ' <span class="sidebar-brand-arrow">▾</span>';
    }
    return;
  }
  
  // Brand mode - show brand name
  var brandSelect = document.getElementById('brand');
  var brandNameDisplay = document.getElementById('sidebarBrandName');
  
  if (brandSelect && brandNameDisplay && brands.length > 0) {
    var brandIdx = parseInt(brandSelect.value);
    if (brands[brandIdx]) {
      // v10.7.11: Use shortName if available, otherwise full name
      var displayName = brands[brandIdx].shortName || brands[brandIdx].name;
      // Preserve the arrow span
      var arrow = brandNameDisplay.querySelector('.sidebar-brand-arrow');
      brandNameDisplay.innerHTML = displayName;
      if (arrow || true) {
        brandNameDisplay.innerHTML += ' <span class="sidebar-brand-arrow">▾</span>';
      }
    }
  }
}

// Provider Dropdown Toggle
function toggleProviderDropdown(provider, event) {
  event.stopPropagation();
  
  // Detect if we're in landing view or conversation view
  var landingContent = document.getElementById('agentLandingContent');
  var isLanding = landingContent && 
                  (landingContent.style.display !== 'none') && 
                  !landingContent.classList.contains('hidden');
  
  var dropdownSuffix = isLanding ? '-landing' : '';
  
  // Close all other dropdowns
  document.querySelectorAll('.provider-dropdown').forEach(function(dropdown) {
    if (dropdown.id !== 'dropdown-' + provider + dropdownSuffix) {
      dropdown.style.display = 'none';
    }
  });
  document.querySelectorAll('.provider-pill.open').forEach(function(pill) {
    if (pill.dataset.provider !== provider) {
      pill.classList.remove('open');
    }
  });
  
  // Toggle current dropdown
  var dropdown = document.getElementById('dropdown-' + provider + dropdownSuffix);
  var pill = event.currentTarget;
  
  if (dropdown && (dropdown.style.display === 'none' || !dropdown.style.display)) {
    dropdown.style.display = 'block';
    pill.classList.add('open');
    
    // Highlight currently selected model
    // Check both brand selectors (Studio uses 'brand', BrandAI uses 'agentBrand')
    var brandSelect = document.getElementById('brand') || document.getElementById('agentBrand');
    if (brandSelect) {
      var brandIdx = parseInt(brandSelect.value);
      var currentModel = brands[brandIdx].model || 'claude-sonnet-4-6';
      var currentProvider = getProviderForModel(currentModel);
      
      if (currentProvider === provider) {
        dropdown.querySelectorAll('.provider-dropdown-item').forEach(function(item) {
          item.classList.remove('selected');
        });
        dropdown.querySelectorAll('.provider-dropdown-item').forEach(function(item) {
          var itemModel = item.getAttribute('onclick').match(/'([^']+)'/)[1];
          if (itemModel === currentModel) {
            item.classList.add('selected');
          }
        });
      }
    }
  } else if (dropdown) {
    dropdown.style.display = 'none';
    pill.classList.remove('open');
  }
}

// v9.1.14: Update star buttons with current provider color
function updateStarButtonProvider() {
  // v15.13: Prefer agentBrand (ChatAI context) — matches selectModel and executeAgentRequest
  var brandIdx = 0;
  var brandSelect = document.getElementById('brand');
  var agentBrandInput = document.getElementById('agentBrand');

  if (agentBrandInput && agentBrandInput.value !== '' && agentBrandInput.value !== 'none') {
    brandIdx = parseInt(agentBrandInput.value) || 0;
  } else if (brandSelect) {
    brandIdx = parseInt(brandSelect.value) || 0;
  }
  
  var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
  var provider = settings.provider || 'anthropic';
  
  // Update all star buttons
  document.querySelectorAll('.model-star-btn').forEach(function(btn) {
    btn.classList.remove('provider-anthropic', 'provider-openai', 'provider-google', 'provider-nanobanana', 'provider-roweos');
    btn.classList.add('provider-' + provider);
    
    // Set title to current model
    var displayName = getModelDisplayName(provider, settings.model);
    btn.title = displayName || 'Select AI Model';
  });
}

// Select Model from Dropdown
function selectModel(provider, model, displayName) {
  // v15.13: Read agentBrand FIRST (ChatAI context) — this is what executeAgentRequest uses
  var brandSelect = document.getElementById('brand');
  var agentBrandInput = document.getElementById('agentBrand');
  var brandIdx = 0;

  if (agentBrandInput && agentBrandInput.value !== '' && agentBrandInput.value !== 'none') {
    brandIdx = parseInt(agentBrandInput.value);
  } else if (brandSelect) {
    brandIdx = parseInt(brandSelect.value);
  }
  if (isNaN(brandIdx)) brandIdx = 0;
  
  if (!brands[brandIdx]) return;
  
  // Update brand settings (not brands array)
  if (!brandSettings[brandIdx]) {
    brandSettings[brandIdx] = {};
  }
  brandSettings[brandIdx].provider = provider;
  brandSettings[brandIdx].model = model;

  // v14.2: Save to localStorage
  saveBrandModelConfig();

  // v15.18: Also save to LifeAI-specific storage when in life mode
  var currentAppMode = localStorage.getItem('roweos_app_mode') || 'brand';
  if (currentAppMode === 'life') {
    localStorage.setItem('roweos_life_provider', provider);
    localStorage.setItem('roweos_life_model', model);
  }
  // Always update selectedProvider for backward compat
  localStorage.setItem('selectedProvider', provider);

  // Close all dropdowns
  document.querySelectorAll('.provider-dropdown').forEach(function(dropdown) {
    dropdown.style.display = 'none';
  });
  document.querySelectorAll('.provider-pill.open').forEach(function(pill) {
    pill.classList.remove('open');
  });
  
  // Update UI
  updateProviderPills();
  updateDeepResearchButton();
  
  // v9.1.14: Add provider-specific class to star buttons for colored fill
  document.querySelectorAll('.model-star-btn').forEach(function(btn) {
    // Remove all provider classes first
    btn.classList.remove('provider-anthropic', 'provider-openai', 'provider-google', 'provider-nanobanana', 'provider-roweos');
    // Add the current provider class
    btn.classList.add('provider-' + provider);
    btn.title = displayName; // Show model name on hover
  });
  
  // Close model dropdowns
  document.querySelectorAll('.model-dropdown').forEach(function(d) {
    d.classList.remove('active');
  });
  
  // Show toast for model switch
  showToast('Switched to ' + displayName, 'success');
  
  // Handle Deep Research indicator for Gemini
  var modelBtns = document.querySelectorAll('.model-selector-pill');
  var deepResearchIndicator = document.getElementById('deepResearchIndicator');
  
  if (provider === 'google') {
    // Add blue hue to model selector buttons
    modelBtns.forEach(function(btn) {
      if (!btn.classList.contains('brand-selector')) {
        btn.classList.add('deep-research-active');
      }
    });
    // Show deep research indicator
    if (deepResearchIndicator) deepResearchIndicator.style.display = 'inline-flex';
  } else {
    // Remove deep research styling
    modelBtns.forEach(function(btn) {
      btn.classList.remove('deep-research-active');
    });
    // Hide deep research indicator
    if (deepResearchIndicator) deepResearchIndicator.style.display = 'none';
  }
  
  // v9.1.14: Removed duplicate - toast already shown above
  
  // v9.1.14: Sync mobile model select
  if (typeof syncMobileModelSelect === 'function') syncMobileModelSelect();
  
  // v9.1.14: Close iOS action sheet if open
  closeIOSActionSheet();
}

// v24.27: Removed dead openIOSActionSheet() — 70 lines, zero callers, replaced by native picker

function closeIOSActionSheet() {
  var backdrop = document.getElementById('iosActionSheetBackdrop');
  var sheet = document.getElementById('iosActionSheet');
  
  if (backdrop) backdrop.classList.remove('active');
  if (sheet) sheet.classList.remove('active');
  document.body.style.overflow = '';
}

// v24.27: Removed dead selectBrandFromSheet() — only called from dead openIOSActionSheet HTML

// Toggle model dropdown (v7.1)
function toggleModelDropdown(event) {
  event.stopPropagation();
  
  // v9.1.14: On mobile, use native iOS picker
  if (window.innerWidth <= 768) {
    var chatModelSelect = document.getElementById('chatModelSelect');
    if (chatModelSelect) {
      // Sync current selection before showing
      syncChatModelSelect();
      chatModelSelect.focus();
      chatModelSelect.click();
    }
    return;
  }
  
  var btn = event.currentTarget;
  var dropdown = btn.nextElementSibling;
  if (!dropdown || !dropdown.classList.contains('model-dropdown')) {
    dropdown = btn.parentElement.querySelector('.model-dropdown');
  }
  
  // Close all other dropdowns
  document.querySelectorAll('.model-dropdown').forEach(function(d) {
    if (d !== dropdown) d.classList.remove('active');
  });
  
  // Toggle this dropdown
  if (dropdown) {
    dropdown.classList.toggle('active');
    
    // v9.1.14: Update checkmarks based on current model
    if (dropdown.classList.contains('active')) {
      updateModelDropdownCheckmarks(dropdown);
    }
  }
}

// v9.1.14: Update checkmarks in model dropdown
function updateModelDropdownCheckmarks(dropdown) {
  var brandIdx = parseInt(document.getElementById('agentBrand').value);
  if (isNaN(brandIdx)) brandIdx = parseInt(document.getElementById('brand').value) || 0;
  var settings = brandSettings[brandIdx] || {};
  var currentModel = settings.model || 'claude-sonnet-4-6';
  
  // Update each dropdown item
  dropdown.querySelectorAll('.model-dropdown-item').forEach(function(item) {
    var onclick = item.getAttribute('onclick') || '';
    var modelMatch = onclick.match(/selectModel\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
    if (modelMatch) {
      var itemModel = modelMatch[2];
      // Remove existing checkmark
      var existingCheck = item.querySelector('.model-check');
      if (existingCheck) existingCheck.remove();
      
      // v9.1.14: Add checkmark on RIGHT side if this is current model
      if (itemModel === currentModel) {
        var check = document.createElement('span');
        check.className = 'model-check';
        check.style.cssText = 'color: var(--accent); margin-left: auto;';
        check.textContent = '✓';
        item.appendChild(check);
      }
    }
  });
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.model-selector-pill') && !e.target.closest('.model-dropdown')) {
    document.querySelectorAll('.model-dropdown').forEach(function(d) {
      d.classList.remove('active');
    });
  }
});

// v11.0.5: Chat Response Length Management
var chatResponseLength = localStorage.getItem('roweos_chat_length') || 'standard';

function toggleChatLengthDropdown(event) {
  event.stopPropagation();
  
  // v11.0.5: On mobile, use native iOS picker just like model selector
  if (window.innerWidth <= 768) {
    var chatLengthSelect = document.getElementById('chatLengthSelect');
    if (chatLengthSelect) {
      // Sync current selection
      chatLengthSelect.value = chatResponseLength || 'standard';
      chatLengthSelect.focus();
      chatLengthSelect.click();
    }
    return;
  }
  
  var dropdown = document.getElementById('chatLengthDropdown');
  if (!dropdown) return;
  
  // Close other dropdowns
  document.querySelectorAll('.model-dropdown').forEach(function(d) {
    if (d !== dropdown) d.classList.remove('active');
  });
  
  // Toggle this dropdown
  dropdown.classList.toggle('active');
  
  // Update checkmarks
  if (dropdown.classList.contains('active')) {
    dropdown.querySelectorAll('.chat-length-option').forEach(function(opt) {
      opt.classList.toggle('active', opt.dataset.length === chatResponseLength);
    });
  }
}

// v11.0.5: Handle native select change for response length
function onChatLengthSelectChange(value) {
  setChatResponseLength(value);
}

function setChatResponseLength(length) {
  chatResponseLength = length;
  localStorage.setItem('roweos_chat_length', length);

  // v16.4: Sync BOTH landing and follow-up dropdowns
  ['chatLengthDropdown', 'followupLengthDropdown'].forEach(function(id) {
    var dropdown = document.getElementById(id);
    if (dropdown) {
      dropdown.querySelectorAll('.chat-length-option').forEach(function(opt) {
        opt.classList.toggle('active', opt.dataset.length === length);
      });
      dropdown.classList.remove('active');
      dropdown.style.display = 'none';
    }
  });

  // Update button state for both buttons
  ['chatLengthBtn', 'followupLengthBtn'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) {
      btn.classList.toggle('active', length !== 'standard');
      btn.title = 'Response length: ' + length.charAt(0).toUpperCase() + length.slice(1);
    }
  });

  showToast('Response length: ' + length.charAt(0).toUpperCase() + length.slice(1), 'success');
}

function getChatLengthInstruction() {
  switch (chatResponseLength) {
    case 'brief':
      return '\n\n[User preference: Keep your response brief and concise. Get straight to the point with minimal elaboration.]';
    case 'detailed':
      return '\n\n[User preference: Provide a detailed, comprehensive response. Include thorough explanations and examples.]';
    default:
      return ''; // Standard - no special instruction
  }
}

// v24.25: Inline visual capability instruction for chat system prompts
var VISUAL_CAPABILITY_HINT = '\n\nINLINE VISUALS: When it would genuinely aid understanding, you may produce an interactive HTML visualization in a ```html code block. Use this for charts, diagrams, data visualizations, interactive demos, or any concept better shown than described. Keep visuals self-contained (inline CSS/JS, no external dependencies except CDN libraries like Chart.js or D3). The HTML will be rendered live in a sandboxed iframe. Only generate visuals when they add real value - not for simple text answers.';

// Close chat length dropdown on outside click
document.addEventListener('click', function(e) {
  if (!e.target.closest('.chat-length-wrapper')) {
    var dropdown = document.getElementById('chatLengthDropdown');
    if (dropdown) dropdown.classList.remove('active');
    var fDropdown = document.getElementById('followupLengthDropdown');
    if (fDropdown) fDropdown.style.display = 'none';
  }
});

// v16.4: Follow-up length dropdown toggle
function toggleFollowupLengthDropdown(event) {
  event.stopPropagation();
  var dropdown = document.getElementById('followupLengthDropdown');
  if (!dropdown) return;
  var isVisible = dropdown.style.display !== 'none';
  dropdown.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    dropdown.querySelectorAll('.chat-length-option').forEach(function(opt) {
      opt.classList.toggle('active', opt.dataset.length === chatResponseLength);
    });
  }
}

// v16.4: Global stream abort controller
var _streamAbortController = null;

function stopStreaming() {
  if (_streamAbortController) {
    _streamAbortController.abort();
    _streamAbortController = null;
  }
}

// v16.4: Transform send button to stop button during streaming
function setSendButtonStopping(btnId) {
  var btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove('sending');
  btn.classList.add('stopping');
  btn.setAttribute('data-original-onclick', btn.getAttribute('onclick') || '');
  btn.setAttribute('onclick', 'stopStreaming()');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  btn.title = 'Stop generating';
}

function restoreSendButton(btnId) {
  var btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.remove('stopping');
  btn.classList.remove('sending');
  btn.disabled = false;
  if (btnId === 'followupBtn') {
    btn.setAttribute('onclick', 'sendFollowup()');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span class="send-text">Sending...</span>';
    btn.title = 'Send message';
  } else if (btnId === 'agentRunBtn') {
    btn.setAttribute('onclick', 'runAgent()');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span class="send-text">Sending...</span>';
    btn.title = 'Send message';
  } else if (btnId === 'studioRunBtn') {
    btn.setAttribute('onclick', 'runSelectedOperation()');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Agent';
    btn.title = 'Run Agent';
    btn.classList.remove('running');
  }
}

// v16.4: Chat message export — per-message action bar
function exportChatMsg(btn, format) {
  var msgEl = btn.closest('.conversation-message');
  if (!msgEl) return;
  var bubble = msgEl.querySelector('.conversation-message-content');
  if (!bubble) return;
  var htmlContent = bubble.innerHTML;
  var textContent = bubble.innerText || bubble.textContent;

  if (format === 'copy') {
    navigator.clipboard.writeText(textContent).then(function() {
      showToast('Copied to clipboard', 'success');
    });
    return;
  }

  if (format === 'pdf') {
    exportChatMsgAsPDF(htmlContent);
    return;
  }

  if (format === 'docx') {
    exportChatMsgAsDocx(htmlContent, textContent);
    return;
  }

  if (format === 'xlsx') {
    exportChatMsgAsXlsx(htmlContent, textContent);
    return;
  }

  if (format === 'pptx') {
    exportChatMsgAsPptx(htmlContent, textContent);
    return;
  }
}

// v23.4: PDF Color Scheme Presets
var PDF_COLOR_SCHEMES = {
  dark: { label: 'Dark', bg: [10,10,10], card: [26,26,26], gold: [168,152,120], text: [232,232,232], sec: [153,153,153], border: [50,50,50], code: [20,20,20], codeText: [180,180,180] },
  light: { label: 'Light', bg: [255,255,255], card: [245,245,247], gold: [139,115,85], text: [26,26,26], sec: [100,100,100], border: [220,220,220], code: [245,245,247], codeText: [50,50,50] },
  brand: { label: 'Brand', bg: [15,12,8], card: [30,26,20], gold: [168,152,120], text: [232,225,210], sec: [160,150,130], border: [60,52,40], code: [25,22,16], codeText: [190,180,160] },
  minimal: { label: 'Minimal', bg: [250,250,250], card: [240,240,240], gold: [80,80,80], text: [30,30,30], sec: [120,120,120], border: [200,200,200], code: [235,235,235], codeText: [60,60,60] },
  navy: { label: 'Navy', bg: [15,23,42], card: [30,41,59], gold: [168,152,120], text: [226,232,240], sec: [148,163,184], border: [51,65,85], code: [22,30,50], codeText: [165,180,200] }
};

function _getPdfBrandIdx() {
  // v23.16: PDF export uses studioSelectedBrand (Studio context), falling back to selectedBrand
  if (typeof studioSelectedBrand !== 'undefined' && studioSelectedBrand !== null) return studioSelectedBrand;
  if (typeof selectedBrand !== 'undefined') return selectedBrand;
  return 0;
}

function getPdfSchemePreference() {
  try {
    return localStorage.getItem('roweos_pdf_scheme_brand_' + _getPdfBrandIdx()) || 'dark';
  } catch(e) { return 'dark'; }
}

function savePdfSchemePreference(scheme) {
  try {
    localStorage.setItem('roweos_pdf_scheme_brand_' + _getPdfBrandIdx(), scheme);
    writeDB('profile/main', { pdfScheme: scheme }); // v25.1
  } catch(e) {}
}

function getPdfLogoPlacement() {
  try {
    return localStorage.getItem('roweos_pdf_logo_placement_' + _getPdfBrandIdx()) || 'left';
  } catch(e) { return 'left'; }
}

function savePdfLogoPlacement(placement) {
  try {
    localStorage.setItem('roweos_pdf_logo_placement_' + _getPdfBrandIdx(), placement);
  } catch(e) {}
}

// v22.31: RoweOS PDF Generator — programmatic dark-theme PDF via jsPDF
// v23.4: Extended with color schemes, page numbers, logo, hyperlink support
// Returns { pdf, base64 } or triggers download. Options: { title, subtitle, orientation, filename, returnBase64, colorScheme, brandLogo, clientLogo, logoPlacement, pageNumbers }
function roweosPDF(markdownOrHtml, options) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('PDF library not loaded. Please refresh and try again.', 'error');
    return null;
  }
  var opts = options || {};
  var orient = opts.orientation || 'portrait';
  var jsPDF = window.jspdf.jsPDF;
  var pdf = new jsPDF({ orientation: orient, unit: 'pt', format: 'letter' });
  // v23.16: Register cursive font if loaded
  if (_pdfCursiveFontData) registerCursiveFont(pdf);
  var pageW = pdf.internal.pageSize.getWidth();
  var pageH = pdf.internal.pageSize.getHeight();
  var margin = 50;
  var usable = pageW - margin * 2;
  var y = margin;
  var _pageNum = 1;
  var _showPageNumbers = opts.pageNumbers !== false;

  // v23.4: Color scheme support
  var schemeName = opts.colorScheme || getPdfSchemePreference() || 'dark';
  var scheme = PDF_COLOR_SCHEMES[schemeName] || PDF_COLOR_SCHEMES.dark;
  var bg = scheme.bg;
  var card = scheme.card;
  var gold = scheme.gold;
  var text = scheme.text;
  var sec = scheme.sec;
  var border = scheme.border;

  function drawBg() {
    pdf.setFillColor(bg[0], bg[1], bg[2]);
    pdf.rect(0, 0, pageW, pageH, 'F');
  }
  drawBg();

  // v23.4: Draw page number footer
  function drawPageNumber() {
    if (!_showPageNumbers || _pageNum <= 0) return;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(sec[0], sec[1], sec[2]);
    pdf.text(String(_pageNum), pageW / 2, pageH - 20, { align: 'center' });
  }

  function newPage() {
    drawPageNumber();
    _pageNum++;
    pdf.addPage();
    drawBg();
    y = margin;
  }

  // v23.16: checkSpace saves/restores font state across page breaks
  // (drawPageNumber changes font to 8pt helvetica, corrupting caller's state)
  function checkSpace(need) {
    if (y + need > pageH - margin) {
      var _savedFont = pdf.getFont();
      var _savedSize = pdf.getFontSize();
      newPage();
      pdf.setFont(_savedFont.fontName, _savedFont.fontStyle);
      pdf.setFontSize(_savedSize);
    }
  }

  // Parse HTML to text blocks
  var tempDiv = document.createElement('div');
  // If it looks like markdown (has # or ** or - ), parse it
  var content = markdownOrHtml || '';
  if (typeof marked !== 'undefined' && marked.parse && (content.indexOf('#') !== -1 || content.indexOf('**') !== -1 || content.indexOf('- ') !== -1)) {
    try { tempDiv.innerHTML = marked.parse(content); } catch(e) { tempDiv.innerHTML = content; }
  } else {
    tempDiv.innerHTML = content;
  }
  // v23.16: Strip any UI elements that should not appear in PDF output
  var _stripSel = tempDiv.querySelectorAll('.studio-smart-suggestions, .studio-edit-toolbar, .studio-output-meta, .studio-v2-actions-row, .studio-save-edits-bar, select, button');
  for (var _si = 0; _si < _stripSel.length; _si++) _stripSel[_si].remove();

  // v23.16: Helper — add image to PDF from base64, compositing onto bg to fix transparency
  // Uses pre-loaded image from opts._preloadedLogos if available for correct dimensions
  function addLogoPdf(logoSrc, x, cy, maxW, maxH) {
    if (!logoSrc || logoSrc.indexOf('data:') !== 0) return;
    try {
      // Use pre-loaded image for correct natural dimensions, or create new
      var img = (opts._preloadedLogos && opts._preloadedLogos[logoSrc]) || null;
      if (!img) {
        img = new Image();
        img.src = logoSrc;
      }
      var natW = img.naturalWidth || img.width;
      var natH = img.naturalHeight || img.height;
      // Fallback: if dimensions still 0, render onto temp canvas to measure
      if (!natW || !natH) {
        natW = maxW * 2;
        natH = maxH * 2;
      }
      // Scale to fit within maxW x maxH preserving aspect ratio
      var scale = Math.min(maxW / natW, maxH / natH, 1);
      var drawW = natW * scale;
      var drawH = natH * scale;
      // Composite onto canvas with PDF background color to eliminate transparency artifacts
      var cvs = document.createElement('canvas');
      cvs.width = Math.round(drawW * 2);
      cvs.height = Math.round(drawH * 2);
      var ctx = cvs.getContext('2d');
      ctx.fillStyle = 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      var composited = cvs.toDataURL('image/jpeg', 0.95);
      pdf.addImage(composited, 'JPEG', x - drawW / 2, cy - drawH / 2, drawW, drawH);
    } catch(e) { console.error('[PDF] addLogoPdf error:', e); }
  }

  // v22.35: Cover page — centered title, brand, date on dark background
  if (opts.coverPage && opts.title) {
    var centerX = pageW / 2;
    var centerY = pageH / 2;
    // v23.4: Brand logo on cover page
    var _coverLogoSrc = opts.brandLogo || '';
    if (_coverLogoSrc && _coverLogoSrc.indexOf('data:') === 0) {
      addLogoPdf(_coverLogoSrc, centerX, centerY - 100, 120, 50);
      centerY += 10; // shift content down slightly for logo
    }
    // v23.4: Client logo on cover page (dual logo support)
    var _clientLogoSrc = opts.clientLogo || '';
    if (_clientLogoSrc && _clientLogoSrc.indexOf('data:') === 0) {
      var _clX = opts.logoPlacement === 'right' ? pageW - margin - 40 : (opts.logoPlacement === 'left' ? margin + 40 : centerX);
      addLogoPdf(_clientLogoSrc, _clX, margin + 30, 60, 30);
    }
    // Thin gold line above title area
    pdf.setDrawColor(gold[0], gold[1], gold[2]);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 60, centerY - 60, pageW - margin - 60, centerY - 60);
    // v23.16: Cover font — user-selectable (helvetica, times, courier)
    var _cf = opts.coverFont || 'helvetica';
    // v23.16: Cover header text — editable, defaults to brand name
    pdf.setFont(_cf, 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(gold[0], gold[1], gold[2]);
    var _coverHeader = opts.coverHeader !== undefined ? opts.coverHeader : (opts.brandName || '');
    if (_coverHeader) pdf.text(_coverHeader.toUpperCase(), centerX, centerY - 40, { align: 'center' });
    // Document title — use contextTitle (client name), never the operation name
    pdf.setFont(_cf, 'bold');
    pdf.setFontSize(28);
    pdf.setTextColor(text[0], text[1], text[2]);
    var _coverTitleLines = pdf.splitTextToSize(opts.title, usable - 80);
    var _titleBlockH = _coverTitleLines.length * 34;
    var _titleStartY = centerY - 5;
    for (var _ct = 0; _ct < _coverTitleLines.length; _ct++) {
      pdf.text(_coverTitleLines[_ct], centerX, _titleStartY + _ct * 34, { align: 'center' });
    }
    // Thin gold line below title (tight spacing)
    var _lineY = _titleStartY + _titleBlockH + 5;
    pdf.setDrawColor(gold[0], gold[1], gold[2]);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 60, _lineY, pageW - margin - 60, _lineY);
    // Date
    var _coverDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    pdf.setFont(_cf, 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(sec[0], sec[1], sec[2]);
    pdf.text(_coverDate, centerX, _lineY + 20, { align: 'center' });
    // Confidential footer on cover
    pdf.setFont(_cf, 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Confidential - Prepared exclusively for the named recipient', centerX, pageH - 40, { align: 'center' });
    // Start content on next page
    newPage();
  } else if (opts.title) {
    // Fallback: simple inline title (non-cover mode)
    checkSpace(60);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(gold[0], gold[1], gold[2]);
    var titleLines = pdf.splitTextToSize(opts.title, usable);
    pdf.text(titleLines, margin, y);
    y += titleLines.length * 26;
    pdf.setDrawColor(gold[0], gold[1], gold[2]);
    pdf.setLineWidth(1.5);
    pdf.line(margin, y, margin + usable, y);
    y += 12;
  }

  // Walk child nodes
  function processNodes(parent) {
    var children = parent.childNodes;
    for (var i = 0; i < children.length; i++) {
      var node = children[i];
      if (node.nodeType === 3) {
        // Text node
        var txt = (node.textContent || '').trim();
        if (txt) {
          checkSpace(18);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(text[0], text[1], text[2]);
          var lines = pdf.splitTextToSize(txt, usable);
          for (var li = 0; li < lines.length; li++) {
            checkSpace(15);
            pdf.text(lines[li], margin, y);
            y += 15;
          }
          y += 4;
        }
        continue;
      }
      if (node.nodeType !== 1) continue;
      var tag = node.tagName.toLowerCase();

      if (tag === 'h1') {
        y += 10;
        checkSpace(36);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(gold[0], gold[1], gold[2]);
        var h1Lines = pdf.splitTextToSize(node.textContent || '', usable);
        pdf.text(h1Lines, margin, y);
        y += h1Lines.length * 24 + 6;
        pdf.setDrawColor(gold[0], gold[1], gold[2]);
        pdf.setLineWidth(1);
        pdf.line(margin, y, margin + usable, y);
        y += 12;
      } else if (tag === 'h2') {
        y += 8;
        checkSpace(30);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(gold[0], gold[1], gold[2]);
        var h2Lines = pdf.splitTextToSize(node.textContent || '', usable);
        pdf.text(h2Lines, margin, y);
        y += h2Lines.length * 20 + 8;
      } else if (tag === 'h3' || tag === 'h4') {
        y += 6;
        checkSpace(24);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(tag === 'h3' ? 13 : 11);
        pdf.setTextColor(text[0], text[1], text[2]);
        var h3Lines = pdf.splitTextToSize(node.textContent || '', usable);
        pdf.text(h3Lines, margin, y);
        y += h3Lines.length * 17 + 6;
      } else if (tag === 'p') {
        checkSpace(18);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(text[0], text[1], text[2]);
        var pText = node.textContent || '';
        var pLines = pdf.splitTextToSize(pText, usable);
        for (var pl = 0; pl < pLines.length; pl++) {
          checkSpace(15);
          pdf.text(pLines[pl], margin, y);
          y += 15;
        }
        y += 8;
      } else if (tag === 'ul' || tag === 'ol') {
        var items = node.querySelectorAll(':scope > li');
        for (var li2 = 0; li2 < items.length; li2++) {
          checkSpace(18);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(text[0], text[1], text[2]);
          var bullet = tag === 'ol' ? (li2 + 1) + '.' : '\u2022';
          var liText = items[li2].textContent || '';
          var liLines = pdf.splitTextToSize(liText, usable - 20);
          pdf.text(bullet, margin + 4, y);
          for (var ll = 0; ll < liLines.length; ll++) {
            checkSpace(15);
            pdf.text(liLines[ll], margin + 20, y);
            y += 15;
          }
          y += 3;
        }
        y += 6;
      } else if (tag === 'blockquote') {
        checkSpace(30);
        var bqText = node.textContent || '';
        var bqLines = pdf.splitTextToSize(bqText, usable - 24);
        var bqH = bqLines.length * 14 + 16;
        checkSpace(bqH);
        pdf.setFillColor(card[0], card[1], card[2]);
        pdf.roundedRect(margin, y - 4, usable, bqH, 4, 4, 'F');
        pdf.setDrawColor(gold[0], gold[1], gold[2]);
        pdf.setLineWidth(2);
        pdf.line(margin, y - 4, margin, y - 4 + bqH);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10);
        pdf.setTextColor(sec[0], sec[1], sec[2]);
        for (var bqi = 0; bqi < bqLines.length; bqi++) {
          pdf.text(bqLines[bqi], margin + 14, y + 8);
          y += 14;
        }
        y += 16;
      } else if (tag === 'pre' || tag === 'code') {
        checkSpace(30);
        var codeText = node.textContent || '';
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(9);
        var codeLines = pdf.splitTextToSize(codeText, usable - 20);
        var codeH = codeLines.length * 12 + 16;
        checkSpace(codeH);
        pdf.setFillColor(20, 20, 20);
        pdf.roundedRect(margin, y - 4, usable, codeH, 4, 4, 'F');
        pdf.setTextColor(180, 180, 180);
        for (var ci = 0; ci < codeLines.length; ci++) {
          pdf.text(codeLines[ci], margin + 10, y + 8);
          y += 12;
        }
        y += 16;
      } else if (tag === 'table') {
        var rows = node.querySelectorAll('tr');
        if (rows.length > 0) {
          var cols = rows[0].querySelectorAll('th, td');
          var colW = cols.length > 0 ? usable / cols.length : usable;
          for (var ri = 0; ri < rows.length; ri++) {
            checkSpace(22);
            var cells = rows[ri].querySelectorAll('th, td');
            var isHeader = cells.length > 0 && cells[0].tagName === 'TH';
            if (isHeader) {
              pdf.setFillColor(30, 30, 30);
              pdf.rect(margin, y - 12, usable, 20, 'F');
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(9);
              pdf.setTextColor(gold[0], gold[1], gold[2]);
            } else {
              if (ri % 2 === 0) {
                pdf.setFillColor(18, 18, 18);
                pdf.rect(margin, y - 12, usable, 20, 'F');
              }
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(9);
              pdf.setTextColor(text[0], text[1], text[2]);
            }
            for (var ci2 = 0; ci2 < cells.length; ci2++) {
              var cellText = (cells[ci2].textContent || '').substring(0, 60);
              pdf.text(cellText, margin + ci2 * colW + 6, y);
            }
            y += 20;
            pdf.setDrawColor(border[0], border[1], border[2]);
            pdf.setLineWidth(0.5);
            pdf.line(margin, y - 8, margin + usable, y - 8);
          }
          y += 10;
        }
      } else if (tag === 'hr') {
        y += 6;
        checkSpace(12);
        pdf.setDrawColor(border[0], border[1], border[2]);
        pdf.setLineWidth(0.5);
        pdf.line(margin, y, margin + usable, y);
        y += 12;
      } else if (tag === 'a') {
        // v23.4: Render hyperlinks — blue underlined text with URL in parentheses
        var linkText = (node.textContent || '').trim();
        var linkHref = node.getAttribute('href') || '';
        if (linkText) {
          checkSpace(18);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(80, 140, 220);
          var linkDisplay = linkText;
          if (linkHref && linkHref !== linkText && linkHref.indexOf('http') === 0) {
            linkDisplay = linkText + ' (' + linkHref + ')';
          }
          var linkLines = pdf.splitTextToSize(linkDisplay, usable);
          for (var lki = 0; lki < linkLines.length; lki++) {
            checkSpace(15);
            pdf.text(linkLines[lki], margin, y);
            y += 15;
          }
        }
      } else if (tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i' || tag === 'span' || tag === 'div' || tag === 'section' || tag === 'article') {
        // Recurse into inline/container elements
        processNodes(node);
      } else {
        // Fallback: render as paragraph
        var fallText = (node.textContent || '').trim();
        if (fallText) {
          checkSpace(18);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(text[0], text[1], text[2]);
          var fallLines = pdf.splitTextToSize(fallText, usable);
          for (var fi = 0; fi < fallLines.length; fi++) {
            checkSpace(15);
            pdf.text(fallLines[fi], margin, y);
            y += 15;
          }
          y += 6;
        }
      }
    }
  }

  processNodes(tempDiv);

  // v22.35: Closing page with RoweOS branding and logo
  if (opts.closingPage) {
    newPage();
    var _cx = pageW / 2;
    var _cy = pageH / 2;
    var _closingBrand = opts.brandName || '';
    var _closingStyle = opts.closingStyle || 'text';
    var _closingLogoSrc = opts.brandLogo || '';
    // v23.16: Closing page — text, logo, or both
    if (_closingStyle === 'logo' || _closingStyle === 'both') {
      if (_closingLogoSrc && _closingLogoSrc.indexOf('data:') === 0) {
        addLogoPdf(_closingLogoSrc, _cx, _cy - (_closingStyle === 'both' ? 40 : 10), 140, 60);
      }
    }
    // v23.16: Closing page uses same font as cover
    var _cfClose = opts.coverFont || 'helvetica';
    if (_closingStyle === 'text' || _closingStyle === 'both') {
      var _textY = _closingStyle === 'both' ? _cy + 30 : _cy - 10;
      pdf.setFont(_cfClose, 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(text[0], text[1], text[2]);
      if (_closingBrand) pdf.text(_closingBrand, _cx, _textY, { align: 'center' });
    }
    // Thin gold line
    var _lineYClose = _closingStyle === 'both' ? _cy + 50 : (_closingStyle === 'logo' ? _cy + 30 : _cy + 10);
    pdf.setDrawColor(gold[0], gold[1], gold[2]);
    pdf.setLineWidth(0.5);
    pdf.line(_cx - 80, _lineYClose, _cx + 80, _lineYClose);
    // Thank you
    pdf.setFont(_cfClose, 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(sec[0], sec[1], sec[2]);
    pdf.text('Thank you for your consideration.', _cx, _lineYClose + 25, { align: 'center' });
    // Confidential footer + attribution
    pdf.setFont(_cfClose, 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    pdf.text('Powered by RoweOS', _cx, pageH - 40, { align: 'center' });
    pdf.setTextColor(50, 50, 50);
    pdf.text('Confidential - Prepared exclusively for the named recipient', _cx, pageH - 30, { align: 'center' });
  } else {
    // Simple footer
    y = pageH - 30;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(sec[0], sec[1], sec[2]);
    pdf.text('Generated by RoweOS', pageW / 2, y, { align: 'center' });
  }

  // v23.4: Draw page number on final page
  drawPageNumber();

  var filename = opts.filename || ('RoweOS-Export-' + Date.now() + '.pdf');

  if (opts.returnBase64) {
    return {
      pdf: pdf,
      base64: pdf.output('datauristring'),
      blob: pdf.output('blob'),
      filename: filename
    };
  }

  pdf.save(filename);
  showToast('PDF downloaded', 'success');
  return { pdf: pdf, filename: filename };
}

// v22.31: Orientation picker modal for PDF exports
function showPdfOrientationModal(callback) {
  var existing = document.getElementById('roweosPdfOrientModal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'roweosPdfOrientModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
  modal.innerHTML = '<div style="background:#1a1a1a;border:1px solid rgba(168,152,120,0.3);border-radius:16px;padding:32px;max-width:360px;width:90%;text-align:center;">' +
    '<div style="font-size:16px;font-weight:600;color:#e8e8e8;margin-bottom:6px;">PDF Orientation</div>' +
    '<div style="font-size:12px;color:#999;margin-bottom:24px;">Choose layout for your PDF export</div>' +
    '<div style="display:flex;gap:16px;justify-content:center;">' +
    '<button id="_pdfPortrait" style="flex:1;padding:20px 16px;background:#111;border:1px solid #333;border-radius:12px;cursor:pointer;color:#e8e8e8;transition:all 0.2s;">' +
    '<div style="width:40px;height:52px;border:2px solid #a89878;border-radius:4px;margin:0 auto 10px;"></div>' +
    '<div style="font-size:13px;font-weight:500;">Portrait</div></button>' +
    '<button id="_pdfLandscape" style="flex:1;padding:20px 16px;background:#111;border:1px solid #333;border-radius:12px;cursor:pointer;color:#e8e8e8;transition:all 0.2s;">' +
    '<div style="width:52px;height:40px;border:2px solid #a89878;border-radius:4px;margin:0 auto 10px;"></div>' +
    '<div style="font-size:13px;font-weight:500;">Landscape</div></button>' +
    '</div>' +
    '<button id="_pdfCancel" style="margin-top:16px;background:none;border:none;color:#999;cursor:pointer;font-size:12px;padding:8px;">Cancel</button>' +
    '</div>';
  document.body.appendChild(modal);
  document.getElementById('_pdfPortrait').onclick = function() { modal.remove(); callback('portrait'); };
  document.getElementById('_pdfLandscape').onclick = function() { modal.remove(); callback('landscape'); };
  document.getElementById('_pdfCancel').onclick = function() { modal.remove(); };
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
}

function exportChatMsgAsPDF(htmlContent) {
  showPdfOrientationModal(function(orient) {
    roweosPDF(htmlContent, {
      title: 'RoweOS Chat Export',
      subtitle: 'Generated ' + new Date().toLocaleDateString(),
      orientation: orient,
      filename: 'RoweOS-Chat-' + Date.now() + '.pdf'
    });
  });
}

function exportChatMsgAsDocx(htmlContent, textContent) {
  // v24.8: Use docx library for proper .docx generation
  if (typeof docx !== 'undefined' && docx.Document) {
    try {
      var lines = textContent.split('\n');
      var children = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.match(/^#{1,3}\s/)) {
          var level = line.match(/^(#{1,3})/)[1].length;
          var headText = line.replace(/^#{1,3}\s*/, '');
          children.push(new docx.Paragraph({ text: headText, heading: level === 1 ? docx.HeadingLevel.HEADING_1 : level === 2 ? docx.HeadingLevel.HEADING_2 : docx.HeadingLevel.HEADING_3 }));
        } else if (line.match(/^[-*]\s/)) {
          children.push(new docx.Paragraph({ children: [new docx.TextRun(line.replace(/^[-*]\s*/, ''))], bullet: { level: 0 } }));
        } else if (line.match(/^\d+\.\s/)) {
          children.push(new docx.Paragraph({ children: [new docx.TextRun(line.replace(/^\d+\.\s*/, ''))], numbering: { reference: 'default-numbering', level: 0 } }));
        } else if (line.trim() === '') {
          children.push(new docx.Paragraph({ text: '' }));
        } else {
          // Handle bold/italic in text
          var runs = [];
          var parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
          for (var p = 0; p < parts.length; p++) {
            if (parts[p].match(/^\*\*.*\*\*$/)) {
              runs.push(new docx.TextRun({ text: parts[p].replace(/\*\*/g, ''), bold: true }));
            } else if (parts[p].match(/^\*.*\*$/)) {
              runs.push(new docx.TextRun({ text: parts[p].replace(/\*/g, ''), italics: true }));
            } else if (parts[p]) {
              runs.push(new docx.TextRun(parts[p]));
            }
          }
          children.push(new docx.Paragraph({ children: runs }));
        }
      }
      var doc = new docx.Document({
        numbering: { config: [{ reference: 'default-numbering', levels: [{ level: 0, format: docx.LevelFormat.DECIMAL, text: '%1.', alignment: docx.AlignmentType.START }] }] },
        sections: [{ properties: {}, children: children }]
      });
      docx.Packer.toBlob(doc).then(function(blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'RoweOS-Export-' + Date.now() + '.docx';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Word document downloaded', 'success');
      });
      return;
    } catch(e) { console.error('[Export] docx lib error, falling back:', e); }
  }
  // Fallback: HTML-based .doc
  var docContent = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a}h1{font-size:18pt;color:#7a6a52;border-bottom:2px solid #b8986a;padding-bottom:6px}h2{font-size:14pt;color:#7a6a52}h3{font-size:12pt;color:#7a6a52}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f0f0f0;font-weight:600}blockquote{border-left:3px solid #b8986a;padding-left:12px;color:#555;font-style:italic}</style></head><body>' + htmlContent + '</body></html>';
  var blob = new Blob([docContent], { type: 'application/vnd.ms-word' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'RoweOS-Export-' + Date.now() + '.doc';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Word document downloaded', 'success');
}

function exportChatMsgAsXlsx(htmlContent, textContent) {
  // v24.8: Use SheetJS for proper .xlsx generation
  if (typeof XLSX !== 'undefined') {
    try {
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      var tables = tempDiv.querySelectorAll('table');
      var wb = XLSX.utils.book_new();
      if (tables.length > 0) {
        for (var ti = 0; ti < tables.length; ti++) {
          var ws = XLSX.utils.table_to_sheet(tables[ti]);
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet' + (ti + 1));
        }
      } else {
        // No tables - export text as rows
        var lines = textContent.split('\n');
        var data = lines.map(function(l) { return [l]; });
        var ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Export');
      }
      XLSX.writeFile(wb, 'RoweOS-Export-' + Date.now() + '.xlsx');
      showToast('Excel spreadsheet downloaded', 'success');
      return;
    } catch(e) { console.error('[Export] SheetJS error, falling back:', e); }
  }
  // Fallback: CSV with BOM for Excel compatibility
  var csvContent = '\uFEFF'; // BOM for Excel UTF-8 detection
  var tempDiv2 = document.createElement('div');
  tempDiv2.innerHTML = htmlContent;
  var tables2 = tempDiv2.querySelectorAll('table');
  if (tables2.length > 0) {
    tables2.forEach(function(table) {
      var rows = table.querySelectorAll('tr');
      rows.forEach(function(row) {
        var cells = row.querySelectorAll('th, td');
        var rowData = [];
        cells.forEach(function(cell) {
          var cellText = (cell.innerText || cell.textContent || '').replace(/"/g, '""');
          rowData.push('"' + cellText + '"');
        });
        csvContent += rowData.join(',') + '\n';
      });
    });
  } else {
    textContent.split('\n').forEach(function(line) {
      csvContent += '"' + line.replace(/"/g, '""') + '"\n';
    });
  }
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'RoweOS-Export-' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Spreadsheet downloaded (CSV)', 'success');
}

function exportChatMsgAsPptx(htmlContent, textContent) {
  // v24.8: Use PptxGenJS for proper .pptx generation
  if (typeof PptxGenJS !== 'undefined') {
    try {
      var pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      // Split content by headers into slides
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      var slides = [];
      var currentSlide = { title: 'RoweOS Export', bullets: [] };
      tempDiv.childNodes.forEach(function(node) {
        if (node.tagName && /^H[1-3]$/.test(node.tagName)) {
          if (currentSlide.bullets.length > 0 || currentSlide.title !== 'RoweOS Export') {
            slides.push(currentSlide);
          }
          currentSlide = { title: (node.textContent || node.innerText || '').trim(), bullets: [] };
        } else {
          var nodeText = (node.textContent || node.innerText || '').trim();
          if (nodeText) {
            // Split long text into bullet points
            var sentences = nodeText.split(/(?<=[.!?])\s+/);
            sentences.forEach(function(s) { if (s.trim()) currentSlide.bullets.push(s.trim()); });
          }
        }
      });
      if (currentSlide.bullets.length > 0 || slides.length === 0) slides.push(currentSlide);
      // Generate slides
      slides.forEach(function(s) {
        var slide = pptx.addSlide();
        slide.addText(s.title, { x: 0.5, y: 0.3, w: '90%', fontSize: 28, color: '7a6a52', bold: true });
        if (s.bullets.length > 0) {
          var bodyItems = s.bullets.map(function(b) { return { text: b, options: { fontSize: 14, color: '333333', bullet: true, breakLine: true } }; });
          slide.addText(bodyItems, { x: 0.5, y: 1.2, w: '90%', h: '70%', valign: 'top', lineSpacing: 24 });
        }
      });
      pptx.writeFile({ fileName: 'RoweOS-Export-' + Date.now() + '.pptx' });
      showToast('PowerPoint downloaded', 'success');
      return;
    } catch(e) { console.error('[Export] PptxGenJS error, falling back:', e); }
  }
  // Fallback: HTML-based presentation
  var tempDiv2 = document.createElement('div');
  tempDiv2.innerHTML = htmlContent;
  var slides2 = [];
  var cs2 = { title: 'RoweOS Export', content: '' };
  tempDiv2.childNodes.forEach(function(node) {
    if (node.tagName && /^H[1-3]$/.test(node.tagName)) {
      if (cs2.content.trim() || cs2.title !== 'RoweOS Export') slides2.push(cs2);
      cs2 = { title: node.textContent || '', content: '' };
    } else { cs2.content += node.outerHTML || node.textContent || ''; }
  });
  if (cs2.content.trim() || slides2.length === 0) slides2.push(cs2);
  var pptHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Calibri,sans-serif;margin:0}.slide{width:100%;min-height:100vh;padding:60px;box-sizing:border-box;page-break-after:always;background:#fff}h1{font-size:28pt;color:#7a6a52;margin-bottom:20px}p,li{font-size:14pt;line-height:1.6}</style></head><body>';
  slides2.forEach(function(s) { pptHtml += '<div class="slide"><h1>' + escapeHtml(s.title) + '</h1>' + s.content + '</div>'; });
  pptHtml += '</body></html>';
  var blob = new Blob([pptHtml], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'RoweOS-Export-' + Date.now() + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Presentation downloaded (HTML)', 'success');
}

// Update model name display

// Toggle brand dropdown
function toggleV71BrandDropdown(event) {
  event.stopPropagation();
  
  // v10.5.25: If only 1 brand, auto-toggle between brand and StandardAI
  if (brands.length <= 1) {
    var currentAgentBrand = document.getElementById('agentBrand').value;
    if (currentAgentBrand === 'none') {
      // Switch to the single brand
      document.getElementById('agentBrand').value = 0;
      updateBrandIconState(false);
      var badge = document.querySelector('.chat-brand-badge');
      if (badge && brands[0]) {
        badge.textContent = brands[0].name;
        badge.classList.remove('standard-ai-badge');
      }
    } else {
      // Switch to StandardAI (silver)
      document.getElementById('agentBrand').value = 'none';
      updateBrandIconState(true);
      var badge = document.querySelector('.chat-brand-badge');
      if (badge) {
        badge.textContent = 'StandardAI';
        badge.classList.add('standard-ai-badge');
      }
    }
    return;
  }
  
  // v9.1.14: On mobile with 2+ brands, use native iOS picker
  if (window.innerWidth <= 768) {
    var chatBrandSelect = document.getElementById('chatBrandSelect');
    if (chatBrandSelect) {
      // Populate and sync before showing
      populateChatBrandSelect();
      chatBrandSelect.focus();
      chatBrandSelect.click();
    }
    return;
  }
  
  var btn = event.currentTarget;
  var dropdown = btn.nextElementSibling;
  
  // Close all other dropdowns
  document.querySelectorAll('.model-dropdown').forEach(function(d) {
    if (d !== dropdown) d.classList.remove('active');
  });
  document.querySelectorAll('.brand-dropdown').forEach(function(d) {
    if (d !== dropdown) d.classList.remove('active');
  });
  
  // v9.1.14: ALWAYS repopulate to show correct checkmark states
  if (dropdown) {
    populateBrandDropdown(dropdown);
  }
  
  // Toggle this dropdown
  if (dropdown) {
    dropdown.classList.toggle('active');
  }
}

// Populate brand dropdown
function populateBrandDropdown(dropdown) {
  dropdown.innerHTML = '';
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';

  // v10.5.25: In LifeAI mode, show LifeAI-specific options instead of brands
  if (currentMode === 'life') {
    // LifeAI mode options (matching mobile)
    var lifeOptions = [
      { name: 'Personal Assistant', value: 'personal' },
      { name: 'Life Coach', value: 'coach' },
      { name: 'Wellness Guide', value: 'wellness' },
      { name: 'Tax Intelligence', value: 'taxintelligence' },
      { name: 'StandardAI', value: 'standard' }
    ];
    
    var currentLifeAgent = localStorage.getItem('roweos_life_agent') || 'personal';
    
    lifeOptions.forEach(function(opt) {
      var item = document.createElement('div');
      item.className = 'model-dropdown-item';
      item.dataset.value = opt.value;
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; text-align: left; white-space: nowrap;';
      var showCheck = currentLifeAgent === opt.value;
      item.innerHTML = '<span>' + opt.name + '</span><span class="brand-check" style="opacity:' + (showCheck ? '1' : '0') + ';margin-left:12px;color:var(--life-accent);">✓</span>';
      item.onclick = function() {
        localStorage.setItem('roweos_life_agent', opt.value);
        syncLifeAIToFirestore({ currentAgent: opt.value });
        var badge = document.querySelector('.chat-brand-badge');
        if (badge) {
          badge.textContent = opt.name;
        }
        closeAllDropdowns();
        showToast('Switched to ' + opt.name, 'info');
      };
      dropdown.appendChild(item);
    });
    // v24.26: Mode switch back to BrandAI
    var modeDivider = document.createElement('div');
    modeDivider.style.cssText = 'height: 1px; background: var(--border-color); margin: 8px 4px;';
    dropdown.appendChild(modeDivider);
    var modeItem = document.createElement('div');
    modeItem.className = 'model-dropdown-item';
    modeItem.style.cssText = 'display: flex; align-items: center; gap: 8px; text-align: left; white-space: nowrap; color: var(--text-secondary);';
    modeItem.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span>Switch to BrandAI</span>';
    modeItem.onclick = function() {
      closeAllDropdowns();
      toggleRoweOSMode();
    };
    dropdown.appendChild(modeItem);
    return;
  }

  // BrandAI mode - show brands
  var currentAgentBrand = document.getElementById('agentBrand').value;
  var isStandardAIMode = currentAgentBrand === 'none';
  // Get the actual brand index from main brand selector
  var mainBrandIdx = parseInt(document.getElementById('brand').value) || 0;
  
  brands.forEach(function(brand, idx) {
    var item = document.createElement('div');
    item.className = 'model-dropdown-item';
    item.dataset.value = idx;
    item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; text-align: left; white-space: nowrap;';
    // v9.1.14: Gold checkmark on RIGHT, ONLY shows when NOT in StandardAI mode
    var showCheck = !isStandardAIMode && (parseInt(currentAgentBrand) === idx);
    item.innerHTML = '<span>' + brand.name + '</span><span class="brand-check" style="opacity:' + (showCheck ? '1' : '0') + ';margin-left:12px;color:var(--accent);">✓</span>';
    item.onclick = function() {
      // Update diamond to gold and switch to this brand
      document.getElementById('agentBrand').value = idx;
      updateBrandIconState(false);
      // v9.1.14: Update badge to show brand name
      var badge = document.querySelector('.chat-brand-badge');
      if (badge) {
        badge.textContent = brands[idx].name;
        badge.classList.remove('standard-ai-badge');
      }
      // v9.1.14: Restore brand placeholder when selecting a brand
      var input = document.getElementById('agentCommand');
      if (input) input.placeholder = "Ask about your brand...";
      var followupInput = document.getElementById('followupInput');
      if (followupInput) followupInput.placeholder = 'Continue the conversation...';
      selectBrandFromDropdown(idx);
      closeAllDropdowns();
    };
    dropdown.appendChild(item);
  });
  
  // v9.1.14: Add divider and "StandardAI" option for chat
  var divider = document.createElement('div');
  divider.style.cssText = 'height: 1px; background: var(--border-color); margin: 8px 4px;';
  dropdown.appendChild(divider);
  
  var noBrandItem = document.createElement('div');
  noBrandItem.className = 'model-dropdown-item no-brand-option';
  noBrandItem.dataset.value = 'none';
  noBrandItem.style.cssText = 'display: flex; align-items: center; justify-content: space-between; text-align: left; white-space: nowrap;';
  var isNoneSelected = document.getElementById('agentBrand').value === 'none';
  // v9.1.14: Grey checkmark on RIGHT for StandardAI when selected
  noBrandItem.innerHTML = '<span style="color:var(--text-muted);">StandardAI</span><span class="brand-check" style="opacity:' + (isNoneSelected ? '1' : '0') + ';margin-left:12px;color:var(--text-muted);">✓</span>';
  noBrandItem.onclick = function() {
    // v9.1.14: If already in StandardAI mode, switch back to current main brand
    if (document.getElementById('agentBrand').value === 'none') {
      var mainBrandIdx = parseInt(document.getElementById('brand').value) || 0;
      document.getElementById('agentBrand').value = mainBrandIdx;
      updateBrandIconState(false);
      var badge = document.querySelector('.chat-brand-badge');
      if (badge && brands[mainBrandIdx]) {
        badge.textContent = brands[mainBrandIdx].name;
        badge.classList.remove('standard-ai-badge');
      }
      // v9.1.14: Restore brand placeholder
      var input = document.getElementById('agentCommand');
      if (input) input.placeholder = "Ask about your brand...";
      var followupInput = document.getElementById('followupInput');
      if (followupInput) followupInput.placeholder = 'Continue the conversation...';
      closeAllDropdowns();
      showToast('Switched back to ' + brands[mainBrandIdx].name, 'info');
      return;
    }
    // Switch to StandardAI mode
    document.getElementById('agentBrand').value = 'none';
    var badge = document.querySelector('.chat-brand-badge');
    if (badge) {
      badge.textContent = 'StandardAI';
      badge.classList.add('standard-ai-badge');
    }
    // Update diamond icon to silver
    updateBrandIconState(true);
    // v9.1.14: Update placeholder for StandardAI
    var input = document.getElementById('agentCommand');
    if (input) input.placeholder = 'Explore anything...';
    var followupInput = document.getElementById('followupInput');
    if (followupInput) followupInput.placeholder = 'Ask about your brand...';
    currentConversation = [];
    renderConversation();
    closeAllDropdowns();
    showToast('Switched to StandardAI mode', 'info');
  };
  dropdown.appendChild(noBrandItem);

  // v24.26: Mode switch (BrandAI / LifeAI) at bottom of dropdown
  var modeDivider = document.createElement('div');
  modeDivider.style.cssText = 'height: 1px; background: var(--border-color); margin: 8px 4px;';
  dropdown.appendChild(modeDivider);
  var modeItem = document.createElement('div');
  modeItem.className = 'model-dropdown-item';
  modeItem.style.cssText = 'display: flex; align-items: center; gap: 8px; text-align: left; white-space: nowrap; color: var(--text-secondary);';
  modeItem.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Switch to LifeAI</span>';
  modeItem.onclick = function() {
    closeAllDropdowns();
    toggleRoweOSMode();
  };
  dropdown.appendChild(modeItem);
}



// Sidebar Brand Dropdown
function toggleSidebarBrandDropdown(event) {
  event.stopPropagation();

  // v15.18: On mobile, use native iOS select picker instead of custom dropdown
  if (window.innerWidth <= 768) {
    openNativeSidebarBrandPicker();
    return;
  }

  var dropdown = document.getElementById('sidebarBrandDropdown');

  // Close other dropdowns
  document.querySelectorAll('.brand-dropdown, .model-dropdown').forEach(function(d) {
    d.classList.remove('active');
  });

  // Toggle this dropdown
  if (dropdown) {
    dropdown.classList.toggle('active');

    // Populate if opening
    if (dropdown.classList.contains('active')) {
      populateSidebarBrandDropdown();
    }
  }
}

// v15.18: Native iOS select picker for sidebar brand switcher on mobile
// v15.21: Native iOS select picker — overlaid on brand name for direct user tap
function openNativeSidebarBrandPicker() {
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';

  // Remove any existing temp picker
  var existing = document.getElementById('sidebarNativePicker');
  if (existing) existing.remove();

  // Position over the brand name element so iOS gets a direct user gesture
  var brandNameEl = document.getElementById('sidebarBrandName');
  var rect = brandNameEl ? brandNameEl.getBoundingClientRect() : { top: 100, left: 10, width: 200, height: 40 };

  var select = document.createElement('select');
  select.id = 'sidebarNativePicker';
  select.style.cssText = 'position:fixed;top:' + rect.top + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;opacity:0.01;z-index:10000;font-size:16px;';

  // Build options matching populateSidebarBrandDropdown logic
  if (currentMode === 'life') {
    var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');

    if (profiles.length === 0) {
      var userName = localStorage.getItem('roweos_user_name') || 'My Life';
      var opt = document.createElement('option');
      opt.value = 'life';
      opt.textContent = userName;
      opt.selected = true;
      select.appendChild(opt);
    } else {
      profiles.forEach(function(profile, idx) {
        var opt = document.createElement('option');
        opt.value = 'life_profile_' + idx;
        opt.textContent = profile.name || 'Life ' + (idx + 1);
        if (idx === currentIdx) opt.selected = true;
        select.appendChild(opt);
      });
    }

    var sep = document.createElement('optgroup');
    sep.label = 'BrandAI';
    brands.forEach(function(brand, idx) {
      var opt = document.createElement('option');
      opt.value = 'brand_' + idx;
      opt.textContent = brand.shortName || brand.name;
      sep.appendChild(opt);
    });
    select.appendChild(sep);
  } else {
    var currentBrand = parseInt(document.getElementById('brand').value);
    brands.forEach(function(brand, idx) {
      var opt = document.createElement('option');
      opt.value = 'brand_' + idx;
      opt.textContent = brand.shortName || brand.name;
      if (idx === currentBrand) opt.selected = true;
      select.appendChild(opt);
    });

    var lifeProfiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    if (lifeProfiles.length > 0) {
      var lifeSep = document.createElement('optgroup');
      lifeSep.label = 'LifeAI';
      lifeProfiles.forEach(function(profile, idx) {
        var opt = document.createElement('option');
        opt.value = 'life_profile_' + idx;
        opt.textContent = profile.name || 'Life ' + (idx + 1);
        lifeSep.appendChild(opt);
      });
      select.appendChild(lifeSep);
    }
  }

  // Handle change
  select.addEventListener('change', function() {
    var val = select.value;
    if (val.indexOf('life_profile_') === 0) {
      var idx = parseInt(val.replace('life_profile_', ''));
      if (currentMode !== 'life') { switchToLifeMode(idx); }
      else { selectLifeProfileByIndex(idx); }
    } else if (val === 'life') {
      if (currentMode !== 'life') { switchToLifeMode(); }
    } else if (val.indexOf('brand_') === 0) {
      onMobileBrandDropdownChange(val);
    }
    select.remove();
  });

  // Auto-remove if dismissed without change
  select.addEventListener('blur', function() {
    setTimeout(function() {
      var el = document.getElementById('sidebarNativePicker');
      if (el) el.remove();
    }, 300);
  });

  document.body.appendChild(select);
}

function populateSidebarBrandDropdown() {
  var dropdown = document.getElementById('sidebarBrandDropdown');
  if (!dropdown) return;
  
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var html = '';
  
  // v24.24: Unified switcher — both modes show BrandAI + LifeAI sections consistently
  var currentBrand = parseInt(document.getElementById('brand').value) || 0;
  var lifeProfiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  var currentLifeIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');

  // BrandAI section — always shown
  html += '<div style="padding: 6px 12px 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-tertiary); opacity: 0.7;">BrandAI</div>';
  brands.forEach(function(brand, idx) {
    var isActive = currentMode === 'brand' && idx === currentBrand;
    var selected = isActive ? ' selected' : '';
    var clickAction = currentMode === 'brand'
      ? 'selectSidebarBrand(' + idx + ')'
      : 'switchToBrandMode(); setTimeout(function(){ selectSidebarBrand(' + idx + '); }, 100);';
    html += '<button class="sidebar-brand-item' + selected + '" data-brand-idx="' + idx + '" onclick="' + clickAction + '">';
    html += '  <span style="display: flex; align-items: center; gap: 8px; pointer-events: none;">';
    html += '    ' + icon('briefcase', {size: 15});
    html += '    ' + escapeHtml(brand.shortName || brand.name);
    html += '  </span>';
    html += '</button>';
  });

  // LifeAI section — always shown if profiles exist
  if (lifeProfiles.length > 0 || currentMode === 'life') {
    html += '<div style="height: 1px; background: var(--border-color); margin: 8px 0;"></div>';
    html += '<div style="padding: 6px 12px 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-tertiary); opacity: 0.7;">LifeAI</div>';

    var profiles = lifeProfiles.length > 0 ? lifeProfiles : [{name: localStorage.getItem('roweos_user_name') || 'My Life'}];
    profiles.forEach(function(profile, idx) {
      var isActive = currentMode === 'life' && idx === currentLifeIdx;
      var selected = isActive ? ' selected' : '';
      var clickAction = currentMode === 'life'
        ? 'selectLifeProfileByIndex(' + idx + ')'
        : 'switchToLifeMode(' + idx + ')';
      html += '<button class="sidebar-brand-item' + selected + '" onclick="' + clickAction + '">';
      html += '  <span style="display: flex; align-items: center; gap: 8px;">';
      html += '    ' + icon('user', {size: 15});
      html += '    ' + escapeHtml(profile.name || 'Life ' + (idx + 1));
      html += '  </span>';
      html += '</button>';
    });

    // Add new life option (mobile only via CSS)
    html += '<button class="sidebar-brand-item add-new-life-btn" onclick="launchLifeOnboardingForNewProfile()" style="color: var(--accent);">';
    html += '  <span style="display: flex; align-items: center; gap: 8px;">';
    html += '    ' + icon('plus', {size: 15});
    html += '    Add New Life';
    html += '  </span>';
    html += '</button>';
  }
  
  dropdown.innerHTML = html;

}

// v29.x: Brand switcher drag reorder — single global handler, no stacking
var _bsDrag = { active: false, fromIdx: -1, startY: 0, el: null };

(function() {
  var THRESHOLD = 8;

  document.addEventListener('mousedown', function(e) {
    var btn = e.target.closest && e.target.closest('.sidebar-brand-item[data-brand-idx]');
    if (!btn) return;
    _bsDrag.fromIdx = parseInt(btn.getAttribute('data-brand-idx'));
    _bsDrag.startY = e.clientY;
    _bsDrag.el = btn;
    _bsDrag.active = false;
  });

  document.addEventListener('mousemove', function(e) {
    if (_bsDrag.fromIdx === -1) return;
    var dy = Math.abs(e.clientY - _bsDrag.startY);
    if (!_bsDrag.active && dy > THRESHOLD) {
      _bsDrag.active = true;
      _bsDrag.el.style.opacity = '0.4';
    }
    if (!_bsDrag.active) return;
    e.preventDefault();
    var dd = document.getElementById('sidebarBrandDropdown');
    if (dd) dd.querySelectorAll('.sidebar-brand-item[data-brand-idx]').forEach(function(b) { b.style.borderTop = ''; });
    var target = document.elementFromPoint(e.clientX, e.clientY);
    target = target && target.closest ? target.closest('.sidebar-brand-item[data-brand-idx]') : null;
    if (target && parseInt(target.getAttribute('data-brand-idx')) !== _bsDrag.fromIdx) {
      target.style.borderTop = '2px solid var(--accent)';
    }
  });

  document.addEventListener('mouseup', function(e) {
    if (_bsDrag.fromIdx === -1) return;
    var wasActive = _bsDrag.active;
    var dd = document.getElementById('sidebarBrandDropdown');
    if (dd) dd.querySelectorAll('.sidebar-brand-item[data-brand-idx]').forEach(function(b) { b.style.borderTop = ''; b.style.opacity = ''; });
    if (wasActive) {
      var target = document.elementFromPoint(e.clientX, e.clientY);
      target = target && target.closest ? target.closest('.sidebar-brand-item[data-brand-idx]') : null;
      if (target) {
        var toIdx = parseInt(target.getAttribute('data-brand-idx'));
        if (toIdx !== _bsDrag.fromIdx) reorderBrand(_bsDrag.fromIdx, toIdx);
      }
      // Block the click event that fires after mouseup on a drag
      var dragEl = _bsDrag.el;
      if (dragEl) {
        var blocker = function(ev) { ev.stopImmediatePropagation(); ev.preventDefault(); dragEl.removeEventListener('click', blocker, true); };
        dragEl.addEventListener('click', blocker, true);
      }
    }
    _bsDrag.fromIdx = -1;
    _bsDrag.active = false;
    _bsDrag.el = null;
  });

  // Touch support
  document.addEventListener('touchstart', function(e) {
    var btn = e.target.closest && e.target.closest('.sidebar-brand-item[data-brand-idx]');
    if (!btn) return;
    _bsDrag.fromIdx = parseInt(btn.getAttribute('data-brand-idx'));
    _bsDrag.startY = e.touches[0].clientY;
    _bsDrag.el = btn;
    _bsDrag.active = false;
  }, {passive: true});

  document.addEventListener('touchmove', function(e) {
    if (_bsDrag.fromIdx === -1) return;
    var t = e.touches[0];
    var dy = Math.abs(t.clientY - _bsDrag.startY);
    if (!_bsDrag.active && dy > THRESHOLD) {
      _bsDrag.active = true;
      _bsDrag.el.style.opacity = '0.4';
    }
    if (!_bsDrag.active) return;
    if (e.cancelable) e.preventDefault();
    var dd = document.getElementById('sidebarBrandDropdown');
    if (dd) dd.querySelectorAll('.sidebar-brand-item[data-brand-idx]').forEach(function(b) { b.style.borderTop = ''; });
    var target = document.elementFromPoint(t.clientX, t.clientY);
    target = target && target.closest ? target.closest('.sidebar-brand-item[data-brand-idx]') : null;
    if (target && parseInt(target.getAttribute('data-brand-idx')) !== _bsDrag.fromIdx) {
      target.style.borderTop = '2px solid var(--accent)';
    }
  }, {passive: false});

  document.addEventListener('touchend', function(e) {
    if (_bsDrag.fromIdx === -1) return;
    var wasActive = _bsDrag.active;
    var dd = document.getElementById('sidebarBrandDropdown');
    if (dd) dd.querySelectorAll('.sidebar-brand-item[data-brand-idx]').forEach(function(b) { b.style.borderTop = ''; b.style.opacity = ''; });
    if (wasActive) {
      var t = e.changedTouches[0];
      var target = document.elementFromPoint(t.clientX, t.clientY);
      target = target && target.closest ? target.closest('.sidebar-brand-item[data-brand-idx]') : null;
      if (target) {
        var toIdx = parseInt(target.getAttribute('data-brand-idx'));
        if (toIdx !== _bsDrag.fromIdx) reorderBrand(_bsDrag.fromIdx, toIdx);
      }
    }
    _bsDrag.fromIdx = -1;
    _bsDrag.active = false;
    _bsDrag.el = null;
  });
})();

function reorderBrand(fromIdx, toIdx) {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= brands.length || toIdx >= brands.length) return;

  // Track which brand was selected before reorder
  var currentBrand = parseInt(document.getElementById('brand').value) || 0;
  var activeBrandId = brands[currentBrand] ? (brands[currentBrand].id || brands[currentBrand].name) : null;

  // Move the brand in the array
  var moved = brands.splice(fromIdx, 1)[0];
  brands.splice(toIdx, 0, moved);

  // Update _order property on all brands
  for (var i = 0; i < brands.length; i++) {
    brands[i]._order = i;
  }

  // Restore selectedBrand to the same brand (index may have changed)
  if (activeBrandId) {
    for (var b = 0; b < brands.length; b++) {
      if ((brands[b].id || brands[b].name) === activeBrandId) {
        selectedBrand = b;
        document.getElementById('brand').value = b;
        break;
      }
    }
  }

  // Persist and sync
  if (typeof saveBrands === 'function') saveBrands();

  // Re-render the dropdown
  populateSidebarBrandDropdown();

  // Update sidebar brand name display
  var sidebarName = document.getElementById('sidebarBrandName');
  if (sidebarName && brands[selectedBrand]) {
    sidebarName.innerHTML = (brands[selectedBrand].shortName || brands[selectedBrand].name) + ' <span class="sidebar-brand-arrow">\u25BE</span>';
  }

  showToast('Brand order updated', 'success');
}

// v10.5.25: Select life profile by index
function selectLifeProfileByIndex(idx) {
  var dropdown = document.getElementById('sidebarBrandDropdown');
  if (dropdown) dropdown.classList.remove('active');
  
  if (typeof setCurrentLifeProfileIndex === 'function') {
    setCurrentLifeProfileIndex(idx);
  }
  
  var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  if (profiles[idx]) {
    // v15.32: Apply per-profile accent colors (reset if profile has none)
    var profile = profiles[idx];
    if (profile.accentDarkMode) {
      localStorage.setItem('roweos_life_accent_dark_mode', profile.accentDarkMode);
      localStorage.setItem('roweos_life_accent_dark_mode_dark', typeof darkenColor === 'function' ? darkenColor(profile.accentDarkMode, 20) : profile.accentDarkMode);
    } else {
      // v15.32: Don't carry over previous profile's accent — reset to default
      localStorage.removeItem('roweos_life_accent_dark_mode');
      localStorage.removeItem('roweos_life_accent_dark_mode_dark');
    }
    if (profile.accentLightMode) {
      localStorage.setItem('roweos_life_accent_light_mode', profile.accentLightMode);
      localStorage.setItem('roweos_life_accent_light_mode_dark', typeof darkenColor === 'function' ? darkenColor(profile.accentLightMode, 20) : profile.accentLightMode);
    } else {
      localStorage.removeItem('roweos_life_accent_light_mode');
      localStorage.removeItem('roweos_life_accent_light_mode_dark');
    }
    if (typeof initLifeAccentColor === 'function') initLifeAccentColor();
    if (typeof applyCurrentModeAccent === 'function') applyCurrentModeAccent();

    // v15.37: Logo loads via getCurrentLogoKey() which reads profile index — no shared key needed
    if (typeof loadCurrentLogo === 'function') loadCurrentLogo();

    showToast('Switched to ' + (profile.name || 'Life ' + (idx + 1)), 'success');

    // v15.30: Invalidate life library cache so new profile's library loads
    fileLibrary['_life'] = null;
    if (currentView === 'library' && typeof renderLibraryView === 'function') {
      renderLibraryView();
    }

    // Refresh Identity view if visible
    if (typeof renderLifeIdentityView === 'function') {
      renderLifeIdentityView();
    }

    // v18.0: Refresh social account cards for new profile's connections
    if (typeof refreshSocialAccountCards === 'function') {
      refreshSocialAccountCards();
    }
  }
}

// v10.5.25: Launch onboarding for new life profile
// v11.0.5: Updated to NOT create profile until onboarding is complete
function launchLifeOnboardingForNewProfile() {
  var dropdown = document.getElementById('sidebarBrandDropdown');
  if (dropdown) dropdown.classList.remove('active');
  
  // v11.0.5: Set flag that we're creating a NEW profile, but don't create it yet
  // The profile will only be created when finishLifeOnboarding() is called
  window.isCreatingNewLifeProfile = true;
  window.pendingNewLifeProfile = {
    id: 'life_' + Date.now(),
    name: '',
    createdAt: new Date().toISOString(),
    lifeAreas: [],
    goals: [],
    identityData: {},
    preferences: {},
    onboardingComplete: false,
    onboardingDismissed: false
  };
  
  // Switch to Life mode if not already
  localStorage.setItem('roweos_app_mode', 'life');
  localStorage.setItem('roweos_mode', 'life');
  updateModeUI('life');
  
  // Navigate to Identity view
  showView('memory');
  
  // Open the new Identity onboarding wizard
  setTimeout(function() {
    openLifeOnboarding();
  }, 100);
}

// Expose to window
window.launchLifeOnboardingForNewProfile = launchLifeOnboardingForNewProfile;

// v10.5.25: Select life profile (deprecated - use selectLifeProfileByIndex)
function selectLifeProfile() {
  var dropdown = document.getElementById('sidebarBrandDropdown');
  if (dropdown) dropdown.classList.remove('active');
  showToast('You are using LifeAI', 'info');
}

// v10.5.25: Switch from Life mode to Brand mode
function switchToBrandMode() {
  // Close dropdown
  var dropdown = document.getElementById('sidebarBrandDropdown');
  if (dropdown) dropdown.classList.remove('active');

  // v20.6: If no brands exist, launch onboarding for BrandAI setup
  if (!brands || brands.length === 0) {
    selectedOnboardingMode = 'brand';
    localStorage.setItem('roweos_onboarding_mode', 'brand');
    showOnboarding();
    // Pre-select BrandAI card in mode selection
    setTimeout(function() {
      selectOnboardingMode('brand');
      // Skip mode selection, go straight to brand name step
      proceedFromModeSelection();
    }, 100);
    return;
  }

  // v13.9: Clear pending document upload state and close modal on mode switch
  pendingDocFiles = [];
  pendingDocMode = 'brand';
  closeDocContextModal();

  // Switch mode
  localStorage.setItem('roweos_app_mode', 'brand');
  localStorage.setItem('roweos_mode', 'brand');

  // v15.3: Restore last active brand instead of defaulting to first
  var lastBrandIdx = window.lastActiveBrandIdx || parseInt(localStorage.getItem('roweos_selected_brand') || '0');
  if (isNaN(lastBrandIdx) || lastBrandIdx < 0 || lastBrandIdx >= brands.length) lastBrandIdx = 0;
  selectedBrand = lastBrandIdx;
  var brandSelect = document.getElementById('brand');
  if (brandSelect && brands[lastBrandIdx]) {
    brandSelect.value = lastBrandIdx;
  }
  var agentBrand = document.getElementById('agentBrand');
  if (agentBrand && brands[lastBrandIdx]) {
    agentBrand.value = lastBrandIdx;
  }
  // v18.5: Also sync mobile brand selector
  var mobileBrandSel = document.getElementById('mobileBrand');
  if (mobileBrandSel) mobileBrandSel.value = lastBrandIdx;

  // v12.0.1: Reload mode-specific data
  initTodoCategories();
  initTodos();
  initCalendar();
  initJournal(); // v12.2.4

  // v15.18: Reload inventory for brand mode
  if (typeof loadInventoryData === 'function') loadInventoryData();

  // v10.5.25: FORCE hide Life containers and show Brand containers immediately
  var lifeContainer = document.getElementById('lifeIdentityCardsContainer');
  var brandContainer = document.getElementById('identityCardsContainer');
  var lifeUploadSection = document.getElementById('lifeIdentityUploadSection');

  if (lifeContainer) lifeContainer.style.display = 'none';
  if (brandContainer) brandContainer.style.display = 'block';
  // v13.9: Hide lifeAI upload section specifically
  if (lifeUploadSection) lifeUploadSection.style.display = 'none';

  // v14.0: Show brand doc upload section explicitly
  var brandDocSection = document.getElementById('brandDocUploadSection');
  if (brandDocSection) brandDocSection.style.display = 'block';

  // Show brand upload sections only
  document.querySelectorAll('.identity-upload-section').forEach(function(el) {
    // v14.0: Use explicit ID-based toggling
    if (el.id === 'lifeIdentityUploadSection') {
      el.style.display = 'none';
    } else {
      el.style.display = 'block';
    }
  });

  // Update UI
  if (typeof updateModeUI === 'function') {
    updateModeUI('brand');
  }

  // v10.5.25: Repopulate the dropdown with brand content
  if (typeof populateSidebarBrandDropdown === 'function') {
    populateSidebarBrandDropdown();
  }

  // v15.23: Force refresh the current view to Brand content (including role data)
  if (currentView === 'memory') {
    if (typeof renderBrandIdentityView === 'function') {
      renderBrandIdentityView();
    } else {
      renderMemoryBrandPills();
      updateMemoryUI();
      loadBrandKnowledge(currentKnowledgeBrand);
    }
  }

  // Force refresh any view
  showView(currentView);

  // v12.2.4: Load logo for BrandAI mode
  if (typeof loadCurrentLogo === 'function') {
    loadCurrentLogo();
  }

  // v15.1: Apply brand accent color to entire UI
  if (typeof applyCurrentBrandAccent === 'function') {
    applyCurrentBrandAccent();
  }

  showToast('Switched to BrandAI mode', 'success');
}

// v10.5.25: Switch from Brand mode to Life mode
function switchToLifeMode(profileIdx) {
  var dropdown = document.getElementById('sidebarBrandDropdown');
  if (dropdown) dropdown.classList.remove('active');

  // v13.9: Clear pending document upload state and close modal on mode switch
  pendingDocFiles = [];
  pendingDocMode = 'life';
  closeDocContextModal();

  var lifeProfiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  
  if (lifeProfiles.length === 0) {
    // Fallback to single profile check
    var lifeProfile = localStorage.getItem('roweos_life_profile');
    if (!lifeProfile) {
      showToast('Please complete LifeAI onboarding first', 'warning');
      return;
    }
  }
  
  // Set the profile index if provided
  if (typeof profileIdx === 'number' && lifeProfiles[profileIdx]) {
    localStorage.setItem('roweos_current_life_profile_idx', profileIdx.toString());
    localStorage.setItem('roweos_life_profile', JSON.stringify(lifeProfiles[profileIdx]));
    localStorage.setItem('roweos_user_name', lifeProfiles[profileIdx].name || 'My Life');
  }
  
  // Switch mode
  localStorage.setItem('roweos_app_mode', 'life');
  localStorage.setItem('roweos_mode', 'life');

  // v12.0.1: Reload mode-specific data
  initTodoCategories();
  initTodos();
  initCalendar();
  initJournal(); // v12.2.4

  // v15.18: Reload inventory for life mode
  if (typeof loadInventoryData === 'function') loadInventoryData();

  // v10.5.25: FORCE hide Brand containers and show Life containers immediately
  var lifeContainer = document.getElementById('lifeIdentityCardsContainer');
  var brandContainer = document.getElementById('identityCardsContainer');
  var lifeUploadSection = document.getElementById('lifeIdentityUploadSection');

  if (brandContainer) brandContainer.style.display = 'none';
  if (lifeContainer) lifeContainer.style.display = 'block';
  // v13.9: Show lifeAI upload section specifically
  if (lifeUploadSection) lifeUploadSection.style.display = 'block';

  // v14.0: Hide brand doc upload section explicitly
  var brandDocSection = document.getElementById('brandDocUploadSection');
  if (brandDocSection) brandDocSection.style.display = 'none';

  // v13.9: Hide brand upload sections, show life upload sections
  document.querySelectorAll('.identity-upload-section').forEach(function(el) {
    if (el.id === 'lifeIdentityUploadSection') {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
  
  // Update UI
  if (typeof updateModeUI === 'function') {
    updateModeUI('life');
  }
  
  // v10.5.25: Repopulate the dropdown with life content
  if (typeof populateSidebarBrandDropdown === 'function') {
    populateSidebarBrandDropdown();
  }
  
  // v10.5.25: Force refresh the current view to Life content
  if (currentView === 'memory' && typeof renderLifeIdentityView === 'function') {
    renderLifeIdentityView();
  }
  
  // Force refresh any view
  showView(currentView);

  // v12.2.4: Load logo for LifeAI mode
  if (typeof loadCurrentLogo === 'function') {
    loadCurrentLogo();
  }

  // v15.1: Reset brand accent so LifeAI uses CSS defaults for --accent
  if (typeof resetBrandAccentCSS === 'function') {
    resetBrandAccentCSS();
  }

  var currentProfile = typeof getCurrentLifeProfile === 'function' ? getCurrentLifeProfile() : null;
  var profileName = currentProfile ? currentProfile.name : localStorage.getItem('roweos_user_name') || 'My Life';
  showToast('Switched to LifeAI - ' + profileName, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// v10.5.25: DUAL ACCENT COLOR SYSTEM - Separate colors for Light/Dark modes
// ═══════════════════════════════════════════════════════════════════════════

// Preset colors for LifeAI accent (full spectrum)
var lifeAccentPresets = [
  // Greens
  { name: 'Emerald', color: '#22c55e', dark: '#16a34a' },
  { name: 'Teal', color: '#14b8a6', dark: '#0d9488' },
  // Blues
  { name: 'Sky', color: '#0ea5e9', dark: '#0284c7' },
  { name: 'Midnight', color: '#1e3a5f', dark: '#0f2744' },
  // Purples
  { name: 'Violet', color: '#8b5cf6', dark: '#7c3aed' },
  { name: 'Purple', color: '#a855f7', dark: '#9333ea' },
  // Pinks & Reds
  { name: 'Pink', color: '#ec4899', dark: '#db2777' },
  { name: 'Burgundy', color: '#722f37', dark: '#4a1f24' },
  // Warm colors
  { name: 'Orange', color: '#f97316', dark: '#ea580c' },
  { name: 'Amber', color: '#f59e0b', dark: '#d97706' },
  // Neutrals
  { name: 'Slate', color: '#64748b', dark: '#475569' },
  { name: 'Zinc', color: '#71717a', dark: '#52525b' }
];

// Current selected accent colors (separate for each mode)
var lifeAccentDarkMode = { color: '#22c55e', dark: '#16a34a' };
var lifeAccentLightMode = { color: '#0ea5e9', dark: '#0284c7' };
var lifeAccentEditing = 'dark'; // Currently editing: 'dark' or 'light'

/**
 * v10.5.25: Initialize LifeAI accent colors from storage
 */
function initLifeAccentColor() {
  // Load dark mode accent
  var savedDarkColor = localStorage.getItem('roweos_life_accent_dark_mode');
  var savedDarkDark = localStorage.getItem('roweos_life_accent_dark_mode_dark');
  if (savedDarkColor) {
    lifeAccentDarkMode = { color: savedDarkColor, dark: savedDarkDark || darkenColor(savedDarkColor, 20) };
  }
  
  // Load light mode accent
  var savedLightColor = localStorage.getItem('roweos_life_accent_light_mode');
  var savedLightDark = localStorage.getItem('roweos_life_accent_light_mode_dark');
  if (savedLightColor) {
    lifeAccentLightMode = { color: savedLightColor, dark: savedLightDark || darkenColor(savedLightColor, 20) };
  }
  
  // Legacy migration: if old single color exists, use it for dark mode
  var legacyColor = localStorage.getItem('roweos_life_accent_color');
  if (legacyColor && !savedDarkColor) {
    lifeAccentDarkMode.color = legacyColor;
    lifeAccentDarkMode.dark = localStorage.getItem('roweos_life_accent_dark') || darkenColor(legacyColor, 20);
  }
  
  // Apply based on current theme
  applyCurrentModeAccent();
}

/**
 * v10.5.25: Get current theme mode
 */
function getCurrentThemeMode() {
  return document.documentElement.classList.contains('light-mode') ? 'light' : 'dark';
}

/**
 * v10.5.25: Apply accent color for current theme mode
 */
function applyCurrentModeAccent() {
  var mode = getCurrentThemeMode();
  var accent = mode === 'light' ? lifeAccentLightMode : lifeAccentDarkMode;
  applyLifeAccentColor(accent.color, accent.dark);
}

/**
 * Apply LifeAI accent color to CSS variables
 */
function applyLifeAccentColor(color, darkColor) {
  // v15.0: Always apply life accent CSS variables so Settings preview works correctly

  var root = document.documentElement;

  // Convert hex to RGB for alpha variations
  var rgb = hexToRgb(color);
  if (!rgb) return;
  
  // Calculate luminance to determine if we need light or dark text
  // Using relative luminance formula: 0.299*R + 0.587*G + 0.114*B
  var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  var contrastText = luminance > 0.5 ? '#1a1a1a' : '#ffffff';
  
  root.style.setProperty('--life-accent', color);
  root.style.setProperty('--life-accent-dark', darkColor || darkenColor(color, 20));
  root.style.setProperty('--life-accent-light', lightenColor(color, 20));
  root.style.setProperty('--life-accent-text', contrastText);
  root.style.setProperty('--life-accent-rgb', rgb.r + ', ' + rgb.g + ', ' + rgb.b); // v11.0.5: For rgba() usage
  root.style.setProperty('--life-accent-10', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.1)');
  root.style.setProperty('--life-accent-15', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.15)');
  root.style.setProperty('--life-accent-20', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.2)');
  root.style.setProperty('--life-accent-25', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.25)');
  root.style.setProperty('--life-accent-30', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.3)');
  root.style.setProperty('--life-accent-40', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.4)');
  root.style.setProperty('--life-accent-50', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.5)');
  root.style.setProperty('--life-accent-60', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.6)');
  root.style.setProperty('--life-accent-70', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.7)');
  
  console.log('[LifeAI] Applied accent color:', color, 'contrast text:', contrastText);
}

/**
 * v10.5.25: Save LifeAI accent color for specific mode
 */
function saveLifeAccentColor(color, darkColor, mode) {
  var targetMode = mode || lifeAccentEditing;
  var accentDark = darkColor || darkenColor(color, 20);
  
  if (targetMode === 'light') {
    lifeAccentLightMode = { color: color, dark: accentDark };
    localStorage.setItem('roweos_life_accent_light_mode', color);
    localStorage.setItem('roweos_life_accent_light_mode_dark', accentDark);
  } else {
    lifeAccentDarkMode = { color: color, dark: accentDark };
    localStorage.setItem('roweos_life_accent_dark_mode', color);
    localStorage.setItem('roweos_life_accent_dark_mode_dark', accentDark);
  }
  
  // Also save to legacy keys for backward compatibility
  if (targetMode === 'dark') {
    localStorage.setItem('roweos_life_accent_color', color);
    localStorage.setItem('roweos_life_accent_dark', accentDark);
  }

  // v15.32: Also update the current profile's accent so it persists per-profile
  var pIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var pfs = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  if (pfs[pIdx]) {
    if (targetMode === 'light') {
      pfs[pIdx].accentLightMode = color;
    } else {
      pfs[pIdx].accentDarkMode = color;
    }
    if (typeof saveLifeProfiles === 'function') saveLifeProfiles(pfs);
  }

  // Apply if currently viewing this mode
  applyCurrentModeAccent();

  // Sync to Firebase if available
  if (typeof syncToFirebase === 'function') {
    syncToFirebase();
  }
}

/**
 * v10.5.25: Select a preset accent color
 */
function selectLifeAccentPreset(index) {
  var preset = lifeAccentPresets[index];
  if (!preset) return;
  
  saveLifeAccentColor(preset.color, preset.dark);
  
  // v10.5.25: Auto-switch theme to match editing mode for preview
  if (lifeAccentEditing === 'light' && !document.documentElement.classList.contains('light-mode')) {
    toggleTheme(); // Switch to light mode
  } else if (lifeAccentEditing === 'dark' && document.documentElement.classList.contains('light-mode')) {
    toggleTheme(); // Switch to dark mode
  }
  
  updateLifeAccentPickerUI();
}

/**
 * v10.5.25: Set custom accent color from hex input
 */
function setCustomLifeAccentColor(color) {
  // Validate hex color
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    showToast('Please enter a valid hex color (e.g., #22c55e)', 'warning');
    return;
  }
  
  saveLifeAccentColor(color, darkenColor(color, 20));
  
  // v10.5.25: Auto-switch theme to match editing mode for preview
  if (lifeAccentEditing === 'light' && !document.documentElement.classList.contains('light-mode')) {
    toggleTheme(); // Switch to light mode
  } else if (lifeAccentEditing === 'dark' && document.documentElement.classList.contains('light-mode')) {
    toggleTheme(); // Switch to dark mode
  }
  
  updateLifeAccentPickerUI();
}

/**
 * v10.5.25: Switch between editing dark/light mode accent
 */
function switchAccentEditMode(mode) {
  lifeAccentEditing = mode;
  
  // v10.5.25: Auto-switch theme to match the mode being edited
  if (mode === 'light' && !document.documentElement.classList.contains('light-mode')) {
    toggleTheme(); // Switch to light mode
  } else if (mode === 'dark' && document.documentElement.classList.contains('light-mode')) {
    toggleTheme(); // Switch to dark mode
  }
  
  updateLifeAccentPickerUI();
}

/**
 * Update color picker UI to show selected color
 */
function updateLifeAccentPickerUI() {
  var currentAccent = lifeAccentEditing === 'light' ? lifeAccentLightMode : lifeAccentDarkMode;
  var selectedColor = currentAccent.color;
  
  // Update mode tabs
  document.querySelectorAll('.accent-mode-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.mode === lifeAccentEditing);
  });
  
  // v15.1: Scope preset update to LifeAI container only (avoid BrandAI preset collision)
  var lifePickerContainer = document.getElementById('settingsLifeAccentPicker');
  var presetBtns = lifePickerContainer ? lifePickerContainer.querySelectorAll('.life-accent-preset') : document.querySelectorAll('.life-accent-preset');
  presetBtns.forEach(function(btn, idx) {
    var preset = lifeAccentPresets[idx];
    btn.classList.toggle('selected', preset && preset.color.toLowerCase() === selectedColor.toLowerCase());
  });
  
  // Update custom inputs
  var colorInput = document.getElementById('lifeAccentColorInput');
  var hexInput = document.getElementById('lifeAccentHexInput');
  if (colorInput) colorInput.value = selectedColor;
  if (hexInput) hexInput.value = selectedColor;
  
  // Update preview badge colors
  var darkBadge = document.querySelector('.accent-mode-preview-dark');
  var lightBadge = document.querySelector('.accent-mode-preview-light');
  if (darkBadge) darkBadge.style.background = lifeAccentDarkMode.color;
  if (lightBadge) lightBadge.style.background = lifeAccentLightMode.color;
  
  // Update preview elements
  updateLifeAccentPreview();
}

/**
 * Update the preview section
 */
function updateLifeAccentPreview() {
  // Preview items auto-update via CSS variables
  // This function can be extended for additional preview logic
}

/**
 * v10.5.25: Render the dual-mode LifeAI accent color picker
 */
function renderLifeAccentPicker(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  
  var darkColor = lifeAccentDarkMode.color;
  var lightColor = lifeAccentLightMode.color;
  var currentColor = lifeAccentEditing === 'light' ? lightColor : darkColor;
  
  var html = '<div class="life-accent-picker">';
  html += '<div class="life-accent-picker-label">Accent Colors</div>';
  html += '<div class="life-accent-picker-sublabel">Set different accent colors for dark and light modes</div>';
  
  // Mode tabs with preview badges
  html += '<div class="accent-mode-tabs">';
  html += '<button class="accent-mode-tab' + (lifeAccentEditing === 'dark' ? ' active' : '') + '" data-mode="dark" onclick="switchAccentEditMode(\'dark\')">';
  html += '<span class="accent-mode-preview-dark" style="background: ' + darkColor + ';"></span>';
  html += '<span>Dark Mode</span>';
  html += '</button>';
  html += '<button class="accent-mode-tab' + (lifeAccentEditing === 'light' ? ' active' : '') + '" data-mode="light" onclick="switchAccentEditMode(\'light\')">';
  html += '<span class="accent-mode-preview-light" style="background: ' + lightColor + ';"></span>';
  html += '<span>Light Mode</span>';
  html += '</button>';
  html += '</div>';
  
  // Preset colors grid
  html += '<div class="life-accent-presets">';
  lifeAccentPresets.forEach(function(preset, idx) {
    var isSelected = preset.color.toLowerCase() === currentColor.toLowerCase();
    html += '<button class="life-accent-preset' + (isSelected ? ' selected' : '') + '" ';
    html += 'style="background: ' + preset.color + ';" ';
    html += 'onclick="selectLifeAccentPreset(' + idx + ')" ';
    html += 'title="' + preset.name + '"></button>';
  });
  html += '</div>';
  
  // Custom color input
  html += '<div class="life-accent-custom">';
  html += '<div class="life-accent-custom-input">';
  html += '<input type="color" id="lifeAccentColorInput" value="' + currentColor + '" onchange="setCustomLifeAccentColor(this.value)">';
  html += '<input type="text" id="lifeAccentHexInput" value="' + currentColor + '" placeholder="#22c55e" onchange="setCustomLifeAccentColor(this.value)">';
  html += '</div>';
  html += '</div>';
  
  // Preview section
  html += '<div class="life-accent-preview">';
  html += '<div class="life-accent-preview-title">Preview</div>';
  html += '<div class="life-accent-preview-items">';
  html += '<button class="life-accent-preview-btn primary">Primary</button>';
  html += '<button class="life-accent-preview-btn secondary">Secondary</button>';
  html += '<button class="life-accent-preview-btn gradient">Gradient</button>';
  html += '<div class="life-accent-preview-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>';
  html += '<span class="life-accent-preview-text">Accent Text</span>';
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  
  container.innerHTML = html;
}

/**
 * Helper: Convert hex to RGB
 */
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Helper: Darken a hex color
 */
function darkenColor(hex, percent) {
  var rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  var r = Math.max(0, Math.floor(rgb.r * (1 - percent / 100)));
  var g = Math.max(0, Math.floor(rgb.g * (1 - percent / 100)));
  var b = Math.max(0, Math.floor(rgb.b * (1 - percent / 100)));
  
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Helper: Lighten a hex color
 */
function lightenColor(hex, percent) {
  var rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  var r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * (percent / 100)));
  var g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * (percent / 100)));
  var b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * (percent / 100)));
  
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * v12.2.4: Per-Brand and Per-Mode Custom Logo Functions
 */

// Default R logo SVG (used as fallback)
var defaultBrandLogoSVG = '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor" stroke="none">R</text></svg>';

/**
 * v29.0: Get brand logo key by brand ID (reorder-safe)
 */
function getBrandLogoKeyById(brandId) {
  return 'roweos_brandlogo_' + (brandId || 'unknown');
}

/**
 * v12.2.4 / v29.0: Get the current logo storage key based on mode and brand
 * Now uses brand ID for reorder-safe logo keys with migration from index-based keys
 */
function getCurrentLogoKey(brandIdx) {
  // v28.3: Check both ID-based (v29+) and index-based (pre-v29) logo keys
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  if (mode === 'life') {
    var lifeIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    return 'roweos_lifeai_logo_profile_' + lifeIdx;
  }
  if (typeof brandIdx === 'undefined' || brandIdx === null) {
    brandIdx = selectedBrand;
  }
  if (typeof brandIdx !== 'number' || isNaN(brandIdx) || brandIdx < 0) brandIdx = 0;
  var brand = brands[brandIdx];
  // Try ID-based key first (v29+)
  if (brand && brand.id) {
    var idKey = 'roweos_brandlogo_' + brand.id;
    if (localStorage.getItem(idKey)) return idKey;
  }
  // Fallback: index-based key using _order (original index, survives reorder)
  var origIdx = (brand && typeof brand._order === 'number') ? brand._order : brandIdx;
  var indexKey = 'roweos_brand_' + origIdx + '_logo';
  if (localStorage.getItem(indexKey)) return indexKey;
  // Return ID-based key for new saves (even if empty), falling back to index key
  if (brand && brand.id) return 'roweos_brandlogo_' + brand.id;
  return indexKey;
}

/**
 * v12.2.4: Get the current logo size storage key based on mode and brand
 */
function getCurrentLogoSizeKey() {
  return getCurrentLogoKey() + '_size';
}

/**
 * v12.2.4: Initialize logo on page load (loads appropriate logo for current mode/brand)
 */
function initBrandLogo() {
  loadCurrentLogo();
}

/**
 * v12.2.4: Load and apply the logo for current mode/brand
 */
function loadCurrentLogo() {
  var logoKey = getCurrentLogoKey();
  var sizeKey = getCurrentLogoSizeKey();
  var savedLogo = localStorage.getItem(logoKey);
  var savedSize = localStorage.getItem(sizeKey);

  // v15.37: Mode safety guard — verify logo key matches current mode
  var mode = (typeof getCurrentMode === 'function') ? getCurrentMode() : 'brand';
  if (mode === 'brand' && logoKey.indexOf('lifeai') !== -1) {
    console.warn('[Logo] Mode mismatch: brand mode but logo key is LifeAI:', logoKey);
    resetLogoToDefault();
    return;
  }
  if (mode === 'life' && logoKey.indexOf('brand_') !== -1) {
    console.warn('[Logo] Mode mismatch: life mode but logo key is BrandAI:', logoKey);
    resetLogoToDefault();
    return;
  }

  if (savedLogo) {
    applyBrandLogo(savedLogo, savedSize || 100);
    // v24.4: Pre-upload logo for email templates (so pipeline emails have a URL ready)
    if (savedLogo.indexOf('data:') === 0 && typeof mailEnsureLogoUrl === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
      try { mailEnsureLogoUrl(savedLogo); } catch(e) {}
    }
  } else {
    // Reset to default logo
    resetLogoToDefault();
  }
  // v28.4: Apply light/dark logo variant after base logo is loaded
  // swapLogoForTheme checks brand.logoLight and light-mode class
  if (mode === 'brand' && typeof swapLogoForTheme === 'function') {
    try { swapLogoForTheme(); } catch(e) {}
  }
}

/**
 * v15.37: One-time migration — move shared roweos_lifeai_logo to per-profile key
 * Prevents BrandAI/LifeAI logo bleed by eliminating the shared key
 */
function migrateSharedLifeLogoToProfile() {
  var sharedLogo = localStorage.getItem('roweos_lifeai_logo');
  if (!sharedLogo) return;
  var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var perProfileKey = 'roweos_lifeai_logo_profile_' + profileIdx;
  // Only migrate if per-profile key doesn't already have data
  if (!localStorage.getItem(perProfileKey)) {
    localStorage.setItem(perProfileKey, sharedLogo);
    var sharedSize = localStorage.getItem('roweos_lifeai_logo_size') || '100';
    localStorage.setItem(perProfileKey + '_size', sharedSize);
    console.log('[Logo] Migrated shared LifeAI logo to profile key:', perProfileKey);
  }
  // Remove shared keys to prevent future bleed
  localStorage.removeItem('roweos_lifeai_logo');
  localStorage.removeItem('roweos_lifeai_logo_size');
  console.log('[Logo] Removed shared roweos_lifeai_logo key');
}

/**
 * v12.2.4: Apply custom brand logo to sidebar with size via CSS custom properties
 */
function applyBrandLogo(base64Logo, size) {
  var mainLogo = document.getElementById('mainLogo');
  if (!mainLogo) return;

  var logoImg = mainLogo.querySelector('.sidebar-logo-img');
  if (logoImg && base64Logo) {
    // Store original src if not already stored
    if (!logoImg.dataset.originalSrc) {
      logoImg.dataset.originalSrc = logoImg.src;
    }
    logoImg.src = base64Logo;
  }

  // v15.19: Apply scale via CSS custom property — container stays fixed, only img scales
  var sizeVal = parseInt(size) || 100;
  var scale = sizeVal / 100;
  // Clamp scale: 0.3 to 3.0 (30% to 300%)
  scale = Math.min(3.0, Math.max(0.3, scale));
  document.documentElement.style.setProperty('--logo-scale', scale);

  // v13.9: Update collapsed logo - clear first to prevent duplication
  var collapsedLogo = document.querySelector('.sidebar-collapsed-logo');
  if (collapsedLogo) {
    collapsedLogo.innerHTML = '';
    collapsedLogo.style.display = '';
    if (base64Logo) {
      // v15.3: Use DOM methods instead of innerHTML to prevent XSS from malformed base64
      var logoImg = document.createElement('img');
      logoImg.src = base64Logo;
      logoImg.alt = 'Logo';
      logoImg.style.cssText = 'object-fit: contain; border-radius: var(--radius-sm);';
      collapsedLogo.appendChild(logoImg);
    }
  }
  // v15.3: Keep mainLogo hidden — its inner img is permanently display:none via CSS.
  // Showing it creates an empty visible box (the "black box" over logos).
  // The collapsed logo element handles the custom logo display instead.
  if (mainLogo) mainLogo.style.display = 'none';
}

/**
 * v12.2.4: Reset logo to default (without removing from storage)
 */
function resetLogoToDefault() {
  // v13.9: No default logo - when reset, remove all logos entirely
  var collapsedLogo = document.querySelector('.sidebar-collapsed-logo');
  if (collapsedLogo) {
    collapsedLogo.innerHTML = '';
    collapsedLogo.style.display = 'none';
  }
  var mainLogo = document.getElementById('mainLogo');
  if (mainLogo) {
    mainLogo.style.display = 'none';
    var logoImg = mainLogo.querySelector('.sidebar-logo-img');
    if (logoImg) logoImg.src = '';
  }
  // Clear mobile header logo too
  var mobileHeaderLogo = document.querySelector('.mobile-header-logo img');
  if (mobileHeaderLogo) mobileHeaderLogo.style.display = 'none';
  // v15.19: Reset scale
  document.documentElement.style.setProperty('--logo-scale', '1');
}

/**
 * v12.2.4: Reset brand logo to default and remove from storage
 */
function resetBrandLogo() {
  var mainLogo = document.getElementById('mainLogo');
  if (!mainLogo) return;

  var logoImg = mainLogo.querySelector('.sidebar-logo-img');
  if (logoImg && logoImg.dataset.originalSrc) {
    logoImg.src = logoImg.dataset.originalSrc;
    logoImg.style.transform = '';
    logoImg.style.transformOrigin = '';
  }

  // v12.2.4: Reset to default and remove per-brand/mode logo from storage
  resetLogoToDefault();

  var logoKey = getCurrentLogoKey();
  var sizeKey = getCurrentLogoSizeKey();
  localStorage.removeItem(logoKey);
  localStorage.removeItem(sizeKey);

  // Re-render the picker to update UI
  renderBrandLogoPicker('settingsBrandLogoUploader');

  // v12.2.4: Sync removal to Firebase
  syncBrandLogoToFirebase(null, null);

  showToast('Logo reset to default', 'info');
}

// v24.24: Welcome Logo Size — resizes container, logo fills inside
function setWelcomeLogoSize(val) {
  var px = Math.round(72 * parseInt(val) / 100);
  document.documentElement.style.setProperty('--welcome-logo-size', px + 'px');
  localStorage.setItem('roweos_welcome_logo_size', val);
  var label = document.getElementById('welcomeLogoSizeLabel');
  if (label) label.textContent = val + '%';
  updateWelcomeCardPreview();
}
function initWelcomeLogoSize() {
  var saved = localStorage.getItem('roweos_welcome_logo_size') || '100';
  var px = Math.round(72 * parseInt(saved) / 100);
  document.documentElement.style.setProperty('--welcome-logo-size', px + 'px');
  var slider = document.getElementById('welcomeLogoSizeSlider');
  if (slider) slider.value = saved;
  var label = document.getElementById('welcomeLogoSizeLabel');
  if (label) label.textContent = saved + '%';
}

// v24.24: Image Zoom — scales the logo image inside the container
function setLogoZoom(val) {
  var v = parseInt(val);
  var scale = v / 100;
  document.documentElement.style.setProperty('--welcome-logo-zoom', scale);
  localStorage.setItem('roweos_welcome_logo_zoom', v);
  var label = document.getElementById('logoZoomLabel');
  if (label) label.textContent = v + '%';
}
function initLogoZoom() {
  var saved = localStorage.getItem('roweos_welcome_logo_zoom') || '100';
  var v = parseInt(saved);
  document.documentElement.style.setProperty('--welcome-logo-zoom', v / 100);
  var slider = document.getElementById('logoZoomSlider');
  if (slider) slider.value = v;
  var label = document.getElementById('logoZoomLabel');
  if (label) label.textContent = v + '%';
}

// v24.24: Update welcome card preview with actual brand/life logos
function updateWelcomeCardPreview() {
  var p1 = document.getElementById('welcomePreviewLogo1');
  var p2 = document.getElementById('welcomePreviewLogo2');
  if (!p1 || !p2) return;
  // Brand preview
  var brandIdx = typeof primaryBrandIdx !== 'undefined' ? primaryBrandIdx : 0;
  var brandLogo = localStorage.getItem(getCurrentLogoKey(brandIdx));
  if (brandLogo) {
    p1.innerHTML = '<img src="' + escapeHtml(brandLogo) + '" style="width:100%;height:100%;object-fit:cover;transform:scale(var(--welcome-logo-zoom,1));">';
  }
  // Life preview
  var lifeLogo = localStorage.getItem('roweos_lifeai_logo_profile_0');
  if (lifeLogo) {
    p2.innerHTML = '<img src="' + escapeHtml(lifeLogo) + '" style="width:100%;height:100%;object-fit:cover;transform:scale(var(--welcome-logo-zoom,1));">';
  }
}

/**
 * v12.2.4: Handle brand logo size slider change (uses per-brand keys)
 */
function handleBrandLogoSizeChange(value) {
  var logoKey = getCurrentLogoKey();
  var sizeKey = getCurrentLogoSizeKey();
  var savedLogo = localStorage.getItem(logoKey);
  if (!savedLogo) return;

  // Save size to localStorage
  localStorage.setItem(sizeKey, value);
  
  // Apply to sidebar collapsed logo
  applyBrandLogo(savedLogo, value);
  
  // v11.5.4: Also update the settings preview image
  var previewImg = document.querySelector('.brand-logo-preview img');
  if (previewImg) {
    var scale = parseInt(value) / 100;
    previewImg.style.transform = 'scale(' + scale + ')';
  }
  
  // Update the displayed value
  var valueDisplay = document.getElementById('brandLogoSizeValue');
  if (valueDisplay) {
    valueDisplay.textContent = value + '%';
  }
  
  // v11.5.4: Sync logo size change to Firebase
  syncBrandLogoToFirebase(savedLogo, value);
}

/**
 * v16.5: Sync brand logo to Firebase — writes to per-logo subcollection doc (not legacy user doc)
 */
function syncBrandLogoToFirebase(base64Logo, size) {
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebaseUser && firebaseUser.uid) {
      var logoKey = getCurrentLogoKey();
      var basePath = 'roweos_users/' + firebaseUser.uid;
      var docId = logoKey.replace(/[\/\.]/g, '_');
      var db = firebase.firestore();

      if (base64Logo) {
        db.doc(basePath + '/logos/' + docId).set({
          key: logoKey,
          base64: base64Logo,
          size: parseInt(size) || 100
        }).then(function() {
          console.log('[Logo] Synced to Firebase (V2):', logoKey);
        }).catch(function(error) {
          console.warn('[Logo] Firebase sync failed:', error);
        });
        // v28.0: Dual-write logo to v4
        if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
          try { syncEngine.write('logos', docId, { key: logoKey, base64: base64Logo, size: parseInt(size) || 100 }); } catch(_e) {}
        }
      } else {
        // Delete logo doc
        db.doc(basePath + '/logos/' + docId).delete().then(function() {
          console.log('[Logo] Deleted from Firebase:', logoKey);
        }).catch(function(error) {
          console.warn('[Logo] Firebase delete failed:', error);
        });
        // v28.0: Dual-write logo delete to v4
        if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
          try { syncEngine.delete('logos', docId); } catch(_e) {}
        }
      }
    }
  } catch (error) {
    console.warn('[Logo] Firebase sync error:', error);
  }
}

/**
 * v12.2.4: Handle brand logo file upload (uses per-brand/mode keys)
 */
function handleBrandLogoUpload(input) {
  var file = input.files && input.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.match(/^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/)) {
    showToast('Please upload a PNG, JPG, WebP, GIF, or SVG image', 'error');
    return;
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be under 2MB', 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    var rawBase64 = e.target.result;
    var logoKey = getCurrentLogoKey();
    var sizeKey = getCurrentLogoSizeKey();

    // v22.37: Resize large logos to max 800x800 to prevent localStorage corruption
    var img = new Image();
    img.onload = function() {
      var base64Logo = rawBase64;
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w > 800 || h > 800 || rawBase64.length > 200000) {
        try {
          var maxDim = 800;
          if (w > maxDim) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          if (h > maxDim) { w = Math.round(w * (maxDim / h)); h = maxDim; }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          base64Logo = c.toDataURL('image/png');
        } catch(resizeErr) { /* use original if resize fails */ }
      }

      try {
        localStorage.setItem(logoKey, base64Logo);
        localStorage.setItem(sizeKey, '100');
      } catch (err) {
        if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
          console.error('[Logo] localStorage quota exceeded:', err);
          showToast('Storage full. Clear some data or use a smaller image.', 'error');
          return;
        }
        console.error('[Logo] Error saving logo:', err);
        showToast('Error saving logo. File may be too large.', 'error');
        return;
      }
      // v29.1: Save to BOTH ID-based and index-based keys for compatibility
      var isLife = typeof isLifeMode === 'function' && isLifeMode();
      if (!isLife) {
        var _brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
        var _brand = (typeof brands !== 'undefined' && brands[_brandIdx]) ? brands[_brandIdx] : null;
        if (_brand) {
          try {
            if (_brand.id) localStorage.setItem('roweos_brandlogo_' + _brand.id, base64Logo);
            var _origIdx = (typeof _brand._order === 'number') ? _brand._order : _brandIdx;
            localStorage.setItem('roweos_brand_' + _origIdx + '_logo', base64Logo);
          } catch(e) { /* best-effort dual save */ }
          // Sync to brands array so dark/light system stays in sync
          _brand.logo = base64Logo;
          if (typeof saveBrands === 'function') saveBrands();
        }
      }
      applyBrandLogo(base64Logo, 100);
      // v29.1: Also apply dark/light theme variant immediately
      if (typeof swapLogoForTheme === 'function') swapLogoForTheme();
      renderBrandLogoPicker('settingsBrandLogoUploader');
      syncBrandLogoToFirebase(base64Logo, 100);
      showToast((isLife ? 'LifeAI' : 'Brand') + ' logo uploaded successfully', 'success');
    };
    img.onerror = function() {
      // SVG or non-rasterizable — save as-is
      try {
        localStorage.setItem(logoKey, rawBase64);
        localStorage.setItem(sizeKey, '100');
      } catch (err) {
        if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
          showToast('Storage full. Clear some data or use a smaller image.', 'error');
          return;
        }
        showToast('Error saving logo. File may be too large.', 'error');
        return;
      }
      // v29.1: Dual-key save for SVG path
      var isLife = typeof isLifeMode === 'function' && isLifeMode();
      if (!isLife) {
        var _brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
        var _brand = (typeof brands !== 'undefined' && brands[_brandIdx]) ? brands[_brandIdx] : null;
        if (_brand) {
          try {
            if (_brand.id) localStorage.setItem('roweos_brandlogo_' + _brand.id, rawBase64);
            var _origIdx = (typeof _brand._order === 'number') ? _brand._order : _brandIdx;
            localStorage.setItem('roweos_brand_' + _origIdx + '_logo', rawBase64);
          } catch(e) {}
          _brand.logo = rawBase64;
          if (typeof saveBrands === 'function') saveBrands();
        }
      }
      applyBrandLogo(rawBase64, 100);
      if (typeof swapLogoForTheme === 'function') swapLogoForTheme();
      renderBrandLogoPicker('settingsBrandLogoUploader');
      syncBrandLogoToFirebase(rawBase64, 100);
      showToast('Logo uploaded successfully', 'success');
    };
    img.src = rawBase64;
  };
  reader.onerror = function() {
    showToast('Error reading file', 'error');
  };
  reader.readAsDataURL(file);
}

/**
 * v12.2.4: Render the logo picker UI with size slider (per-brand/mode)
 */
function renderBrandLogoPicker(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var isLife = typeof isLifeMode === 'function' && isLifeMode();
  var logoKey = getCurrentLogoKey();
  var sizeKey = getCurrentLogoSizeKey();
  var savedLogo = localStorage.getItem(logoKey);
  var savedSize = localStorage.getItem(sizeKey) || '100';
  var hasLogo = !!savedLogo;

  // v12.2.4: Get brand name for label (if in BrandAI mode)
  var brandLabel = 'Custom Logo';
  var brandHint = 'Upload your logo to replace the default R symbol';
  if (!isLife) {
    var brandSelect = document.getElementById('brand');
    var brandIdx = brandSelect ? parseInt(brandSelect.value) : 0;
    if (typeof brands !== 'undefined' && brands[brandIdx]) {
      var brandName = brands[brandIdx].shortName || brands[brandIdx].name;
      brandLabel = brandName + ' Logo';
      brandHint = 'Upload a logo for ' + brandName + '. Each brand can have its own logo.';
    }
  } else {
    brandLabel = 'LifeAI Logo';
    brandHint = 'Upload a personal logo for LifeAI mode.';
  }

  var html = '<div class="brand-logo-picker">';
  html += '<div class="brand-logo-picker-label">' + brandLabel + '</div>';
  html += '<div class="brand-logo-picker-sublabel">' + brandHint + '</div>';

  // Preview and actions container
  html += '<div class="brand-logo-preview-container">';

  // Logo preview
  html += '<div class="brand-logo-preview' + (hasLogo ? ' has-logo' : '') + '">';
  if (hasLogo) {
    html += '<img src="' + savedLogo + '" alt="Custom logo">';
  } else {
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>';
  }
  html += '</div>';

  // Actions
  html += '<div class="brand-logo-actions">';
  html += '<input type="file" id="brandLogoInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml" style="display:none;" onchange="handleBrandLogoUpload(this)">';
  html += '<button class="brand-logo-upload-btn" onclick="document.getElementById(\'brandLogoInput\').click()">';
  html += icon('upload', {strokeWidth: 2});
  html += hasLogo ? 'Change Logo' : 'Upload Logo';
  html += '</button>';

  if (hasLogo) {
    html += '<button class="brand-logo-reset-btn" onclick="resetBrandLogo()">';
    html += 'Reset to Default';
    html += '</button>';
  }

  html += '</div>'; // .brand-logo-actions
  html += '</div>'; // .brand-logo-preview-container

  // Size slider (only show when logo is uploaded)
  if (hasLogo) {
    html += '<div class="brand-logo-size-control">';
    html += '<div class="brand-logo-size-label">';
    html += '<span>Logo Size</span>';
    html += '<span class="brand-logo-size-value" id="brandLogoSizeValue">' + savedSize + '%</span>';
    html += '</div>';
    html += '<input type="range" class="brand-logo-size-slider" id="brandLogoSizeSlider" min="30" max="300" value="' + savedSize + '" oninput="handleBrandLogoSizeChange(this.value)">';
    html += '</div>';
  }

  // v29.1: Dark/Light mode logos — consolidated here (BrandAI only)
  if (!isLife) {
    var _bIdx = brandSelect ? parseInt(brandSelect.value) : 0;
    var _curBrand = (typeof brands !== 'undefined' && brands[_bIdx]) ? brands[_bIdx] : null;
    var _hasDarkLight = _curBrand && !!_curBrand.logoLight;
    var placeholder = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

    html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">';
    html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">';
    html += '<input type="checkbox" id="logoSameForBoth" onchange="toggleLogoSameMode()"' + (_hasDarkLight ? ' checked' : '') + '>';
    html += '<span style="font-size:12px;color:var(--text-secondary);">Use different logos for dark/light mode</span>';
    html += '</label>';
    html += '<div class="logo-upload-slots" id="logoUploadSlots" style="' + (_hasDarkLight ? 'display:flex;' : 'display:none;') + 'gap:12px;margin-top:8px;">';

    // Dark mode slot
    html += '<div class="logo-upload-slot" style="flex:1;">';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Dark Mode</div>';
    html += '<div class="logo-upload-preview" id="logoDarkPreview" style="width:48px;height:48px;border-radius:8px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:4px;">';
    if (_curBrand && _curBrand.logo) {
      html += '<img src="' + _curBrand.logo + '" alt="Dark logo" style="max-width:100%;max-height:100%;object-fit:contain;">';
    } else {
      html += placeholder;
    }
    html += '</div>';
    html += '<button class="brand-logo-upload-btn" style="font-size:11px;padding:4px 8px;" onclick="uploadBrandLogo(\'dark\')">Upload</button>';
    html += ' <button style="font-size:11px;padding:4px 8px;background:none;border:none;color:var(--text-muted);cursor:pointer;" onclick="removeBrandLogo(\'dark\')">Remove</button>';
    html += '</div>';

    // Light mode slot
    html += '<div class="logo-upload-slot" id="logoLightSlot" style="flex:1;">';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Light Mode</div>';
    html += '<div class="logo-upload-preview" id="logoLightPreview" style="width:48px;height:48px;border-radius:8px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:4px;">';
    if (_curBrand && _curBrand.logoLight) {
      html += '<img src="' + _curBrand.logoLight + '" alt="Light logo" style="max-width:100%;max-height:100%;object-fit:contain;">';
    } else {
      html += placeholder;
    }
    html += '</div>';
    html += '<button class="brand-logo-upload-btn" style="font-size:11px;padding:4px 8px;" onclick="uploadBrandLogo(\'light\')">Upload</button>';
    html += ' <button style="font-size:11px;padding:4px 8px;background:none;border:none;color:var(--text-muted);cursor:pointer;" onclick="removeBrandLogo(\'light\')">Remove</button>';
    html += '</div>';

    html += '</div>'; // .logo-upload-slots
    html += '<input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" style="display:none;" onchange="handleLogoFileSelect(event)">';
    html += '</div>';
  }

  // Hint text
  html += '<div class="brand-logo-hint">PNG, JPG, WebP, GIF, or SVG recommended. Max 2MB.</div>';

  html += '</div>'; // .brand-logo-picker

  container.innerHTML = html;
}

function selectSidebarBrand(idx) {
  // Update the hidden select
  var brandSelect = document.getElementById('brand');
  if (brandSelect) brandSelect.value = idx;

  // v15.4: Save last active brand for mode switching persistence
  window.lastActiveBrandIdx = idx;
  localStorage.setItem('roweos_selected_brand', idx.toString());
  selectedBrand = idx;

  // Close dropdown
  var dropdown = document.getElementById('sidebarBrandDropdown');
  if (dropdown) dropdown.classList.remove('active');
  
  // v11.5.4: Directly update sidebar brand name — use shortName if available
  var sidebarName = document.getElementById('sidebarBrandName');
  if (sidebarName && brands[idx]) {
    sidebarName.innerHTML = (brands[idx].shortName || brands[idx].name) + ' <span class="sidebar-brand-arrow">▾</span>';
  }
  
  // v9.1.14: Directly update Focus brand badge
  var focusBrandBadge = document.getElementById('focusBrandBadge');
  if (focusBrandBadge && brands[idx]) {
    focusBrandBadge.textContent = brands[idx].shortName || brands[idx].name;
  }
  
  // v28.2: Also persist brand ID for stable resolution
  if (brands[idx] && brands[idx].id) {
    if (typeof setSelectedBrand === 'function') setSelectedBrand(brands[idx].id);
  }

  // Trigger the full brand change
  onBrandChange();

  // v9.1.14: Always update Focus view when brand changes
  if (typeof renderFocusView === 'function') {
    renderFocusView();
  }

  // v28.2: Force Identity view refresh if currently visible — belt-and-suspenders
  if (currentView === 'memory' && typeof renderBrandIdentityView === 'function') {
    currentKnowledgeBrand = 'brand_' + idx;
    renderBrandIdentityView();
  }
  // v28.2: Update sidebar logo for new brand
  if (typeof initBrandLogo === 'function') initBrandLogo();
  if (typeof loadCurrentLogo === 'function') loadCurrentLogo();
}

// Close sidebar dropdown when clicking outside
document.addEventListener('click', function(e) {
  var sidebarDropdown = document.getElementById('sidebarBrandDropdown');
  var sidebarName = document.getElementById('sidebarBrandName');
  
  if (sidebarDropdown && !sidebarDropdown.contains(e.target) && !sidebarName.contains(e.target)) {
    sidebarDropdown.classList.remove('active');
  }
});

// Select brand from dropdown (v7.1)
function selectBrandFromDropdown(idxOrId) {
  // v29.0: Accept brand ID (string) or index (number) for backwards compat
  var idx;
  if (typeof idxOrId === 'string' && idxOrId.indexOf('brand_') === 0) {
    idx = getBrandIndex(idxOrId);
  } else {
    idx = parseInt(idxOrId, 10) || 0;
  }
  // Update hidden inputs
  var brandSelect = document.getElementById('brand');
  var agentBrandInput = document.getElementById('agentBrand');
  
  if (brandSelect) brandSelect.value = idx;
  if (agentBrandInput) agentBrandInput.value = idx;
  
  // v11.5.4: Update display names (sidebar, mobile, etc.) — use shortName if available
  var sidebarName = document.getElementById('sidebarBrandName');
  var mobilePillText = document.getElementById('mobileBrandPillText');
  
  if (sidebarName) sidebarName.innerHTML = (brands[idx].shortName || brands[idx].name) + ' <span class="sidebar-brand-arrow">▾</span>';
  if (mobilePillText) mobilePillText.textContent = brands[idx].shortName || brands[idx].name;
  
  // v9.1.14: Directly update Focus brand badge
  var focusBrandBadge = document.getElementById('focusBrandBadge');
  if (focusBrandBadge && brands[idx]) {
    focusBrandBadge.textContent = brands[idx].shortName || brands[idx].name;
  }
  
  // v9.1.14: Update brand icon active state (gold highlight when brand selected)
  updateBrandIconState(false);
  
  // v9.1.14: Update placeholder for BrandAI mode
  var input = document.getElementById('agentCommand');
  if (input) input.placeholder = "Ask about your brand...";
  var followupInput = document.getElementById('followupInput');
  if (followupInput) followupInput.placeholder = 'Continue the conversation...';
  
  // Close dropdowns
  document.querySelectorAll('.brand-dropdown').forEach(function(d) {
    d.classList.remove('active');
  });
  
  // v29.0: Store selected brand by ID
  if (brands[idx] && brands[idx].id) {
    setSelectedBrand(brands[idx].id);
  }

  // Trigger full brand change
  onBrandChange();

  // v9.1.14: Always update Focus view when brand changes
  if (typeof renderFocusView === 'function') {
    renderFocusView();
  }
}

// Close brand dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.brand-selector') && !e.target.closest('.brand-icon-btn') && !e.target.closest('.brand-dropdown')) {
    document.querySelectorAll('.brand-dropdown').forEach(function(d) {
      d.classList.remove('active');
    });
  }
});


function updateModelNameDisplay(modelName) {
  var displays = ['currentModelName', 'landingModelName'];
  displays.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = modelName;
  });
}


// Update Provider Pills UI
function updateProviderPills() {
  // v15.18: In LifeAI mode, read from life-specific storage
  var currentAppMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var currentModel, currentProvider;

  if (currentAppMode === 'life') {
    currentProvider = localStorage.getItem('roweos_life_provider') || 'anthropic';
    currentModel = localStorage.getItem('roweos_life_model') || 'claude-sonnet-4-6';
  } else {
    var brandSelect = document.getElementById('brand');
    if (!brandSelect) return;
    var brandIdx = parseInt(brandSelect.value);
    if (!brands[brandIdx]) return;
    var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    currentModel = settings.model;
    currentProvider = settings.provider || getProviderForModel(currentModel);
  }
  
  // Update active state on main provider pills
  document.querySelectorAll('.provider-pill.provider-main').forEach(function(pill) {
    if (pill.dataset.provider === currentProvider) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

// v13.9: Show/hide Nanobanana sections in chat model dropdowns based on key availability
function updateNanobananaChatSections() {
  var hasKey = !!getNanobananaKey();
  document.querySelectorAll('.nanobanana-chat-section, #nanobananaModelSection').forEach(function(section) {
    section.style.display = hasKey ? 'block' : 'none';
  });
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.provider-pill-group')) {
    document.querySelectorAll('.provider-dropdown').forEach(function(dropdown) {
      dropdown.style.display = 'none';
    });
    document.querySelectorAll('.provider-pill.open').forEach(function(pill) {
      pill.classList.remove('open');
    });
  }
});

// Get provider from model name
function getProviderForModel(model) {
  if (model === 'auto') return 'roweos';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('gemini-') || model.startsWith('models/')) return 'google';
  return 'anthropic'; // default
}

// ═══════════════════════════════════════════════════════════════════════════════
// v20.5: RoweOS AI — Smart Model Routing
// Dynamically selects the optimal provider/model based on interaction type
// ═══════════════════════════════════════════════════════════════════════════════

var ROWEOS_AI_ROUTING = {
  creative: [
    // Alternates between Gemini 3.1 Pro and Sonnet 4.6 — resolved dynamically
    { provider: '_alternate', models: [
      { provider: 'google', model: 'gemini-3.1-pro-preview' },
      { provider: 'anthropic', model: 'claude-sonnet-4-6' }
    ]},
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
    { provider: 'openai', model: 'gpt-5.4' }
  ],
  strategic: [
    { provider: 'anthropic', model: 'claude-opus-4-7' },
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'openai', model: 'gpt-5.4' }
  ],
  code: [
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
    { provider: 'openai', model: 'gpt-5.4' }
  ],
  multimodal: [
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'openai', model: 'gpt-5.4' }
  ],
  quick: [
    { provider: 'google', model: 'gemini-3-flash-preview' },
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    { provider: 'openai', model: 'gpt-5.4' }
  ],
  general: [
    { provider: '_alternate', models: [
      { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      { provider: 'google', model: 'gemini-3.1-pro-preview' }
    ]},
    { provider: 'openai', model: 'gpt-5.4' }
  ]
};
var _roweosAIAlternateCounter = 0;

// v20.5: Classify the interaction type from message content and context
function classifyInteraction(userMessage, systemPrompt, options) {
  options = options || {};
  var hasImages = options.hasImages || false;
  var agentCategory = (options.agentCategory || '').toLowerCase();
  // v20.5: Handle multimodal content arrays — extract text part
  var msgStr = '';
  if (Array.isArray(userMessage)) {
    hasImages = true; // Array content = multimodal
    for (var _i = 0; _i < userMessage.length; _i++) {
      if (userMessage[_i].type === 'text' && userMessage[_i].text) { msgStr = userMessage[_i].text; break; }
    }
  } else {
    msgStr = userMessage || '';
  }
  var msg = msgStr.toLowerCase();
  var msgLen = msgStr.length;

  // Image/multimodal content — Gemini excels at native multimodal
  if (hasImages) return 'multimodal';

  // Code-related keywords
  if (/\b(code|function|debug|program|script|api|endpoint|css|html|javascript|python|sql|regex|refactor|implement|deploy|compile|syntax)\b/.test(msg)) return 'code';

  // Creative writing keywords
  if (/\b(write|draft|compose|blog|article|copy|creative|story|email|newsletter|social media post|tagline|headline|caption|slogan|brand voice)\b/.test(msg)) return 'creative';

  // Strategic/analytical keywords
  if (/\b(analy[sz]e|strategy|plan|assess|evaluate|compare|research|deep dive|breakdown|forecast|audit|competitive|swot|market|positioning)\b/.test(msg)) return 'strategic';

  // Agent category signals from system prompt / operation config
  if (/strateg/.test(agentCategory)) return 'strategic';
  if (/market|creative/.test(agentCategory)) return 'creative';
  if (/document|operations/.test(agentCategory)) return 'code';

  // Short messages = quick response (speed > depth)
  if (msgLen > 0 && msgLen < 80) return 'quick';

  // Long messages = deeper analysis
  if (msgLen > 600) return 'strategic';

  return 'general';
}

// v20.5: Check which providers have API keys configured
function getAvailableProviders() {
  var available = {};
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    if (keys.anthropic) available.anthropic = true;
    if (keys.openai) available.openai = true;
    if (keys.google) available.google = true;
  } catch(e) {}
  // Fallback to old individual key format
  if (!available.anthropic && localStorage.getItem('anthropicApiKey')) available.anthropic = true;
  if (!available.openai && localStorage.getItem('openaiApiKey')) available.openai = true;
  if (!available.google && localStorage.getItem('googleApiKey')) available.google = true;
  return available;
}

// v20.5: Resolve RoweOS AI to an actual provider/model
function resolveRoweOSAI(context) {
  context = context || {};
  var taskType = classifyInteraction(
    context.userMessage || '',
    context.systemPrompt || '',
    { hasImages: context.hasImages, agentCategory: context.agentCategory }
  );

  var routes = ROWEOS_AI_ROUTING[taskType] || ROWEOS_AI_ROUTING.general;
  var available = getAvailableProviders();

  for (var i = 0; i < routes.length; i++) {
    var route = routes[i];

    // v20.5: Handle _alternate entries — round-robin between available options
    if (route.provider === '_alternate' && route.models) {
      var pick = route.models[_roweosAIAlternateCounter % route.models.length];
      if (available[pick.provider]) {
        _roweosAIAlternateCounter++;
        if (localStorage.getItem('roweos_debug') === 'true') {
          console.log('[RoweOS AI] Task:', taskType, '(alternate #' + _roweosAIAlternateCounter + ') →', pick.provider, pick.model);
        }
        return { provider: pick.provider, model: pick.model, taskType: taskType };
      }
      // If the picked alternate isn't available, try the other(s)
      for (var j = 0; j < route.models.length; j++) {
        if (available[route.models[j].provider]) {
          _roweosAIAlternateCounter++;
          return { provider: route.models[j].provider, model: route.models[j].model, taskType: taskType };
        }
      }
      continue; // No alternates available, try next route
    }

    if (available[route.provider]) {
      if (localStorage.getItem('roweos_debug') === 'true') {
        console.log('[RoweOS AI] Task:', taskType, '→', route.provider, route.model);
      }
      return { provider: route.provider, model: route.model, taskType: taskType };
    }
  }

  // No keys found — return first preference, let the "no API key" error surface
  var fallback = routes[0];
  if (fallback.provider === '_alternate') fallback = fallback.models[0];
  return { provider: fallback.provider, model: fallback.model, taskType: taskType };
}

// Old brand dropdown removed - using v7.1 style dropdown
// Brand selection handled by toggleBrandDropdown(event) in v7.1 section

// Agent Status Animation
function setAgentStatus(status) {
  var inputContainer = document.getElementById('agentInputContainer');
  var followupContainer = document.querySelector('#agentConversation .chat-input-container');
  var brandAIBadges = document.querySelectorAll('.brandai-badge');
  
  if (status === 'executing') {
    // Apply gold pulsing to input containers
    if (inputContainer) {
      inputContainer.classList.add('agent-thinking');
    }
    if (followupContainer) {
      followupContainer.classList.add('agent-thinking');
    }
    // Apply gradient shift to BrandAI badges
    brandAIBadges.forEach(function(badge) {
      badge.classList.add('agent-thinking-badge');
    });
  } else {
    // Remove animations
    if (inputContainer) {
      inputContainer.classList.remove('agent-thinking');
    }
    if (followupContainer) {
      followupContainer.classList.remove('agent-thinking');
    }
    brandAIBadges.forEach(function(badge) {
      badge.classList.remove('agent-thinking-badge');
    });
  }
}

// Export History Log
function exportHistoryLog() {
  if (runs.length === 0 && agentCommands.length === 0) {
    showToast('No history to export', 'warning');
    return;
  }
  
  var log = '═══════════════════════════════════════════════════════════════\n';
  log += '                    ROWEOS HISTORY LOG\n';
  log += '                    Exported: ' + new Date().toLocaleString() + '\n';
  log += '═══════════════════════════════════════════════════════════════\n\n';
  
  // Studio Runs Section
  if (runs.length > 0) {
    log += '┌─────────────────────────────────────────────────────────────┐\n';
    log += '│                      STUDIO RUNS                           │\n';
    log += '└─────────────────────────────────────────────────────────────┘\n\n';
    
    runs.forEach(function(run, idx) {
      log += '─── Run #' + (idx + 1) + ' ───────────────────────────────────────────────\n';
      log += 'Operation: ' + run.op + '\n';
      log += 'Brand: ' + run.brand + '\n';
      log += 'Time: ' + run.time + '\n';
      if (run.context) {
        log += 'Context: ' + run.context + '\n';
      }
      log += '\n▸ PLAN:\n' + run.plan + '\n';
      log += '\n▸ DELIVERABLES:\n' + run.deliv + '\n\n';
    });
  }
  
  // Agent Conversations Section
  if (agentCommands.length > 0) {
    log += '┌─────────────────────────────────────────────────────────────┐\n';
    log += '│                  AGENT CONVERSATIONS                       │\n';
    log += '└─────────────────────────────────────────────────────────────┘\n\n';
    
    agentCommands.forEach(function(cmd, idx) {
      log += '─── Conversation #' + (idx + 1) + ' ────────────────────────────────────────\n';
      log += 'Brand: ' + cmd.brand + '\n';
      log += 'Time: ' + cmd.time + '\n';
      log += 'Initial Command: ' + cmd.command + '\n\n';
      
      if (cmd.conversation && cmd.conversation.length > 0) {
        cmd.conversation.forEach(function(msg, msgIdx) {
          var role = msg.role === 'user' ? '👤 USER' : '🤖 AGENT';
          log += role + ':\n';
          log += msg.content + '\n\n';
        });
      }
    });
  }
  
  // Calendar Section
  if (calendar.length > 0) {
    log += '┌─────────────────────────────────────────────────────────────┐\n';
    log += '│                    CALENDAR ITEMS                          │\n';
    log += '└─────────────────────────────────────────────────────────────┘\n\n';
    
    calendar.forEach(function(item, idx) {
      log += '─── Item #' + (idx + 1) + ' ─────────────────────────────────────────────\n';
      log += 'Title: ' + item.title + '\n';
      log += 'Date: ' + item.date + '\n';
      log += 'Status: ' + item.status.toUpperCase() + '\n';
      log += 'Brand: ' + item.brand + '\n\n';
    });
  }
  
  log += '═══════════════════════════════════════════════════════════════\n';
  log += '                       END OF LOG\n';
  log += '═══════════════════════════════════════════════════════════════\n';
  
  var blob = new Blob([log], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'RoweOS_History_' + new Date().toISOString().slice(0, 10) + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('History log exported', 'success');
}

// Settings Validation
var validationRules = {
  name: { required: true, minLength: 2, maxLength: 50 },
  tagline: { required: true, minLength: 5, maxLength: 100 },
  positioning: { required: true, minLength: 10, maxLength: 300 },
  audience: { required: true, minLength: 10, maxLength: 300 },
  promise: { required: true, minLength: 5, maxLength: 200 },
  cta: { required: true, minLength: 3, maxLength: 50 },
  voice: { required: true, minLength: 5, maxLength: 200 },
  vocabDo: { required: false, maxLength: 500 },
  vocabDont: { required: false, maxLength: 500 },
  constraints: { required: false, maxLength: 500 },
  contacts: { required: false, maxLength: 200, pattern: /^[a-zA-Z0-9._%+-@,\s]*$/ }
};

function validateField(field, value) {
  var rules = validationRules[field] || { required: false, maxLength: 1000 };
  var errors = [];
  
  if (rules.required && (!value || value.trim() === '')) {
    errors.push('This field is required');
  }
  
  if (value && rules.minLength && value.length < rules.minLength) {
    errors.push('Minimum ' + rules.minLength + ' characters');
  }
  
  if (value && rules.maxLength && value.length > rules.maxLength) {
    errors.push('Maximum ' + rules.maxLength + ' characters');
  }
  
  if (value && rules.pattern && !rules.pattern.test(value)) {
    errors.push('Invalid format');
  }
  
  return errors;
}

function toggleSettingsEdit() {
  settingsEditMode = !settingsEditMode;
  var btn = document.getElementById('editSettingsBtn');
  
  if (settingsEditMode) {
    btn.textContent = 'Cancel';
    pendingSettingsChanges = {};
  } else {
    btn.textContent = 'Edit';
    pendingSettingsChanges = {};
  }
  
  showSettings();
}

function toggleTextSize() {
  var body = document.body;
  var btn = document.getElementById('textSizeBtn');
  
  if (body.classList.contains('compact-text')) {
    body.classList.remove('compact-text');
    btn.style.opacity = '0.6';
    localStorage.setItem('roweosCompactText', 'false');
    showToast('Standard text size', 'info');
  } else {
    body.classList.add('compact-text');
    btn.style.opacity = '1';
    localStorage.setItem('roweosCompactText', 'true');
    showToast('Compact text size', 'info');
  }
}

function saveSettings() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var hasErrors = false;
  
  // Validate all pending changes
  for (var field in pendingSettingsChanges) {
    var errors = validateField(field, pendingSettingsChanges[field]);
    if (errors.length > 0) {
      hasErrors = true;
      break;
    }
  }
  
  if (hasErrors) {
    showToast('Please fix validation errors', 'error');
    return;
  }
  
  // Apply changes
  for (var field in pendingSettingsChanges) {
    brands[brandIdx][field] = pendingSettingsChanges[field];
  }
  
  // v9.1.14: Save and sync
  saveBrands();
  
  settingsEditMode = false;
  pendingSettingsChanges = {};
  document.getElementById('editSettingsBtn').textContent = 'Edit';
  showSettings();
  showToast('Brand profile updated', 'success');
}

function onSettingsFieldChange(field, value) {
  pendingSettingsChanges[field] = value;
  
  var fieldWrapper = document.querySelector('[data-field="' + field + '"]');
  if (!fieldWrapper) return;
  
  var errors = validateField(field, value);
  var validationEl = fieldWrapper.querySelector('.settings-validation');
  
  fieldWrapper.classList.remove('valid', 'invalid', 'editing');
  
  if (errors.length > 0) {
    fieldWrapper.classList.add('invalid');
    validationEl.className = 'settings-validation error';
    validationEl.innerHTML = '✕ ' + errors[0];
  } else if (value && value.trim()) {
    fieldWrapper.classList.add('valid');
    validationEl.className = 'settings-validation success';
    validationEl.innerHTML = '✓ Valid';
  } else {
    fieldWrapper.classList.add('editing');
  }
  
  // Update character count
  var charCount = fieldWrapper.querySelector('.settings-char-count');
  var rules = validationRules[field] || { maxLength: 1000 };
  if (charCount && rules.maxLength) {
    charCount.textContent = (value ? value.length : 0) + ' / ' + rules.maxLength;
  }
}

