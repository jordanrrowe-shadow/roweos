/**
 * RoweOS Cloud Functions — Scheduler
 * v19.1: Evaluates which automations are due for execution
 * v19.5: Removed Phase 1 skip filters — now handles post, image, pipeline
 * Ported from client-side checkAndRunDueTasks() (~line 127385)
 */

var helpers = require('./firestore-helpers');
var admin = require('firebase-admin');

/**
 * Get all users who have opted into cloud scheduling
 * @returns {Array<{uid: string, apiKeys: Object}>}
 */
async function getEnabledUsers() {
  var db = helpers.getDb();
  // v19.1: Query parent docs where cloudSchedulerEnabled is true
  // enableCloudScheduler() writes this flag to the parent doc
  var usersSnap = await db.collection('roweos_users')
    .where('cloudSchedulerEnabled', '==', true)
    .get();
  var users = [];

  for (var i = 0; i < usersSnap.docs.length; i++) {
    var userDoc = usersSnap.docs[i];
    var uid = userDoc.id;
    try {
      var keysDoc = await db.doc('roweos_users/' + uid + '/secure/api_keys').get();
      if (keysDoc.exists) {
        var data = keysDoc.data();
        if (data.cloudSchedulerEnabled) {
          users.push({ uid: uid, apiKeys: data });
        }
      }
    } catch (e) {
      // Skip users with permission issues
      console.warn('[Scheduler] Could not read keys for user', uid, e.message);
    }
  }
  return users;
}

/**
 * Convert HH:MM time string to minutes since midnight
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * Check if two dates are the same calendar day
 */
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

/**
 * Get days elapsed since a date
 */
function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Evaluate if a task is due, respecting user's timezone
 * Port of the isDue logic from checkAndRunDueTasks()
 * @param {Object} task - Automation task
 * @param {Date} now - Current time in user's timezone
 * @returns {boolean} Whether the task is due
 */
function isTaskDue(task, now) {
  if (!task.enabled) return false;

  var freq = task.frequency || task.recurType || 'none';
  var taskTime = task.time || '09:00';
  var lastRun = task.lastRun ? new Date(task.lastRun) : null;

  var currentTime = now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0');
  var timeDiff = timeToMinutes(currentTime) - timeToMinutes(taskTime);

  // Custom recurrence — interval math
  if (freq === 'custom') {
    var cInterval = task.recurInterval || 1;
    var cUnit = task.recurUnit || 'days';
    if (!lastRun) {
      if (timeDiff >= 0 && timeDiff <= 30) return true;
      return false;
    }
    var msSince = now.getTime() - lastRun.getTime();
    if (cUnit === 'minutes') return msSince >= cInterval * 60 * 1000;
    if (cUnit === 'hours') return msSince >= cInterval * 60 * 60 * 1000;
    if (cUnit === 'days') return msSince >= cInterval * 24 * 60 * 60 * 1000;
    if (cUnit === 'weeks') return msSince >= cInterval * 7 * 24 * 60 * 60 * 1000;
    if (cUnit === 'months') {
      var monthsDiff = (now.getFullYear() - lastRun.getFullYear()) * 12 +
        (now.getMonth() - lastRun.getMonth());
      return monthsDiff >= cInterval;
    }
    return false;
  }

  // Standard recurrence — time window check (0-30 min forward)
  if (timeDiff < 0 || timeDiff > 30) return false;

  if (freq === 'daily') {
    return !lastRun || !isSameDay(lastRun, now);
  } else if (freq === 'weekly') {
    return !lastRun || daysSince(lastRun) >= 7;
  } else if (freq === 'monthly') {
    return !lastRun || (now.getMonth() !== lastRun.getMonth() ||
      now.getFullYear() !== lastRun.getFullYear());
  } else if (freq === 'once' || freq === 'none') {
    if (task.scheduledDate) {
      var todayStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      return !lastRun && task.scheduledDate === todayStr;
    }
    return !lastRun;
  }

  return false;
}

/**
 * Get current time in a user's timezone
 * @param {string} timezone - IANA timezone string (e.g. 'America/Chicago')
 * @returns {Date} Date object adjusted to user's local time
 */
function getUserLocalTime(timezone) {
  if (!timezone) return new Date(); // Fall back to UTC

  try {
    // Get current UTC time, then format in user's timezone to extract components
    var now = new Date();
    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    var parts = formatter.formatToParts(now);
    var vals = {};
    parts.forEach(function(p) { vals[p.type] = p.value; });

    // Construct a Date with the user's local values
    // Note: This Date object's internal UTC value doesn't matter;
    // we only use getHours/getMinutes/getDate etc. for comparison
    return new Date(
      parseInt(vals.year),
      parseInt(vals.month) - 1,
      parseInt(vals.day),
      parseInt(vals.hour),
      parseInt(vals.minute),
      parseInt(vals.second)
    );
  } catch (e) {
    console.warn('[Scheduler] Invalid timezone:', timezone, e.message);
    return new Date();
  }
}

/**
 * Get due tasks for a specific user
 * v19.1: Reads automations from subcollection (individual docs), not a single doc
 * @param {string} uid - Firebase user ID
 * @param {string} timezone - User's IANA timezone
 * @returns {Array<Object>} Array of due tasks
 */
async function getDueTasks(uid, timezone) {
  var automations = await helpers.getUserAutomations(uid);
  var now = getUserLocalTime(timezone);
  var dueTasks = [];

  for (var i = 0; i < automations.length; i++) {
    var task = automations[i];
    // v19.5: Only skip reminder-only tasks (no execution needed)
    if (task.action === 'none') {
      continue;
    }
    if (isTaskDue(task, now)) {
      dueTasks.push(task);
    }
  }

  return dueTasks;
}

module.exports = {
  getEnabledUsers: getEnabledUsers,
  isTaskDue: isTaskDue,
  getUserLocalTime: getUserLocalTime,
  getDueTasks: getDueTasks,
  timeToMinutes: timeToMinutes
};
