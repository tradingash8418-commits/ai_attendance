import {
  addDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { OrgContextService } from './org-context.service';
import type { Site } from '@/types/site';

const COLLECTION_NAME = 'sites';

export class SitesService {
  public static async getSites(orgId?: string): Promise<Site[]> {
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [orderBy('createdAt', 'desc')],
      orgId
    );
    return docs.map((d) => ({
      id: d.id,
      ...d,
    })) as Site[];
  }

  public static async getSiteById(id: string, orgId?: string): Promise<Site | null> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    if (!res.data) return null;
    return { id, ...res.data } as Site;
  }

  /**
   * Retrieves active construction site assigned to a specific supervisor.
   */
  public static async getSiteBySupervisorId(supervisorId: string, orgId?: string): Promise<Site | null> {
    if (!supervisorId) return null;
    const sites = await this.getSites(orgId);
    return sites.find((s) => s.supervisorId === supervisorId && s.active !== false) || null;
  }

  /**
   * Resolves a site by its secure, non-guessable checkInToken.
   */
  public static async getSiteByCheckInToken(checkInToken: string, orgId?: string): Promise<Site | null> {
    if (!checkInToken) return null;
    const sites = await this.getSites(orgId);
    const tokenSite = sites.find((s) => s.checkInToken === checkInToken);
    if (tokenSite) return tokenSite;

    // Fallback: check if checkInToken matches site doc ID
    return await this.getSiteById(checkInToken, orgId);
  }

  /**
   * Ensures the site has a unique secure checkInToken. Generates one if missing.
   */
  public static async ensureSiteCheckInToken(siteId: string, orgId?: string): Promise<string> {
    const site = await this.getSiteById(siteId, orgId);
    if (!site) throw new Error('Site not found');
    if (site.checkInToken) return site.checkInToken;

    const generatedToken = `st_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    await this.updateSite(siteId, { checkInToken: generatedToken }, orgId);
    return generatedToken;
  }

  public static async createSite(
    data: {
      name: string;
      address?: string;
      supervisorId?: string;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
    },
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();
    const checkInToken = `st_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
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
    data: Partial<Omit<Site, 'id' | 'createdAt' | 'updatedAt'>>,
    orgId?: string
  ): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    await updateDoc(res.ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  public static async toggleSiteActive(id: string, active: boolean, orgId?: string): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    await updateDoc(res.ref, {
      active,
      updatedAt: serverTimestamp(),
    });
  }

  public static async assignSupervisorToSite(
    siteId: string,
    supervisorId: string,
    orgId?: string
  ): Promise<void> {
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, siteId, orgId);
    await updateDoc(res.ref, {
      supervisorId,
      updatedAt: serverTimestamp(),
    });
  }
}
