import {
  addDoc,
  updateDoc,
  where,
  serverTimestamp,
  collectionGroup,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrgContextService } from './org-context.service';
import type { PendingCheckin } from '@/types/pendingCheckin';

const COLLECTION_NAME = 'pendingCheckins';
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
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);

    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestampCode = Date.now().toString(36).substring(4).toUpperCase();
    const token = `CK_${timestampCode}_${randomHex}`;

    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
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
    });

    return { id: docRef.id, token };
  }

  /**
   * Resolves a pending checkin session by token.
   */
  public static async getPendingCheckinByToken(token: string, orgId?: string): Promise<PendingCheckin | null> {
    if (!token) return null;
    const cleanToken = token.trim().toUpperCase();
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [where('token', '==', cleanToken)],
      orgId
    );

    let data: any = null;
    if (docs.length > 0 && docs[0]) {
      data = docs[0];
    } else {
      // Global collectionGroup fallback search for pending checkin tokens across all organizations
      try {
        const groupRef = collectionGroup(db, COLLECTION_NAME);
        const groupSnap = await getDocs(query(groupRef, where('token', '==', cleanToken)));
        if (!groupSnap.empty && groupSnap.docs[0]) {
          const docSnap = groupSnap.docs[0];
          data = { id: docSnap.id, ...docSnap.data() };
        }
      } catch (err) {
        console.warn('[PendingCheckinService] Global token lookup error:', err);
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

    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, session.id, orgId);
    await updateDoc(res.ref, {
      phone,
      triggerMessageId: triggerMessageId || '',
      updatedAt: serverTimestamp(),
    });

    session.phone = phone;
    session.triggerMessageId = triggerMessageId;
    return session;
  }

  /**
   * Marks a pending checkin session as used once attendance is successfully recorded.
   */
  public static async markPendingCheckinUsed(id: string, orgId?: string): Promise<void> {
    if (!id) return;
    const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, id, orgId);
    await updateDoc(res.ref, {
      status: 'used',
      usedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  }
}
