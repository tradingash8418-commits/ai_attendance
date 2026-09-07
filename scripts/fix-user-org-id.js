const path = require('path');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');
if (!module.paths.includes(frontendNodeModules)) {
  module.paths.push(frontendNodeModules);
}

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

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

const TARGET_USER_UID = 'VP2kdWJJzUwYxGJCJ3Lw7YFkS6r1';
const CORRECT_ORG_ID = `org_${TARGET_USER_UID}`;

async function fixUserOrgId() {
  console.log(`🔧 Updating user profile "users/${TARGET_USER_UID}" to correct organizationId: "${CORRECT_ORG_ID}"...`);
  const userRef = doc(db, 'users', TARGET_USER_UID);
  await updateDoc(userRef, {
    organizationId: CORRECT_ORG_ID
  });
  console.log(`✅ Successfully updated users/${TARGET_USER_UID} to organizationId = "${CORRECT_ORG_ID}".`);
}

fixUserOrgId().catch(console.error);
