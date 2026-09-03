import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Site } from '@/types/site';

const COLLECTION_NAME = 'sites';

export class SitesService {
  public static async getSites(): Promise<Site[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Site[];
  }

  public static async getSiteById(id: string): Promise<Site | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Site;
  }

  /**
   * Retrieves active construction site assigned to a specific supervisor.
   */
  public static async getSiteBySupervisorId(supervisorId: string): Promise<Site | null> {
    if (!supervisorId) return null;
    const sites = await this.getSites();
    return sites.find((s) => s.supervisorId === supervisorId && s.active !== false) || null;
  }

  public static async createSite(data: {
    name: string;
    address?: string;
    supervisorId?: string;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      name: data.name.trim(),
      address: data.address?.trim() || '',
      supervisorId: data.supervisorId || '',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  public static async updateSite(
    id: string,
    data: Partial<Omit<Site, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  public static async toggleSiteActive(id: string, active: boolean): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      active,
      updatedAt: serverTimestamp(),
    });
  }

  public static async assignSupervisorToSite(
    siteId: string,
    supervisorId: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, siteId);
    await updateDoc(docRef, {
      supervisorId,
      updatedAt: serverTimestamp(),
    });
  }
}
