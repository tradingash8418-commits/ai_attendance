import type { Timestamp } from 'firebase/firestore';

export interface PendingCheckin {
  id: string;
  token: string;
  siteId: string;
  siteToken: string;
  phone?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  status: 'pending' | 'used' | 'expired';
  createdAt: Timestamp | string;
  expiresAt: Timestamp | string;
  triggerMessageId?: string;
  usedAt?: Timestamp | string;
}
