import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTodayDateString } from '@/lib/formatters';
import type { SiteAssignment } from '@/types/site';

const COLLECTION_NAME = 'siteAssignments';

export class SiteAssignmentsService {
  public static async getSiteAssignments(): Promise<SiteAssignment[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as SiteAssignment[];
  }

  /**
   * Resolves a worker's assigned site on a given date string (YYYY-MM-DD).
   * Verifies that the date falls within [startDate, endDate] and active == true.
   */
  public static async getWorkerSiteAssignment(
    workerId: string,
    targetDate: string = getTodayDateString()
  ): Promise<SiteAssignment | null> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(
      colRef,
      where('workerId', '==', workerId),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      const assignment = { id: docSnap.id, ...docSnap.data() } as SiteAssignment;
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
    targetDate: string = getTodayDateString()
  ): Promise<SiteAssignment[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(
      colRef,
      where('siteId', '==', siteId),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SiteAssignment))
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
    startDate: string = getTodayDateString()
  ): Promise<string> {
    // 1. Deactivate existing active assignments for this worker
    const colRef = collection(db, COLLECTION_NAME);
    const existingQ = query(
      colRef,
      where('workerId', '==', workerId),
      where('active', '==', true)
    );
    const existingSnap = await getDocs(existingQ);

    const now = serverTimestamp();
    for (const docSnap of existingSnap.docs) {
      const existingRef = doc(db, COLLECTION_NAME, docSnap.id);
      await updateDoc(existingRef, {
        active: false,
        endDate: startDate,
        updatedAt: now,
      });
    }

    // 2. Create new site assignment record
    const newDocRef = await addDoc(colRef, {
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
