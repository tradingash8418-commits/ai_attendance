import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PendingCheckin } from '@/types/pendingCheckin';

const COLLECTION_NAME = 'pendingCheckins';
const TOKEN_TTL_MINUTES = 10;

export class PendingCheckinService {
  /**
   * Creates a short-lived, single-use pending checkin session after successful server-side GPS verification.
   */
  public static async createPendingCheckin(data: {
    siteId: string;
    siteToken: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
  }): Promise<{ id: string; token: string }> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);

    // Cryptographically random 6-character hex suffix
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestampCode = Date.now().toString(36).substring(4).toUpperCase();
    const token = `CK_${timestampCode}_${randomHex}`;

    const docRef = await addDoc(colRef, {
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
  public static async getPendingCheckinByToken(token: string): Promise<PendingCheckin | null> {
    if (!token) return null;
    const cleanToken = token.trim().toUpperCase();
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('token', '==', cleanToken));
    const snapshot = await getDocs(q);

    if (snapshot.empty || !snapshot.docs[0]) return null;
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    return {
      id: docSnap.id,
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
    };
  }

  /**
   * Finds the latest active, non-expired pending checkin session for a specific phone number.
   */
  public static async getActivePendingCheckinByPhone(phone: string): Promise<PendingCheckin | null> {
    if (!phone) return null;
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('phone', '==', phone), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const now = Date.now();
    const validSessions = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
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
        } as PendingCheckin;
      })
      .filter((s) => {
        const expiryTime = new Date(s.expiresAt as string).getTime();
        return expiryTime > now && s.status === 'pending';
      });

    if (validSessions.length === 0) return null;

    // Return the newest valid session
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
    triggerMessageId?: string
  ): Promise<PendingCheckin | null> {
    const session = await this.getPendingCheckinByToken(token);
    if (!session) return null;

    const expiryTime = new Date(session.expiresAt as string).getTime();
    if (Date.now() > expiryTime || session.status !== 'pending') {
      return null;
    }

    const docRef = doc(db, COLLECTION_NAME, session.id);
    await updateDoc(docRef, {
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
  public static async markPendingCheckinUsed(id: string): Promise<void> {
    if (!id) return;
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      status: 'used',
      usedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  }
}
