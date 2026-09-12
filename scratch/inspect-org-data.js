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

async function inspectOrg(orgId) {
  console.log(`\n======================================================`);
  console.log(`INSPECTING TENANT ORG: ${orgId}`);
  console.log(`======================================================`);

  const subcols = ['sites', 'workers', 'supervisors', 'attendanceRecords', 'paymentLedger', 'pendingCheckins'];
  for (const col of subcols) {
    const snap = await getDocs(collection(db, 'organizations', orgId, col));
    console.log(`\n--- Subcollection: ${col} (${snap.docs.length} docs) ---`);
    snap.docs.forEach((d) => {
      console.log(d.id, d.data());
    });
  }
}

async function inspectRoot() {
  console.log(`\n======================================================`);
  console.log(`INSPECTING ROOT MAPPINGS (siteTokens, pendingCheckinTokens, users)`);
  console.log(`======================================================`);

  for (const col of ['siteTokens', 'pendingCheckinTokens', 'users']) {
    const snap = await getDocs(collection(db, col));
    console.log(`\n--- Root Collection: ${col} (${snap.docs.length} docs) ---`);
    snap.docs.forEach((d) => {
      console.log(d.id, d.data());
    });
  }
}

async function main() {
  await inspectRoot();
  const orgsSnap = await getDocs(collection(db, 'organizations'));
  for (const orgDoc of orgsSnap.docs) {
    await inspectOrg(orgDoc.id);
  }
}

main().catch(console.error);
