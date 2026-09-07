import {
  addDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
  collection,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeWhatsAppNumber } from '@/lib/formatters';
import { OrgContextService } from './org-context.service';
import type { Supervisor } from '@/types/supervisor';

const COLLECTION_NAME = 'supervisors';

export class SupervisorsService {
  public static async getSupervisors(orgId?: string): Promise<Supervisor[]> {
    const targetOrg = orgId || OrgContextService.getOrgId();
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [orderBy('createdAt', 'desc')],
      targetOrg
    );

    const result = docs.map((d) => ({
      id: d.id,
      ...d,
    })) as Supervisor[];

    if (targetOrg !== 'org_primary') {
      try {
        const primaryDocs = await OrgContextService.getDocsWithFallback(
          COLLECTION_NAME,
          [orderBy('createdAt', 'desc')],
          'org_primary'
        );
        const existingIds = new Set(result.map((s) => s.id));
        for (const pd of primaryDocs) {
          if (!existingIds.has(pd.id)) {
            result.push({ id: pd.id, ...pd } as Supervisor);
          }
        }
      } catch (e) {}
    }

    return result;
  }

  public static async getSupervisorById(id: string, orgId?: string): Promise<Supervisor | null> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    if (!res.data) return null;
    return { id, ...res.data } as Supervisor;
  }

  public static async getSupervisorByWhatsAppNumber(
    rawNumber: string,
    orgId?: string
  ): Promise<Supervisor | null> {
    const normalized = normalizeWhatsAppNumber(rawNumber);
    if (!normalized) return null;

    const all = await this.getSupervisors(orgId);
    const match = all.find(
      (s) =>
        s.active !== false &&
        (normalizeWhatsAppNumber(s.whatsappNumber || '') === normalized ||
          normalizeWhatsAppNumber(s.phone || '') === normalized)
    );
    if (match) return match;

    // Fallback: Global lookup in root `users` collection by WhatsApp/Phone number
    try {
      const usersColRef = collection(db, 'users');
      const usersSnap = await getDocs(query(usersColRef));
      const matchingUserDoc = usersSnap.docs.find((d) => {
        const u = d.data();
        const uWa = normalizeWhatsAppNumber(u.whatsappNumber || '');
        const uPhone = normalizeWhatsAppNumber(u.phone || '');
        return uWa === normalized || uPhone === normalized;
      });

      if (matchingUserDoc) {
        const uData = matchingUserDoc.data();
        return {
          id: matchingUserDoc.id,
          name: uData.displayName || 'Contractor Admin',
          whatsappNumber: uData.whatsappNumber || normalized,
          phone: uData.phone || normalized,
          organizationId: uData.organizationId || OrgContextService.getOrgId(),
          active: true,
          createdAt: uData.createdAt || new Date().toISOString(),
          updatedAt: uData.updatedAt || new Date().toISOString(),
        } as Supervisor;
      }
    } catch (err) {
      console.warn('[SupervisorsService] Global users lookup error:', err);
    }

    return null;
  }

  /**
   * Alias and fallback for supervisor lookup by phone or WhatsApp number.
   */
  public static async getSupervisorByPhone(
    rawNumber: string,
    orgId?: string
  ): Promise<Supervisor | null> {
    return await this.getSupervisorByWhatsAppNumber(rawNumber, orgId);
  }

  public static async createSupervisor(
    data: {
      name: string;
      phone?: string;
      whatsappNumber: string;
      email?: string;
    },
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();
    const normalizedNumber = normalizeWhatsAppNumber(data.whatsappNumber);

    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
      name: data.name.trim(),
      phone: data.phone?.trim() || normalizedNumber,
      whatsappNumber: normalizedNumber,
      email: data.email?.trim() || '',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  public static async updateSupervisor(
    id: string,
    data: Partial<Omit<Supervisor, 'id' | 'createdAt' | 'updatedAt'>>,
    orgId?: string
  ): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    const updateData: Record<string, any> = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    if (data.whatsappNumber) {
      updateData.whatsappNumber = normalizeWhatsAppNumber(data.whatsappNumber);
    }

    await updateDoc(res.ref, updateData);
  }

  public static async toggleSupervisorActive(
    id: string,
    active: boolean,
    orgId?: string
  ): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    await updateDoc(res.ref, {
      active,
      updatedAt: serverTimestamp(),
    });
  }
}
