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

  /**
   * Resolves a site by its secure, non-guessable checkInToken.
   */
  public static async getSiteByCheckInToken(checkInToken: string): Promise<Site | null> {
    if (!checkInToken) return null;
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('checkInToken', '==', checkInToken));
    const snapshot = await getDocs(q);
    if (snapshot.empty || !snapshot.docs[0]) {
      // Fallback: check if checkInToken matches site doc ID
      const directSite = await this.getSiteById(checkInToken);
      return directSite;
    }
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Site;
  }

  /**
   * Ensures the site has a unique secure checkInToken. Generates one if missing.
   */
  public static async ensureSiteCheckInToken(siteId: string): Promise<string> {
    const site = await this.getSiteById(siteId);
    if (!site) throw new Error('Site not found');
    if (site.checkInToken) return site.checkInToken;

    const generatedToken = `st_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    await this.updateSite(siteId, { checkInToken: generatedToken });
    return generatedToken;
  }

  public static async createSite(data: {
    name: string;
    address?: string;
    supervisorId?: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const checkInToken = `st_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    const docRef = await addDoc(colRef, {
      name: data.name.trim(),
      address: data.address?.trim() || '',
      supervisorId: data.supervisorId || '',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      radiusMeters: data.radiusMeters ?? 150,
      checkInToken,
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
