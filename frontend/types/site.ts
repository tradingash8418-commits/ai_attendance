import type { Timestamp } from 'firebase/firestore';

export interface Site {
  id: string;
  name: string;
  address?: string;
  supervisorId?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // Default: 150 meters
  checkInToken?: string; // Non-guessable site check-in token e.g. st_site_abc123
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SiteAssignment {
  id: string;
  workerId: string;
  siteId: string;
  startDate: string; // ISO Date String: YYYY-MM-DD
  endDate?: string;  // ISO Date String: YYYY-MM-DD
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
