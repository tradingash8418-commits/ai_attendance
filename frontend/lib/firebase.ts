import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getFirebaseConfig } from '@/config/firebase.config';

const config = getFirebaseConfig();

const app: FirebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// Connect to Local Firebase Emulators if configured
if (config.useEmulator && typeof window !== 'undefined') {
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
  try {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
    connectStorageEmulator(storage, emulatorHost, 9199);
  } catch (error) {
    // Prevent duplicate emulator connection errors on hot-reloading
    console.warn('Firebase emulator connection notice:', error);
  }
}

export { app, auth, db, storage };
