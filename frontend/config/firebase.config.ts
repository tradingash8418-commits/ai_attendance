export interface FirebaseEnvironmentConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  useEmulator: boolean;
}

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAbtAuBhwH7rSYhoitWMsGxl6PXEW1gHls',
  authDomain: 'face-attendance-9c705.firebaseapp.com',
  projectId: 'face-attendance-9c705',
  storageBucket: 'face-attendance-9c705.firebasestorage.app',
  messagingSenderId: '419158130243',
  appId: '1:419158130243:web:debdd48c8c026c0f695ef6',
};

export const getFirebaseConfig = (): FirebaseEnvironmentConfig => {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    useEmulator: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true',
  };
};

export const isFirebaseConfigured = (): boolean => {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey &&
      config.apiKey !== 'dummy-api-key-placeholder' &&
      config.projectId &&
      config.projectId !== 'contractor-ai-dummy'
  );
};
