import type { User } from 'firebase/auth';
import type { UserProfile } from '@/services/user-profile.service';

export interface SystemStatus {
  frontendConnected: boolean;
  firebaseConfigured: boolean;
  environmentLoaded: boolean;
  emulatorActive: boolean;
  environmentName: string;
}

export interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  organizationId: string;
  loading: boolean;
  error: string | null;
}

export * from './worker';
export * from './site';
export * from './supervisor';
export * from './attendance';
export * from './whatsapp';
export * from './embedding';
export type { UserProfile } from '@/services/user-profile.service';
