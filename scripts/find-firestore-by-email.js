#!/usr/bin/env node
// Scans common collections for any docs referencing target emails.
var path = require('path');
var fs = require('fs');
var admin = require('firebase-admin');

var EMAILS = ['jordanr.rowe@icloud.com', 'jrowe2@student.framingham.edu'];

var keyDir = path.join(__dirname, '..', 'secrets');
var keyFile = fs.readdirSync(keyDir).find(function (f) { return /firebase-adminsdk.*\.json$/.test(f); });
var serviceAccount = require(path.join(keyDir, keyFile));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });

var db = admin.firestore();

async function main() {
  var collections = await db.listCollections();
  console.log('Top-level collections:', collections.map(function (c) { return c.id; }).join(', '));

  for (var i = 0; i < collections.length; i++) {
    var col = collections[i];
    for (var j = 0; j < EMAILS.length; j++) {
      var email = EMAILS[j];
      try {
        var snap = await col.where('email', '==', email).limit(5).get();
        if (!snap.empty) {
          console.log('\n[' + col.id + '] match for ' + email + ':');
          snap.docs.forEach(function (d) { console.log('  ', d.ref.path); });
        }
      } catch (e) { /* ignore - field may not exist */ }
    }
    // also try a doc id == email
    for (var k = 0; k < EMAILS.length; k++) {
      var doc = await col.doc(EMAILS[k]).get();
      if (doc.exists) console.log('\n[' + col.id + '] doc id ' + EMAILS[k] + ' exists at ' + doc.ref.path);
    }
  }
  process.exit(0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
