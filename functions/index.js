/**
 * RoweOS Cloud Functions — Entry Point
 * v19.1: Background scheduled task execution
 * v19.5: Added post, image, pipeline support (Phase 2 & 3)
 *
 * Functions:
 *   runScheduledTasks — Runs every 5 minutes via Cloud Scheduler
 *   runTaskNow — onCall for manual/testing trigger
 */

var admin = require('firebase-admin');
var functions = require('firebase-functions/v2');

// v25.4: Lazy init — avoid timeout during deployment analysis
var _adminInitialized = false;
function ensureInit() {
  if (!_adminInitialized) {
    admin.initializeApp();
    _adminInitialized = true;
  }
}

// v25.4: Lazy require — modules loaded on first invocation, not at deploy time
var _scheduler, _executor, _scavenger, _helpers;
function getScheduler() { if (!_scheduler) _scheduler = require('./lib/scheduler'); return _scheduler; }
function getExecutor() { if (!_executor) _executor = require('./lib/executor'); return _executor; }
function getScavenger() { if (!_scavenger) _scavenger = require('./lib/scavenger'); return _scavenger; }
function getHelpers() { if (!_helpers) _helpers = require('./lib/firestore-helpers'); return _helpers; }

/**
 * Scheduled function: runs every 5 minutes
 * Checks all opted-in users for due automations and executes them
 */
exports.runScheduledTasks = functions.scheduler.onSchedule(
  {
    schedule: 'every 5 minutes',
    timeoutSeconds: 300,
    memory: '512MiB',
    region: 'us-central1'
  },
  async function(event) {
    ensureInit();
    var scheduler = getScheduler();
    var executor = getExecutor();
    var helpers = getHelpers();
    var scavenger = getScavenger();

    console.log('[Cloud Scheduler] Tick at', new Date().toISOString());

    try {
      var users = await scheduler.getEnabledUsers();
      console.log('[Cloud Scheduler] Found', users.length, 'enabled users');

      var totalExecuted = 0;

      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        try {
          var settings = await helpers.getUserSettings(user.uid);
          var timezone = settings.timezone || 'America/Chicago';
          var dueTasks = await scheduler.getDueTasks(user.uid, timezone);

          if (dueTasks.length > 0) {
            console.log('[Cloud Scheduler] User', user.uid, 'has', dueTasks.length, 'due tasks');
          }

          for (var j = 0; j < dueTasks.length; j++) {
            var result = await executor.executeTask(user.uid, dueTasks[j], user.apiKeys);
            if (result.success) {
              totalExecuted++;
              console.log('[Cloud Scheduler] Task completed:', dueTasks[j].name);
            } else {
              console.warn('[Cloud Scheduler] Task failed:', dueTasks[j].name, result.error);
            }
          }

          try {
            var scavengerConfigs = await helpers.getActiveScavengerConfigs(user.uid);
            if (scavengerConfigs.length > 0) {
              // v25.5: Diagnostic logging for scavenger pipeline
              if (!settings || !settings.cloudSchedulerEnabled) {
                console.warn('[Scavenger:' + user.uid.slice(0,6) + '] SKIPPED — cloudSchedulerEnabled is ' + (settings ? settings.cloudSchedulerEnabled : 'missing'));
              } else {
                console.log('[Scavenger:' + user.uid.slice(0,6) + '] Pipeline starting — ' + scavengerConfigs.length + ' configs, autoPostThreshold: ' + (scavengerConfigs[0].autoPostThreshold || 'not set'));
                console.log('[Cloud Scheduler] Running scavenger for user', user.uid, '(' + scavengerConfigs.length + ' configs)');
                await scavenger.runScavengerPipeline(user.uid, user.apiKeys, scavengerConfigs);
              }
            }
          } catch (scavErr) {
            console.error('[Cloud Scheduler] Scavenger error for user', user.uid, ':', scavErr.message);
          }
        } catch (userErr) {
          console.error('[Cloud Scheduler] Error for user', user.uid, ':', userErr.message);
        }
      }

      console.log('[Cloud Scheduler] Done. Executed', totalExecuted, 'tasks');
    } catch (err) {
      console.error('[Cloud Scheduler] Fatal error:', err);
    }
  }
);

/**
 * Callable function: manual trigger for testing
 * Call from client: firebase.functions().httpsCallable('runTaskNow')({ taskId: '...' })
 */
exports.runTaskNow = functions.https.onCall(
  {
    timeoutSeconds: 120,
    memory: '256MiB',
    region: 'us-central1'
  },
  async function(request) {
    ensureInit();
    var executor = getExecutor(); // v30.1: Initialize executor (was missing, caused crash)
    // Verify authentication
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }

    var uid = request.auth.uid;
    var taskId = request.data.taskId;

    if (!taskId) {
      throw new functions.https.HttpsError('invalid-argument', 'taskId is required');
    }

    console.log('[RunTaskNow] Manual trigger by', uid, 'for task', taskId);

    // Get user's API keys
    var helpers = require('./lib/firestore-helpers');
    var apiKeys = await helpers.getUserApiKeys(uid);
    if (!apiKeys || !apiKeys.cloudSchedulerEnabled) {
      throw new functions.https.HttpsError('failed-precondition', 'Cloud scheduler not enabled');
    }

    // Find the specific task
    var automations = await helpers.getUserAutomations(uid);
    var task = null;
    for (var i = 0; i < automations.length; i++) {
      if (String(automations[i].id) === String(taskId)) {
        task = automations[i];
        break;
      }
    }

    if (!task) {
      throw new functions.https.HttpsError('not-found', 'Task not found');
    }

    // v19.5: All action types now supported (post, image, pipeline, create, notify, pulse, AI)
    var result = await executor.executeTask(uid, task, apiKeys);
    return {
      success: result.success,
      error: result.error || null,
      message: result.success ? 'Task executed successfully' : 'Task failed: ' + result.error
    };
  }
);

/**
 * v34.67: Phase B #5 — Sync v5 audit.
 * Runs daily. For every user that has dual-write enabled, walks each v4-shadowed
 * collection and compares the v4 doc(s) to the v5 envelope(s). When they differ,
 * writes a row to `sync_v5_audit/<uid>/discrepancies/<auto-id>` capturing the
 * collection, doc id, what differed, and timestamps. Admin dashboard reads this
 * collection to get a single source of truth on whether v5 is keeping up with v4.
 *
 * Per spec §migration-phase-b: 14 consecutive days of zero discrepancies is the
 * gate to flip v5 reads on.
 */
exports.runSyncV5Audit = functions.scheduler.onSchedule(
  {
    schedule: 'every 24 hours',
    timeoutSeconds: 540,
    memory: '512MiB',
    region: 'us-central1'
  },
  async function(event) {
    ensureInit();
    var db = admin.firestore();
    console.log('[SyncV5 Audit] Tick at', new Date().toISOString());

    // v4-shadowed collections to compare. Each entry maps a v4 collection name
    // to the corresponding v5 collection name (registered in 35-sync-v5.js).
    var COMPARE = [
      { v4: 'brands',          v5: 'brands_v5' },
      { v4: 'conversations',   v5: 'conversations_v5' },
      { v4: 'chats',           v5: 'conversations_v5' },
      { v4: 'automations',     v5: 'automations_v5' },
      { v4: 'pulse_goals',     v5: 'pulse_v5' },
      { v4: 'agent_history',   v5: 'conversations_v5' }
    ];

    var totalDiscrepancies = 0;
    var totalUsersAudited = 0;

    try {
      // Iterate users that have opted into v5 dual-write. We use roweos_users meta
      // doc field `syncV5DualWrite` if present (set when admin flips the flag for
      // their account); else fall back to all users (cheap query, capped at 500).
      var usersSnap = await db.collection('roweos_users').limit(500).get();
      var userIds = [];
      usersSnap.forEach(function(doc) {
        var d = doc.data() || {};
        if (d.syncV5DualWrite === false) return; // explicit opt-out
        userIds.push(doc.id);
      });

      for (var u = 0; u < userIds.length; u++) {
        var uid = userIds[u];
        try {
          var auditedThisUser = false;
          for (var c = 0; c < COMPARE.length; c++) {
            var pair = COMPARE[c];
            var v4Path = 'roweos_users/' + uid + '/' + pair.v4;
            var v5Path = 'roweos_users/' + uid + '/' + pair.v5;
            var v4SnapP = db.collection(v4Path).limit(500).get();
            var v5SnapP = db.collection(v5Path).limit(500).get();
            var snaps;
            try { snaps = await Promise.all([v4SnapP, v5SnapP]); }
            catch (qErr) { console.warn('[SyncV5 Audit]', uid, pair.v4, 'query failed:', qErr.message); continue; }
            var v4Snap = snaps[0], v5Snap = snaps[1];
            if (!v4Snap || !v5Snap) continue;

            var v4Map = {};
            v4Snap.forEach(function(d) { v4Map[d.id] = d.data() || {}; });
            var v5Map = {};
            v5Snap.forEach(function(d) {
              var x = d.data() || {};
              v5Map[d.id] = (x.data && typeof x.data === 'object') ? x.data : x;
              v5Map[d.id]._v5_modifiedAt = x._modifiedAt || 0;
              v5Map[d.id]._v5_deletedAt = x._deletedAt || null;
            });

            // Discrepancy: v4 has, v5 doesn't (and v5 isn't tombstoned)
            for (var v4Id in v4Map) {
              if (!Object.prototype.hasOwnProperty.call(v4Map, v4Id)) continue;
              if (v4Id === '_all') continue;
              if (!v5Map[v4Id]) {
                await db.collection('sync_v5_audit').doc(uid).collection('discrepancies').add({
                  uid: uid, collection: pair.v4, v5Collection: pair.v5,
                  docId: v4Id, kind: 'missing_in_v5',
                  v4ModifiedAt: v4Map[v4Id]._modifiedAt || null,
                  detectedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                totalDiscrepancies++;
              }
            }
            // Discrepancy: v5 has, v4 doesn't (no tombstone in v5 either) — likely a v5 write that v4 missed
            for (var v5Id in v5Map) {
              if (!Object.prototype.hasOwnProperty.call(v5Map, v5Id)) continue;
              var v5Item = v5Map[v5Id];
              if (v5Item._v5_deletedAt) continue; // tombstoned — expected to be absent in v4
              if (!v4Map[v5Id]) {
                await db.collection('sync_v5_audit').doc(uid).collection('discrepancies').add({
                  uid: uid, collection: pair.v4, v5Collection: pair.v5,
                  docId: v5Id, kind: 'missing_in_v4',
                  v5ModifiedAt: v5Item._v5_modifiedAt || null,
                  detectedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                totalDiscrepancies++;
              }
            }
            auditedThisUser = true;
          }
          if (auditedThisUser) totalUsersAudited++;
        } catch (uErr) {
          console.error('[SyncV5 Audit] Error for user', uid, ':', uErr.message);
        }
      }

      // Write a summary row so the dashboard can show "last audit ran X, Y discrepancies".
      await db.collection('sync_v5_audit').doc('_meta').collection('runs').add({
        ranAt: admin.firestore.FieldValue.serverTimestamp(),
        totalUsersAudited: totalUsersAudited,
        totalDiscrepancies: totalDiscrepancies
      });

      console.log('[SyncV5 Audit] Done.', totalUsersAudited, 'users,', totalDiscrepancies, 'discrepancies');
    } catch (err) {
      console.error('[SyncV5 Audit] Fatal error:', err);
    }
  }
);

/**
 * v34.67: Phase D #17 — Tombstone garbage collection.
 * Daily. Deletes envelopes with _deletedAt < (now - 30d) from every registered
 * v5 collection across every user. Per spec §6: tombstones are kept 30 days for
 * cross-device convergence, then hard-deleted to prevent unbounded growth.
 */
exports.runTombstoneGC = functions.scheduler.onSchedule(
  {
    schedule: 'every 24 hours',
    timeoutSeconds: 540,
    memory: '512MiB',
    region: 'us-central1'
  },
  async function(event) {
    ensureInit();
    var db = admin.firestore();
    console.log('[Tombstone GC] Tick at', new Date().toISOString());

    var TTL_MS = 30 * 24 * 60 * 60 * 1000;
    var cutoff = Date.now() - TTL_MS;
    var totalDeleted = 0;

    var V5_COLLECTIONS = [
      'evolve_skills', 'evolve_sources', 'evolve_reflections', 'evolve_sops',
      'brands_v5', 'conversations_v5', 'automations_v5', 'scribe_v5',
      'reminders_v5', 'pulse_v5', 'library_brand_v5', 'library_life_v5',
      'mail_v5', 'journal_v5', 'folio_v5'
    ];

    try {
      var usersSnap = await db.collection('roweos_users').limit(500).get();
      var userIds = [];
      usersSnap.forEach(function(doc) { userIds.push(doc.id); });

      for (var u = 0; u < userIds.length; u++) {
        var uid = userIds[u];
        for (var c = 0; c < V5_COLLECTIONS.length; c++) {
          var coll = V5_COLLECTIONS[c];
          try {
            var staleSnap = await db.collection('roweos_users/' + uid + '/' + coll)
              .where('_deletedAt', '<', cutoff)
              .limit(200)
              .get();
            if (staleSnap.empty) continue;
            var batch = db.batch();
            staleSnap.forEach(function(d) { batch.delete(d.ref); });
            await batch.commit();
            totalDeleted += staleSnap.size;
          } catch (cErr) {
            // Most users won't have most collections; missing-index errors are expected.
          }
        }
      }
      console.log('[Tombstone GC] Done. Deleted', totalDeleted, 'stale tombstones across', userIds.length, 'users');
    } catch (err) {
      console.error('[Tombstone GC] Fatal error:', err);
    }
  }
);
