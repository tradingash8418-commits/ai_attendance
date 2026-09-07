import {
  addDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getTodayDateString } from '@/lib/formatters';
import { OrgContextService } from './org-context.service';
import type { AttendanceSession, AttendanceSessionStatus } from '@/types/attendance';

const COLLECTION_NAME = 'attendanceSessions';

export class AttendanceSessionsService {
  public static async getAttendanceSessions(
    date?: string,
    orgId?: string
  ): Promise<AttendanceSession[]> {
    const constraints = date && date !== 'all' ? [where('date', '==', date)] : [];
    const rawDocs = await OrgContextService.getDocsWithFallback(COLLECTION_NAME, constraints, orgId);

    const docs = rawDocs.map((data) => {
      let sessionStatus = data.status || 'received';

      if (sessionStatus === 'processing') {
        sessionStatus = 'completed';
      }

      return {
        id: data.id,
        ...data,
        status: sessionStatus,
      };
    }) as AttendanceSession[];

    return docs.sort((a, b) => {
      const tA = (a as any).receivedAt?.seconds || 0;
      const tB = (b as any).receivedAt?.seconds || 0;
      return tB - tA;
    });
  }

  public static async getAttendanceSessionById(
    id: string,
    orgId?: string
  ): Promise<AttendanceSession | null> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    if (!res.data) return null;
    return { id, ...res.data } as AttendanceSession;
  }

  public static async createAttendanceSession(
    data: {
      siteId: string;
      supervisorId: string;
      whatsappMessageId?: string;
      whatsappSenderNumber?: string;
      date?: string;
      photoUrl?: string;
      status?: AttendanceSessionStatus;
    },
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();
    const sessionDate = data.date || getTodayDateString();

    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
      siteId: data.siteId,
      supervisorId: data.supervisorId,
      whatsappMessageId: data.whatsappMessageId || '',
      whatsappSenderNumber: data.whatsappSenderNumber || '',
      date: sessionDate,
      receivedAt: now,
      photoUrl: data.photoUrl || '',
      status: data.status || 'received',
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  public static async updateSessionStatus(
    id: string,
    status: AttendanceSessionStatus,
    orgId?: string
  ): Promise<void> {
    if (!id) return;
    try {
      let res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
      if (!res.data && orgId && orgId !== 'org_primary') {
        const fallbackRes = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, 'org_primary');
        if (fallbackRes.data) {
          res = fallbackRes;
        }
      }

      if (res.data && res.ref) {
        const now = serverTimestamp();
        const updateData: Record<string, any> = {
          status,
          updatedAt: now,
        };

        if (status === 'processing') {
          updateData.processingStartedAt = now;
        } else if (status === 'completed' || status === 'failed') {
          updateData.processingCompletedAt = now;
        }

        await updateDoc(res.ref, updateData);
      }
    } catch (e) {
      console.warn(`[AttendanceSessionsService] Error updating session status ${id}:`, e);
    }
  }
}
