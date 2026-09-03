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
import { normalizeWhatsAppNumber } from '@/lib/formatters';
import type { Supervisor } from '@/types/supervisor';

const COLLECTION_NAME = 'supervisors';

export class SupervisorsService {
  public static async getSupervisors(): Promise<Supervisor[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Supervisor[];
  }

  public static async getSupervisorById(id: string): Promise<Supervisor | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Supervisor;
  }

  public static async getSupervisorByWhatsAppNumber(
    rawNumber: string
  ): Promise<Supervisor | null> {
    const normalized = normalizeWhatsAppNumber(rawNumber);
    if (!normalized) return null;

    const colRef = collection(db, COLLECTION_NAME);
    const q = query(
      colRef,
      where('whatsappNumber', '==', normalized),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    if (!docSnap) return null;
    return { id: docSnap.id, ...docSnap.data() } as Supervisor;
  }

  /**
   * Alias and fallback for supervisor lookup by phone or WhatsApp number.
   */
  public static async getSupervisorByPhone(
    rawNumber: string
  ): Promise<Supervisor | null> {
    const byWa = await this.getSupervisorByWhatsAppNumber(rawNumber);
    if (byWa) return byWa;

    const normalized = normalizeWhatsAppNumber(rawNumber);
    if (!normalized) return null;

    const colRef = collection(db, COLLECTION_NAME);
    const q = query(
      colRef,
      where('phone', '==', normalized),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    if (!docSnap) return null;
    return { id: docSnap.id, ...docSnap.data() } as Supervisor;
  }

  public static async createSupervisor(data: {
    name: string;
    phone?: string;
    whatsappNumber: string;
    email?: string;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const normalizedNumber = normalizeWhatsAppNumber(data.whatsappNumber);

    const docRef = await addDoc(colRef, {
      name: data.name.trim(),
      phone: data.phone?.trim() || normalizedNumber,
      whatsappNumber: normalizedNumber,
      email: data.email?.trim() || '',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  public static async updateSupervisor(
    id: string,
    data: Partial<Omit<Supervisor, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    if (data.whatsappNumber) {
      updateData.whatsappNumber = normalizeWhatsAppNumber(data.whatsappNumber);
    }

    await updateDoc(docRef, updateData);
  }

  public static async toggleSupervisorActive(
    id: string,
    active: boolean
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      active,
      updatedAt: serverTimestamp(),
    });
  }
}
