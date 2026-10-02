import type { Timestamp } from 'firebase/firestore';

export type TaskStatus = 'draft' | 'notified' | 'completed' | 'cancelled';

export interface WorkerTaskDetail {
  workerId: string;
  workerName: string;
  workerPhone: string;
  tasks: string; // Worker-specific bullet points / task details
  completionDate?: string; // Target completion date for this worker's task (YYYY-MM-DD)
  notified?: boolean;
  notifiedAt?: Timestamp | string | null;
}

export interface TaskAssignment {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  siteId: string;
  siteName: string;
  date: string; // YYYY-MM-DD (Assignment Date)
  completionDate?: string; // Overall Task Completion Date (YYYY-MM-DD)
  completionTime?: string; // Kept for backward compatibility
  supervisorId: string;
  supervisorName: string;
  supervisorPhone: string;
  supervisorTasks?: string;
  workerDetails: WorkerTaskDetail[];
  assignedWorkerIds: string[];
  assignedWorkerNames: string[];
  assignedWorkerPhones?: string[];
  contactPersonName: string;
  contactPersonPhone: string;
  status: TaskStatus;
  supervisorNotified?: boolean;
  supervisorNotifiedAt?: Timestamp | string | null;
  notifiedAt?: Timestamp | string | null;
  notifiedCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
