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
  }

  public static async uploadWorkerPhoto(
    workerId: string,
    file: File
  ): Promise<WorkerPhoto> {
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let photoUrl = '';
    let storagePath = `workers/${workerId}/photos/${photoId}`;

    const isLocalMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE === 'local' ||
      process.env.IMAGE_STORAGE_MODE === 'local' ||
      process.env.NODE_ENV === 'development';

    if (isLocalMode) {
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
          storagePath = data.storagePath;
        } else {
          throw new Error('Local API upload returned non-200 status');
        }
      } catch (localErr) {
        console.warn('[WorkerPhotosService] Local API upload fallback to object URL:', localErr);
        photoUrl = URL.createObjectURL(file);
      }
    } else {
      try {
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        photoUrl = await getDownloadURL(storageRef);
      } catch (fbErr: any) {
        console.error('[WorkerPhotosService] Firebase Storage upload failed:', fbErr);
        throw new Error(`Firebase Storage unavailable: ${fbErr?.message || 'Upload failed'}`);
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
