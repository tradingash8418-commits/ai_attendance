const fs = require('fs');
const path = require('path');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');
if (!module.paths.includes(frontendNodeModules)) {
  module.paths.push(frontendNodeModules);
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

const COLLECTIONS_TO_BACKUP = [
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

async function runBackup() {
  console.log('🚀 Starting Full Firestore Backup...');
  const backupDir = path.join(__dirname, '..', 'scratch', 'backup_data');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const summary = {};

  for (const colName of COLLECTIONS_TO_BACKUP) {
    try {
      console.log(`📦 Fetching collection: "${colName}"...`);
      const snap = await getDocs(collection(db, colName));
      const records = snap.docs.map((d) => ({
        _id: d.id,
        ...d.data()
      }));

      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
      summary[colName] = records.length;
      console.log(`✅ Saved ${records.length} records to ${colName}.json`);
    } catch (err) {
      console.error(`❌ Failed to backup collection "${colName}":`, err?.message || err);
    }
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        collections: summary
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n🎉 FULL BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`📁 Backup Directory: ${backupDir}`);
  console.table(summary);
}

runBackup().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
