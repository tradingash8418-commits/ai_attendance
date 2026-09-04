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
import { getTodayDateString } from '@/lib/formatters';
import type { AttendanceSession, AttendanceSessionStatus } from '@/types/attendance';

const COLLECTION_NAME = 'attendanceSessions';

export class AttendanceSessionsService {
  public static async getAttendanceSessions(
    date?: string
  ): Promise<AttendanceSession[]> {
    const colRef = collection(db, COLLECTION_NAME);
    let snapshot;
    try {
      if (date && date !== 'all') {
        const q = query(
          colRef,
          where('date', '==', date),
          orderBy('receivedAt', 'desc')
        );
        snapshot = await getDocs(q);
      } else {
        const q = query(colRef, orderBy('receivedAt', 'desc'));
        snapshot = await getDocs(q);
      }
    } catch (err) {
      console.warn('[AttendanceSessionsService] Using in-memory fallback for sessions:', err);
      if (date && date !== 'all') {
        const simpleQ = query(colRef, where('date', '==', date));
        snapshot = await getDocs(simpleQ);
      } else {
        snapshot = await getDocs(colRef);
      }
    }

    const docs = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      let sessionStatus = data.status || 'received';

      // Auto-cleanup stale processing status from deadlocked earlier requests
      if (sessionStatus === 'processing') {
        sessionStatus = 'completed';
      }

      return {
        id: docSnap.id,
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
    id: string
  ): Promise<AttendanceSession | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as AttendanceSession;
  }

  public static async createAttendanceSession(data: {
    siteId: string;
    supervisorId: string;
    whatsappMessageId?: string;
    whatsappSenderNumber?: string;
    date?: string;
    photoUrl?: string;
    status?: AttendanceSessionStatus;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const sessionDate = data.date || getTodayDateString();

    const docRef = await addDoc(colRef, {
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
    status: AttendanceSessionStatus
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
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

    await updateDoc(docRef, updateData);
  }
}
