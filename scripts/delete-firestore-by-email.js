#!/usr/bin/env node
// Deletes docs in admin_notifications and signups matching target emails.
var path = require('path');
var fs = require('fs');
var admin = require('firebase-admin');

var EMAILS = ['jordanr.rowe@icloud.com', 'jrowe2@student.framingham.edu'];
var DRY_RUN = process.argv.indexOf('--dry-run') !== -1;
var COLLECTIONS = ['admin_notifications', 'signups', 'newsletter_subscribers', 'feedback', 'roweos_users', 'users'];

var keyDir = path.join(__dirname, '..', 'secrets');
var keyFile = fs.readdirSync(keyDir).find(function (f) { return /firebase-adminsdk.*\.json$/.test(f); });
var serviceAccount = require(path.join(keyDir, keyFile));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
var db = admin.firestore();

async function main() {
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE DELETE');
  var totalDeleted = 0;
  for (var i = 0; i < COLLECTIONS.length; i++) {
    var col = db.collection(COLLECTIONS[i]);
    for (var j = 0; j < EMAILS.length; j++) {
      var email = EMAILS[j];
      try {
        var snap = await col.where('email', '==', email).get();
        if (snap.empty) continue;
        console.log('[' + COLLECTIONS[i] + '] ' + snap.size + ' doc(s) for ' + email);
        for (var k = 0; k < snap.docs.length; k++) {
          var d = snap.docs[k];
          if (DRY_RUN) console.log('  [dry-run] would delete', d.ref.path);
          else { await d.ref.delete(); console.log('  deleted', d.ref.path); totalDeleted++; }
        }
      } catch (e) { console.log('  skip ' + COLLECTIONS[i] + ': ' + (e.code || e.message)); }
    }
  }
  console.log('\nDone. Deleted:', totalDeleted);
  process.exit(0);
}
main().catch(function (e) { console.error(e); process.exit(1); });
