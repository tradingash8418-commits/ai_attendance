import type { Timestamp } from 'firebase/firestore';

export interface Worker {
  id: string;
  workerCode?: string; // Optional code/badge ID to distinguish workers with identical names
  name: string;
  phone?: string;
  role?: string;
  photoUrl?: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkerPhoto {
  id: string;
  workerId: string;
  storagePath: string;
  photoUrl: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
