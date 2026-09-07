import {
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrgContextService } from './org-context.service';
import type { PendingCheckin } from '@/types/pendingCheckin';

const COLLECTION_NAME = 'pendingCheckins';
const GLOBAL_TOKENS_COLLECTION = 'pendingCheckinTokens';
const TOKEN_TTL_MINUTES = 10;

export class PendingCheckinService {
  /**
   * Creates a short-lived, single-use pending checkin session after successful server-side GPS verification.
   */
  public static async createPendingCheckin(
    data: {
      siteId: string;
      siteToken: string;
      latitude: number;
      longitude: number;
      distanceMeters: number;
    },
    orgId?: string
  ): Promise<{ id: string; token: string }> {
    const targetOrgId = orgId || OrgContextService.getOrgId();
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, targetOrgId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);

    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestampCode = Date.now().toString(36).substring(4).toUpperCase();
    const token = `CK_${timestampCode}_${randomHex}`;

    const docData = {
      organizationId: targetOrgId,
      token,
      siteId: data.siteId,
      siteToken: data.siteToken,
      latitude: data.latitude,
      longitude: data.longitude,
      distanceMeters: data.distanceMeters,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      serverCreatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(colRef, docData);

    // Save global mapping document for instant, 0-index lookup across all organizations
    try {
      await setDoc(doc(db, GLOBAL_TOKENS_COLLECTION, token.trim().toUpperCase()), {
        ...docData,
        orgDocId: docRef.id,
      });
    } catch (e) {
      console.warn('[PendingCheckinService] Error creating root token mapping:', e);
    }

    return { id: docRef.id, token };
  }

  /**
   * Resolves a pending checkin session by token.
   */
  public static async getPendingCheckinByToken(token: string, orgId?: string): Promise<PendingCheckin | null> {
    if (!token) return null;
    const cleanToken = token.trim().toUpperCase();

    let data: any = null;

    // 1. Direct document ID lookup in root 'pendingCheckinTokens' collection (0 index required!)
    try {
      const globalTokenRef = doc(db, GLOBAL_TOKENS_COLLECTION, cleanToken);
      const globalSnap = await getDoc(globalTokenRef);
      if (globalSnap.exists()) {
        const rawData = globalSnap.data();
        data = { id: rawData.orgDocId || globalSnap.id, ...rawData };
      }
    } catch (err) {
      console.warn('[PendingCheckinService] Global root token lookup error:', err);
    }

    // 2. Fallback to organization subcollection search
    if (!data) {
      const docs = await OrgContextService.getDocsWithFallback(
        COLLECTION_NAME,
        [where('token', '==', cleanToken)],
        orgId
      );
      if (docs.length > 0 && docs[0]) {
        data = docs[0];
      }
    }

    if (!data) return null;

    return {
      id: data.id,
      token: data.token,
      organizationId: data.organizationId,
      siteId: data.siteId,
      siteToken: data.siteToken,
      phone: data.phone,
      latitude: data.latitude,
      longitude: data.longitude,
      distanceMeters: data.distanceMeters,
      status: data.status,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      triggerMessageId: data.triggerMessageId,
    };
  }

  /**
   * Finds the latest active, non-expired pending checkin session for a specific phone number.
   */
  public static async getActivePendingCheckinByPhone(phone: string, orgId?: string): Promise<PendingCheckin | null> {
    if (!phone) return null;
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [where('phone', '==', phone), where('status', '==', 'pending')],
      orgId
    );

    if (docs.length === 0) return null;

    const now = Date.now();
    const validSessions = docs
      .map((data) => ({
        id: data.id,
        token: data.token,
        siteId: data.siteId,
        siteToken: data.siteToken,
        phone: data.phone,
        latitude: data.latitude,
        longitude: data.longitude,
        distanceMeters: data.distanceMeters,
        status: data.status,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        triggerMessageId: data.triggerMessageId,
      } as PendingCheckin))
      .filter((s) => {
        const expiryTime = new Date(s.expiresAt as string).getTime();
        return expiryTime > now && s.status === 'pending';
      });

    if (validSessions.length === 0) return null;

    validSessions.sort((a, b) => {
      const tA = new Date(a.createdAt as string).getTime();
      const tB = new Date(b.createdAt as string).getTime();
      return tB - tA;
    });

    return validSessions[0] || null;
  }

  /**
   * Links a sender's WhatsApp phone number to the pending checkin session upon receiving CHECKIN_<TOKEN>.
   */
  public static async linkPhoneToPendingCheckin(
    token: string,
    phone: string,
    triggerMessageId?: string,
    orgId?: string
  ): Promise<PendingCheckin | null> {
    const session = await this.getPendingCheckinByToken(token, orgId);
    if (!session) return null;

    const expiryTime = new Date(session.expiresAt as string).getTime();
    if (Date.now() > expiryTime || session.status !== 'pending') {
      return null;
    }

    const trueOrgId = session.organizationId || orgId;
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, session.id, trueOrgId);
    await updateDoc(res.ref, {
      phone,
      triggerMessageId: triggerMessageId || '',
      updatedAt: serverTimestamp(),
    });

    // Update global root pendingCheckinTokens mapping doc as well
    try {
      const globalTokenRef = doc(db, GLOBAL_TOKENS_COLLECTION, token.trim().toUpperCase());
      const globalSnap = await getDoc(globalTokenRef);
      if (globalSnap.exists()) {
        await updateDoc(globalTokenRef, {
          phone,
          triggerMessageId: triggerMessageId || '',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('[PendingCheckinService] Error updating root token mapping doc:', e);
    }

    session.phone = phone;
    session.triggerMessageId = triggerMessageId;
    return session;
  }

  /**
   * Marks a pending checkin session as used once attendance is successfully recorded.
   */
  public static async markPendingCheckinUsed(id: string, orgId?: string, token?: string): Promise<void> {
    if (!id) return;
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    await updateDoc(res.ref, {
      status: 'used',
      usedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    if (token) {
      try {
        const globalTokenRef = doc(db, GLOBAL_TOKENS_COLLECTION, token.trim().toUpperCase());
        const globalSnap = await getDoc(globalTokenRef);
        if (globalSnap.exists()) {
          await updateDoc(globalTokenRef, {
            status: 'used',
            usedAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (e) {}
    }
  }
}

