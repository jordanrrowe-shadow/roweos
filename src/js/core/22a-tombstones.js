// v32.0-A: Unified tombstone + sync registry. Single source of truth for every
// list-based data category that supports authoritative delete.
//
// Each entry declares the local key, cloud path, cloud shape, tombstone keys,
// scrub targets, and rerender callbacks. The universal API (tombstoneAndDelete /
// tombstoneAndDeleteMany / clearTombstones) operates on these entries — no
// per-category branching anywhere else.
//
// Pre-existing tombstone keys (kept for backward compat — do not rename):
// - brandAIChats uses roweos_deleted_chat_ids / profile/deletedChatIds (v31.13)
// All other categories use roweos_deleted_<id> / profile/deleted<Id> conventions.

var SYNC_CATEGORIES = [
  {
    id: 'brands',
    label: 'Brands',
    localKey: 'roweos_user_brands',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'brands',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_brands',
    cloudTombstonePath: 'profile/deletedBrands',
    scrubReaders: ['brands', 'window.brands'],
    rerender: ['renderBrandSelector', 'initBrandLogo'],
    legacyHeuristic: null,
    graceMs: 8000 // brands need longer ghost-cleanup window — _all batch + per-doc batch flush
  },
  {
    id: 'brandLogos',
    label: 'Brand Logos',
    localKey: null, // hybrid storage — small inline on brand.logo, oversize via IDB + brand_logos subcollection (Spec C)
    localArrayField: null,
    localFilter: null,
    cloudPath: 'brand_logos',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_brand_logos',
    cloudTombstonePath: 'profile/deletedBrandLogos',
    scrubReaders: [], // logos managed by Spec C (writeBrandLogo / readBrandLogoSync); no top-level array to scrub
    rerender: ['renderSyncInventory', 'initBrandLogo'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'brandAIChats',
    label: 'BrandAI Chats',
    localKey: 'roweos_agentCommands',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'chats',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_chat_ids', // pre-existing
    cloudTombstonePath: 'profile/deletedChatIds', // pre-existing
    scrubReaders: ['agentCommands', 'window.agentCommands'],
    rerender: ['renderHistory', 'renderSyncInventory'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'lifeAIChats',
    label: 'LifeAI Chats',
    localKey: 'roweos_life_agentCommands',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'life_chats',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_life_chat_ids',
    cloudTombstonePath: 'profile/deletedLifeChatIds',
    scrubReaders: ['lifeAgentCommands', 'window.lifeAgentCommands'],
    rerender: ['renderHistory', 'renderSyncInventory'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'brandTodos',
    label: 'BrandAI To-Dos',
    localKey: 'roweosTodos',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'todos/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_brand_todos',
    cloudTombstonePath: 'profile/deletedBrandTodos',
    scrubReaders: ['todos', 'window.todos'],
    rerender: ['renderTodos', 'renderSyncInventory'],
    legacyHeuristic: null, // populated in Spec B
    graceMs: 5000
  },
  {
    id: 'lifeTodos',
    label: 'LifeAI To-Dos',
    localKey: 'roweos_life_todos', // v32.0-A: actual canonical key (registry spec said 'roweosLifeTodos' but doesn't exist)
    localArrayField: null,
    localFilter: null,
    cloudPath: 'life_todos/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_life_todos',
    cloudTombstonePath: 'profile/deletedLifeTodos',
    scrubReaders: ['lifeTodos', 'window.lifeTodos'],
    rerender: ['renderTodos', 'renderSyncInventory'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'calendar',
    label: 'Calendar',
    localKey: 'roweos_calendar', // v32.0-A: actual canonical key (registry spec said 'roweos_calendar_events')
    localArrayField: null,
    localFilter: null,
    cloudPath: 'calendar/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_calendar_events',
    cloudTombstonePath: 'profile/deletedCalendarEvents',
    scrubReaders: ['calendarEvents', 'window.calendarEvents'],
    rerender: ['renderCalendar'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'journal',
    label: 'Journal',
    localKey: 'roweos_journal', // v32.0-A: actual canonical key (registry spec said 'roweos_journal_entries')
    localArrayField: null,
    localFilter: null,
    cloudPath: 'journal/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_journal_entries',
    cloudTombstonePath: 'profile/deletedJournalEntries',
    scrubReaders: ['journalEntries', 'window.journalEntries'],
    rerender: ['renderJournal'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'libraryFiles',
    label: 'Library Files',
    localKey: 'roweosLibrary', // v32.0-A: actual canonical key (camelCase). Life library separately at 'roweos_life_library'
    localArrayField: null,
    localFilter: null,
    cloudPath: 'library',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_library_files',
    cloudTombstonePath: 'profile/deletedLibraryFiles',
    scrubReaders: ['libraryFiles', 'window.libraryFiles'],
    rerender: ['renderLibrary'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'inventory',
    label: 'Inventory',
    localKey: 'roweos_inventory',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'inventory/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_inventory',
    cloudTombstonePath: 'profile/deletedInventory',
    scrubReaders: ['inventoryItems', 'window.inventoryItems'],
    rerender: ['renderInventory'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'possessions',
    label: 'Possessions',
    localKey: 'roweos_life_inventory', // v32.0-A: actual canonical key. Stored as {items: [...]} - Spec B/C must extract from .items
    localArrayField: 'items',
    localFilter: null,
    cloudPath: 'possessions/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_possessions',
    cloudTombstonePath: 'profile/deletedPossessions',
    scrubReaders: ['possessions', 'window.possessions'],
    rerender: ['renderPossessions'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'studioRuns',
    label: 'Studio Runs',
    localKey: 'roweos_runs', // v32.0-A: actual canonical key. Stored as {runs: [...]} - Spec B/C must extract from .runs
    localArrayField: 'runs',
    localFilter: null,
    cloudPath: 'studio_runs',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_studio_runs',
    cloudTombstonePath: 'profile/deletedStudioRuns',
    scrubReaders: ['studioRuns', 'window.studioRuns'],
    rerender: ['renderStudio'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'pulseGoals',
    label: 'Pulse Goals',
    localKey: 'roweos_pulse_goals',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'pulse_goals',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_pulse_goals',
    cloudTombstonePath: 'profile/deletedPulseGoals',
    scrubReaders: ['pulseGoals', 'window.pulseGoals'],
    rerender: ['renderPulseView', 'renderPulse3Checklists'],
    legacyHeuristic: null, // populated in Spec B
    graceMs: 5000
  },
  {
    id: 'automations',
    label: 'Automations',
    localKey: 'roweos_automations',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'automations',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_automations',
    cloudTombstonePath: 'profile/deletedAutomations',
    scrubReaders: ['automations', 'window.automations'],
    rerender: ['renderAutomations'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'customOps',
    label: 'Custom Ops',
    localKey: 'roweos_custom_operations', // v32.0-A: actual canonical key (registry spec said 'roweos_custom_ops')
    localArrayField: null,
    localFilter: null,
    cloudPath: 'custom_ops/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_custom_ops',
    cloudTombstonePath: 'profile/deletedCustomOps',
    scrubReaders: ['customOps', 'window.customOps'],
    rerender: ['renderStudio'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'clients',
    label: 'Clients',
    localKey: 'roweos_people', // v32.0-A: shared with team + directReports, filtered by personType === 'client'
    localArrayField: null,
    localFilter: { field: 'personType', value: 'client' },
    cloudPath: 'clients/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_clients',
    cloudTombstonePath: 'profile/deletedClients',
    scrubReaders: ['clients', 'window.clients'],
    rerender: ['renderClients'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'team',
    label: 'Team',
    localKey: 'roweos_people', // v32.0-A: shared with clients + directReports, filtered by personType === 'team'
    localArrayField: null,
    localFilter: { field: 'personType', value: 'team' },
    cloudPath: 'team/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_team',
    cloudTombstonePath: 'profile/deletedTeam',
    scrubReaders: ['teamMembers', 'window.teamMembers'],
    rerender: ['renderTeam'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'directReports',
    label: 'Direct Reports',
    localKey: 'roweos_people', // v32.0-A: shared with clients + team, filtered by personType === 'report'
    localArrayField: null,
    localFilter: { field: 'personType', value: 'report' },
    cloudPath: 'direct_reports/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_direct_reports',
    cloudTombstonePath: 'profile/deletedDirectReports',
    scrubReaders: ['directReports', 'window.directReports'],
    rerender: ['renderDirectReports'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'lifeAIProfiles',
    label: 'LifeAI Profiles',
    localKey: 'roweos_life_profiles', // v32.0-A: actual canonical key (registry spec said 'roweos_lifeai_profiles')
    localArrayField: null,
    localFilter: null,
    cloudPath: 'lifeai_profiles',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_lifeai_profiles',
    cloudTombstonePath: 'profile/deletedLifeAIProfiles',
    scrubReaders: ['lifeAIProfiles', 'window.lifeAIProfiles'],
    rerender: ['renderIdentity'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'folioItems',
    label: 'Folio Items',
    localKey: 'roweos_folio_items',
    localArrayField: null,
    localFilter: null,
    cloudPath: 'folio_items/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_folio_items',
    cloudTombstonePath: 'profile/deletedFolioItems',
    scrubReaders: ['folioItems', 'window.folioItems'],
    rerender: ['renderFolio'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'notebooks',
    label: 'Notebooks',
    localKey: 'roweos_scribe_notebooks', // v32.0-A: actual canonical key (registry spec said 'roweos_notebooks')
    localArrayField: null,
    localFilter: null,
    cloudPath: 'notebooks/main',
    cloudShape: 'blob',
    blobField: 'data',
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_notebooks',
    cloudTombstonePath: 'profile/deletedNotebooks',
    scrubReaders: ['notebooks', 'window.notebooks'],
    rerender: ['renderNotebooks'],
    legacyHeuristic: null,
    graceMs: 5000
  }
];

window.SYNC_CATEGORIES = SYNC_CATEGORIES;

// Helper: lookup by id (priority) with label as fallback.
// Two-pass to ensure deterministic id-first match; an id collision with a label
// from another entry will always resolve to the id match.
function getCategoryById(idOrLabel) {
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    if (SYNC_CATEGORIES[i].id === idOrLabel) return SYNC_CATEGORIES[i];
  }
  for (var j = 0; j < SYNC_CATEGORIES.length; j++) {
    if (SYNC_CATEGORIES[j].label === idOrLabel) return SYNC_CATEGORIES[j];
  }
  return null;
}
window.getCategoryById = getCategoryById;
