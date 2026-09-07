import {
  addDoc,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getTodayDateString } from '@/lib/formatters';
import { OrgContextService } from './org-context.service';
import type { SiteAssignment } from '@/types/site';

const COLLECTION_NAME = 'siteAssignments';

export class SiteAssignmentsService {
  public static async getSiteAssignments(orgId?: string): Promise<SiteAssignment[]> {
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [orderBy('createdAt', 'desc')],
      orgId
    );
    return docs.map((d) => ({
      id: d.id,
      ...d,
    })) as SiteAssignment[];
  }

  /**
   * Resolves a worker's assigned site on a given date string (YYYY-MM-DD).
   * Verifies that the date falls within [startDate, endDate] and active == true.
   */
  public static async getWorkerSiteAssignment(
    workerId: string,
    targetDate: string = getTodayDateString(),
    orgId?: string
  ): Promise<SiteAssignment | null> {
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [where('workerId', '==', workerId), where('active', '==', true)],
      orgId
    );

    for (const d of docs) {
      const assignment = { id: d.id, ...d } as SiteAssignment;
      const start = assignment.startDate;
      const end = assignment.endDate;

      if (start <= targetDate && (!end || end >= targetDate)) {
        return assignment;
      }
    }
    return null;
  }

  /**
   * Retrieves all workers assigned to a specific site.
   */
  public static async getAssignmentsBySite(
    siteId: string,
    targetDate: string = getTodayDateString(),
    orgId?: string
  ): Promise<SiteAssignment[]> {
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [where('siteId', '==', siteId), where('active', '==', true)],
      orgId
    );

    return docs
      .map((d) => ({ id: d.id, ...d } as SiteAssignment))
      .filter((assignment) => {
        const start = assignment.startDate;
        const end = assignment.endDate;
        return start <= targetDate && (!end || end >= targetDate);
      });
  }

  /**
   * Assigns a worker to a site. Deactivates any previous active assignment
   * for this worker to prevent overlapping active assignments.
   */
  public static async assignWorkerToSite(
    workerId: string,
    siteId: string,
    startDate: string = getTodayDateString(),
    orgId?: string
  ): Promise<string> {
    const existingQ = [where('workerId', '==', workerId), where('active', '==', true)];
    const existingDocs = await OrgContextService.getDocsWithFallback(COLLECTION_NAME, existingQ, orgId);

    const now = serverTimestamp();
    for (const d of existingDocs) {
      const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, d.id, orgId);
      await updateDoc(res.ref, {
        active: false,
        endDate: startDate,
        updatedAt: now,
      });
    }

    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const newDocRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
      workerId,
      siteId,
      startDate,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    return newDocRef.id;
  }
}
