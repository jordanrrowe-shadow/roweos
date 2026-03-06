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
var scheduler = require('./lib/scheduler');
var executor = require('./lib/executor');

// Initialize Firebase Admin SDK
admin.initializeApp();

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
    console.log('[Cloud Scheduler] Tick at', new Date().toISOString());

    try {
      // Get all users who have enabled cloud scheduling
      var users = await scheduler.getEnabledUsers();
      console.log('[Cloud Scheduler] Found', users.length, 'enabled users');

      var totalExecuted = 0;

      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        try {
          // Get user's timezone
          var settings = await require('./lib/firestore-helpers').getUserSettings(user.uid);
          var timezone = settings.timezone || 'America/Chicago';

          // Find due tasks
          var dueTasks = await scheduler.getDueTasks(user.uid, timezone);

          if (dueTasks.length > 0) {
            console.log('[Cloud Scheduler] User', user.uid, 'has', dueTasks.length, 'due tasks');
          }

          // Execute each due task (sequentially per user to avoid rate limits)
          for (var j = 0; j < dueTasks.length; j++) {
            var result = await executor.executeTask(user.uid, dueTasks[j], user.apiKeys);
            if (result.success) {
              totalExecuted++;
              console.log('[Cloud Scheduler] Task completed:', dueTasks[j].name);
            } else {
              console.warn('[Cloud Scheduler] Task failed:', dueTasks[j].name, result.error);
            }
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
