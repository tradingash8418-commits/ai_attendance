import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { WorkerPhoto } from '@/types/worker';

const COLLECTION_NAME = 'workerPhotos';

export class WorkerPhotosService {
  public static async getWorkerPhotos(workerId: string): Promise<WorkerPhoto[]> {
    const colRef = collection(db, COLLECTION_NAME);
    try {
      const q = query(
        colRef,
        where('workerId', '==', workerId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as WorkerPhoto[];
    } catch (err) {
      // Fallback if composite index (workerId + createdAt) is not created yet in Firebase Console
      const qFallback = query(colRef, where('workerId', '==', workerId));
      const snapshot = await getDocs(qFallback);
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as WorkerPhoto[];
      return docs.sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds || 0;
        const timeB = (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
      });
    }
  }

  public static async uploadWorkerPhoto(
    workerId: string,
    file: File
  ): Promise<WorkerPhoto> {
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let photoUrl = '';
    let storagePath = `workers/${workerId}/photos/${photoId}`;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workerId', workerId);

      const res = await fetch('/api/storage/upload-worker-photo', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        photoUrl = data.photoUrl;
        storagePath = data.storagePath || storagePath;
      } else {
        throw new Error(`Upload API returned status ${res.status}`);
      }
    } catch (apiErr) {
      console.warn('[WorkerPhotosService] Server upload fallback to client Firebase SDK:', apiErr);
      try {
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        photoUrl = await getDownloadURL(storageRef);
      } catch (fbErr: any) {
        console.error('[WorkerPhotosService] Firebase Storage upload also failed:', fbErr);
        const reader = new FileReader();
        photoUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
    }

    // Save photo metadata in Firestore workerPhotos collection
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      workerId,
      storagePath,
      photoUrl,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: docRef.id,
      workerId,
      storagePath,
      photoUrl,
      active: true,
      createdAt: now as any,
      updatedAt: now as any,
    };
  }
}
