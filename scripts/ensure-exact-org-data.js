const path = require('path');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');
if (!module.paths.includes(frontendNodeModules)) {
  module.paths.push(frontendNodeModules);
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

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

const EXACT_USER_UID = 'VP2kdWJJzUWyxGJCJ3Lw7YFkS6r1';
const EXACT_ORG_ID = `org_${EXACT_USER_UID}`;

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

async function ensureDataInExactOrg() {
  console.log(`🚀 ENSURING ALL BACKUP DATA IS IN EXACT ORG: "${EXACT_ORG_ID}"`);
  
  // Update organization document
  await setDoc(doc(db, 'organizations', EXACT_ORG_ID), {
    id: EXACT_ORG_ID,
    name: "admin's Infra",
    ownerUid: EXACT_USER_UID,
    ownerEmail: 'admin@gmail.com',
    plan: 'enterprise',
    status: 'active'
  }, { merge: true });

  // Update user document
  await setDoc(doc(db, 'users', EXACT_USER_UID), {
    organizationId: EXACT_ORG_ID,
    organizationName: "admin's Infra"
  }, { merge: true });

  const backupDir = path.join(__dirname, '..', 'scratch', 'backup_data');

  for (const colName of COLLECTIONS) {
    const jsonPath = path.join(backupDir, `${colName}.json`);
    if (!fs.existsSync(jsonPath)) continue;

    const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📦 Writing ${records.length} records to organizations/${EXACT_ORG_ID}/${colName}...`);

    for (const record of records) {
      const docId = record._id || record.id;
      if (!docId) continue;

      const cleanData = { ...record };
      delete cleanData._id;
      cleanData.organizationId = EXACT_ORG_ID;

      await setDoc(doc(db, 'organizations', EXACT_ORG_ID, colName, docId), cleanData, { merge: true });
    }
  }

  console.log('✅ ALL BACKUP DATA WRITTEN TO EXACT ORG SUCCESSFULLY!');
}

const fs = require('fs');
ensureDataInExactOrg().catch(console.error);
