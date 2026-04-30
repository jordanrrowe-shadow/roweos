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
    cloudPath: 'profile/people', // v32.0-A: shared with team + directReports — single Firestore doc
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
    cloudPath: 'profile/people', // v32.0-A: shared with clients + directReports — single Firestore doc
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
    cloudPath: 'profile/people', // v32.0-A: shared with clients + team — single Firestore doc
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

// v32.0-A: Universal delete API. Three exported functions:
//   - tombstoneAndDelete(categoryIdOrLabel, itemId)
//   - tombstoneAndDeleteMany(categoryIdOrLabel, itemIds)
//   - clearTombstones(categoryIdOrLabel)
// All deletes from anywhere in the app go through these - no per-category
// branching outside the registry. Helpers honor localArrayField (wrapper-
// object storage) and localFilter (shared-storage discriminator).

// v32.0-A: Per-category last-save timestamps map. Used for category-scoped
// onSnapshot grace-period checks. Keyed by category id. NOTE: The single
// numeric `lastLocalSaveTime` (declared in 22-firebase-sync.js) is left
// untouched — that global is still consulted by the v27.0 grace path. Both
// stay fresh because tombstoneAndDelete[Many] stamp BOTH on every delete.
var lastCategoryLocalSave = {};
var LOCAL_SAVE_GRACE_PERIOD_DEFAULT = 5000;
window.lastCategoryLocalSave = lastCategoryLocalSave;
window.LOCAL_SAVE_GRACE_PERIOD_DEFAULT = LOCAL_SAVE_GRACE_PERIOD_DEFAULT;

// v32.0-A: LOCAL ARRAY READ/WRITE (honors wrapper objects + shared filters)

// v32.0-A: Read the localStorage value as a parsed object (or null).
function _readRaw(key) {
  if (!key) return null;
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// v32.0-A: Read the array of items belonging to a category, honoring
// localArrayField and localFilter. Returns [] if missing.
function _readCategoryArray(cat) {
  if (!cat || !cat.localKey) return [];
  var raw = _readRaw(cat.localKey);
  if (raw == null) return [];
  // Extract array - wrapper or direct
  var arr;
  if (cat.localArrayField) {
    arr = (raw && Array.isArray(raw[cat.localArrayField])) ? raw[cat.localArrayField] : [];
  } else {
    arr = Array.isArray(raw) ? raw : [];
  }
  // Apply filter for shared storage
  if (cat.localFilter && cat.localFilter.field) {
    var f = cat.localFilter.field;
    var v = cat.localFilter.value;
    arr = arr.filter(function(item) { return item && item[f] === v; });
  }
  return arr;
}
window._readCategoryArray = _readCategoryArray;

// v32.0-A: Write the array of items belonging to a category, preserving any
// sibling items in shared storage and any wrapper-object sibling fields.
function _writeCategoryArray(cat, newArr) {
  if (!cat || !cat.localKey) return;
  var raw = _readRaw(cat.localKey);

  // For shared storage: combine our filtered items with the others' items.
  var combined;
  if (cat.localFilter && cat.localFilter.field) {
    var existingAll = [];
    if (cat.localArrayField) {
      existingAll = (raw && Array.isArray(raw[cat.localArrayField])) ? raw[cat.localArrayField] : [];
    } else {
      existingAll = Array.isArray(raw) ? raw : [];
    }
    var f = cat.localFilter.field;
    var v = cat.localFilter.value;
    // Keep items that DON'T belong to us; replace ours with newArr.
    var others = existingAll.filter(function(item) { return !(item && item[f] === v); });
    combined = others.concat(newArr);
  } else {
    combined = newArr;
  }

  var payload;
  if (cat.localArrayField) {
    // Preserve other fields on the wrapper object.
    payload = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    payload[cat.localArrayField] = combined;
  } else {
    payload = combined;
  }

  try {
    localStorage.setItem(cat.localKey, JSON.stringify(payload));
  } catch (e) {
    console.warn('[v32.0-A] _writeCategoryArray failed for ' + cat.localKey, e);
  }
}
window._writeCategoryArray = _writeCategoryArray;

// v32.0-A: TOMBSTONE SET HELPERS

function _readTombstoneSet(cat) {
  var arr;
  try {
    var raw = localStorage.getItem(cat.tombstoneKey);
    arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) arr = [];
  } catch (e) {
    arr = [];
  }
  var tombSet = {};
  for (var i = 0; i < arr.length; i++) tombSet[arr[i]] = true;
  return tombSet;
}

function _writeTombstoneSet(cat, set) {
  var arr = [];
  for (var k in set) if (set.hasOwnProperty(k)) arr.push(k);
  try {
    localStorage.setItem(cat.tombstoneKey, JSON.stringify(arr));
  } catch (e) {
    console.warn('[v32.0-A] _writeTombstoneSet failed for ' + cat.tombstoneKey, e);
  }
}

// v32.0-A: RERENDER + LOOKUP

function _runRerenders(cat) {
  if (!cat || !cat.rerender || !cat.rerender.length) return;
  for (var i = 0; i < cat.rerender.length; i++) {
    var fnName = cat.rerender[i];
    try {
      if (typeof window[fnName] === 'function') window[fnName]();
    } catch (e) {
      console.warn('[v32.0-A] rerender ' + fnName + ' threw', e);
    }
  }
}

function _getWindowFn(name) {
  return (typeof window[name] === 'function') ? window[name] : null;
}

// v32.0-A: CLOUD WRITES

// v32.0-A: Delete one item from cloud. Strategy depends on cloudShape.
// Note: writeDB/deleteDBDoc in 09-state.js are fire-and-forget (no promise
// returned) - we wrap with Promise.resolve() so the API surface stays
// promise-shaped for callers, but the actual cloud sync happens in the
// background via writeDB's internal .then()/.catch().
function _deleteCloudItem(cat, itemId) {
  return new Promise(function(resolve) {
    if (cat.cloudShape === 'subcollection') {
      var deleteDBDoc = _getWindowFn('deleteDBDoc');
      if (!deleteDBDoc) { resolve({ ok: false, error: 'deleteDBDoc unavailable' }); return; }
      try {
        var p = deleteDBDoc(cat.cloudPath, itemId);
        if (p && typeof p.then === 'function') {
          p.then(function() { resolve({ ok: true }); }, function(err) { resolve({ ok: false, error: err }); });
        } else {
          resolve({ ok: true });
        }
      } catch (e) { resolve({ ok: false, error: e }); }
      return;
    }
    if (cat.cloudShape === 'blob') {
      // Re-write the blob doc minus the item. Cloud doc shape mirrors localStorage:
      // { [blobField]: arr, _modifiedAt }.
      // For SHARED storage (localFilter set), we send the FULL localStorage array
      // — all categories' items combined — so we don't wipe siblings.
      var writeDB = _getWindowFn('writeDB');
      if (!writeDB) { resolve({ ok: false, error: 'writeDB unavailable' }); return; }
      try {
        var fullArr;
        if (cat.localFilter && cat.localFilter.field) {
          // Shared storage: read raw localStorage without category filter
          var raw = _readRaw(cat.localKey);
          if (cat.localArrayField) {
            fullArr = (raw && Array.isArray(raw[cat.localArrayField])) ? raw[cat.localArrayField] : [];
          } else {
            fullArr = Array.isArray(raw) ? raw : [];
          }
        } else {
          // Non-shared: this category owns the entire array
          fullArr = _readCategoryArray(cat);
        }
        var payload = {};
        payload[cat.blobField || 'data'] = fullArr;
        payload._modifiedAt = Date.now();
        var p2 = writeDB(cat.cloudPath, payload);
        if (p2 && typeof p2.then === 'function') {
          p2.then(function() { resolve({ ok: true }); }, function(err) { resolve({ ok: false, error: err }); });
        } else {
          resolve({ ok: true });
        }
      } catch (e2) { resolve({ ok: false, error: e2 }); }
      return;
    }
    if (cat.cloudShape === 'inline-field') {
      var writeDB2 = _getWindowFn('writeDB');
      if (!writeDB2) { resolve({ ok: false, error: 'writeDB unavailable' }); return; }
      try {
        var fullArr2;
        if (cat.localFilter && cat.localFilter.field) {
          var raw2 = _readRaw(cat.localKey);
          if (cat.localArrayField) {
            fullArr2 = (raw2 && Array.isArray(raw2[cat.localArrayField])) ? raw2[cat.localArrayField] : [];
          } else {
            fullArr2 = Array.isArray(raw2) ? raw2 : [];
          }
        } else {
          fullArr2 = _readCategoryArray(cat);
        }
        var pld = {};
        pld[cat.blobField || 'data'] = fullArr2;
        pld._modifiedAt = Date.now();
        var p3 = writeDB2(cat.parentDoc, pld);
        if (p3 && typeof p3.then === 'function') {
          p3.then(function() { resolve({ ok: true }); }, function(err) { resolve({ ok: false, error: err }); });
        } else {
          resolve({ ok: true });
        }
      } catch (e3) { resolve({ ok: false, error: e3 }); }
      return;
    }
    resolve({ ok: false, error: 'unknown cloudShape: ' + cat.cloudShape });
  });
}

// v32.0-A: Push the tombstone set to cloud as a blob doc.
function _writeCloudTombstone(cat, set) {
  var writeDB = _getWindowFn('writeDB');
  if (!writeDB) return Promise.resolve({ ok: false, error: 'writeDB unavailable' });
  var ids = [];
  for (var k in set) if (set.hasOwnProperty(k)) ids.push(k);
  return Promise.resolve(writeDB(cat.cloudTombstonePath, { ids: ids, _modifiedAt: Date.now() }))
    .then(function() { return { ok: true }; }, function(err) { return { ok: false, error: err }; });
}

// v32.0-A: PUBLIC API

// v32.0-A: tombstoneAndDelete(categoryIdOrLabel, itemId)
// Marks an item as deleted across all storage layers. Local writes are
// synchronous and authoritative; cloud writes are fire-and-forget per the
// project's write-through architecture (writeDB/deleteDBDoc do not return
// promises — they dispatch to Firestore in the background and update the
// sync indicator on completion).
//
// Returns: Promise<{
//   ok:           boolean,  // local writes succeeded AND cloud calls dispatched
//   id:           string,
//   ts:           number,
//   tombstoneOk:  boolean,  // tombstone push DISPATCHED (not confirmed)
//   deleteOk:     boolean,  // delete call DISPATCHED (not confirmed)
//   error:        any|null
// }>
//
// Cloud failures surface via writeDB's own error toast / sync indicator;
// they do not propagate here. The local tombstone is authoritative — on
// the next pull, applyTombstoneFilter (Spec A.3) re-pushes any pending
// tombstones if the cloud has lost track.
function tombstoneAndDelete(categoryIdOrLabel, itemId) {
  var cat = getCategoryById(categoryIdOrLabel);
  if (!cat) return Promise.resolve({ ok: false, error: 'unknown category: ' + categoryIdOrLabel });
  if (itemId === undefined || itemId === null || itemId === '') {
    return Promise.resolve({ ok: false, error: 'itemId required' });
  }

  // 1. Append to local tombstone set
  var tombSet = _readTombstoneSet(cat);
  tombSet[itemId] = true;
  _writeTombstoneSet(cat, tombSet);

  // 2. Filter local data array (no-op when localKey is null)
  if (cat.localKey) {
    var localArr = _readCategoryArray(cat);
    var filtered = localArr.filter(function(item) {
      return item && item[cat.idField] !== itemId;
    });
    _writeCategoryArray(cat, filtered);
  }

  // 3. Update grace period (per-category map + legacy numeric global)
  lastCategoryLocalSave[cat.id] = Date.now();
  if (typeof stampLocalSave === 'function') stampLocalSave(); // v32.0-A: keep v27.0 numeric grace fresh

  // 4 & 5. Push tombstone + delete cloud doc(s) in parallel
  return Promise.all([
    _writeCloudTombstone(cat, tombSet),
    _deleteCloudItem(cat, itemId)
  ]).then(function(results) {
    var tombRes = results[0];
    var delRes = results[1];
    var ok = tombRes.ok && delRes.ok;

    // 6. Optional postDelete hook (used by Spec C for brand logos)
    if (typeof cat.postDelete === 'function') {
      try { cat.postDelete(itemId); } catch (e) { console.warn('[v32.0-A] postDelete threw', e); }
    }

    // 7. Trigger rerenders
    _runRerenders(cat);

    return {
      ok: ok,
      id: itemId,
      ts: Date.now(),
      tombstoneOk: tombRes.ok,
      deleteOk: delRes.ok,
      error: ok ? null : (tombRes.error || delRes.error)
    };
  });
}
window.tombstoneAndDelete = tombstoneAndDelete;

// v32.0-A: tombstoneAndDeleteMany(categoryIdOrLabel, itemIds)
// Bulk variant of tombstoneAndDelete. Same semantics:
//   - Local writes (tombstone set, array filter) are synchronous and authoritative.
//   - Cloud writes are fire-and-forget. For subcollection categories, one cloud
//     delete is dispatched per item; for blob/inline-field categories the local
//     re-write covers all items in a single cloud call.
//
// Returns: Promise<{
//   ok:           boolean,           // tombstone push dispatched AND no per-item failures
//   count:        number,            // items the local-side believes succeeded
//   failed:       Array<{id, ok, error}>,
//   tombstoneOk:  boolean,           // tombstone push DISPATCHED (not confirmed)
//   error:        any|null
// }>
//
// As with tombstoneAndDelete, cloud failures surface via writeDB's own
// telemetry — they do not propagate here. The local tombstone is the
// authoritative record and applyTombstoneFilter (Spec A.3) re-pushes
// anything the cloud has lost on next pull.
function tombstoneAndDeleteMany(categoryIdOrLabel, itemIds) {
  var cat = getCategoryById(categoryIdOrLabel);
  if (!cat) return Promise.resolve({ ok: false, count: 0, failed: [], error: 'unknown category' });
  if (!Array.isArray(itemIds) || !itemIds.length) {
    return Promise.resolve({ ok: true, count: 0, failed: [] });
  }

  // 1. Append all to local tombstone set
  var tombSet = _readTombstoneSet(cat);
  for (var i = 0; i < itemIds.length; i++) tombSet[itemIds[i]] = true;
  _writeTombstoneSet(cat, tombSet);

  // 2. Filter local data array
  if (cat.localKey) {
    var localArr = _readCategoryArray(cat);
    var killSet = {};
    for (var j = 0; j < itemIds.length; j++) killSet[itemIds[j]] = true;
    var filtered = localArr.filter(function(item) {
      return item && !killSet[item[cat.idField]];
    });
    _writeCategoryArray(cat, filtered);
  }

  // 3. Update grace period (per-category map + legacy numeric global)
  lastCategoryLocalSave[cat.id] = Date.now();
  if (typeof stampLocalSave === 'function') stampLocalSave(); // v32.0-A: keep v27.0 numeric grace fresh

  // 4. Push tombstone (single write)
  var pTomb = _writeCloudTombstone(cat, tombSet);

  // 5. Delete cloud docs. For blob/inline-field, the local-array re-write
  // covers all items in one cloud call, so we only need ONE _deleteCloudItem
  // invocation; for subcollection we iterate.
  var pDeletes;
  if (cat.cloudShape === 'subcollection') {
    var promises = [];
    for (var d = 0; d < itemIds.length; d++) {
      (function(id) {
        promises.push(_deleteCloudItem(cat, id).then(function(r) {
          return { id: id, ok: r.ok, error: r.error };
        }));
      })(itemIds[d]);
    }
    pDeletes = Promise.all(promises);
  } else {
    // blob / inline-field: one re-write covers all
    pDeletes = _deleteCloudItem(cat, itemIds[0]).then(function(r) {
      var arr = [];
      for (var z = 0; z < itemIds.length; z++) arr.push({ id: itemIds[z], ok: r.ok, error: r.error });
      return arr;
    });
  }

  return Promise.all([pTomb, pDeletes]).then(function(results) {
    var tombRes = results[0];
    var perItem = results[1];
    var failed = perItem.filter(function(x) { return !x.ok; });
    var ok = tombRes.ok && failed.length === 0;

    // postDelete hooks (only useful for subcollection deletes per item)
    if (typeof cat.postDelete === 'function') {
      for (var p = 0; p < itemIds.length; p++) {
        try { cat.postDelete(itemIds[p]); } catch (e) {}
      }
    }

    _runRerenders(cat);

    return {
      ok: ok,
      count: itemIds.length - failed.length,
      failed: failed,
      tombstoneOk: tombRes.ok,
      error: ok ? null : (tombRes.error || (failed[0] && failed[0].error))
    };
  });
}
window.tombstoneAndDeleteMany = tombstoneAndDeleteMany;

// v32.0-A: clearTombstones(categoryIdOrLabel)
// Wipes the local tombstone set for a category and dispatches a cloud
// overwrite to mirror the empty state. Local clear is synchronous and
// authoritative; the cloud write is fire-and-forget per the project's
// write-through architecture (writeDB does not return a promise — it
// dispatches in the background and updates the sync indicator on
// completion).
//
// Returns: Promise<{
//   ok:       boolean,  // true if writeDB was reachable and dispatch wrapped without throwing
//   cleared:  number,   // count of locally-removed tombstones
//   error:    any|null
// }>
//
// Use case: admin tooling / sync inventory reset. Typical app code does
// NOT call this — once an item is tombstoned it should stay tombstoned
// until the next pull confirms the cloud has caught up.
function clearTombstones(categoryIdOrLabel) {
  var cat = getCategoryById(categoryIdOrLabel);
  if (!cat) return Promise.resolve({ ok: false, cleared: 0, error: 'unknown category' });
  var existing = [];
  try {
    var raw = localStorage.getItem(cat.tombstoneKey);
    existing = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(existing)) existing = [];
  } catch (e) { existing = []; }
  try { localStorage.setItem(cat.tombstoneKey, '[]'); } catch (e) {}
  var writeDB = _getWindowFn('writeDB');
  if (!writeDB) return Promise.resolve({ ok: false, cleared: existing.length, error: 'writeDB unavailable' });
  return Promise.resolve(writeDB(cat.cloudTombstonePath, { ids: [], _modifiedAt: Date.now() }))
    .then(function() {
      _runRerenders(cat);
      return { ok: true, cleared: existing.length };
    }, function(err) {
      return { ok: false, cleared: existing.length, error: err };
    });
}
window.clearTombstones = clearTombstones;

// v32.0-A: Pull-side enforcement. Called by loadFromFirebaseV2 (this task) and
// every onSnapshot listener (Task A.4) BEFORE the cloud payload is merged into
// local state. Loads the union of local+cloud tombstones, persists it back, and
// filters BOTH the incoming payload AND any local stragglers against the union.
//
// Cloud reads are best-effort. Some readDB implementations are sync (cache-
// backed) and some return a promise. We handle both — promise results are
// applied on the next pull, never blocking this one.
function applyTombstoneFilter(categoryIdOrLabel, cloudItems) {
  var cat = getCategoryById(categoryIdOrLabel);
  if (!cat) return Array.isArray(cloudItems) ? cloudItems : [];
  if (!Array.isArray(cloudItems)) cloudItems = [];

  // 1. Read local tombstones into a set
  var localSet = _readTombstoneSet(cat);

  // 2. Best-effort cloud tombstone hydration (sync or promise both supported)
  var readDB = _getWindowFn('readDB');
  if (readDB) {
    try {
      var maybe = readDB(cat.cloudTombstonePath);
      if (maybe && Array.isArray(maybe.ids)) {
        for (var i = 0; i < maybe.ids.length; i++) localSet[maybe.ids[i]] = true;
      } else if (maybe && typeof maybe.then === 'function') {
        // async — apply later on next pull (fire-and-forget update)
        maybe.then(function(res) {
          if (res && Array.isArray(res.ids)) {
            var s = _readTombstoneSet(cat);
            var changed = false;
            for (var j = 0; j < res.ids.length; j++) {
              if (!s[res.ids[j]]) { s[res.ids[j]] = true; changed = true; }
            }
            if (changed) _writeTombstoneSet(cat, s);
          }
        }, function() { /* ignore */ });
      }
    } catch (e) { /* ignore — best effort */ }
  }

  // 3. Persist union locally so subsequent reads converge
  _writeTombstoneSet(cat, localSet);

  // 4. Filter cloud payload
  var filteredCloud = cloudItems.filter(function(item) {
    return item && !localSet[item[cat.idField]];
  });

  // 5. Filter local data array (catches dupes that slipped past)
  if (cat.localKey) {
    var localArr = _readCategoryArray(cat);
    var localFiltered = localArr.filter(function(item) {
      return item && !localSet[item[cat.idField]];
    });
    if (localFiltered.length !== localArr.length) {
      _writeCategoryArray(cat, localFiltered);
    }
  }

  return filteredCloud;
}
window.applyTombstoneFilter = applyTombstoneFilter;

// v32.0-A: One-shot init on first v32.0 launch. Idempotent. Initializes empty
// tombstone arrays in localStorage for every registered category if missing
// (preserves any pre-existing data like roweos_deleted_chat_ids), then pushes
// the current state to Firestore so cross-device convergence works from day 1.
//
// Guarded by localStorage flag 'roweos_tombstone_init_v32' === 'done'.
// Cloud writes are fire-and-forget per the project's write-through architecture
// — partial failures retry on next launch (flag stays unset).
function initTombstoneRegistry_v32() {
  if (localStorage.getItem('roweos_tombstone_init_v32') === 'done') {
    return Promise.resolve({ ok: true, skipped: true });
  }
  var pushes = [];
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    var cat = SYNC_CATEGORIES[i];
    if (!cat || !cat.tombstoneKey) continue;
    if (localStorage.getItem(cat.tombstoneKey) === null) {
      try { localStorage.setItem(cat.tombstoneKey, '[]'); } catch (e) {}
    }
    var set = _readTombstoneSet(cat);
    pushes.push(_writeCloudTombstone(cat, set));
  }
  return Promise.all(pushes).then(function(results) {
    var allOk = true;
    for (var j = 0; j < results.length; j++) {
      if (!results[j] || !results[j].ok) { allOk = false; break; }
    }
    if (allOk) {
      try { localStorage.setItem('roweos_tombstone_init_v32', 'done'); } catch (e) {}
    }
    if (typeof console !== 'undefined' && console.log) {
      console.log('[v32.0-A] tombstone registry init: ' + (allOk ? 'done' : 'partial'));
    }
    return { ok: allOk, results: results };
  }, function(err) {
    return { ok: false, error: err };
  });
}
window.initTombstoneRegistry_v32 = initTombstoneRegistry_v32;

// v33.0: Focus residue heuristics removed. v28.8 retired Focus, and v32.1
// neutralized the title-prefix matcher (false-positives on still-active goals
// like "Priority", "Governance"). All purges go through explicit user UI now.

// v32.0-B: Pre-flight backup. Writes a snapshot of every category's localStorage
// to TWO local keys (one stable, one ephemeral) AND a Firestore doc so cross-
// device restore is possible.

function _snapshotForBackup() {
  var snap = {};
  var keys = [];
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    var cat = SYNC_CATEGORIES[i];
    if (cat.localKey) keys.push(cat.localKey);
    if (cat.tombstoneKey) keys.push(cat.tombstoneKey);
  }
  for (var j = 0; j < keys.length; j++) {
    try {
      var v = localStorage.getItem(keys[j]);
      if (v !== null) snap[keys[j]] = v;
    } catch (e) { /* ignore */ }
  }
  snap._capturedAt = new Date().toISOString();
  snap._version = (window.ROWEOS_VERSION || 'unknown');
  return snap;
}

function writePrePurgeBackup_v32() {
  var snap = _snapshotForBackup();
  try { localStorage.setItem('roweos_pre_pull_backup', JSON.stringify(snap)); } catch (e) {}
  try { localStorage.setItem('roweos_pre_purge_backup_v32', JSON.stringify(snap)); } catch (e2) {}
  var writeDB = _getWindowFn('writeDB');
  if (!writeDB) return Promise.resolve({ ok: false, error: 'writeDB unavailable' });
  return Promise.resolve(writeDB('profile/preBackup_v32', { snapshot: snap, _modifiedAt: Date.now() }))
    .then(function() { return { ok: true }; }, function(err) { return { ok: false, error: err }; });
}
window.writePrePurgeBackup_v32 = writePrePurgeBackup_v32;

function previewLegacyFocusCounts() {
  var out = { pulseGoals: 0, brandTodos: 0, lifeTodos: 0 };
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    var cat = SYNC_CATEGORIES[i];
    if (!cat.legacyHeuristic || !cat.localKey) continue;
    var arr = (typeof window._readCategoryArray === 'function') ? window._readCategoryArray(cat) : [];
    var n = 0;
    for (var k = 0; k < arr.length; k++) {
      if (cat.legacyHeuristic(arr[k])) n++;
    }
    if (out.hasOwnProperty(cat.id)) out[cat.id] = n;
  }
  return out;
}
window.previewLegacyFocusCounts = previewLegacyFocusCounts;

// v32.0.2: Fetch cloud items for a category directly via Firestore — returns
// an array of items the same shape as _readCategoryArray. Lets the purge see
// cloud-only ghosts that haven't been pulled into local yet.
function _fetchCloudItemsForCategory(cat) {
  if (!cat || !window.firebase || !window.firebaseUser) return Promise.resolve([]);
  try {
    var db = firebase.firestore();
    var basePath = 'roweos_users/' + window.firebaseUser.uid;
    if (cat.cloudShape === 'subcollection') {
      return db.collection(basePath + '/' + cat.cloudPath).get().then(function(snap) {
        var items = [];
        snap.forEach(function(doc) {
          var d = doc.data() || {};
          if (!d[cat.idField]) d[cat.idField] = doc.id;
          items.push(d);
        });
        return items;
      }, function() { return []; });
    }
    if (cat.cloudShape === 'blob') {
      return db.doc(basePath + '/' + cat.cloudPath).get().then(function(snap) {
        var d = snap && snap.exists ? snap.data() : null;
        if (!d) return [];
        var arr = d[cat.blobField || 'data'];
        if (!Array.isArray(arr)) return [];
        if (cat.localFilter && cat.localFilter.field) {
          var f = cat.localFilter.field;
          var v = cat.localFilter.value;
          arr = arr.filter(function(x) { return x && x[f] === v; });
        }
        return arr;
      }, function() { return []; });
    }
    return Promise.resolve([]);
  } catch (e) {
    return Promise.resolve([]);
  }
}
window._fetchCloudItemsForCategory = _fetchCloudItemsForCategory;

// v32.0-B: Purge function. Runs all categories with legacyHeuristic. Does NOT
// prompt — caller is responsible for confirmation (B.3 wraps with the modal flow).
function purgeLegacyFocusResidue(opts) {
  opts = opts || {};
  var force = opts.force === true;
  if (!force && localStorage.getItem('roweos_focus_purge_v32') === 'done') {
    return Promise.resolve({ ok: true, skipped: true, message: 'already purged' });
  }
  return writePrePurgeBackup_v32().then(function(backupRes) {
    if (!backupRes.ok && !force) {
      return { ok: false, error: 'backup failed: ' + (backupRes.error || 'unknown'), results: null };
    }
    var perCategory = [];
    var chain = Promise.resolve();
    for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
      (function(cat) {
        if (!cat.legacyHeuristic || !cat.localKey) return;
        chain = chain.then(function() {
          // v32.0.2: union of local + cloud items so cloud-only ghosts get caught
          var localArr = (typeof window._readCategoryArray === 'function') ? window._readCategoryArray(cat) : [];
          return _fetchCloudItemsForCategory(cat).then(function(cloudArr) {
            var seen = {};
            var union = [];
            var src = localArr.concat(cloudArr);
            for (var s = 0; s < src.length; s++) {
              var it = src[s];
              if (!it) continue;
              var iid = it[cat.idField];
              if (iid === undefined || iid === null) continue;
              if (seen[iid]) continue;
              seen[iid] = true;
              union.push(it);
            }
            var killIds = [];
            for (var k = 0; k < union.length; k++) {
              if (cat.legacyHeuristic(union[k])) {
                killIds.push(union[k][cat.idField]);
              }
            }
            if (!killIds.length) {
              perCategory.push({ id: cat.id, count: 0, ok: true });
              return;
            }
            return tombstoneAndDeleteMany(cat.id, killIds).then(function(res) {
              perCategory.push({ id: cat.id, count: res.count, ok: res.ok, failed: res.failed });
            });
          });
        });
      })(SYNC_CATEGORIES[i]);
    }
    return chain.then(function() {
      var allOk = true;
      for (var pi = 0; pi < perCategory.length; pi++) {
        if (!perCategory[pi].ok) { allOk = false; break; }
      }
      if (allOk) {
        try { localStorage.setItem('roweos_focus_purge_v32', 'done'); } catch (e) {}
      }
      return { ok: allOk, results: perCategory, backup: backupRes };
    });
  });
}
window.purgeLegacyFocusResidue = purgeLegacyFocusResidue;

function restoreFromPrePurgeBackup_v32() {
  var raw = localStorage.getItem('roweos_pre_purge_backup_v32');
  if (!raw) {
    return Promise.resolve({ ok: false, error: 'no local backup; try cloud restore' });
  }
  try {
    var snap = JSON.parse(raw);
    var restored = 0;
    for (var k in snap) {
      if (!snap.hasOwnProperty(k)) continue;
      if (k.charAt(0) === '_') continue;
      try { localStorage.setItem(k, snap[k]); restored++; } catch (e) {}
    }
    try { localStorage.removeItem('roweos_focus_purge_v32'); } catch (e2) {}
    return Promise.resolve({ ok: true, restored: restored, capturedAt: snap._capturedAt });
  } catch (e3) {
    return Promise.resolve({ ok: false, error: e3 });
  }
}
window.restoreFromPrePurgeBackup_v32 = restoreFromPrePurgeBackup_v32;

// v32.0-B: Modal helpers. Uses the existing modal system if available; falls
// back to confirm() prompts if openModal isn't reachable.

function _showFocusPurgeModal(counts, onProceed, onSkip, onRestore) {
  var total = counts.pulseGoals + counts.brandTodos + counts.lifeTodos;
  if (total === 0) {
    if (onSkip) onSkip();
    return;
  }
  var msg =
    'v32.0 detected legacy Focus data:\n\n' +
    ' - ' + counts.pulseGoals + ' Pulse Goals\n' +
    ' - ' + counts.brandTodos + ' BrandAI To-Dos older than v28.8 cutoff\n' +
    ' - ' + counts.lifeTodos + ' LifeAI To-Dos older than v28.8 cutoff\n\n' +
    'A backup will be written before purge. Proceed?';

  if (typeof window.openModal === 'function') {
    window.openModal({
      title: 'v32.0 Cleanup',
      body: msg.split('\n').join('<br>'),
      buttons: [
        { label: 'Proceed', primary: true, onClick: function() { if (typeof window.closeModal === 'function') window.closeModal(); onProceed(); } },
        { label: 'Skip (mark done)', onClick: function() { if (typeof window.closeModal === 'function') window.closeModal(); onSkip(); } },
        { label: 'Restore from backup', onClick: function() { if (typeof window.closeModal === 'function') window.closeModal(); onRestore(); } }
      ]
    });
  } else {
    if (window.confirm(msg + '\n\nClick OK to proceed, Cancel to skip.')) onProceed();
    else onSkip();
  }
}

// v32.0.2: cloud-aware count preview — counts cloud-only ghosts too, so the
// modal shows the real number of items the purge will tombstone.
function previewLegacyFocusCountsAsync() {
  var out = { pulseGoals: 0, brandTodos: 0, lifeTodos: 0 };
  var ops = [];
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    var cat = SYNC_CATEGORIES[i];
    if (!cat.legacyHeuristic || !cat.localKey) continue;
    if (!out.hasOwnProperty(cat.id)) continue;
    (function(cat) {
      var localArr = (typeof window._readCategoryArray === 'function') ? window._readCategoryArray(cat) : [];
      ops.push(_fetchCloudItemsForCategory(cat).then(function(cloudArr) {
        var seen = {};
        var src = localArr.concat(cloudArr);
        var n = 0;
        for (var s = 0; s < src.length; s++) {
          var it = src[s];
          if (!it) continue;
          var iid = it[cat.idField];
          if (iid === undefined || iid === null) continue;
          if (seen[iid]) continue;
          seen[iid] = true;
          if (cat.legacyHeuristic(it)) n++;
        }
        out[cat.id] = n;
      }));
    })(cat);
  }
  return Promise.all(ops).then(function() { return out; });
}
window.previewLegacyFocusCountsAsync = previewLegacyFocusCountsAsync;

function runFocusPurgeFlow(opts) {
  opts = opts || {};
  var force = opts.force === true;
  if (!force && localStorage.getItem('roweos_focus_purge_v32') === 'done') return Promise.resolve({ skipped: true });

  return previewLegacyFocusCountsAsync().then(function(counts) {
  return new Promise(function(resolve) {
    _showFocusPurgeModal(counts,
      function onProceed() {
        if (typeof showToast === 'function') showToast('Purging legacy Focus data...', 'info');
        purgeLegacyFocusResidue({ force: force }).then(function(res) {
          var totalCount = 0;
          if (res.results) for (var i = 0; i < res.results.length; i++) totalCount += (res.results[i].count || 0);
          var msg = res.ok
            ? 'Purged ' + totalCount + ' legacy items. Backup written.'
            : 'Purge incomplete - see console';
          if (typeof showToast === 'function') showToast(msg, res.ok ? 'success' : 'warning');
          resolve(res);
        });
      },
      function onSkip() {
        try { localStorage.setItem('roweos_focus_purge_v32', 'done'); } catch (e) {}
        resolve({ ok: true, skipped: true });
      },
      function onRestore() {
        restoreFromPrePurgeBackup_v32().then(function(res) {
          if (typeof showToast === 'function') showToast(res.ok ? 'Restored from backup' : 'No backup found', res.ok ? 'success' : 'error');
          resolve(res);
        });
      }
    );
  });
  });
}
window.runFocusPurgeFlow = runFocusPurgeFlow;

// =====================================================================
// v32.1: SELF-HEALING TOMBSTONES + CONTINUOUS CONVERGENCE
// =====================================================================
// The v32.0 auto-purge had a false-positive bug. v32.1 removes the auto-
// purge entirely AND adds self-healing: if a tombstone says "this id is
// deleted" but cloud actually still has that id, the cloud is the source
// of truth — clear the stale tombstone so the item re-appears locally.
//
// The convergence loop runs every 30s in the active tab. It checks the
// drift state for every category and silently dispatches a reconcile
// (push or pull) so the Sync Inventory always shows "Synced" without the
// user ever needing to click Push/Pull.

var V321_STALE_TOMBSTONE_FLAG = 'roweos_v321_self_heal_done';
var V321_CONVERGENCE_INTERVAL_MS = 30 * 1000;
var _v321ConvergenceTimer = null;

// v32.1: Self-heal stale tombstones — for each category, fetch cloud item
// IDs; any local tombstone for an ID that EXISTS in cloud is stale (cloud
// is the source of truth). Remove from tombstone set, write back.
function selfHealStaleTombstones_v321() {
  if (localStorage.getItem(V321_STALE_TOMBSTONE_FLAG) === 'done') {
    return Promise.resolve({ ok: true, skipped: true });
  }
  if (!window.firebase || !window.firebaseUser) return Promise.resolve({ ok: false, error: 'no auth' });

  var ops = [];
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    (function(cat) {
      if (!cat || !cat.tombstoneKey) return;
      ops.push(_v321HealOneCategory(cat));
    })(SYNC_CATEGORIES[i]);
  }
  return Promise.all(ops).then(function(results) {
    var total = 0;
    for (var j = 0; j < results.length; j++) {
      if (results[j] && results[j].cleared) total += results[j].cleared;
    }
    try { localStorage.setItem(V321_STALE_TOMBSTONE_FLAG, 'done'); } catch (e) {}
    if (total > 0) console.log('[v32.1] Self-healed ' + total + ' stale tombstone(s)');
    return { ok: true, total: total, results: results };
  });
}
window.selfHealStaleTombstones_v321 = selfHealStaleTombstones_v321;

function _v321HealOneCategory(cat) {
  var localSet = _readTombstoneSet(cat);
  var localIds = [];
  for (var k in localSet) if (localSet.hasOwnProperty(k)) localIds.push(k);
  if (!localIds.length) return Promise.resolve({ id: cat.id, cleared: 0 });

  return _fetchCloudItemsForCategory(cat).then(function(cloudArr) {
    var cloudIdSet = {};
    for (var i = 0; i < cloudArr.length; i++) {
      var it = cloudArr[i];
      if (it && it[cat.idField] !== undefined && it[cat.idField] !== null) {
        cloudIdSet[String(it[cat.idField])] = true;
      }
    }
    var cleared = 0;
    for (var j = 0; j < localIds.length; j++) {
      if (cloudIdSet[String(localIds[j])]) {
        delete localSet[localIds[j]];
        cleared++;
      }
    }
    if (cleared > 0) {
      _writeTombstoneSet(cat, localSet);
      var writeDB = _getWindowFn('writeDB');
      if (writeDB) {
        var ids = [];
        for (var m in localSet) if (localSet.hasOwnProperty(m)) ids.push(m);
        try { writeDB(cat.cloudTombstonePath, { ids: ids, _modifiedAt: Date.now() }); } catch (e) {}
      }
    }
    return { id: cat.id, cleared: cleared };
  });
}

// v32.1: Continuous convergence loop. Every 30s when the tab is active,
// re-check drift for every category. If local count != cloud count for
// any category, silently dispatch a reconcile via loadFromFirebaseV2
// (cloud-authoritative pull). User never needs to click Push/Pull.
function startConvergenceLoop_v321() {
  if (_v321ConvergenceTimer) return;
  _v321ConvergenceTimer = setInterval(function() {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!window.firebase || !window.firebaseUser) return;
    _v321ConvergeOnce().catch(function(){});
  }, V321_CONVERGENCE_INTERVAL_MS);
  console.log('[v32.1] Convergence loop started (' + (V321_CONVERGENCE_INTERVAL_MS / 1000) + 's interval)');
}
window.startConvergenceLoop_v321 = startConvergenceLoop_v321;

function stopConvergenceLoop_v321() {
  if (_v321ConvergenceTimer) {
    clearInterval(_v321ConvergenceTimer);
    _v321ConvergenceTimer = null;
  }
}
window.stopConvergenceLoop_v321 = stopConvergenceLoop_v321;

function _v321ConvergeOnce() {
  // Only reconcile if there's a known drift signal — avoid hammering Firestore.
  // We piggyback on the existing renderSyncInventory's drift detection: the
  // cloud counts are cached on window._lastSyncCounts (set when Sync view
  // renders). If cached counts show drift, trigger a pull.
  var counts = window._lastSyncCounts || null;
  if (!counts) return Promise.resolve({ ok: true, reason: 'no cached counts' });

  var drifted = false;
  for (var label in counts) {
    if (!counts.hasOwnProperty(label)) continue;
    var c = counts[label];
    if (c && typeof c.local === 'number' && typeof c.cloud === 'number') {
      if (c.local !== c.cloud) { drifted = true; break; }
    }
  }
  if (!drifted) return Promise.resolve({ ok: true, reason: 'no drift' });

  console.log('[v32.1] Drift detected — auto-reconciling');
  if (typeof window.loadFromFirebaseV2 === 'function') {
    return Promise.resolve(window.loadFromFirebaseV2(false, true)).then(function() {
      if (typeof window.renderSyncInventory === 'function') {
        try { window.renderSyncInventory(); } catch (e) {}
      }
      return { ok: true, reconciled: true };
    });
  }
  return Promise.resolve({ ok: false, error: 'loadFromFirebaseV2 missing' });
}

// =====================================================================
// v32.1.1: TIMESTAMP-BASED DRIFT RESOLVER
// =====================================================================
// Called from renderSyncInventory when local count != cloud count.
// Compares local-array max _modifiedAt vs cloud-doc _modifiedAt.
// - If cloud is newer (cloud was modified more recently) → pull-only
//   (loadFromFirebaseV2 will replace local with cloud, including
//   empty-cloud-clears-local for wiped categories).
// - If local is newer → push-only (call category-specific save fn).
// - If timestamps tie or are missing → cloud-authoritative pull (safe default).
// Throttled to once per category per 10s to avoid hammering Firestore.

var _v321DriftLast = {}; // { categoryName: timestampMs }
var V321_DRIFT_THROTTLE_MS = 10 * 1000;

function _v321ResolveDrift(syncCat) {
  if (!syncCat || !syncCat.name) return Promise.resolve({ ok: false, error: 'no cat' });
  var name = syncCat.name;
  var last = _v321DriftLast[name] || 0;
  if (Date.now() - last < V321_DRIFT_THROTTLE_MS) {
    return Promise.resolve({ ok: true, throttled: true });
  }
  _v321DriftLast[name] = Date.now();

  // Map UI category name → registry category id
  var nameToId = {
    'Brands': 'brands', 'BrandAI Chats': 'brandAIChats', 'LifeAI Chats': 'lifeAIChats',
    'BrandAI To-Dos': 'brandTodos', 'LifeAI To-Dos': 'lifeTodos',
    'Calendar': 'calendar', 'Journal': 'journal', 'Library Files': 'libraryFiles',
    'Inventory': 'inventory', 'Possessions': 'possessions', 'Studio Runs': 'studioRuns',
    'Pulse Goals': 'pulseGoals', 'Automations': 'automations', 'Custom Ops': 'customOps',
    'Clients': 'clients', 'Team': 'team', 'Direct Reports': 'directReports',
    'LifeAI Profiles': 'lifeAIProfiles', 'Brand Logos': 'brandLogos',
    'Folio Items': 'folioItems', 'Notebooks': 'notebooks'
  };
  var catId = nameToId[name];
  if (!catId) return Promise.resolve({ ok: false, error: 'unmapped: ' + name });
  var cat = getCategoryById(catId);
  if (!cat) return Promise.resolve({ ok: false, error: 'no registry: ' + catId });

  return _v321FetchModifiedTimestamps(cat).then(function(ts) {
    var localTs = ts.local || 0;
    var cloudTs = ts.cloud || 0;
    var direction;
    if (cloudTs > localTs) direction = 'pull';
    else if (localTs > cloudTs) direction = 'push';
    else direction = 'pull'; // tie → cloud-authoritative default
    if (direction === 'pull') {
      return _v321DoPull(cat).then(function(r) { return { ok: true, direction: 'pull', result: r }; });
    } else {
      return _v321DoPush(cat).then(function(r) { return { ok: true, direction: 'push', result: r }; });
    }
  }, function(err) {
    return { ok: false, error: err };
  });
}
window._v321ResolveDrift = _v321ResolveDrift;

function _v321FetchModifiedTimestamps(cat) {
  // Local: max _modifiedAt across items in localKey OR localStorage key timestamp
  var localTs = 0;
  if (cat.localKey) {
    try {
      var raw = localStorage.getItem(cat.localKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        var arr = parsed;
        if (cat.localArrayField && parsed && parsed[cat.localArrayField]) arr = parsed[cat.localArrayField];
        if (Array.isArray(arr)) {
          for (var i = 0; i < arr.length; i++) {
            var ts = 0;
            if (arr[i] && arr[i]._modifiedAt) {
              ts = typeof arr[i]._modifiedAt === 'number' ? arr[i]._modifiedAt : Date.parse(arr[i]._modifiedAt);
            }
            if (ts > localTs) localTs = ts;
          }
        }
        if (parsed && parsed._modifiedAt) {
          var topTs = typeof parsed._modifiedAt === 'number' ? parsed._modifiedAt : Date.parse(parsed._modifiedAt);
          if (topTs > localTs) localTs = topTs;
        }
      }
    } catch (e) {}
  }

  // Cloud: top-level _modifiedAt on cloud doc (blob) or aggregate from subcollection
  var cloudTs = 0;
  if (!window.firebase || !window.firebaseUser) return Promise.resolve({ local: localTs, cloud: 0 });
  var db = firebase.firestore();
  var basePath = 'roweos_users/' + window.firebaseUser.uid;
  if (cat.cloudShape === 'blob') {
    return db.doc(basePath + '/' + cat.cloudPath).get().then(function(snap) {
      if (snap.exists) {
        var d = snap.data();
        if (d._modifiedAt) {
          cloudTs = typeof d._modifiedAt === 'number' ? d._modifiedAt : Date.parse(d._modifiedAt);
        }
      }
      return { local: localTs, cloud: cloudTs };
    }, function() { return { local: localTs, cloud: 0 }; });
  }
  if (cat.cloudShape === 'subcollection') {
    return db.collection(basePath + '/' + cat.cloudPath).get().then(function(snap) {
      snap.forEach(function(d) {
        var data = d.data();
        if (data && data._modifiedAt) {
          var ts2 = typeof data._modifiedAt === 'number' ? data._modifiedAt : Date.parse(data._modifiedAt);
          if (ts2 > cloudTs) cloudTs = ts2;
        }
      });
      return { local: localTs, cloud: cloudTs };
    }, function() { return { local: localTs, cloud: 0 }; });
  }
  return Promise.resolve({ local: localTs, cloud: 0 });
}

function _v321DoPull(cat) {
  if (typeof window.loadFromFirebaseV2 === 'function') {
    return Promise.resolve(window.loadFromFirebaseV2(false, true)).then(function() {
      if (typeof window.renderSyncInventory === 'function') {
        try { window.renderSyncInventory(); } catch (e) {}
      }
      return { pulled: true };
    });
  }
  return Promise.resolve({ pulled: false, error: 'loadFromFirebaseV2 missing' });
}

function _v321DoPush(cat) {
  // Map category id → existing save function for that category
  var saveMap = {
    'brands': 'saveBrands',
    'brandTodos': 'saveTodos',
    'lifeTodos': 'saveTodos',
    'calendar': 'saveCalendar',
    'journal': 'saveJournal',
    'pulseGoals': 'savePulseGoals',
    'automations': 'saveAutomations',
    'inventory': 'saveInventory',
    'possessions': 'savePossessions',
    'studioRuns': 'saveStudioRuns',
    'customOps': 'saveCustomOps',
    'clients': 'saveClients',
    'team': 'saveTeam',
    'directReports': 'saveDirectReports',
    'lifeAIProfiles': 'saveLifeAIProfiles',
    'folioItems': 'saveFolioItems',
    'notebooks': 'saveNotebooks',
    'libraryFiles': 'saveLibrary',
    'brandLogos': 'saveBrands',
    'brandAIChats': null, // chat saves are inline per-message; no aggregate save
    'lifeAIChats': null
  };
  var fnName = saveMap[cat.id];
  if (!fnName) return Promise.resolve({ pushed: false, reason: 'no save fn for ' + cat.id });
  var fn = window[fnName];
  if (typeof fn !== 'function') return Promise.resolve({ pushed: false, reason: fnName + ' not loaded' });
  try {
    var p = fn();
    return Promise.resolve(p).then(function() {
      if (typeof window.renderSyncInventory === 'function') {
        try { setTimeout(function(){ window.renderSyncInventory(); }, 800); } catch (e) {}
      }
      return { pushed: true, fn: fnName };
    }, function(err) { return { pushed: false, error: err }; });
  } catch (e) {
    return Promise.resolve({ pushed: false, error: e });
  }
}

// =====================================================================
// v32.1.1: FORCE-ALIGN ON FIRST LAUNCH
// =====================================================================
// One-shot. For each registered category, fetch cloud's _modifiedAt and
// compare against local items' max _modifiedAt. If cloud is strictly
// NEWER, overwrite local with cloud's data — including the empty-cloud
// case where local should clear to match. This fixes the situation where
// Firebase Admin wiped cloud (with fresh _modifiedAt) but the user's
// browser still has old local items showing as "Push needed".
//
// Guarded by roweos_v321_force_align flag so it never re-runs.

// v32.1.2: removed flag — run every launch. Cheap (one .get() per blob category).
function forceAlignFromCloud_v321() {
  if (!window.firebase || !window.firebaseUser) return Promise.resolve({ ok: false, error: 'no auth' });

  var db = firebase.firestore();
  var basePath = 'roweos_users/' + window.firebaseUser.uid;
  var ops = [];
  for (var i = 0; i < SYNC_CATEGORIES.length; i++) {
    (function(cat) {
      if (!cat || !cat.localKey) return;
      if (cat.cloudShape === 'blob') ops.push(_v321AlignBlobCategory(cat, db, basePath));
      else if (cat.cloudShape === 'subcollection') ops.push(_v321AlignSubcollCategory(cat, db, basePath));
    })(SYNC_CATEGORIES[i]);
  }
  return Promise.all(ops).then(function(results) {
    var aligned = 0;
    for (var j = 0; j < results.length; j++) {
      if (results[j] && results[j].aligned) aligned++;
    }
    if (aligned > 0) {
      console.log('[v32.1.2] Force-aligned ' + aligned + ' category(ies) from newer cloud');
      if (typeof window.renderSyncInventory === 'function') {
        try { window.renderSyncInventory(); } catch (e) {}
      }
    }
    return { ok: true, aligned: aligned, results: results };
  });
}
window.forceAlignFromCloud_v321 = forceAlignFromCloud_v321;

function _v321AlignBlobCategory(cat, db, basePath) {
  return db.doc(basePath + '/' + cat.cloudPath).get().then(function(snap) {
    if (!snap.exists) return { id: cat.id, aligned: false, reason: 'no cloud doc' };
    var d = snap.data();
    var cloudTs = 0;
    if (d._modifiedAt) {
      cloudTs = typeof d._modifiedAt === 'number' ? d._modifiedAt : Date.parse(d._modifiedAt);
    }
    if (!cloudTs) return { id: cat.id, aligned: false, reason: 'no cloud ts' };

    // Read local max ts. v32.1.2: fall back to createdAt, updatedAt, and numeric
    // id when _modifiedAt is missing (most existing local records lack it).
    var localTs = 0;
    try {
      var raw = localStorage.getItem(cat.localKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        var arr = parsed;
        if (cat.localArrayField && parsed && parsed[cat.localArrayField]) arr = parsed[cat.localArrayField];
        if (Array.isArray(arr)) {
          for (var i = 0; i < arr.length; i++) {
            var item = arr[i];
            if (!item) continue;
            var iTs = 0;
            if (item._modifiedAt) iTs = typeof item._modifiedAt === 'number' ? item._modifiedAt : Date.parse(item._modifiedAt);
            if (!iTs && item.updatedAt) iTs = typeof item.updatedAt === 'number' ? item.updatedAt : Date.parse(item.updatedAt);
            if (!iTs && item.createdAt) iTs = typeof item.createdAt === 'number' ? item.createdAt : Date.parse(item.createdAt);
            if (!iTs && typeof item.id === 'number' && item.id > 1000000000000) iTs = item.id;
            if (iTs && iTs > localTs) localTs = iTs;
          }
        }
        if (parsed && parsed._modifiedAt) {
          var topTs = typeof parsed._modifiedAt === 'number' ? parsed._modifiedAt : Date.parse(parsed._modifiedAt);
          if (topTs > localTs) localTs = topTs;
        }
      }
    } catch (e) {}

    if (cloudTs <= localTs) return { id: cat.id, aligned: false, reason: 'local newer or equal', cloudTs: cloudTs, localTs: localTs };

    // Cloud is newer → overwrite local with cloud's array
    var cloudArr = d[cat.blobField || 'data'] || [];
    if (!Array.isArray(cloudArr)) return { id: cat.id, aligned: false, reason: 'cloud not array' };

    var payload;
    if (cat.localArrayField) {
      var existing = {};
      try { existing = JSON.parse(localStorage.getItem(cat.localKey) || '{}'); } catch (e2) {}
      if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) existing = {};
      existing[cat.localArrayField] = cloudArr;
      existing._modifiedAt = cloudTs;
      payload = existing;
    } else if (cat.localFilter && cat.localFilter.field) {
      // Shared storage: preserve other-category items, replace this category's
      var raw2 = {};
      try { raw2 = JSON.parse(localStorage.getItem(cat.localKey) || '[]'); } catch (e3) {}
      var existingAll = Array.isArray(raw2) ? raw2 : [];
      var others = existingAll.filter(function(x) { return !(x && x[cat.localFilter.field] === cat.localFilter.value); });
      payload = others.concat(cloudArr);
    } else {
      payload = cloudArr;
    }
    try { localStorage.setItem(cat.localKey, JSON.stringify(payload)); } catch (e4) {}

    // Trigger any rerender callbacks
    if (cat.rerender) {
      for (var r = 0; r < cat.rerender.length; r++) {
        try { var fn = window[cat.rerender[r]]; if (typeof fn === 'function') fn(); } catch (e5) {}
      }
    }

    return { id: cat.id, aligned: true, cloudCount: cloudArr.length, cloudTs: cloudTs, localTs: localTs };
  }, function(err) {
    return { id: cat.id, aligned: false, error: err };
  });
}

// v32.1.2: subcollection-shape force-align. For per-doc collections (chats,
// pulse_goals, brands), drop any local item whose id doesn't exist in cloud
// AND whose timestamp is older than 2026-04-15. This catches chats wiped via
// Firebase Admin that local hasn't seen yet.
var V321_STALE_CUTOFF = Date.parse('2026-04-15T00:00:00Z');

function _v321AlignSubcollCategory(cat, db, basePath) {
  if (!cat.localKey) return Promise.resolve({ id: cat.id, aligned: false, reason: 'no localKey' });
  return db.collection(basePath + '/' + cat.cloudPath).get().then(function(snap) {
    var cloudIdSet = {};
    snap.forEach(function(d) { cloudIdSet[d.id] = true; });
    var localArr;
    try { localArr = JSON.parse(localStorage.getItem(cat.localKey) || '[]'); } catch (e) { localArr = []; }
    if (!Array.isArray(localArr)) return { id: cat.id, aligned: false, reason: 'local not array' };
    var kept = [];
    var killed = 0;
    for (var i = 0; i < localArr.length; i++) {
      var item = localArr[i];
      if (!item) continue;
      var iid = String(item[cat.idField || 'id']);
      if (cloudIdSet[iid]) { kept.push(item); continue; }
      // Not in cloud — check ts
      var ts = 0;
      if (item._modifiedAt) ts = typeof item._modifiedAt === 'number' ? item._modifiedAt : Date.parse(item._modifiedAt);
      if (!ts && item.updatedAt) ts = typeof item.updatedAt === 'number' ? item.updatedAt : Date.parse(item.updatedAt);
      if (!ts && item.createdAt) ts = typeof item.createdAt === 'number' ? item.createdAt : Date.parse(item.createdAt);
      if (!ts && typeof item.id === 'number' && item.id > 1000000000000) ts = item.id;
      if (ts && ts < V321_STALE_CUTOFF) { killed++; continue; }
      kept.push(item); // recent + missing from cloud — keep (likely uncommitted)
    }
    if (killed > 0) {
      try { localStorage.setItem(cat.localKey, JSON.stringify(kept)); } catch (e) {}
      console.log('[v32.1.2] ' + cat.id + ': dropped ' + killed + ' local item(s) absent from cloud + older than cutoff');
      if (cat.rerender) {
        for (var r = 0; r < cat.rerender.length; r++) {
          try { var fn = window[cat.rerender[r]]; if (typeof fn === 'function') fn(); } catch (e2) {}
        }
      }
      return { id: cat.id, aligned: true, killed: killed };
    }
    return { id: cat.id, aligned: false, reason: 'no stale local items' };
  }, function(err) { return { id: cat.id, aligned: false, error: err }; });
}
