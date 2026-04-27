// v32.0-A: Unified tombstone + sync registry. Single source of truth for every
// list-based data category that supports authoritative delete.
//
// Each entry declares the local key, cloud path, cloud shape, tombstone keys,
// scrub targets, and rerender callbacks. The universal API (tombstoneAndDelete /
// tombstoneAndDeleteMany / clearTombstones) operates on these entries — no
// per-category branching anywhere else.

var SYNC_CATEGORIES = [
  {
    id: 'brands',
    label: 'Brands',
    localKey: 'roweos_user_brands',
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
    graceMs: 8000
  },
  {
    id: 'brandLogos',
    label: 'Brand Logos',
    localKey: null, // hybrid storage handled in Spec C
    cloudPath: 'brand_logos',
    cloudShape: 'subcollection',
    blobField: null,
    parentDoc: null,
    idField: 'id',
    tombstoneKey: 'roweos_deleted_brand_logos',
    cloudTombstonePath: 'profile/deletedBrandLogos',
    scrubReaders: [],
    rerender: ['renderSyncInventory', 'initBrandLogo'],
    legacyHeuristic: null,
    graceMs: 5000
  },
  {
    id: 'brandAIChats',
    label: 'BrandAI Chats',
    localKey: 'roweos_agentCommands',
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

// Helper: lookup by id or label
function getCategoryById(idOrLabel) {
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    if (SYNC_CATEGORIES[i].id === idOrLabel || SYNC_CATEGORIES[i].label === idOrLabel) {
      return SYNC_CATEGORIES[i];
    }
  }
  return null;
}
window.getCategoryById = getCategoryById;
