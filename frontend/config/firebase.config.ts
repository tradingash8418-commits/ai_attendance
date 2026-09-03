export interface FirebaseEnvironmentConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  useEmulator: boolean;
}

export const getFirebaseConfig = (): FirebaseEnvironmentConfig => {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
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
