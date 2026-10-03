import {
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  QueryConstraint,
  serverTimestamp,
} from 'firebase/firestore';
import { OrgContextService } from './org-context.service';
import type { TaskAssignment, TaskStatus } from '@/types/task';

const COLLECTION_NAME = 'tasks';

export class TasksService {
  /**
   * Retrieves tasks for the contractor organization using optimized server-side query constraints.
   */
  public static async getTasks(
    filters?: {
      date?: string;
      siteId?: string;
      status?: TaskStatus;
      supervisorId?: string;
    },
    orgId?: string
  ): Promise<TaskAssignment[]> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const constraints: QueryConstraint[] = [];

    if (filters?.date) {
      constraints.push(where('date', '==', filters.date));
    }
    if (filters?.siteId) {
      constraints.push(where('siteId', '==', filters.siteId));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.supervisorId) {
      constraints.push(where('supervisorId', '==', filters.supervisorId));
    }

    if (!filters?.date && !filters?.siteId && !filters?.status && !filters?.supervisorId) {
      constraints.push(orderBy('date', 'desc'));
    }

    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      constraints,
      targetOrg
    );

    return docs.map((d) => ({
      id: d.id,
      ...d,
    })) as TaskAssignment[];
  }

  /**
   * Creates a new daily task assignment in Firestore.
   */
  public static async createTask(
    data: Omit<TaskAssignment, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    orgId?: string
  ): Promise<string> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, targetOrg);
    const now = serverTimestamp();

    const docRef = await addDoc(colRef, {
      organizationId: targetOrg,
      title: data.title.trim(),
      description: data.description.trim(),
      siteId: data.siteId || '',
      siteName: data.siteName || '',
      date: data.date,
      completionDate: (data.completionDate || data.completionTime || '').trim(),
      completionTime: (data.completionTime || data.completionDate || '').trim(),
      supervisorId: data.supervisorId || '',
      supervisorName: data.supervisorName || '',
      supervisorPhone: data.supervisorPhone || '',
      supervisorTasks: (data.supervisorTasks || '').trim(),
      workerDetails: data.workerDetails || [],
      assignedWorkerIds: data.assignedWorkerIds || [],
      assignedWorkerNames: data.assignedWorkerNames || [],
      assignedWorkerPhones: data.assignedWorkerPhones || [],
      contactPersonName: data.contactPersonName || '',
      contactPersonPhone: data.contactPersonPhone || '',
      locationLandmark: (data.locationLandmark || '').trim(),
      mapLink: (data.mapLink || '').trim(),
      status: data.status || 'draft',
      supervisorNotified: false,
      createdAt: now,
      updatedAt: now,
    });

    return docRef.id;
  }

  /**
   * Updates an existing task assignment.
   */
  public static async updateTask(
    taskId: string,
    updates: Partial<TaskAssignment>,
    orgId?: string
  ): Promise<void> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const docRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, taskId, targetOrg);

    await updateDoc(docRes.ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Deletes a task assignment.
   */
  public static async deleteTask(taskId: string, orgId?: string): Promise<void> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const docRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, taskId, targetOrg);
    await deleteDoc(docRes.ref);
  }

  /**
   * Dispatches WhatsApp notification message to assigned worker(s) ONLY (without notifying supervisor).
   */
  public static async notifyWorkerViaWhatsApp(
    taskId: string,
    workerId: string = 'all',
    orgId?: string
  ): Promise<{ success: boolean; notifiedCount: number; errors: string[] }> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    try {
      const response = await fetch('/api/tasks/notify-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, workerId, orgId: targetOrg }),
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('[TasksService] Error calling /api/tasks/notify-worker:', err);
      return { success: false, notifiedCount: 0, errors: [err?.message || 'Network error'] };
    }
  }

  /**
   * Dispatches ONE single Master Summary WhatsApp message to the supervisor listing all team workers & their tasks.
   */
  public static async notifySupervisorViaWhatsApp(
    taskId: string,
    orgId?: string
  ): Promise<{ success: boolean; notifiedCount: number; errors: string[] }> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    try {
      const response = await fetch('/api/tasks/notify-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, orgId: targetOrg }),
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('[TasksService] Error calling /api/tasks/notify-supervisor:', err);
      return { success: false, notifiedCount: 0, errors: [err?.message || 'Network error'] };
    }
  }

  /**
   * Legacy wrapper for backward compatibility.
   */
  public static async notifyTaskViaWhatsApp(
    taskId: string,
    orgId?: string
  ): Promise<{ success: boolean; notifiedCount: number; errors: string[] }> {
    const workerRes = await this.notifyWorkerViaWhatsApp(taskId, 'all', orgId);
    const supRes = await this.notifySupervisorViaWhatsApp(taskId, orgId);

    return {
      success: workerRes.success && supRes.success,
      notifiedCount: workerRes.notifiedCount + supRes.notifiedCount,
      errors: [...workerRes.errors, ...supRes.errors],
    };
  }
}
