#!/usr/bin/env node
// One-off: dedupe email_log entries.
// Groups by (userEmail + template + sentAt-rounded-to-minute) and keeps only the
// earliest doc in each group, deleting the rest. Caused by v31.2 having both client
// and server writing to email_log; server-only as of v31.3.

var path = require('path');
var fs = require('fs');
var admin = require('firebase-admin');

var keyDir = path.join(__dirname, '..', 'secrets');
var keyFile = fs.readdirSync(keyDir).find(function (f) { return /firebase-adminsdk.*\.json$/.test(f); });
if (!keyFile) { console.error('No service account key in', keyDir); process.exit(1); }
var serviceAccount = require(path.join(keyDir, keyFile));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });

var db = admin.firestore();

function bucketKey(d) {
  // Round to the minute so two writes a few seconds apart still group together
  var t = d.sentAt ? new Date(d.sentAt).getTime() : 0;
  var minute = Math.floor(t / 60000);
  return (d.userEmail || d.userId || '') + '|' + (d.template || '') + '|' + minute;
}

async function main() {
  var snap = await db.collection('email_log').get();
  console.log('Scanned', snap.size, 'email_log docs');

  var groups = {};
  snap.docs.forEach(function (doc) {
    var d = doc.data() || {};
    var key = bucketKey(d);
    if (!groups[key]) groups[key] = [];
    groups[key].push({ id: doc.id, ref: doc.ref, sentAt: d.sentAt || '', userEmail: d.userEmail || '', template: d.template || '' });
  });

  var toDelete = [];
  Object.keys(groups).forEach(function (key) {
    var arr = groups[key];
    if (arr.length <= 1) return;
    // Sort ascending by sentAt; keep [0], delete the rest
    arr.sort(function (a, b) { return (a.sentAt || '').localeCompare(b.sentAt || ''); });
    for (var i = 1; i < arr.length; i++) toDelete.push(arr[i]);
  });

  if (toDelete.length === 0) { console.log('No duplicates found.'); process.exit(0); }

  console.log('Found', toDelete.length, 'duplicate(s):');
  toDelete.forEach(function (d) {
    console.log('  delete', d.id, '|', d.userEmail, '|', d.template, '|', d.sentAt);
  });

  var batch = db.batch();
  toDelete.forEach(function (d) { batch.delete(d.ref); });
  await batch.commit();
  console.log('Deleted', toDelete.length, 'duplicate email_log entries.');
  process.exit(0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
