import type { Timestamp } from 'firebase/firestore';

export type TaskStatus = 'draft' | 'notified' | 'completed' | 'cancelled';

export interface TaskAssignment {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  siteId: string;
  siteName: string;
  date: string; // YYYY-MM-DD
  supervisorId: string;
  supervisorName: string;
  supervisorPhone: string;
  supervisorTasks?: string;
  assignedWorkerIds: string[];
  assignedWorkerNames: string[];
  assignedWorkerPhones?: string[];
  contactPersonName: string;
  contactPersonPhone: string;
  status: TaskStatus;
  notifiedAt?: Timestamp | string | null;
  notifiedCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
