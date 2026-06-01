// 35-sync-v5.js
// Sync v5 — scaffold (NOT YET ACTIVATED)
// v33.1 — first scaffold per docs/brilliance/16-sync-v5.md
//
// This is a skeleton. It defines the public contract (Collection, SyncEngine, conflict
// resolution) but does NOT replace v4. Activation is gated by feature flag:
//   localStorage.roweos_sync_v5_enabled === 'true'
//
// Even when the flag is on, behavior is read-shadow only — v5 listens to Firestore but
// does not write. Real dual-write begins in v34, after the read-shadow zero-discrepancy
// period documented in the spec.
//
// Public surface (final shape, mostly stubs for now):
//   SyncV5.isEnabled()                  -> boolean
//   SyncV5.collection(name, opts)       -> Collection
//   Collection#read(id)                 -> Synced<T> | null
//   Collection#list({ includeDeleted }) -> Synced<T>[]
//   Collection#write(id, data)          -> Synced<T>
//   Collection#delete(id)               -> Synced<T>  (tombstone)
//   Collection#subscribe(handler)       -> unsubscribe fn
//
// IMPORTANT: do not import this from production code paths yet. Read the spec.

var SyncV5 = (function(){
  var FLAG_KEY = 'roweos_sync_v5_enabled';
  var collections = {};
  var clientId = null;
  var stats = {
    started: false,
    eventsSeen: 0,
    discrepancies: 0,
    lastEventAt: 0,
    lastDiscrepancyAt: 0,
    lastError: null,
    activeCollections: [],
    perCollection: {}, // { collectionName: { events: 0, discrepancies: 0, lastDiscrepancyAt: 0, lastSummary: '' } }
    recentEvents: [], // last 5 — { collection, action, at, id }
    dualWrites: 0,    // v33.43: total dual-write candidates flushed
    dualWriteErrors: 0,
    lastDualWriteAt: 0
  };
  var statsListeners = [];

  function isEnabled() {
    try { return localStorage.getItem(FLAG_KEY) === 'true'; } catch(e) { return false; }
  }

  // v33.8: Write activation gate. Reads from a SECOND flag.
  // When true (and isEnabled()), v5-native collections (evolve_*) push to Firestore.
  // V4-shadowed collections (automations, brands, conversations, scribe, reminders)
  // STILL never write through v5 — they remain v4-authoritative until v34 dual-write phase.
  function writesEnabled() {
    try { return isEnabled() && localStorage.getItem('roweos_sync_v5_writes') === 'true'; } catch(e) { return false; }
  }
  function setWritesEnabled(on) {
    try { localStorage.setItem('roweos_sync_v5_writes', on ? 'true' : 'false'); } catch(e){}
    notifyStatsListeners();
  }

  // v33.43: Dual-write activation gate. THIRD flag.
  // When all three flags are on (read-shadow + writes + dual-write), v4 write paths
  // can mirror their writes into v5 collections via mirrorV4Write(). Stats track
  // every dual-write candidate so the v34 14-day zero-discrepancy bar can be
  // measured precisely. This is the entry to the canonical dual-write phase
  // documented in docs/brilliance/16-sync-v5.md.
  // Initial cut: SCAFFOLDED but the v4 write paths do NOT call mirrorV4Write yet.
  // v34 wires this in once the read-shadow has been clean for 14 days.
  function dualWriteEnabled() {
    try {
      return isEnabled()
        && writesEnabled()
        && localStorage.getItem('roweos_sync_v5_dual_write') === 'true';
    } catch(e) { return false; }
  }
  function setDualWriteEnabled(on) {
    try { localStorage.setItem('roweos_sync_v5_dual_write', on ? 'true' : 'false'); } catch(e){}
    notifyStatsListeners();
  }

  // v34.67: Phase C #8 — fourth flag. When ON: reads come from v5 collections;
  // writes still hit both v4 and v5 (because the dual_write flag is independent).
  // The spec calls for this gate so we can roll out reads gradually (Jordan first,
  // then 10%, then 100%). When OFF, every read site behaves as before (v4-shaped).
  function readsEnabled() {
    try {
      return isEnabled()
        && writesEnabled()
        && dualWriteEnabled()
        && localStorage.getItem('roweos_sync_v5_reads') === 'true';
    } catch(e) { return false; }
  }
  function setReadsEnabled(on) {
    try { localStorage.setItem('roweos_sync_v5_reads', on ? 'true' : 'false'); } catch(e){}
    notifyStatsListeners();
  }

  // v34.68: Phase D retirement flag. When ON: v4 dual-write paths short-circuit,
  // v4 reads stop running, v5 is the only sync layer. Default OFF — admin must
  // explicitly flip after the 30-day Phase D observation window. The flag is
  // checked by writeDB / writeDBDoc / loadFromFirebaseV2 / manualSyncNow guards.
  function v4Retired() {
    try { return localStorage.getItem('roweos_sync_v4_retired') === 'true'; } catch(e) { return false; }
  }
  function setV4Retired(on) {
    try { localStorage.setItem('roweos_sync_v4_retired', on ? 'true' : 'false'); } catch(e){}
    notifyStatsListeners();
  }
  // V5-native collection allowlist for cloud writes.
  // v34.67: Phase A #2 — extended beyond evolve_* to include every v4-shadowed
  // collection so dual-write actually fires Firestore writes (not just localStorage).
  // The names match the v5 cache collection names that mirrorV4Write() stamps via
  // the _v5Map in 09-state.js writeDB(). When dual-write flag is ON, any v4 write
  // to any of these flows to a v5 envelope in users/{uid}/<name>_v5/<docId>.
  var V5_NATIVE_COLLECTIONS = [
    // Originally v5-native (Evolve)
    'evolve_skills', 'evolve_sources', 'evolve_reflections', 'evolve_sops',
    // v4-shadowed collections (registered with explicit specs in v34.67)
    'brands_v5',
    'conversations_v5',
    'automations_v5',
    'scribe_v5',
    'reminders_v5',
    'pulse_v5',
    'library_brand_v5',
    'library_life_v5',
    'mail_v5',
    'journal_v5',
    'folio_v5',
    // Profile sub-docs that flow through writeDB('profile/X')
    'profile_main',
    'profile_userContact',
    'profile_customAgents',
    'profile_customOps',
    'profile_clients',
    'profile_socialPosts',
    'profile_socialWorkflows',
    'profile_notifications',
    'profile_researchHistory',
    'profile_mail',
    'profile_people',
    'profile_reminders',
    'profile_inventory',
    'profile_generatedBrandOps',
    'lifeAI'
  ];
  function isV5NativeCollection(name) {
    return V5_NATIVE_COLLECTIONS.indexOf(name) !== -1;
  }

  function getClientId() {
    if (clientId) return clientId;
    try {
      var existing = localStorage.getItem('roweos_sync_v5_client_id');
      if (existing) { clientId = existing; return clientId; }
      var fresh = uuid();
      localStorage.setItem('roweos_sync_v5_client_id', fresh);
      clientId = fresh;
      return clientId;
    } catch(e) { clientId = uuid(); return clientId; }
  }

  function uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try { return crypto.randomUUID(); } catch(e){}
    }
    // RFC4122 v4 fallback (not cryptographically strong, but stable enough for client IDs).
    var s = '';
    for (var i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) { s += '-'; continue; }
      if (i === 14) { s += '4'; continue; }
      var r = Math.random() * 16 | 0;
      if (i === 19) r = (r & 0x3) | 0x8;
      s += r.toString(16);
    }
    return s;
  }

  // Universal envelope per spec §1.
  function envelope(id, data, opts) {
    opts = opts || {};
    var now = Date.now();
    return {
      id: id,
      data: data,
      _modifiedAt: opts._modifiedAt || now,
      _createdAt: opts._createdAt || now,
      _deletedAt: opts._deletedAt || null,
      _clientId: opts._clientId || getClientId(),
      _schemaVersion: opts._schemaVersion || 1
    };
  }

  // Last-write-wins by _modifiedAt; ties broken by _clientId lexicographic.
  function resolveConflict(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a._modifiedAt !== b._modifiedAt) return (a._modifiedAt > b._modifiedAt) ? a : b;
    return (a._clientId > b._clientId) ? a : b;
  }

  function Collection(opts) {
    if (!(this instanceof Collection)) return new Collection(opts);
    this.name = opts.name;
    this.firestorePath = opts.firestorePath; // function(uid) -> path
    this.localStorageKey = opts.localStorageKey || ('brilliance_v5_' + opts.name);
    this.schemaVersion = opts.schemaVersion || 1;
    this._items = {};
    this._subscribers = [];
    this._unsubscribeFirestore = null;
    this._loaded = false;
  }

  Collection.prototype._loadLocal = function() {
    try {
      var raw = localStorage.getItem(this.localStorageKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') this._items = parsed;
      }
    } catch(e){}
    this._loaded = true;
  };

  Collection.prototype._persistLocal = function() {
    try { localStorage.setItem(this.localStorageKey, JSON.stringify(this._items)); } catch(e){}
  };

  Collection.prototype._notify = function(change) {
    for (var i = 0; i < this._subscribers.length; i++) {
      try { this._subscribers[i](change); } catch(e){}
    }
  };

  Collection.prototype.read = function(id) {
    if (!this._loaded) this._loadLocal();
    var it = this._items[id];
    if (!it || it._deletedAt) return null;
    return it;
  };

  Collection.prototype.list = function(opts) {
    if (!this._loaded) this._loadLocal();
    opts = opts || {};
    var out = [];
    for (var k in this._items) {
      if (!Object.prototype.hasOwnProperty.call(this._items, k)) continue;
      var it = this._items[k];
      if (it._deletedAt && !opts.includeDeleted) continue;
      out.push(it);
    }
    return out;
  };

  Collection.prototype.write = function(id, data) {
    if (!this._loaded) this._loadLocal();
    var prev = this._items[id];
    var next = envelope(id, data, {
      _createdAt: prev ? prev._createdAt : undefined,
      _schemaVersion: this.schemaVersion
    });
    this._items[id] = next;
    this._persistLocal();
    this._notify({ kind: 'write', id: id, item: next });
    // v33.8: Cloud write for v5-native collections only, gated by writesEnabled().
    this._maybeCloudWrite(id, next);
    return next;
  };

  Collection.prototype.delete = function(id) {
    if (!this._loaded) this._loadLocal();
    var prev = this._items[id];
    if (!prev) return null;
    var tombstone = envelope(id, prev.data, {
      _createdAt: prev._createdAt,
      _modifiedAt: Date.now(),
      _deletedAt: Date.now(),
      _schemaVersion: this.schemaVersion
    });
    this._items[id] = tombstone;
    this._persistLocal();
    this._notify({ kind: 'delete', id: id, item: tombstone });
    // v33.8: Cloud write of tombstone for v5-native collections.
    this._maybeCloudWrite(id, tombstone);
    return tombstone;
  };

  // v33.43: Mirror a v4 payload into the v5 collection cache (and optionally
  // cloud, if both write flags + dual-write flag are all on).
  // Returns the resulting envelope, or null if dual-write is gated off.
  Collection.prototype._prepareDualWrite = function(id, v4Data) {
    if (!dualWriteEnabled()) return null;
    if (!this._loaded) this._loadLocal();
    var prev = this._items[id];
    var env = envelope(id, v4Data, {
      _createdAt: prev ? prev._createdAt : undefined,
      _schemaVersion: this.schemaVersion
    });
    this._items[id] = env;
    this._persistLocal();
    stats.dualWrites++;
    stats.lastDualWriteAt = Date.now();
    notifyStatsListeners();
    // v34: cloud-write path. For now, gate on the existing _maybeCloudWrite
    // which only fires for v5-native (evolve_*) collections — v4-shadowed
    // collections still won't touch Firestore until the v34 spec phase
    // explicitly extends the allowlist.
    try { this._maybeCloudWrite(id, env); } catch(e) {
      stats.dualWriteErrors++;
      notifyStatsListeners();
    }
    this._notify({ kind: 'dual-write', id: id, item: env });
    return env;
  };

  Collection.prototype._maybeCloudWrite = function(id, envelope) {
    try {
      if (!writesEnabled()) return;
      if (!isV5NativeCollection(this.name)) return;
      if (typeof firebase === 'undefined' || !firebase.firestore) return;
      if (typeof firebaseUser === 'undefined' || !firebaseUser || !firebaseUser.uid) return;
      var path = this.firestorePath(firebaseUser.uid);
      firebase.firestore().collection(path).doc(id).set(envelope, { merge: true })
        .catch(function(err){
          if (window.ROWEOS_DEBUG) console.warn('[SyncV5 cloud-write]', err);
          stats.lastError = (err && err.message) || 'cloud-write failed';
          notifyStatsListeners();
        });
    } catch(e){
      if (window.ROWEOS_DEBUG) console.warn('[SyncV5 cloud-write]', e);
    }
  };

  Collection.prototype.subscribe = function(handler) {
    var self = this;
    this._subscribers.push(handler);
    return function unsubscribe(){
      var idx = self._subscribers.indexOf(handler);
      if (idx > -1) self._subscribers.splice(idx, 1);
    };
  };

  // Read-shadow only for v33.2 — no Firestore writes from v5 yet.
  // Read-shadow does NOT mutate the v4 source of truth. It listens to Firestore,
  // compares each doc to v4 state via the optional `compareV4` callback, and bumps
  // the discrepancy counter so the Settings dashboard can surface what would have
  // diverged. Real reconciliation begins in v34 dual-write phase.
  Collection.prototype._startReadShadow = function(uid, opts) {
    if (!isEnabled()) return;
    if (!uid || typeof firebase === 'undefined' || !firebase.firestore) return;
    if (this._unsubscribeFirestore) return;
    var self = this;
    opts = opts || {};
    var compareV4 = opts.compareV4; // function(doc) -> { matches: bool, summary: string }
    try {
      var path = this.firestorePath(uid);
      this._unsubscribeFirestore = firebase.firestore().collection(path).onSnapshot(function(snap){
        // Successful snapshot — reset retry counter.
        self._retryCount = 0;
        snap.docChanges().forEach(function(ch){
          stats.eventsSeen++;
          stats.lastEventAt = Date.now();
          // Per-collection counters.
          if (!stats.perCollection[self.name]) stats.perCollection[self.name] = { events: 0, discrepancies: 0, lastDiscrepancyAt: 0, lastSummary: '' };
          stats.perCollection[self.name].events++;
          // v33.15: Recent events log (last 5).
          stats.recentEvents.unshift({ collection: self.name, action: ch.type, at: Date.now(), id: ch.doc.id });
          if (stats.recentEvents.length > 5) stats.recentEvents.length = 5;
          var doc = ch.doc.data();
          if (!doc) return;

          // Discrepancy check: compare v5-shadow view against v4 state via caller-supplied probe.
          if (typeof compareV4 === 'function') {
            try {
              var cmp = compareV4(doc, ch);
              if (cmp && cmp.matches === false) {
                stats.discrepancies++;
                stats.lastDiscrepancyAt = Date.now();
                stats.perCollection[self.name].discrepancies++;
                stats.perCollection[self.name].lastDiscrepancyAt = Date.now();
                stats.perCollection[self.name].lastSummary = cmp.summary || '';
                if (window.ROWEOS_DEBUG) {
                  console.warn('[SyncV5 shadow] discrepancy in', self.name, cmp.summary || '', doc);
                }
              }
            } catch(eCmp){}
          }

          // Maintain v5 local cache (does not affect v4).
          if (!doc.id) return;
          var local = self._items[doc.id];
          var winner = resolveConflict(local, doc);
          if (winner !== local) {
            self._items[doc.id] = winner;
            self._persistLocal();
            self._notify({ kind: 'remote', id: doc.id, item: winner });
          }
        });
        notifyStatsListeners();
      }, function(err){
        stats.lastError = (err && err.message) || String(err || 'unknown');
        notifyStatsListeners();
        if (window.ROWEOS_DEBUG) console.warn('[SyncV5 shadow]', self.name, err);
        // v33.22: Auto-retry up to 3 times with 30s backoff. After that, surface lastError and stop.
        self._retryCount = (self._retryCount || 0) + 1;
        if (self._retryCount <= 3) {
          setTimeout(function(){
            try {
              if (self._unsubscribeFirestore) { try { self._unsubscribeFirestore(); } catch(eU){} self._unsubscribeFirestore = null; }
              self._startReadShadow(uid, opts);
            } catch(eR){}
          }, 30000);
        }
      });
      if (stats.activeCollections.indexOf(self.name) === -1) stats.activeCollections.push(self.name);
      stats.started = true;
      notifyStatsListeners();
    } catch(e){
      stats.lastError = e.message || 'unknown init failure';
    }
  };

  Collection.prototype._stopReadShadow = function() {
    if (this._unsubscribeFirestore) {
      try { this._unsubscribeFirestore(); } catch(e){}
      this._unsubscribeFirestore = null;
    }
    var idx = stats.activeCollections.indexOf(this.name);
    if (idx > -1) stats.activeCollections.splice(idx, 1);
    if (stats.activeCollections.length === 0) stats.started = false;
    notifyStatsListeners();
  };

  function getStats() {
    // Deep-copy perCollection so subscribers can't mutate internal state.
    var perColl = {};
    for (var k in stats.perCollection) {
      if (Object.prototype.hasOwnProperty.call(stats.perCollection, k)) {
        var p = stats.perCollection[k];
        perColl[k] = {
          events: p.events,
          discrepancies: p.discrepancies,
          lastDiscrepancyAt: p.lastDiscrepancyAt,
          lastSummary: p.lastSummary
        };
      }
    }
    return {
      enabled: isEnabled(),
      writesEnabled: writesEnabled(),
      dualWriteEnabled: dualWriteEnabled(),
      readsEnabled: readsEnabled(),
      v4Retired: v4Retired(),
      started: stats.started,
      eventsSeen: stats.eventsSeen,
      discrepancies: stats.discrepancies,
      lastEventAt: stats.lastEventAt,
      lastDiscrepancyAt: stats.lastDiscrepancyAt,
      lastError: stats.lastError,
      activeCollections: stats.activeCollections.slice(),
      v5NativeCollections: V5_NATIVE_COLLECTIONS.slice(),
      perCollection: perColl,
      recentEvents: stats.recentEvents.slice(),
      dualWrites: stats.dualWrites,
      dualWriteErrors: stats.dualWriteErrors,
      lastDualWriteAt: stats.lastDualWriteAt
    };
  }

  /**
   * v33.43: Mirror a v4 write to the corresponding v5 collection.
   * v4 callers (the writeDB wrappers) call this once dual-write is fully wired in v34.
   * Resolution map below converts a v4 docPath to a v5 collection name + envelope id.
   * Returns the v5 envelope on success, null when dual-write is gated off.
   */
  function mirrorV4Write(collectionName, id, v4Data) {
    if (!dualWriteEnabled()) return null;
    if (!collectionName || !id) return null;
    var coll = collections[collectionName];
    if (!coll) {
      // v34.111: Auto-register fallback. Previously used 'users/{uid}' which is the
      // WRONG namespace - everything else in this codebase uses 'roweos_users/{uid}'.
      // An auto-registered collection writing to the wrong path would silently send
      // dual-write data into a parallel Firestore tree that no reader queries.
      coll = getCollection(collectionName, {
        firestorePath: function(uid){ return 'roweos_users/' + uid + '/' + collectionName; },
        localStorageKey: 'brilliance_v5_' + collectionName,
        schemaVersion: 1
      });
    }
    return coll._prepareDualWrite(id, v4Data);
  }

  // v34 lookup table: maps a v4 writeDB() docPath to (collection, id).
  // EMPTY for now — populated when individual collections graduate to dual-write.
  var V4_PATH_RESOLVERS = {};

  function subscribeStats(handler) {
    statsListeners.push(handler);
    return function unsubscribe(){
      var idx = statsListeners.indexOf(handler);
      if (idx > -1) statsListeners.splice(idx, 1);
    };
  }

  function notifyStatsListeners() {
    var snapshot = getStats();
    for (var i = 0; i < statsListeners.length; i++) {
      try { statsListeners[i](snapshot); } catch(e){}
    }
  }

  // v33.13: Reset all counters. Doesn't stop the listener — just zeros stats.
  function resetStats() {
    stats.eventsSeen = 0;
    stats.discrepancies = 0;
    stats.lastEventAt = 0;
    stats.lastDiscrepancyAt = 0;
    stats.lastError = null;
    stats.perCollection = {};
    stats.recentEvents = [];
    stats.dualWrites = 0;
    stats.dualWriteErrors = 0;
    stats.lastDualWriteAt = 0;
    notifyStatsListeners();
  }

  // v33.16: Clear all v5 local caches. Strictly local — no cloud impact.
  // Useful after toggling writes, or to re-baseline after a bug.
  function clearLocalCache() {
    var cleared = 0;
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('brilliance_v5_') === 0) keys.push(k);
      }
      for (var j = 0; j < keys.length; j++) {
        localStorage.removeItem(keys[j]);
        cleared++;
      }
    } catch(e){}
    // Reset all collection in-memory caches.
    for (var name in collections) {
      if (Object.prototype.hasOwnProperty.call(collections, name)) {
        collections[name]._items = {};
        collections[name]._loaded = false;
      }
    }
    resetStats();
    return cleared;
  }

  function setEnabled(on) {
    try { localStorage.setItem(FLAG_KEY, on ? 'true' : 'false'); } catch(e){}
    if (!on) {
      // Stop all active shadows.
      for (var k in collections) {
        if (collections[k] && collections[k]._unsubscribeFirestore) collections[k]._stopReadShadow();
      }
    } else {
      // Auto-start any registered shadow if firebase + uid available.
      try {
        if (typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.uid) {
          startReadShadowForAutomations(firebaseUser.uid);
          startReadShadowForBrands(firebaseUser.uid);
          startReadShadowForConversations(firebaseUser.uid);
          startReadShadowForScribe(firebaseUser.uid);
          startReadShadowForReminders(firebaseUser.uid);
          startReadShadowForPulse(firebaseUser.uid);
          startReadShadowForLibrary(firebaseUser.uid);
          startReadShadowForMail(firebaseUser.uid);
          startReadShadowForJournal(firebaseUser.uid);
          startReadShadowForFolio(firebaseUser.uid);
        }
      } catch(e){}
    }
    notifyStatsListeners();
  }

  // Read-shadow target: automations.
  function startReadShadowForAutomations(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('automations', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/automations'; },
      localStorageKey: 'brilliance_v5_automations',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var raw = localStorage.getItem('roweos_automations');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only id ' + cloudId };
          var cloudTs = cloudDoc._modifiedAt || (cloudDoc.data && cloudDoc.data._modifiedAt) || 0;
          var localTs = match._modifiedAt || 0;
          if (Math.abs(cloudTs - localTs) > 5000) {
            return { matches: false, summary: 'timestamp drift ' + cloudTs + ' vs ' + localTs };
          }
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.27: Read-shadow for journal entries (LifeAI mode).
  function startReadShadowForJournal(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('journal', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/journal'; },
      localStorageKey: 'brilliance_v5_journal',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var raw = localStorage.getItem('roweos_journal') || localStorage.getItem('roweos_pulse_journal');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only journal entry ' + cloudId };
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.27: Read-shadow for folio artifacts.
  function startReadShadowForFolio(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('folio', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/folio'; },
      localStorageKey: 'brilliance_v5_folio',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var raw = localStorage.getItem('roweos_folio_artifacts');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only folio artifact ' + cloudId };
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.20: Read-shadow for mail outbox + sent items.
  function startReadShadowForMail(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('mail', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/mail'; },
      localStorageKey: 'brilliance_v5_mail',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var sentRaw = localStorage.getItem('roweos_mail_sent');
          var outRaw = localStorage.getItem('roweos_mail_outbox');
          var sent = sentRaw ? JSON.parse(sentRaw) : [];
          var out = outRaw ? JSON.parse(outRaw) : [];
          if (!Array.isArray(sent)) sent = [];
          if (!Array.isArray(out)) out = [];
          var local = sent.concat(out);
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only mail item ' + cloudId };
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.12: Read-shadow for pulse_goals.
  function startReadShadowForPulse(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('pulse_goals', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/pulse_goals'; },
      localStorageKey: 'brilliance_v5_pulse_goals',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var raw = localStorage.getItem('roweos_pulse_goals');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only goal ' + cloudId };
          var cloudCompleted = !!cloudDoc.completed;
          var localCompleted = !!match.completed;
          if (cloudCompleted !== localCompleted) {
            return { matches: false, summary: 'goal ' + cloudId + ' completion drift' };
          }
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.12: Read-shadow for library/studio gallery.
  function startReadShadowForLibrary(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('library', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/library'; },
      localStorageKey: 'brilliance_v5_library',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          // Library items live across multiple v4 keys; use studio_gallery for spot-check.
          var raw = localStorage.getItem('roweos_auto_lab_images');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only library item ' + cloudId };
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.7: Read-shadow for scribe notebooks. v4 stores at roweos_scribe_notebooks;
  // cloud subcollection is users/{uid}/scribe.
  function startReadShadowForScribe(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('scribe', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/scribe'; },
      localStorageKey: 'brilliance_v5_scribe',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var raw = localStorage.getItem('roweos_scribe_notebooks');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only notebook ' + cloudId };
          var cloudTs = cloudDoc._modifiedAt || 0;
          var localTs = match._modifiedAt || 0;
          if (Math.abs(cloudTs - localTs) > 5000) {
            return { matches: false, summary: 'notebook ' + cloudId + ' timestamp drift' };
          }
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.7: Read-shadow for reminders. Cloud at users/{uid}/reminders.
  function startReadShadowForReminders(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('reminders', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/reminders'; },
      localStorageKey: 'brilliance_v5_reminders',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var raw = localStorage.getItem('roweos_reminders');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only reminder ' + cloudId };
          var cloudStatus = cloudDoc.status || (cloudDoc.data && cloudDoc.data.status);
          if (cloudStatus && match.status && cloudStatus !== match.status) {
            return { matches: false, summary: 'reminder ' + cloudId + ' status drift ' + cloudStatus + ' vs ' + match.status };
          }
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.6: Read-shadow target: conversations. Lessons from the Feb 9 chat-resurrection
  // bug — every cloud `messages` change should mirror local. Tombstoned chats stay tombstoned.
  function startReadShadowForConversations(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('conversations', {
      firestorePath: function(u){ return 'roweos_users/' + u + '/chats'; },
      localStorageKey: 'brilliance_v5_conversations',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          // v4 stores chats in roweos_agentCommands keyed by id, plus tombstones in roweos_deleted_chat_ids.
          var raw = localStorage.getItem('roweos_agentCommands');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          var tombsRaw = localStorage.getItem('roweos_deleted_chat_ids');
          var tombs = tombsRaw ? JSON.parse(tombsRaw) : [];
          if (!Array.isArray(tombs)) tombs = [];

          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId) return { matches: true };
          // If cloud has a chat that's tombstoned locally, that's a discrepancy (resurrection risk).
          if (tombs.indexOf(cloudId) !== -1) {
            return { matches: false, summary: 'tombstoned chat present in cloud: ' + cloudId };
          }
          var match = null;
          for (var i = 0; i < local.length; i++) { if (local[i] && local[i].id === cloudId) { match = local[i]; break; } }
          if (!match) return { matches: false, summary: 'cloud-only chat ' + cloudId };
          // Compare message counts as a quick proxy for content drift.
          var cloudMsgs = cloudDoc.messages || (cloudDoc.data && cloudDoc.data.messages) || [];
          var localMsgs = match.messages || [];
          if (Math.abs((cloudMsgs.length || 0) - (localMsgs.length || 0)) > 1) {
            return { matches: false, summary: 'chat ' + cloudId + ' message-count drift ' + cloudMsgs.length + ' vs ' + localMsgs.length };
          }
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // v33.5: Read-shadow target: brands. Compares cloud brand docs to roweos_user_brands.
  function startReadShadowForBrands(uid) {
    if (!isEnabled() || !uid) return;
    var coll = getCollection('brands', {
      firestorePath: function(u){ return 'users/' + u + '/brands'; },
      localStorageKey: 'brilliance_v5_brands',
      schemaVersion: 1
    });
    coll._startReadShadow(uid, {
      compareV4: function(cloudDoc) {
        try {
          var raw = localStorage.getItem('roweos_user_brands');
          var local = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(local)) local = [];
          // Cloud brand docs use stable ID paths like brand_<name>_<idx> per v27.3.
          var cloudId = cloudDoc.id || (cloudDoc.data && cloudDoc.data.id);
          if (!cloudId || cloudId === '_all') return { matches: true };
          // Skip brand_ prefix when matching against local array (which uses index-based ids).
          var cloudName = cloudDoc.name || (cloudDoc.data && cloudDoc.data.name);
          if (!cloudName) return { matches: true };
          var match = null;
          for (var i = 0; i < local.length; i++) {
            if (local[i] && (local[i].name === cloudName || local[i].id === cloudId)) { match = local[i]; break; }
          }
          if (!match) return { matches: false, summary: 'cloud-only brand "' + cloudName + '"' };
          var cloudTs = cloudDoc._modifiedAt || 0;
          var localTs = match._modifiedAt || 0;
          if (cloudTs && localTs && Math.abs(cloudTs - localTs) > 10000) {
            return { matches: false, summary: 'brand "' + cloudName + '" timestamp drift' };
          }
          return { matches: true };
        } catch(e){ return { matches: true }; }
      }
    });
  }

  // Auto-start when feature flag is on AND firebaseUser becomes available.
  // Uses a polling fallback because firebaseUser is set async during auth.
  (function autoStart(){
    if (!isEnabled()) return;
    var attempts = 0;
    var iv = setInterval(function(){
      attempts++;
      try {
        if (typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.uid) {
          clearInterval(iv);
          startReadShadowForAutomations(firebaseUser.uid);
          startReadShadowForBrands(firebaseUser.uid);
          startReadShadowForConversations(firebaseUser.uid);
          startReadShadowForScribe(firebaseUser.uid);
          startReadShadowForReminders(firebaseUser.uid);
          startReadShadowForPulse(firebaseUser.uid);
          startReadShadowForLibrary(firebaseUser.uid);
          startReadShadowForMail(firebaseUser.uid);
          startReadShadowForJournal(firebaseUser.uid);
          startReadShadowForFolio(firebaseUser.uid);
        }
      } catch(e){}
      if (attempts > 60) clearInterval(iv); // give up after ~60s
    }, 1000);
  })();

  function getCollection(name, opts) {
    if (!collections[name]) collections[name] = new Collection(Object.assign({ name: name }, opts || {}));
    return collections[name];
  }

  // v34.67: Phase A #4 — one-time bootstrap that seeds v5 collection caches from
  // existing v4 localStorage keys. Runs once per device (gated by
  // roweos_sync_v5_bootstrap_done='true'). Without this, a fresh v5 cache has no
  // historical data and the 14-day discrepancy clock starts from a blank slate
  // which makes "zero discrepancies" trivially true.
  //
  // Strategy: for every v4 → v5 mapping, parse the v4 key, normalize each item
  // into the Synced<T> envelope, and write into the v5 collection's _items map +
  // localStorage. We do NOT touch Firestore here — bootstrap is local-only. Cloud
  // mirroring happens lazily as users perform writes (because the dual-write flag
  // is what gates cloud writes).
  //
  // Migrations are best-effort: a parse failure on one key never blocks others.
  function _toEnvelope(rawId, data, opts) {
    opts = opts || {};
    var modified = (data && (data._modifiedAt || data.updatedAt || data.modifiedAt)) || opts.fallbackTs || Date.now();
    var created  = (data && (data._createdAt  || data.createdAt))  || modified;
    if (typeof modified !== 'number') modified = new Date(modified).getTime() || Date.now();
    if (typeof created  !== 'number') created  = new Date(created ).getTime() || modified;
    return {
      id: String(rawId),
      data: data,
      _modifiedAt: modified,
      _createdAt: created,
      _deletedAt: (data && data._deletedAt) || null,
      _clientId: (data && data._clientId) || getClientId(),
      _schemaVersion: (data && data._schemaVersion) || (opts.schemaVersion || 1)
    };
  }

  // Map: { v4LocalStorageKey, v5Collection, idField, isList, isMap, singleDocId }
  // - isList: v4 value is a JSON array of items (each gets its own envelope by idField)
  // - isMap: v4 value is { docId: data } (each entry becomes one envelope)
  // - singleDocId: v4 value is a single object stored as one envelope
  var BOOTSTRAP_MAP = [
    // v34.105: actual storage key is 'roweos_user_brands' (per 22-firebase-sync.js).
    // 'roweos_brands' never existed; v5 brand bootstrap was reading null on every device.
    { lsKey: 'roweos_user_brands',      coll: 'brands_v5',         isList: true, idField: 'id', idFallback: function(b){ return 'brand_name_' + (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'); } },
    { lsKey: 'roweos_conversations',    coll: 'conversations_v5',  isList: true, idField: 'id' },
    { lsKey: 'roweos_automations',      coll: 'automations_v5',    isList: true, idField: 'id' },
    { lsKey: 'roweos_scribe_notebooks', coll: 'scribe_v5',         isList: true, idField: 'id' },
    { lsKey: 'roweos_reminders',        coll: 'reminders_v5',      isList: true, idField: 'id' },
    { lsKey: 'roweos_pulse_goals',      coll: 'pulse_v5',          isList: true, idField: 'id' },
    { lsKey: 'roweos_journal',          coll: 'journal_v5',        isList: true, idField: 'id' },
    { lsKey: 'roweos_mail_outbox',      coll: 'mail_v5',           isList: true, idField: 'id', idPrefix: 'outbox_' },
    { lsKey: 'roweos_mail_sent',        coll: 'mail_v5',           isList: true, idField: 'id', idPrefix: 'sent_' },
    { lsKey: 'roweos_folio',            coll: 'folio_v5',          singleDocId: 'main' },
    { lsKey: 'roweos_user',             coll: 'profile_main',      singleDocId: 'main' },
    { lsKey: 'roweos_user_contact',     coll: 'profile_userContact', singleDocId: 'main' },
    { lsKey: 'roweos_clients',          coll: 'profile_clients',   singleDocId: 'main' },
    { lsKey: 'roweos_inventory',        coll: 'profile_inventory', singleDocId: 'main' },
    { lsKey: 'roweos_people',           coll: 'profile_people',    singleDocId: 'main' },
    { lsKey: 'roweos_lifeai_profile',   coll: 'lifeAI',            singleDocId: 'main' }
  ];

  // Library is special — keys are roweos_brand_library_<idx> and roweos_life_library.
  function _bootstrapLibraries() {
    try {
      // Brand-side libraries: roweos_brand_library_0, _1, ...
      var brandColl = getCollection('library_brand_v5');
      if (brandColl && !brandColl._loaded) brandColl._loadLocal();
      for (var k = 0; k < localStorage.length; k++) {
        var key = localStorage.key(k);
        if (!key || key.indexOf('roweos_brand_library_') !== 0) continue;
        var idx = key.replace('roweos_brand_library_', '');
        try {
          var raw = JSON.parse(localStorage.getItem(key) || '{}');
          if (raw && typeof raw === 'object') {
            brandColl._items['brand_' + idx] = _toEnvelope('brand_' + idx, raw, { fallbackTs: Date.now() });
          }
        } catch(e){}
      }
      brandColl._persistLocal();

      // Life-side library: single key roweos_life_library
      try {
        var lifeRaw = localStorage.getItem('roweos_life_library');
        if (lifeRaw) {
          var lifeColl = getCollection('library_life_v5');
          if (lifeColl && !lifeColl._loaded) lifeColl._loadLocal();
          var lifeData = JSON.parse(lifeRaw);
          lifeColl._items['main'] = _toEnvelope('main', lifeData, { fallbackTs: Date.now() });
          lifeColl._persistLocal();
        }
      } catch(e){}
    } catch(e){
      if (window.ROWEOS_DEBUG) console.warn('[SyncV5 bootstrap] library:', e);
    }
  }

  function bootstrapFromV4() {
    try {
      if (localStorage.getItem('roweos_sync_v5_bootstrap_done') === 'true') return { skipped: true };
    } catch(e){}

    var seeded = {};
    var totalItems = 0;
    var startTs = Date.now();

    for (var i = 0; i < BOOTSTRAP_MAP.length; i++) {
      var m = BOOTSTRAP_MAP[i];
      try {
        var raw = localStorage.getItem(m.lsKey);
        if (!raw) continue;
        var coll = getCollection(m.coll);
        if (!coll) continue;
        if (!coll._loaded) coll._loadLocal();

        if (m.singleDocId) {
          // Single-doc collections (profile/main, folio, lifeAI, etc.)
          try {
            var data = JSON.parse(raw);
            if (data && typeof data === 'object') {
              coll._items[m.singleDocId] = _toEnvelope(m.singleDocId, data, { fallbackTs: startTs });
              totalItems++;
              seeded[m.coll] = (seeded[m.coll] || 0) + 1;
            }
          } catch(eS) {
            if (window.ROWEOS_DEBUG) console.warn('[SyncV5 bootstrap]', m.lsKey, 'parse:', eS && eS.message);
          }
        } else if (m.isList) {
          var arr = [];
          try {
            var parsed = JSON.parse(raw);
            arr = Array.isArray(parsed) ? parsed : [];
          } catch(eP) {
            if (window.ROWEOS_DEBUG) console.warn('[SyncV5 bootstrap]', m.lsKey, 'parse:', eP && eP.message);
            continue;
          }
          for (var j = 0; j < arr.length; j++) {
            var item = arr[j];
            if (!item || typeof item !== 'object') continue;
            var rawId = item[m.idField];
            if (!rawId && typeof m.idFallback === 'function') {
              try { rawId = m.idFallback(item); } catch(e){}
            }
            if (!rawId) rawId = uuid();
            if (m.idPrefix) rawId = m.idPrefix + rawId;
            // Don't clobber an existing v5 envelope with a stale v4 copy.
            if (coll._items[rawId] && coll._items[rawId]._modifiedAt > (item._modifiedAt || 0)) continue;
            coll._items[rawId] = _toEnvelope(rawId, item, { fallbackTs: startTs });
            totalItems++;
          }
          seeded[m.coll] = (seeded[m.coll] || 0) + arr.length;
        }
        coll._persistLocal();
      } catch(eM) {
        if (window.ROWEOS_DEBUG) console.warn('[SyncV5 bootstrap]', m.lsKey, eM && eM.message);
      }
    }

    _bootstrapLibraries();

    try { localStorage.setItem('roweos_sync_v5_bootstrap_done', 'true'); } catch(e){}
    try { localStorage.setItem('roweos_sync_v5_bootstrap_at', String(startTs)); } catch(e){}
    if (window.ROWEOS_DEBUG) console.log('[SyncV5 bootstrap] seeded', totalItems, 'items in', Object.keys(seeded).length, 'collections');
    return { skipped: false, totalItems: totalItems, perCollection: seeded, ms: Date.now() - startTs };
  }

  // Run bootstrap on module init when read-shadow is enabled. Safe to run on
  // every page load — the gate (`roweos_sync_v5_bootstrap_done`) prevents re-runs.
  // Defer briefly so localStorage / IndexedDB shim has hydrated.
  setTimeout(function(){
    try {
      if (isEnabled()) bootstrapFromV4();
    } catch(e){}
  }, 1500);

  // v34.68: Phase B clock + Phase C cohort-of-one auto-activation for the admin.
  // Per spec migration §Phase C: "Flip a server-side flag (sync_v5_reads_enabled)
  // for one user (Jordan) first. Reads now come from v5 paths." Without a real
  // server flag, we use a client-side admin-UID gate that flips all four flags
  // ON the first time the admin lands on a device. Starts the Phase B 14-day
  // discrepancy clock + the Phase C 7-day Jordan-cohort window simultaneously.
  // For non-admin users this auto-activation is a no-op; they remain on v4 until
  // the explicit 10% / 100% rollout deploys land.
  var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
  var V5_AUTO_ACTIVATE_KEY = 'roweos_sync_v5_admin_auto_activated';
  function _maybeAutoActivateForAdmin() {
    try {
      if (typeof firebaseUser === 'undefined' || !firebaseUser) return;
      if (firebaseUser.uid !== ADMIN_UID) return;
      if (localStorage.getItem(V5_AUTO_ACTIVATE_KEY) === 'true') return;
      // Flip all four flags ON. setEnabled triggers listener wiring; the others
      // just persist localStorage so writeDB / mirrorV4Write / readArray respect them.
      setEnabled(true);
      setWritesEnabled(true);
      setDualWriteEnabled(true);
      setReadsEnabled(true);
      // Stamp the activation timestamp so we know exactly when the Phase B clock
      // started — useful for the 14-day zero-discrepancy gate.
      localStorage.setItem(V5_AUTO_ACTIVATE_KEY, 'true');
      localStorage.setItem('roweos_sync_v5_phase_b_clock_started', String(Date.now()));
      if (window.ROWEOS_DEBUG) console.log('[SyncV5] v34.68 admin auto-activate: all four flags ON. Phase B clock started.');
    } catch (e) {
      if (window.ROWEOS_DEBUG) console.warn('[SyncV5 auto-activate]', e && e.message);
    }
  }
  // Poll for firebaseUser to be set (auth resolves async). Cap at ~60s.
  (function _autoActivatePoll(){
    var attempts = 0;
    var iv = setInterval(function(){
      attempts++;
      try {
        if (typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.uid) {
          clearInterval(iv);
          _maybeAutoActivateForAdmin();
        }
      } catch(e){}
      if (attempts > 60) clearInterval(iv);
    }, 1000);
  })();

  // v34.67: Phase A #1 — register every v4-shadowed collection with an explicit
  // spec (firestorePath, localStorageKey, schemaVersion). Before this, mirrorV4Write
  // auto-created passive collections at first call with default paths, which made
  // it impossible to (a) seed bootstrap data into a known cache shape and (b) have
  // a single source of truth for what v5 collections exist. With this registry,
  // every read site, audit Function, and bootstrap migration uses the same names.
  var V5_REGISTRY = [
    // v4-shadowed app collections
    { name: 'brands_v5',         path: function(uid){ return 'roweos_users/' + uid + '/brands_v5'; },         lsKey: 'brilliance_v5_brands',         schemaVersion: 1 },
    { name: 'conversations_v5',  path: function(uid){ return 'roweos_users/' + uid + '/conversations_v5'; },  lsKey: 'brilliance_v5_conversations',  schemaVersion: 1 },
    { name: 'automations_v5',    path: function(uid){ return 'roweos_users/' + uid + '/automations_v5'; },    lsKey: 'brilliance_v5_automations',    schemaVersion: 1 },
    { name: 'scribe_v5',         path: function(uid){ return 'roweos_users/' + uid + '/scribe_v5'; },         lsKey: 'brilliance_v5_scribe',         schemaVersion: 1 },
    { name: 'reminders_v5',      path: function(uid){ return 'roweos_users/' + uid + '/reminders_v5'; },      lsKey: 'brilliance_v5_reminders',      schemaVersion: 1 },
    { name: 'pulse_v5',          path: function(uid){ return 'roweos_users/' + uid + '/pulse_v5'; },          lsKey: 'brilliance_v5_pulse',          schemaVersion: 1 },
    { name: 'library_brand_v5',  path: function(uid){ return 'roweos_users/' + uid + '/library_brand_v5'; },  lsKey: 'brilliance_v5_library_brand',  schemaVersion: 1 },
    { name: 'library_life_v5',   path: function(uid){ return 'roweos_users/' + uid + '/library_life_v5'; },   lsKey: 'brilliance_v5_library_life',   schemaVersion: 1 },
    { name: 'mail_v5',           path: function(uid){ return 'roweos_users/' + uid + '/mail_v5'; },           lsKey: 'brilliance_v5_mail',           schemaVersion: 1 },
    { name: 'journal_v5',        path: function(uid){ return 'roweos_users/' + uid + '/journal_v5'; },        lsKey: 'brilliance_v5_journal',        schemaVersion: 1 },
    { name: 'folio_v5',          path: function(uid){ return 'roweos_users/' + uid + '/folio_v5'; },          lsKey: 'brilliance_v5_folio',          schemaVersion: 1 },
    // profile/* sub-docs (single-doc collections, mirroring writeDB('profile/X'))
    { name: 'profile_main',                path: function(uid){ return 'roweos_users/' + uid + '/profile_main'; },                lsKey: 'brilliance_v5_profile_main',                schemaVersion: 1 },
    { name: 'profile_userContact',         path: function(uid){ return 'roweos_users/' + uid + '/profile_userContact'; },         lsKey: 'brilliance_v5_profile_userContact',         schemaVersion: 1 },
    { name: 'profile_customAgents',        path: function(uid){ return 'roweos_users/' + uid + '/profile_customAgents'; },        lsKey: 'brilliance_v5_profile_customAgents',        schemaVersion: 1 },
    { name: 'profile_customOps',           path: function(uid){ return 'roweos_users/' + uid + '/profile_customOps'; },           lsKey: 'brilliance_v5_profile_customOps',           schemaVersion: 1 },
    { name: 'profile_clients',             path: function(uid){ return 'roweos_users/' + uid + '/profile_clients'; },             lsKey: 'brilliance_v5_profile_clients',             schemaVersion: 1 },
    { name: 'profile_socialPosts',         path: function(uid){ return 'roweos_users/' + uid + '/profile_socialPosts'; },         lsKey: 'brilliance_v5_profile_socialPosts',         schemaVersion: 1 },
    { name: 'profile_socialWorkflows',     path: function(uid){ return 'roweos_users/' + uid + '/profile_socialWorkflows'; },     lsKey: 'brilliance_v5_profile_socialWorkflows',     schemaVersion: 1 },
    { name: 'profile_notifications',       path: function(uid){ return 'roweos_users/' + uid + '/profile_notifications'; },       lsKey: 'brilliance_v5_profile_notifications',       schemaVersion: 1 },
    { name: 'profile_researchHistory',     path: function(uid){ return 'roweos_users/' + uid + '/profile_researchHistory'; },     lsKey: 'brilliance_v5_profile_researchHistory',     schemaVersion: 1 },
    { name: 'profile_mail',                path: function(uid){ return 'roweos_users/' + uid + '/profile_mail'; },                lsKey: 'brilliance_v5_profile_mail',                schemaVersion: 1 },
    { name: 'profile_people',              path: function(uid){ return 'roweos_users/' + uid + '/profile_people'; },              lsKey: 'brilliance_v5_profile_people',              schemaVersion: 1 },
    { name: 'profile_reminders',           path: function(uid){ return 'roweos_users/' + uid + '/profile_reminders'; },           lsKey: 'brilliance_v5_profile_reminders',           schemaVersion: 1 },
    { name: 'profile_inventory',           path: function(uid){ return 'roweos_users/' + uid + '/profile_inventory'; },           lsKey: 'brilliance_v5_profile_inventory',           schemaVersion: 1 },
    { name: 'profile_generatedBrandOps',   path: function(uid){ return 'roweos_users/' + uid + '/profile_generatedBrandOps'; },   lsKey: 'brilliance_v5_profile_generatedBrandOps',   schemaVersion: 1 },
    { name: 'lifeAI',                      path: function(uid){ return 'roweos_users/' + uid + '/lifeAI_v5'; },                   lsKey: 'brilliance_v5_lifeAI',                       schemaVersion: 1 }
  ];
  // Register every spec at module init so bootstrap, audit, and reads see one
  // canonical Collection per name.
  for (var _ri = 0; _ri < V5_REGISTRY.length; _ri++) {
    var _r = V5_REGISTRY[_ri];
    getCollection(_r.name, { firestorePath: _r.path, localStorageKey: _r.lsKey, schemaVersion: _r.schemaVersion });
  }

  return {
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    writesEnabled: writesEnabled,
    setWritesEnabled: setWritesEnabled,
    dualWriteEnabled: dualWriteEnabled,
    setDualWriteEnabled: setDualWriteEnabled,
    readsEnabled: readsEnabled,
    setReadsEnabled: setReadsEnabled,
    v4Retired: v4Retired,
    setV4Retired: setV4Retired,
    mirrorV4Write: mirrorV4Write,
    // v34.67: Phase C #9 — read-site facade. Every legacy read of a v4-shadowed
    // collection should go through these. When readsEnabled() is OFF, v4Reader()
    // is called and its result returned unchanged (zero behavior change vs today).
    // When ON, the v5 collection is consulted and items are unwrapped from their
    // Synced<T> envelopes back to plain v4-shape so callers don't need to know.
    //
    // Usage:
    //   var brands = SyncV5.readArray('brands_v5', function(){
    //     return JSON.parse(localStorage.getItem('roweos_brands') || '[]');
    //   });
    //
    // Returns whatever v4Reader returns. Helper exists ONLY to give us a binary
    // cutover gate for the rollout.
    readArray: function readArray(collName, v4Reader) {
      if (!readsEnabled()) return (typeof v4Reader === 'function') ? v4Reader() : [];
      try {
        var coll = collections[collName];
        if (!coll) return (typeof v4Reader === 'function') ? v4Reader() : [];
        if (!coll._loaded) coll._loadLocal();
        var out = [];
        for (var k in coll._items) {
          if (!Object.prototype.hasOwnProperty.call(coll._items, k)) continue;
          var env = coll._items[k];
          if (!env || env._deletedAt) continue;
          // Unwrap: callers expect the plain v4 shape, not the envelope.
          out.push((env.data && typeof env.data === 'object') ? env.data : env);
        }
        return out;
      } catch (e) {
        if (window.ROWEOS_DEBUG) console.warn('[SyncV5 readArray]', collName, e.message);
        return (typeof v4Reader === 'function') ? v4Reader() : [];
      }
    },
    // For single-doc collections (profile/main, lifeAI, folio, etc.)
    readDoc: function readDoc(collName, docId, v4Reader) {
      if (!readsEnabled()) return (typeof v4Reader === 'function') ? v4Reader() : null;
      try {
        var coll = collections[collName];
        if (!coll) return (typeof v4Reader === 'function') ? v4Reader() : null;
        if (!coll._loaded) coll._loadLocal();
        var env = coll._items[docId || 'main'];
        if (!env || env._deletedAt) return (typeof v4Reader === 'function') ? v4Reader() : null;
        return (env.data && typeof env.data === 'object') ? env.data : env;
      } catch (e) {
        if (window.ROWEOS_DEBUG) console.warn('[SyncV5 readDoc]', collName, e.message);
        return (typeof v4Reader === 'function') ? v4Reader() : null;
      }
    },
    bootstrapFromV4: bootstrapFromV4,
    resetStats: resetStats,
    clearLocalCache: clearLocalCache,
    isV5NativeCollection: isV5NativeCollection,
    collection: getCollection,
    resolveConflict: resolveConflict,
    envelope: envelope,
    getStats: getStats,
    subscribeStats: subscribeStats,
    startReadShadowForAutomations: startReadShadowForAutomations,
    startReadShadowForBrands: startReadShadowForBrands,
    startReadShadowForConversations: startReadShadowForConversations,
    startReadShadowForScribe: startReadShadowForScribe,
    startReadShadowForReminders: startReadShadowForReminders,
    startReadShadowForPulse: startReadShadowForPulse,
    startReadShadowForLibrary: startReadShadowForLibrary,
    startReadShadowForMail: startReadShadowForMail,
    startReadShadowForJournal: startReadShadowForJournal,
    startReadShadowForFolio: startReadShadowForFolio,
    _uuid: uuid,
    _clientId: getClientId
  };
})();

window.SyncV5 = SyncV5;

// v34.67: Phase B #6 — Sync v5 Audit dashboard.
// Reads sync_v5_audit/{uid}/discrepancies (admin sees all users via collectionGroup;
// regular users see only their own row). Shows the most recent run summary, a per-
// collection rollup of unresolved discrepancies, and an "ack" button per row.
//
// Wired to the Settings → Sync v5 panel via a "View audit" button that opens this.
window.openSyncV5AuditPanel = function openSyncV5AuditPanel() {
  var existing = document.getElementById('syncV5AuditOverlay');
  if (existing) existing.parentNode.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'syncV5AuditOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Sync v5 audit');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
  overlay.onclick = function(e){ if (e.target === overlay) _close(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:720px;width:92%;max-height:88vh;overflow:auto;background:#0f0f0f;border:1px solid rgba(201,181,122,0.22);border-radius:14px;padding:32px;color:#f5ecd9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px rgba(0,0,0,0.6);';
  modal.innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
      '<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="position:absolute;inset:-6px;background:radial-gradient(circle,rgba(201,169,97,0.22) 0%,rgba(201,169,97,0) 70%);border-radius:50%;"></div>' +
        '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#c9a961" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a961;font-weight:500;">Sync v5</div>' +
        '<div style="font-size:22px;font-weight:600;letter-spacing:-0.01em;">Audit dashboard</div>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:18px;line-height:1.5;">Daily Cloud Function (<code>runSyncV5Audit</code>) compares v4 docs against v5 envelopes and logs discrepancies here. The 14-day zero-discrepancy bar is the gate to enable v5 reads.</div>' +
    '<div id="syncV5AuditMeta" style="font-size:13px;padding:12px 14px;border:1px solid rgba(201,169,97,0.18);border-radius:10px;background:rgba(201,169,97,0.04);margin-bottom:14px;">Loading latest run…</div>' +
    '<div id="syncV5AuditRollup" style="margin-bottom:14px;"></div>' +
    '<div id="syncV5AuditRows" style="font-size:12px;"></div>' +
    '<div style="margin-top:18px;display:flex;justify-content:flex-end;gap:8px;">' +
      '<button id="syncV5AuditCloseBtn" style="padding:9px 20px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Close</button>' +
    '</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.style.opacity = '1'; }, 16);

  function _close() {
    overlay.style.opacity = '0';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    document.removeEventListener('keydown', escFn);
  }
  function escFn(e) { if (e.key === 'Escape') _close(); }
  document.addEventListener('keydown', escFn);
  document.getElementById('syncV5AuditCloseBtn').onclick = _close;

  // Load data
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    document.getElementById('syncV5AuditMeta').textContent = 'Firebase not loaded.';
    return;
  }
  var db = firebase.firestore();
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : null;
  var iAmAdmin = (typeof isAdmin === 'function') ? isAdmin() : false;

  // Latest run meta
  db.collection('sync_v5_audit').doc('_meta').collection('runs').orderBy('ranAt', 'desc').limit(1).get().then(function(snap) {
    var metaEl = document.getElementById('syncV5AuditMeta');
    if (!metaEl) return;
    if (snap.empty) {
      metaEl.textContent = 'No audit runs yet. The Cloud Function runs every 24 hours.';
      return;
    }
    var d = snap.docs[0].data() || {};
    var when = d.ranAt && d.ranAt.toDate ? d.ranAt.toDate().toLocaleString() : 'unknown';
    metaEl.innerHTML = '<strong>Last run:</strong> ' + when + ' &nbsp; · &nbsp; <strong>Users audited:</strong> ' + (d.totalUsersAudited || 0) + ' &nbsp; · &nbsp; <strong>Discrepancies:</strong> ' + (d.totalDiscrepancies || 0);
  }, function(err){
    document.getElementById('syncV5AuditMeta').textContent = 'Latest run failed: ' + (err && err.message);
  });

  // Discrepancy list — admins see all users, regular users see only own.
  var query;
  if (iAmAdmin) {
    query = db.collectionGroup('discrepancies').orderBy('detectedAt', 'desc').limit(100).get();
  } else if (uid) {
    query = db.collection('sync_v5_audit').doc(uid).collection('discrepancies').orderBy('detectedAt', 'desc').limit(100).get();
  } else {
    document.getElementById('syncV5AuditRows').textContent = 'Sign in to view audit data.';
    return;
  }

  query.then(function(snap) {
    var rowsEl = document.getElementById('syncV5AuditRows');
    var rollupEl = document.getElementById('syncV5AuditRollup');
    if (!rowsEl || !rollupEl) return;
    if (snap.empty) {
      rowsEl.innerHTML = '<div style="color:rgba(245,236,217,0.5);padding:14px;border:1px dashed rgba(255,255,255,0.10);border-radius:8px;">No discrepancies recorded. The 14-day clean clock keeps ticking.</div>';
      return;
    }
    var byColl = {};
    var rowsHtml = '<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(245,236,217,0.5);margin-bottom:8px;">Recent discrepancies</div>';
    var docs = snap.docs;
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i].data() || {};
      var coll = d.collection || '(unknown)';
      byColl[coll] = (byColl[coll] || 0) + 1;
      var when = d.detectedAt && d.detectedAt.toDate ? d.detectedAt.toDate().toLocaleString() : 'pending';
      rowsHtml += '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
        '<div><strong style="color:#c9a961;">' + coll + '</strong> · <span style="opacity:0.7;">' + (d.docId || '') + '</span></div>' +
        '<div style="opacity:0.6;font-size:11px;">' + (d.kind || '') + ' · ' + when + '</div>' +
      '</div>';
    }
    rowsEl.innerHTML = rowsHtml;

    var rollupHtml = '<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(245,236,217,0.5);margin-bottom:8px;">By collection</div>';
    rollupHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">';
    for (var k in byColl) {
      if (!Object.prototype.hasOwnProperty.call(byColl, k)) continue;
      rollupHtml += '<div style="border:1px solid rgba(201,169,97,0.18);border-radius:8px;padding:10px 12px;background:rgba(201,169,97,0.04);">' +
        '<div style="font-size:11px;color:rgba(245,236,217,0.6);">' + k + '</div>' +
        '<div style="font-size:18px;font-weight:600;font-family:Georgia,serif;color:#c9a961;">' + byColl[k] + '</div>' +
      '</div>';
    }
    rollupHtml += '</div>';
    rollupEl.innerHTML = rollupHtml;
  }, function(err){
    document.getElementById('syncV5AuditRows').textContent = 'Audit query failed: ' + (err && err.message);
  });
};

// v33.2: Settings panel for Sync v5.
window.openSyncV5Panel = function openSyncV5Panel() {
  var existing = document.getElementById('syncV5PanelOverlay');
  if (existing) existing.parentNode.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'syncV5PanelOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:99000;';
  overlay.onclick = function(e){ if (e.target === overlay) close(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:560px;width:92%;background:#0f0f0f;border:1px solid rgba(201,181,122,0.18);border-radius:14px;padding:24px;color:#f5ecd9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
  modal.innerHTML =
    '<div style="font-size:18px;font-weight:600;margin-bottom:6px;">Sync v5 (Preview)</div>' +
    '<div style="font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:18px;line-height:1.5;">Continuous, timestamp-based, type-safe. Currently in <strong>read-shadow</strong> mode: listens to Firestore but does not write. Real dual-write activates after 14 consecutive zero-discrepancy days.</div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(255,255,255,0.02);margin-bottom:10px;">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:600;">Read-shadow</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;">Listens; never writes. Safe to enable.</div>' +
      '</div>' +
      '<button id="syncV5ToggleBtn" style="padding:8px 18px;border-radius:8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(201,181,122,0.5);background:rgba(201,181,122,0.10);color:#f5e6c8;">Loading…</button>' +
    '</div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px;border:1px solid rgba(255,150,150,0.18);border-radius:10px;background:rgba(255,150,150,0.03);margin-bottom:10px;">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:600;">Cloud writes <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,180,180,0.85);background:rgba(239,83,80,0.12);padding:2px 8px;border-radius:99px;margin-left:6px;">Preview</span></div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;">v5-native only (evolve_*). V4-shadowed collections stay v4-authoritative.</div>' +
      '</div>' +
      '<button id="syncV5WritesToggleBtn" style="padding:8px 18px;border-radius:8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(255,180,180,0.4);background:rgba(255,180,180,0.06);color:#ffb8b8;">Loading…</button>' +
    '</div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px;border:1px solid rgba(239,83,80,0.22);border-radius:10px;background:rgba(239,83,80,0.04);margin-bottom:14px;">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:600;">Dual-write <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#ef5350;background:rgba(239,83,80,0.18);padding:2px 8px;border-radius:99px;margin-left:6px;">v34</span></div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;">Mirrors every v4 write into v5 collections. Requires the two flags above. Per spec, only flip after 14 days zero-discrepancy.</div>' +
      '</div>' +
      '<button id="syncV5DualWriteToggleBtn" style="padding:8px 18px;border-radius:8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(239,83,80,0.4);background:rgba(239,83,80,0.06);color:#ef5350;">Loading…</button>' +
    '</div>' +
    '<div id="syncV5StatsBlock" style="font-size:13px;line-height:1.7;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin-bottom:14px;"></div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,0.35);line-height:1.6;">Discrepancies are differences between v5 read-shadow and v4 source-of-truth, not data loss. They mark places v34 dual-write will need careful migration. See <code style="color:rgba(201,169,97,0.65);">docs/brilliance/16-sync-v5.md</code>.</div>' +
    '<div style="margin-top:18px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button id="syncV5ResetBtn" style="padding:9px 16px;background:transparent;border:1px solid rgba(255,180,180,0.3);border-radius:8px;color:rgba(255,180,180,0.8);font-size:12px;cursor:pointer;">Reset stats</button>' +
        '<button id="syncV5ExportBtn" style="padding:9px 16px;background:transparent;border:1px solid rgba(201,181,122,0.3);border-radius:8px;color:#c9b57a;font-size:12px;cursor:pointer;">Export stats</button>' +
        '<button id="syncV5ClearCacheBtn" style="padding:9px 16px;background:transparent;border:1px solid rgba(255,80,80,0.4);border-radius:8px;color:rgba(255,150,150,0.85);font-size:12px;cursor:pointer;">Clear cache</button>' +
        '<button id="syncV5AuditBtn" style="padding:9px 16px;background:transparent;border:1px solid rgba(201,181,122,0.4);border-radius:8px;color:#c9a961;font-size:12px;cursor:pointer;font-weight:500;">View audit</button>' +
      '</div>' +
      '<button id="syncV5CloseBtn" style="padding:9px 18px;background:transparent;border:1px solid rgba(201,181,122,0.3);border-radius:8px;color:#c9b57a;font-size:13px;cursor:pointer;">Done</button>' +
    '</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); if (typeof unsubStats === 'function') unsubStats(); }
  modal.querySelector('#syncV5CloseBtn').onclick = close;
  var resetBtn = modal.querySelector('#syncV5ResetBtn');
  if (resetBtn) {
    resetBtn.onclick = function(){
      SyncV5.resetStats();
    };
  }
  var clearCacheBtn = modal.querySelector('#syncV5ClearCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.onclick = function(){
      if (!confirm('Clear all v5 local cache? This removes brilliance_v5_* localStorage keys. Cloud data is unaffected; the read-shadow will repopulate on next event.')) return;
      var n = SyncV5.clearLocalCache();
      if (typeof showToast === 'function') showToast('Cleared ' + n + ' cache entries', 'success');
    };
  }
  // v34.67: Audit dashboard hook
  var auditBtn = modal.querySelector('#syncV5AuditBtn');
  if (auditBtn) {
    auditBtn.onclick = function(){
      try { close(); } catch(e){}
      if (typeof window.openSyncV5AuditPanel === 'function') window.openSyncV5AuditPanel();
    };
  }
  var exportBtn = modal.querySelector('#syncV5ExportBtn');
  if (exportBtn) {
    exportBtn.onclick = function(){
      try {
        var snapshot = SyncV5.getStats();
        var blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'brilliance-syncv5-stats-' + ts + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 100);
      } catch(e){
        if (typeof showToast === 'function') showToast('Export failed: ' + (e.message || e), 'error');
      }
    };
  }

  var toggleBtn = modal.querySelector('#syncV5ToggleBtn');
  var writesBtn = modal.querySelector('#syncV5WritesToggleBtn');
  var dualBtn = modal.querySelector('#syncV5DualWriteToggleBtn');
  function paint(stats) {
    var on = stats.enabled;
    toggleBtn.textContent = on ? 'Disable' : 'Enable';
    toggleBtn.style.background = on ? 'rgba(255,80,80,0.10)' : 'rgba(201,181,122,0.10)';
    toggleBtn.style.color = on ? 'rgba(255,150,150,0.9)' : '#f5e6c8';
    toggleBtn.style.borderColor = on ? 'rgba(255,80,80,0.4)' : 'rgba(201,181,122,0.5)';

    var writesOn = stats.writesEnabled;
    if (writesBtn) {
      writesBtn.textContent = writesOn ? 'Disable' : 'Enable';
      writesBtn.disabled = !on;
      writesBtn.style.opacity = on ? '1' : '0.4';
      writesBtn.style.cursor = on ? 'pointer' : 'not-allowed';
      writesBtn.style.background = writesOn ? 'rgba(74,222,128,0.10)' : 'rgba(255,180,180,0.06)';
      writesBtn.style.color = writesOn ? '#4ade80' : '#ffb8b8';
      writesBtn.style.borderColor = writesOn ? 'rgba(74,222,128,0.4)' : 'rgba(255,180,180,0.4)';
    }

    var dualOn = stats.dualWriteEnabled;
    var dualReady = on && writesOn;
    if (dualBtn) {
      dualBtn.textContent = dualOn ? 'Disable' : 'Enable';
      dualBtn.disabled = !dualReady;
      dualBtn.style.opacity = dualReady ? '1' : '0.4';
      dualBtn.style.cursor = dualReady ? 'pointer' : 'not-allowed';
      dualBtn.style.background = dualOn ? 'rgba(74,222,128,0.10)' : 'rgba(239,83,80,0.06)';
      dualBtn.style.color = dualOn ? '#4ade80' : '#ef5350';
      dualBtn.style.borderColor = dualOn ? 'rgba(74,222,128,0.4)' : 'rgba(239,83,80,0.4)';
    }

    var lastEvent = stats.lastEventAt ? new Date(stats.lastEventAt).toLocaleString() : 'never';
    var lastDisc  = stats.lastDiscrepancyAt ? new Date(stats.lastDiscrepancyAt).toLocaleString() : 'never';
    var lastDual = stats.lastDualWriteAt ? new Date(stats.lastDualWriteAt).toLocaleString() : 'never';
    var statsHtml =
      '<div><strong style="color:#c9b57a;">Status</strong> · ' + (on ? (stats.started ? 'running' : 'idle (waiting on auth)') : 'off') + '</div>' +
      '<div><strong style="color:#c9b57a;">Active collections</strong> · ' + (stats.activeCollections.length ? stats.activeCollections.join(', ') : 'none') + '</div>' +
      '<div><strong style="color:#c9b57a;">Events seen</strong> · ' + stats.eventsSeen + '</div>' +
      '<div><strong style="color:#c9b57a;">Discrepancies</strong> · ' + stats.discrepancies + (stats.discrepancies > 0 ? ' <span style="color:rgba(255,150,150,0.85);">(open dev tools to inspect)</span>' : '') + '</div>' +
      '<div><strong style="color:#c9b57a;">Last event</strong> · ' + lastEvent + '</div>' +
      '<div><strong style="color:#c9b57a;">Last discrepancy</strong> · ' + lastDisc + '</div>' +
      (stats.dualWriteEnabled || stats.dualWrites > 0
        ? '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);">' +
          '<div><strong style="color:#c9b57a;">Dual-writes</strong> · ' + stats.dualWrites + (stats.dualWriteErrors > 0 ? ' <span style="color:#ef5350;">(' + stats.dualWriteErrors + ' errors)</span>' : '') + '</div>' +
          '<div><strong style="color:#c9b57a;">Last dual-write</strong> · ' + lastDual + '</div>' +
        '</div>'
        : '') +
      (stats.lastError ? '<div style="margin-top:8px;color:rgba(255,150,150,0.85);"><strong>Last error</strong> · ' + stats.lastError + '</div>' : '');
    // v33.10: Per-collection breakdown.
    var perRows = '';
    for (var name in stats.perCollection) {
      if (!Object.prototype.hasOwnProperty.call(stats.perCollection, name)) continue;
      var p = stats.perCollection[name];
      perRows += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;">' +
        '<span style="color:rgba(255,255,255,0.65);"><code style="color:#c9b57a;">' + name + '</code></span>' +
        '<span style="color:rgba(255,255,255,0.55);font-family:\'JetBrains Mono\',monospace;">' + p.events + ' events · <span style="color:' + (p.discrepancies > 0 ? '#ef5350' : 'rgba(255,255,255,0.4)') + ';">' + p.discrepancies + ' diff</span></span>' +
      '</div>';
    }
    if (perRows) {
      statsHtml += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">' +
        '<div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#c9b57a;margin-bottom:8px;font-weight:500;">Per-collection</div>' +
        perRows +
      '</div>';
    }
    // v33.15: Recent events log.
    var eventsRows = '';
    if (stats.recentEvents && stats.recentEvents.length) {
      for (var ei = 0; ei < stats.recentEvents.length; ei++) {
        var e = stats.recentEvents[ei];
        var when = new Date(e.at).toLocaleTimeString();
        eventsRows += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px;font-family:\'JetBrains Mono\',monospace;">' +
          '<span style="color:rgba(255,255,255,0.55);"><code style="color:#c9b57a;">' + e.collection + '</code> · ' + e.action + '</span>' +
          '<span style="color:rgba(255,255,255,0.4);">' + when + '</span>' +
        '</div>';
      }
    }
    if (eventsRows) {
      statsHtml += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">' +
        '<div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#c9b57a;margin-bottom:8px;font-weight:500;">Recent events</div>' +
        eventsRows +
      '</div>';
    }
    modal.querySelector('#syncV5StatsBlock').innerHTML = statsHtml;

    var rowLabel = document.getElementById('syncV5StateText');
    if (rowLabel) rowLabel.textContent = on ? (stats.started ? 'On' : 'Pending') : 'Off';
  }

  toggleBtn.onclick = function(){
    var s = SyncV5.getStats();
    SyncV5.setEnabled(!s.enabled);
    if (!s.enabled) {
      // Just enabled — also enable debug for first-time testers.
      try { localStorage.setItem('roweos_debug', 'true'); window.ROWEOS_DEBUG = true; } catch(e){}
    }
  };
  if (writesBtn) {
    writesBtn.onclick = function(){
      var s = SyncV5.getStats();
      if (!s.enabled) return;
      SyncV5.setWritesEnabled(!s.writesEnabled);
    };
  }
  if (dualBtn) {
    dualBtn.onclick = function(){
      var s = SyncV5.getStats();
      if (!s.enabled || !s.writesEnabled) return;
      // First-time enable confirmation. v34 spec requires 14 days zero-discrepancy first.
      if (!s.dualWriteEnabled) {
        var confirmMsg = 'Enable dual-write?\n\n' +
          'This mirrors every v4 write into a v5 collection. Per the v34 spec, you should only flip this on after the read-shadow has run zero-discrepancy for 14 consecutive days.\n\n' +
          'Currently: ' + s.discrepancies + ' discrepancies seen.\n\n' +
          'Continue?';
        if (!confirm(confirmMsg)) return;
      }
      SyncV5.setDualWriteEnabled(!s.dualWriteEnabled);
    };
  }

  var unsubStats = SyncV5.subscribeStats(paint);
  paint(SyncV5.getStats());
};

// v33.17: Cmd/Ctrl+Shift+S opens the Sync v5 panel from anywhere.
(function syncV5HotkeyInit(){
  function handler(e){
    if (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
      // Don't fire when user is in a textarea/input and trying to save.
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      try { if (typeof window.openSyncV5Panel === 'function') window.openSyncV5Panel(); } catch(err){}
    }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    document.addEventListener('keydown', handler);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ document.addEventListener('keydown', handler); });
  }
})();

// Sync the row label on init.
(function syncV5RowLabelInit(){
  function paint(){
    try {
      var s = SyncV5.getStats();
      var el = document.getElementById('syncV5StateText');
      if (el) el.textContent = s.enabled ? (s.started ? 'On' : 'Pending') : 'Off';
    } catch(e){}
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(paint, 0);
  else document.addEventListener('DOMContentLoaded', paint);
  SyncV5.subscribeStats(paint);
})();
