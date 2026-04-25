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
