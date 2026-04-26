#!/usr/bin/env node
// Deletes specific users from Firebase Auth + their Firestore data.
// Usage: node scripts/delete-firebase-users.js [--dry-run] [--yes]
// Service account: secrets/roweos-firebase-adminsdk-*.json

var path = require('path');
var fs = require('fs');
var admin = require('firebase-admin');
var readline = require('readline');

var EMAILS_TO_DELETE = [
  'jordanr.rowe@icloud.com',
  'jrowe2@student.framingham.edu'
];

// Top-level collections that key documents by uid (delete docs uid == user.uid)
var UID_DOC_COLLECTIONS = [
  'roweos_users',
  'users',
  'access_keys_by_user',
  'social_tokens',
  'mail',
  'profile'
];

// Top-level collections to scan and delete docs/subcollections under uid
var UID_PARENT_COLLECTIONS = [
  'onboarding_responses',
  'email_log'
];

var DRY_RUN = process.argv.indexOf('--dry-run') !== -1;
var SKIP_CONFIRM = process.argv.indexOf('--yes') !== -1;

var keyDir = path.join(__dirname, '..', 'secrets');
var keyFile = fs.readdirSync(keyDir).find(function (f) {
  return /firebase-adminsdk.*\.json$/.test(f);
});
if (!keyFile) {
  console.error('No firebase-adminsdk*.json found in secrets/');
  process.exit(1);
}
var serviceAccount = require(path.join(keyDir, keyFile));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

var auth = admin.auth();
var db = admin.firestore();

function confirm(question) {
  return new Promise(function (resolve) {
    if (SKIP_CONFIRM) return resolve(true);
    var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question + ' (yes/no) ', function (ans) {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'yes');
    });
  });
}

async function deleteSubcollections(docRef) {
  var subs = await docRef.listCollections();
  for (var i = 0; i < subs.length; i++) {
    var snap = await subs[i].get();
    for (var j = 0; j < snap.docs.length; j++) {
      var d = snap.docs[j];
      await deleteSubcollections(d.ref);
      if (DRY_RUN) {
        console.log('  [dry-run] would delete subdoc', d.ref.path);
      } else {
        await d.ref.delete();
      }
    }
  }
}

async function deleteUserData(uid, email) {
  console.log('\n--- Firestore cleanup for', email, '(uid:', uid + ') ---');

  for (var i = 0; i < UID_DOC_COLLECTIONS.length; i++) {
    var col = UID_DOC_COLLECTIONS[i];
    var ref = db.collection(col).doc(uid);
    var snap = await ref.get();
    if (snap.exists) {
      await deleteSubcollections(ref);
      if (DRY_RUN) {
        console.log('  [dry-run] would delete', ref.path);
      } else {
        await ref.delete();
        console.log('  deleted', ref.path);
      }
    }
  }

  for (var k = 0; k < UID_PARENT_COLLECTIONS.length; k++) {
    var pcol = UID_PARENT_COLLECTIONS[k];
    var pref = db.collection(pcol).doc(uid);
    var psnap = await pref.get();
    var subs = await pref.listCollections();
    if (psnap.exists || subs.length) {
      await deleteSubcollections(pref);
      if (psnap.exists) {
        if (DRY_RUN) console.log('  [dry-run] would delete', pref.path);
        else { await pref.delete(); console.log('  deleted', pref.path); }
      }
    }
  }
}

async function main() {
  console.log('Project:', serviceAccount.project_id);
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE DELETE');
  console.log('Targets:', EMAILS_TO_DELETE.join(', '));

  var ok = await confirm('\nProceed?');
  if (!ok) { console.log('Aborted.'); process.exit(0); }

  for (var i = 0; i < EMAILS_TO_DELETE.length; i++) {
    var email = EMAILS_TO_DELETE[i];
    var user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (e) {
      console.log('\n[skip] no auth user for', email, '-', e.code || e.message);
      continue;
    }

    await deleteUserData(user.uid, email);

    if (DRY_RUN) {
      console.log('[dry-run] would delete auth user', email, '(' + user.uid + ')');
    } else {
      await auth.deleteUser(user.uid);
      console.log('deleted auth user', email);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
