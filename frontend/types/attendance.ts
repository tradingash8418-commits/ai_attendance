import type { Timestamp } from 'firebase/firestore';

export type AttendanceSessionStatus =
  | 'received'
  | 'processing'
  | 'completed'
  | 'needs_review'
  | 'failed';

export interface AttendanceSession {
  id: string;
  siteId: string;
  supervisorId: string;
  whatsappMessageId?: string;
  whatsappSenderNumber?: string;
  date: string; // ISO Date String: YYYY-MM-DD
  receivedAt: Timestamp;
  photoUrl?: string;
  status: AttendanceSessionStatus;
  processingStartedAt?: Timestamp;
  processingCompletedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AttendanceStatus = 'present' | 'absent';
export type AttendanceMethod = 'face_recognition' | 'manual_review';
export type AttendanceVerificationStatus = 'verified' | 'needs_review' | 'rejected';

export interface AttendanceRecord {
  id: string;
  attendanceSessionId: string;
  workerId: string;
  siteId: string;
  date: string; // ISO Date String: YYYY-MM-DD
  checkInTime?: Timestamp;
  status: AttendanceStatus;
  method: AttendanceMethod;
  confidence?: number;
  verificationStatus: AttendanceVerificationStatus;
  attendancePhotoUrl?: string;
  submittedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
