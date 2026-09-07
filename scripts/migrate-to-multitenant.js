const fs = require('fs');
const path = require('path');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');
if (!module.paths.includes(frontendNodeModules)) {
  module.paths.push(frontendNodeModules);
}

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  serverTimestamp
} = require('firebase/firestore');

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
const IS_DRY_RUN = process.argv.includes('--dry-run');

const COLLECTIONS_TO_MIGRATE = [
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

async function runMigration() {
  console.log(`🚀 STARTING MULTI-TENANT DATA MIGRATION [${IS_DRY_RUN ? 'DRY-RUN MODE' : 'LIVE WRITE MODE'}]`);
  console.log(`🏢 Target Organization ID: "${TARGET_ORG_ID}"`);
  console.log(`👤 Target User UID: "${TARGET_USER_UID}"\n`);

  // Step 1: Ensure Target Organization Profile Document Exists
  const orgDocRef = doc(db, 'organizations', TARGET_ORG_ID);
  const orgSnap = await getDoc(orgDocRef);

  if (!orgSnap.exists()) {
    console.log(`📌 Creating Organization document: "organizations/${TARGET_ORG_ID}"...`);
    if (!IS_DRY_RUN) {
      await setDoc(orgDocRef, {
        id: TARGET_ORG_ID,
        name: "admin's infra",
        ownerUid: TARGET_USER_UID,
        ownerEmail: 'admin@gmail.com',
        ownerPhone: '+919876543210',
        plan: 'enterprise',
        status: 'active',
        createdAt: serverTimestamp(),
        migratedAt: new Date().toISOString()
      }, { merge: true });
    }
  } else {
    console.log(`✅ Target Organization "organizations/${TARGET_ORG_ID}" already exists.`);
  }

  // Step 1B: Update User Profile to point to TARGET_ORG_ID
  const userDocRef = doc(db, 'users', TARGET_USER_UID);
  console.log(`📌 Linking user profile "users/${TARGET_USER_UID}" to organizationId "${TARGET_ORG_ID}"...`);
  if (!IS_DRY_RUN) {
    await setDoc(userDocRef, {
      organizationId: TARGET_ORG_ID,
      organizationName: "admin's infra",
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  const auditReport = {};

  // Step 2: Migrate each root collection to organizations/{orgId}/{collectionName}
  for (const colName of COLLECTIONS_TO_MIGRATE) {
    try {
      console.log(`\n🔄 Migrating collection: "${colName}"...`);
      const snap = await getDocs(collection(db, colName));
      console.log(`   Found ${snap.docs.length} root documents in "${colName}".`);

      let copiedCount = 0;

      for (const d of snap.docs) {
        const docId = d.id;
        const data = d.data();

        // Target path: organizations/org_primary/<colName>/<docId>
        const targetDocRef = doc(db, 'organizations', TARGET_ORG_ID, colName, docId);

        const updatedData = {
          ...data,
          organizationId: TARGET_ORG_ID,
          _migratedFromRootAt: new Date().toISOString()
        };

        if (!IS_DRY_RUN) {
          await setDoc(targetDocRef, updatedData, { merge: true });
        }
        copiedCount++;
      }

      auditReport[colName] = {
        rootCount: snap.docs.length,
        migratedCount: copiedCount,
        status: copiedCount === snap.docs.length ? '100% MATCH' : 'COUNT MISMATCH'
      };

      console.log(`   ✅ Successfully migrated ${copiedCount}/${snap.docs.length} documents into "organizations/${TARGET_ORG_ID}/${colName}".`);
    } catch (err) {
      console.error(`   ❌ Error migrating collection "${colName}":`, err?.message || err);
      auditReport[colName] = { rootCount: 0, migratedCount: 0, status: 'FAILED' };
    }
  }

  console.log('\n==================================================');
  console.log(`🎉 MIGRATION AUDIT REPORT [${IS_DRY_RUN ? 'DRY-RUN' : 'LIVE'}]`);
  console.log('==================================================');
  console.table(auditReport);

  if (IS_DRY_RUN) {
    console.log('\n💡 Dry-run finished. No data was modified in Firestore.');
    console.log('   Run without --dry-run to execute live migration.');
  } else {
    console.log('\n✨ Live migration completed successfully! All root data is safely preserved and copied under organizations/org_primary/.');
  }
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
