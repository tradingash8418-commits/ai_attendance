import {
  addDoc,
  updateDoc,
  setDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { normalizeWhatsAppNumber } from '@/lib/formatters';
import { OrgContextService } from './org-context.service';
import type { Worker } from '@/types/worker';

const COLLECTION_NAME = 'workers';
const DEFAULT_ORG_ID = 'org_primary';

export class WorkersService {
  public static async getWorkers(orgId?: string): Promise<Worker[]> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [orderBy('createdAt', 'desc')],
      targetOrg
    );

    const result = docs.map((d) => ({
      id: d.id,
      ...d,
    })) as Worker[];

    // Fallback: If contractor org has docs, but worker was created in default org_primary, merge primary workers
    if (targetOrg !== DEFAULT_ORG_ID) {
      try {
        const primaryDocs = await OrgContextService.getDocsWithFallback(
          COLLECTION_NAME,
          [orderBy('createdAt', 'desc')],
          DEFAULT_ORG_ID
        );
        const existingIds = new Set(result.map((w) => w.id));
        for (const pd of primaryDocs) {
          if (!existingIds.has(pd.id)) {
            result.push({ id: pd.id, ...pd } as Worker);
          }
        }
      } catch (e) {
        console.warn('[WorkersService] Error fetching fallback workers:', e);
      }
    }

    return result;
  }

  public static async getWorkerById(id: string, orgId?: string): Promise<Worker | null> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    if (res.data) {
      return { id, ...res.data } as Worker;
    }

    // Fallback search under DEFAULT_ORG_ID if worker was initially created in primary org
    if (orgId && orgId !== DEFAULT_ORG_ID) {
      const fallbackRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, DEFAULT_ORG_ID);
      if (fallbackRes.data) {
        return { id, ...fallbackRes.data } as Worker;
      }
    }

    return null;
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
   * Flexible parameter order handling: supports (phone, orgId) and (phone, defaultName, orgId).
   */
  public static async getOrCreateWorkerByPhone(
    phone: string,
    arg2?: string,
    arg3?: string
  ): Promise<Worker> {
    let targetOrgId: string | undefined = undefined;
    let fallbackNameCandidate: string | undefined = undefined;

    if (arg2) {
      if (arg2.startsWith('org_') || arg2.includes('-') || !arg3) {
        targetOrgId = arg2;
        fallbackNameCandidate = arg3;
      } else {
        fallbackNameCandidate = arg2;
        targetOrgId = arg3;
      }
    }

    const finalOrgId = targetOrgId || OrgContextService.getOrgId();
    const cleanPhone = normalizeWhatsAppNumber(phone);

    const existing = await this.getWorkerByPhone(cleanPhone, finalOrgId);
    if (existing) {
      // If existing worker doc is found, ensure doc exists under target orgId too
      if (finalOrgId && (existing as any).organizationId !== finalOrgId) {
        try {
          await this.createWorkerWithId(
            existing.id,
            {
              name: existing.name,
              workerCode: existing.workerCode,
              phone: existing.phone,
              role: existing.role,
              dailyRate: existing.dailyRate,
              photoUrl: existing.photoUrl,
            },
            finalOrgId
          );
        } catch (e) {}
      }
      return existing;
    }

    const shortSuffix = cleanPhone.slice(-4);
    const fallbackName =
      fallbackNameCandidate && !fallbackNameCandidate.startsWith('org_')
        ? fallbackNameCandidate
        : `Worker (${shortSuffix})`;

    const allWorkers = await this.getWorkers(finalOrgId);
    const nextWorkerCode = `WRK-00${allWorkers.length + 1}`;

    const newId = await this.createWorker(
      {
        name: fallbackName,
        workerCode: nextWorkerCode,
        phone: cleanPhone,
        role: 'General Worker',
        dailyRate: 500,
      },
      finalOrgId
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
    } as Worker;
  }

  public static async createWorkerWithId(
    docId: string,
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
    const targetOrgId = orgId || OrgContextService.getOrgId();
    const docRef = OrgContextService.getDocRef(COLLECTION_NAME, docId, targetOrgId);
    const now = serverTimestamp();
    await setDoc(
      docRef,
      {
        organizationId: targetOrgId,
        name: data.name.trim(),
        workerCode: data.workerCode?.trim() || '',
        phone: data.phone?.trim() || '',
        role: data.role?.trim() || 'General Worker',
        dailyRate: typeof data.dailyRate === 'number' && data.dailyRate > 0 ? data.dailyRate : 500,
        photoUrl: data.photoUrl || '',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    return docId;
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
    const targetOrgId = orgId || OrgContextService.getOrgId();
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, targetOrgId);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      organizationId: targetOrgId,
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

