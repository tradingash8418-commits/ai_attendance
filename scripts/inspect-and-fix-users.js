const path = require('path');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');
if (!module.paths.includes(frontendNodeModules)) {
  module.paths.push(frontendNodeModules);
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, doc } = require('firebase/firestore');

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

async function inspectUsers() {
  const snap = await getDocs(collection(db, 'users'));
  console.log(`Found ${snap.docs.length} users documents:`);
  for (const d of snap.docs) {
    console.log(`ID: "${d.id}" -> data:`, d.data());
    
    // Fix any mismatch
    const data = d.data();
    if (data.email === 'admin@gmail.com' || d.id.startsWith('VP2k')) {
      const correctOrgId = `org_${d.id}`;
      console.log(`Updating user ${d.id} organizationId to "${correctOrgId}"`);
      await setDoc(doc(db, 'users', d.id), {
        ...data,
        organizationId: correctOrgId,
        organizationName: "admin's infra"
      }, { merge: true });
    }
  }
}

inspectUsers().catch(console.error);
