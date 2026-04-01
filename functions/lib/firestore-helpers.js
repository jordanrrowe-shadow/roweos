/**
 * RoweOS Cloud Functions — Firestore Helpers
 * v19.1: Read/write utilities for cloud task execution
 * Reads from subcollections matching syncToFirebaseV2() write paths
 */

var admin = require('firebase-admin');

/**
 * Get Firestore instance
 */
function getDb() {
  return admin.firestore();
}

// v28.0: Check if user has migrated to v4 namespace
// Returns 'roweos_v4/{uid}' if migrated, else 'roweos_users/{uid}'
// Caches result per uid for the lifetime of this function invocation
var _basePathCache = {};
async function getBasePath(uid) {
  if (_basePathCache[uid]) return _basePathCache[uid];
  var db = getDb();
  try {
    var configDoc = await db.collection('roweos_v4').doc(uid).collection('_meta').doc('config').get();
    if (configDoc.exists && configDoc.data().migrationCompleted) {
      _basePathCache[uid] = 'roweos_v4/' + uid;
      return _basePathCache[uid];
    }
  } catch (e) {
    // Fall back to old namespace
  }
  _basePathCache[uid] = 'roweos_users/' + uid;
  return _basePathCache[uid];
}

/**
 * Read user's API keys from secure storage
 * @param {string} uid - Firebase user ID
 * @returns {Object|null} API keys object or null
 */
async function getUserApiKeys(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var doc = await db.doc(basePath + '/secure/api_keys').get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * Read user's brands from Firestore subcollection
 * syncToFirebaseV2() writes: basePath + '/brands/' + idx
 * @param {string} uid - Firebase user ID
 * @returns {Array} brands array
 */
async function getUserBrands(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var snap = await db.collection(basePath + '/brands').get();
  if (snap.empty) return [];
  var brands = [];
  snap.forEach(function(doc) {
    var idx = parseInt(doc.id);
    if (!isNaN(idx)) {
      brands[idx] = doc.data();
    } else {
      brands.push(doc.data());
    }
  });
  // Remove undefined gaps from sparse array
  return brands.filter(function(b) { return b; });
}

/**
 * Read user's brand settings from profile
 * @param {string} uid - Firebase user ID
 * @returns {Object} brand settings object
 */
async function getUserBrandSettings(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var doc = await db.doc(basePath + '/profile/main').get();
  if (!doc.exists) return {};
  var data = doc.data();
  return data.brandSettings || {};
}

/**
 * Read user's profile settings (includes timezone)
 * @param {string} uid - Firebase user ID
 * @returns {Object} settings object
 */
async function getUserSettings(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var doc = await db.doc(basePath + '/profile/main').get();
  if (!doc.exists) return {};
  var data = doc.data();
  return data.settings || {};
}

/**
 * Read user's automations from Firestore subcollection
 * syncToFirebaseV2() writes: basePath + '/automations/' + auto.id
 * Each automation is an individual document in the subcollection
 * @param {string} uid - Firebase user ID
 * @returns {Array} automations array
 */
async function getUserAutomations(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var snap = await db.collection(basePath + '/automations').get();
  if (snap.empty) return [];
  var automations = [];
  snap.forEach(function(doc) {
    var data = doc.data();
    data.id = doc.id; // v25.6: Include doc ID for locking and lastRun updates
    automations.push(data);
  });
  return automations;
}

/**
 * Read user's custom operations from Firestore subcollection
 * syncToFirebaseV2() writes: basePath + '/customOps/' + idx
 * @param {string} uid - Firebase user ID
 * @returns {Array} custom operations array
 */
async function getUserCustomOps(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var snap = await db.collection(basePath + '/customOps').get();
  if (snap.empty) return [];
  var ops = [];
  snap.forEach(function(doc) { ops.push(doc.data()); });
  return ops;
}

/**
 * Read user's generated brand operations from Firestore subcollection
 * syncToFirebaseV2() writes: basePath + '/generatedBrandOps/' + idx
 * @param {string} uid - Firebase user ID
 * @returns {Array} generated brand ops array
 */
async function getUserGeneratedBrandOps(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var snap = await db.collection(basePath + '/generatedBrandOps').get();
  if (snap.empty) return [];
  var ops = [];
  snap.forEach(function(doc) { ops.push(doc.data()); });
  return ops;
}

/**
 * Write execution result to cloud_results subcollection
 * @param {string} uid - Firebase user ID
 * @param {Object} result - Execution result
 */
async function writeCloudResult(uid, result) {
  var db = getDb();
  var resultDoc = {
    taskId: result.taskId,
    taskName: result.taskName,
    brand: result.brand || '',
    action: result.action || 'ai',
    success: result.success,
    result: (result.result || '').substring(0, 20000),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    executedBy: 'cloud_function',
    picked_up: false
  };
  var basePath = await getBasePath(uid);
  await db.collection(basePath + '/cloud_results').add(resultDoc);
}

/**
 * Update automation's lastRun timestamp and executor
 * v19.1: Updates individual automation doc in subcollection
 * @param {string} uid - Firebase user ID
 * @param {string} taskId - Automation task ID
 * @param {string} timestamp - ISO timestamp
 */
async function updateAutomationLastRun(uid, taskId, timestamp, executor, errorMsg) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var idStr = String(taskId);
  var docRef = db.doc(basePath + '/automations/' + idStr);
  var doc = await docRef.get();
  if (doc.exists) {
    var update = {
      lastRun: timestamp,
      lastExecutor: executor || 'cloud'
    };
    // v25.6: For failed runs, restore previous lastRun
    // so frequency logic isn't polluted by failures
    if (executor === 'cloud_failed') {
      var prevData = doc.data();
      update = {
        lastRun: prevData.lastRun || null,
        lastRunAttempt: timestamp,
        lastExecutor: 'cloud_failed',
        lastError: errorMsg || 'Unknown error'
      };
    }
    await docRef.set(update, { merge: true });
  }
}

/**
 * Set/release cloud lock on a task (prevents concurrent execution)
 * @param {string} uid - Firebase user ID
 * @param {string} taskId - Task ID
 * @param {boolean} lock - true to lock, false to release
 * @returns {boolean} true if lock acquired, false if already locked
 */
async function setCloudLock(uid, taskId, lock) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var lockRef = db.doc(basePath + '/cloud_locks/' + taskId);

  if (lock) {
    try {
      var result = await db.runTransaction(async function(transaction) {
        var lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists) {
          var lockData = lockDoc.data();
          // Check if lock is stale (older than 10 minutes)
          var lockTime = lockData.lockedAt ? lockData.lockedAt.toDate().getTime() : 0;
          if (Date.now() - lockTime < 10 * 60 * 1000) {
            return false; // Still locked
          }
        }
        transaction.set(lockRef, {
          locked: true,
          lockedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
      });
      return result;
    } catch (e) {
      console.error('[Lock] Transaction failed:', e);
      return false;
    }
  } else {
    await lockRef.delete();
    return true;
  }
}

/**
 * Read a user's social token for a specific platform + scope
 * v19.5: Tries individual token doc first, falls back to profile blob
 * @param {string} uid - Firebase user ID
 * @param {string} platform - 'x', 'threads', or 'instagram'
 * @param {string} scope - Scope suffix, e.g. '_brand_0'
 * @returns {Object|null} Token object { accessToken, userId, ... } or null
 */
async function getUserSocialToken(uid, platform, scope) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var tokenKey = platform + (scope || '');

  // Try individual token doc first (fresher, written by storeSocialToken())
  try {
    var tokenDoc = await db.doc(basePath + '/social_tokens/' + tokenKey).get();
    if (tokenDoc.exists) {
      var tokenData = tokenDoc.data();
      if (tokenData.accessToken) return tokenData;
    }
  } catch (e) {
    console.warn('[Helpers] Could not read social token doc:', e.message);
  }

  // Fall back to profile blob (written by syncToFirebaseV2)
  try {
    var profileDoc = await db.doc(basePath + '/profile/main').get();
    if (profileDoc.exists) {
      var data = profileDoc.data();
      var connections = data.socialConnections || {};
      var connKey = tokenKey;
      if (connections[connKey] && connections[connKey].token) {
        var parsed = connections[connKey].token;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch (e) { return null; }
        }
        if (parsed && parsed.accessToken) return parsed;
      }
    }
  } catch (e) {
    console.warn('[Helpers] Could not read social connections from profile:', e.message);
  }

  return null;
}

/**
 * Read all social connections for a user from profile blob
 * v19.5: Returns full socialConnections map
 * @param {string} uid - Firebase user ID
 * @returns {Object} Social connections map, e.g. { 'x_brand_0': { connected, handle, token } }
 */
async function getUserSocialConnections(uid) {
  var db = getDb();
  try {
    var basePath = await getBasePath(uid);
    var doc = await db.doc(basePath + '/profile/main').get();
    if (!doc.exists) return {};
    var data = doc.data();
    return data.socialConnections || {};
  } catch (e) {
    console.warn('[Helpers] Could not read social connections:', e.message);
    return {};
  }
}

// v26.3: Scavenger config helpers

async function getActiveScavengerConfigs(uid) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var snap = await db.collection(basePath + '/scavenger_configs')
    .where('active', '==', true)
    .get();
  if (snap.empty) return [];
  var configs = [];
  snap.forEach(function(doc) {
    var data = doc.data();
    data.id = doc.id;
    configs.push(data);
  });
  return configs;
}

async function writeScavengerTarget(uid, target) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var docRef = await db.collection(basePath + '/scavenger_targets').add(target);
  return docRef.id;
}

async function updateScavengerTarget(uid, targetId, updates) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  await db.doc(basePath + '/scavenger_targets/' + targetId).set(updates, { merge: true });
}

async function getScavengerTargetsByStatus(uid, status) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var snap = await db.collection(basePath + '/scavenger_targets')
    .where('status', '==', status)
    .get();
  var targets = [];
  snap.forEach(function(doc) {
    var data = doc.data();
    data._id = doc.id;
    targets.push(data);
  });
  return targets;
}

async function scavengerTargetExists(uid, postId) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var snap = await db.collection(basePath + '/scavenger_targets')
    .where('postId', '==', postId)
    .limit(1)
    .get();
  return !snap.empty;
}

async function countScavengerTargets(uid, configId, status, sinceMs) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var sinceDate = new Date(sinceMs);
  var snap = await db.collection(basePath + '/scavenger_targets')
    .where('configId', '==', configId)
    .where('status', '==', status)
    .where('postedAt', '>=', sinceDate)
    .get();
  return snap.size;
}

async function setScavengerLock(uid, lock) {
  var db = getDb();
  var basePath = await getBasePath(uid);
  var lockRef = db.doc(basePath + '/scavenger_lock/pipeline');
  if (lock) {
    try {
      var result = await db.runTransaction(async function(transaction) {
        var lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists) {
          var lockData = lockDoc.data();
          var lockTime = lockData.lockedAt ? lockData.lockedAt.toDate().getTime() : 0;
          if (Date.now() - lockTime < 5 * 60 * 1000) {
            return false;
          }
        }
        transaction.set(lockRef, {
          locked: true,
          lockedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
      });
      return result;
    } catch (e) {
      console.error('[ScavengerLock] Transaction failed:', e);
      return false;
    }
  } else {
    await lockRef.delete();
    return true;
  }
}

module.exports = {
  getDb: getDb,
  getBasePath: getBasePath,
  getUserApiKeys: getUserApiKeys,
  getUserBrands: getUserBrands,
  getUserBrandSettings: getUserBrandSettings,
  getUserSettings: getUserSettings,
  getUserAutomations: getUserAutomations,
  getUserCustomOps: getUserCustomOps,
  getUserGeneratedBrandOps: getUserGeneratedBrandOps,
  writeCloudResult: writeCloudResult,
  updateAutomationLastRun: updateAutomationLastRun,
  setCloudLock: setCloudLock,
  getUserSocialToken: getUserSocialToken,
  getUserSocialConnections: getUserSocialConnections,
  // v26.3: Scavenger helpers
  getActiveScavengerConfigs: getActiveScavengerConfigs,
  writeScavengerTarget: writeScavengerTarget,
  updateScavengerTarget: updateScavengerTarget,
  getScavengerTargetsByStatus: getScavengerTargetsByStatus,
  scavengerTargetExists: scavengerTargetExists,
  countScavengerTargets: countScavengerTargets,
  setScavengerLock: setScavengerLock
};
