import type { User } from 'firebase/auth';

export interface SystemStatus {
  frontendConnected: boolean;
  firebaseConfigured: boolean;
  environmentLoaded: boolean;
  emulatorActive: boolean;
  environmentName: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export * from './worker';
export * from './site';
export * from './supervisor';
export * from './attendance';
export * from './whatsapp';
export * from './embedding';
