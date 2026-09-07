import {
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrgContextService } from './org-context.service';
import type { Site } from '@/types/site';

const COLLECTION_NAME = 'sites';
const GLOBAL_SITE_TOKENS_COLLECTION = 'siteTokens';

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
   * Resolves a site by its secure, non-guessable checkInToken across any contractor organization.
   * Performs instant, 0-index direct document lookup in root siteTokens collection.
   */
  public static async getSiteByCheckInToken(checkInToken: string, orgId?: string): Promise<Site | null> {
    if (!checkInToken) return null;

    // 1. Direct document ID lookup in root 'siteTokens' mapping collection (0 index required!)
    try {
      const siteTokenRef = doc(db, GLOBAL_SITE_TOKENS_COLLECTION, checkInToken);
      const siteTokenSnap = await getDoc(siteTokenRef);
      if (siteTokenSnap.exists()) {
        const { siteId, organizationId } = siteTokenSnap.data();
        if (siteId && organizationId) {
          const resolvedSite = await this.getSiteById(siteId, organizationId);
          if (resolvedSite) return resolvedSite;
        }
      }
    } catch (err) {
      console.warn('[SitesService] Root siteTokens lookup error:', err);
    }

    // 2. Local org sites check
    const sites = await this.getSites(orgId);
    const tokenSite = sites.find((s) => s.checkInToken === checkInToken || s.id === checkInToken);
    if (tokenSite) return tokenSite;

    // 3. Fallback: check if checkInToken matches site doc ID in orgId
    return await this.getSiteById(checkInToken, orgId);
  }

  /**
   * Ensures the site has a unique secure checkInToken. Generates one if missing.
   */
  public static async ensureSiteCheckInToken(siteId: string, orgId?: string): Promise<string> {
    const site = await this.getSiteById(siteId, orgId);
    if (!site) throw new Error('Site not found');
    
    const targetOrgId = site.organizationId || orgId || OrgContextService.getOrgId();

    if (site.checkInToken) {
      // Ensure global siteTokens mapping document exists
      try {
        const siteTokenRef = doc(db, GLOBAL_SITE_TOKENS_COLLECTION, site.checkInToken);
        const snap = await getDoc(siteTokenRef);
        if (!snap.exists()) {
          await setDoc(siteTokenRef, {
            siteId,
            organizationId: targetOrgId,
            checkInToken: site.checkInToken,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (e) {}
      return site.checkInToken;
    }

    const generatedToken = `st_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    await this.updateSite(siteId, { checkInToken: generatedToken }, targetOrgId);
    
    try {
      await setDoc(doc(db, GLOBAL_SITE_TOKENS_COLLECTION, generatedToken), {
        siteId,
        organizationId: targetOrgId,
        checkInToken: generatedToken,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {}

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
    const targetOrgId = orgId || OrgContextService.getOrgId();
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, targetOrgId);
    const now = serverTimestamp();
    const checkInToken = `st_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    
    const docRef = await addDoc(colRef, {
      organizationId: targetOrgId,
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

    // Write root siteTokens mapping doc for instant 0-index lookups
    try {
      await setDoc(doc(db, GLOBAL_SITE_TOKENS_COLLECTION, checkInToken), {
        siteId: docRef.id,
        organizationId: targetOrgId,
        checkInToken,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[SitesService] Error creating siteTokens mapping doc:', e);
    }

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

    if (data.checkInToken) {
      try {
        const targetOrg = res.data?.organizationId || orgId || OrgContextService.getOrgId();
        await setDoc(doc(db, GLOBAL_SITE_TOKENS_COLLECTION, data.checkInToken), {
          siteId: id,
          organizationId: targetOrg,
          checkInToken: data.checkInToken,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {}
    }
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

