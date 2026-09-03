import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Worker } from '@/types/worker';

const COLLECTION_NAME = 'workers';

export class WorkersService {
  public static async getWorkers(): Promise<Worker[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Worker[];
  }

  public static async getWorkerById(id: string): Promise<Worker | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Worker;
  }

  public static async createWorker(data: {
    name: string;
    workerCode?: string;
    phone?: string;
    role?: string;
    photoUrl?: string;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      name: data.name.trim(),
      workerCode: data.workerCode?.trim() || '',
      phone: data.phone?.trim() || '',
      role: data.role?.trim() || 'General Worker',
      photoUrl: data.photoUrl || '',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  public static async updateWorker(
    id: string,
    data: Partial<Omit<Worker, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  public static async toggleWorkerActive(id: string, active: boolean): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      active,
      updatedAt: serverTimestamp(),
    });
  }
}
