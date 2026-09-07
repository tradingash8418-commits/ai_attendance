const fs = require('fs');
const path = require('path');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');
if (!module.paths.includes(frontendNodeModules)) {
  module.paths.push(frontendNodeModules);
}

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAbtAuBhwH7rSYhoitWMsGxl6PXEW1gHls",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "face-attendance-9c705.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "face-attendance-9c705",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "face-attendance-9c705.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "419158130243",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:419158130243:web:debdd48c8c026c0f695ef6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_ORG_ID = process.env.TARGET_ORG_ID || 'org_VP2kdWJJzUwYxGJCJ3Lw7YFkS6r1';
const TARGET_USER_UID = process.env.TARGET_USER_UID || 'VP2kdWJJzUwYxGJCJ3Lw7YFkS6r1';

const COLLECTIONS = [
  'attendanceRecords',
  'attendanceSessions',
  'paymentLedger',
  'pendingCheckins',
  'siteAssignments',
  'sites',
  'supervisors',
  'whatsappMessages',
  'workerFaceEmbeddings',
  'workerPhotos',
  'workers'
];

async function runRestore() {
  console.log(`🚀 RESTORING BACKUP DATA INTO TARGET ORG: "${TARGET_ORG_ID}"`);
  console.log(`👤 Linking to User UID: "${TARGET_USER_UID}"\n`);

  const backupDir = path.join(__dirname, '..', 'scratch', 'backup_data');

  // 1. Ensure Target Org exists
  const orgRef = doc(db, 'organizations', TARGET_ORG_ID);
  await setDoc(orgRef, {
    id: TARGET_ORG_ID,
    name: "admin's infra",
    ownerUid: TARGET_USER_UID,
    ownerEmail: 'admin@gmail.com',
    plan: 'enterprise',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // 2. Link user profile
  const userRef = doc(db, 'users', TARGET_USER_UID);
  await setDoc(userRef, {
    organizationId: TARGET_ORG_ID,
    organizationName: "admin's infra",
    updatedAt: serverTimestamp()
  }, { merge: true });
  console.log(`✅ Linked user profile "users/${TARGET_USER_UID}" to organizationId "${TARGET_ORG_ID}".\n`);

  // 3. Restore all records into organizations/{TARGET_ORG_ID}/{colName}/{docId}
  const summary = {};

  for (const colName of COLLECTIONS) {
    const jsonPath = path.join(backupDir, `${colName}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.warn(`⚠️ Backup file missing for ${colName}`);
      continue;
    }

    const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📦 Restoring ${records.length} records into "organizations/${TARGET_ORG_ID}/${colName}"...`);

    let restoredCount = 0;
    for (const record of records) {
      const docId = record._id || record.id;
      if (!docId) continue;

      const cleanData = { ...record };
      delete cleanData._id;
      cleanData.organizationId = TARGET_ORG_ID;

      const targetDocRef = doc(db, 'organizations', TARGET_ORG_ID, colName, docId);
      await setDoc(targetDocRef, cleanData, { merge: true });
      restoredCount++;
    }

    summary[colName] = restoredCount;
    console.log(`   ✅ Restored ${restoredCount} documents.`);
  }

  console.log('\n==================================================');
  console.log('🎉 RESTORATION & LINKING COMPLETED SUCCESSFULLY!');
  console.log('==================================================');
  console.table(summary);
}

runRestore().catch((err) => {
  console.error('Fatal restore error:', err);
  process.exit(1);
});
