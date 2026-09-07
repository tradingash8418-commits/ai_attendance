import {
  addDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { normalizeWhatsAppNumber } from '@/lib/formatters';
import { OrgContextService } from './org-context.service';
import type { Worker } from '@/types/worker';

const COLLECTION_NAME = 'workers';

export class WorkersService {
  public static async getWorkers(orgId?: string): Promise<Worker[]> {
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [orderBy('createdAt', 'desc')],
      orgId
    );
    return docs.map((d) => ({
      id: d.id,
      ...d,
    })) as Worker[];
  }

  public static async getWorkerById(id: string, orgId?: string): Promise<Worker | null> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    if (!res.data) return null;
    return { id, ...res.data } as Worker;
  }

  /**
   * Finds a worker by their normalized WhatsApp phone number.
   */
  public static async getWorkerByPhone(phone: string, orgId?: string): Promise<Worker | null> {
    if (!phone) return null;
    const cleanTarget = normalizeWhatsAppNumber(phone);
    const all = await this.getWorkers(orgId);
    return (
      all.find((w) => w.phone && normalizeWhatsAppNumber(w.phone) === cleanTarget) || null
    );
  }

  /**
   * Finds a worker by phone or auto-registers a new worker record.
   */
  public static async getOrCreateWorkerByPhone(
    phone: string,
    defaultName?: string,
    orgId?: string
  ): Promise<Worker> {
    const existing = await this.getWorkerByPhone(phone, orgId);
    if (existing) return existing;

    const cleanPhone = normalizeWhatsAppNumber(phone);
    const shortSuffix = cleanPhone.slice(-4);
    const fallbackName = defaultName || `Worker (${shortSuffix})`;
    const allWorkers = await this.getWorkers(orgId);
    const nextWorkerCode = `WRK-00${allWorkers.length + 1}`;

    const newId = await this.createWorker(
      {
        name: fallbackName,
        workerCode: nextWorkerCode,
        phone: cleanPhone,
        role: 'General Worker',
        dailyRate: 500,
      },
      orgId
    );

    return {
      id: newId,
      name: fallbackName,
      workerCode: nextWorkerCode,
      phone: cleanPhone,
      role: 'General Worker',
      dailyRate: 500,
      active: true,
      createdAt: null as any,
      updatedAt: null as any,
    };
  }

  public static async createWorker(
    data: {
      name: string;
      workerCode?: string;
      phone?: string;
      role?: string;
      dailyRate?: number;
      photoUrl?: string;
    },
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
      name: data.name.trim(),
      workerCode: data.workerCode?.trim() || '',
      phone: data.phone?.trim() || '',
      role: data.role?.trim() || 'General Worker',
      dailyRate: typeof data.dailyRate === 'number' && data.dailyRate > 0 ? data.dailyRate : 500,
      photoUrl: data.photoUrl || '',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  public static async updateWorker(
    id: string,
    data: Partial<Omit<Worker, 'id' | 'createdAt' | 'updatedAt'>>,
    orgId?: string
  ): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    await updateDoc(res.ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  public static async toggleWorkerActive(id: string, active: boolean, orgId?: string): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    await updateDoc(res.ref, {
      active,
      updatedAt: serverTimestamp(),
    });
  }
}
