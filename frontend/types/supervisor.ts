import type { Timestamp } from 'firebase/firestore';

export interface Supervisor {
  id: string;
  name: string;
  phone?: string;
  whatsappNumber: string; // E.164 normalized (e.g., +919876543210)
  email?: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
