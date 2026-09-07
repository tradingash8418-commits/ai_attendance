import {
  addDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { OrgContextService } from './org-context.service';
import type { WorkerPhoto } from '@/types/worker';

const COLLECTION_NAME = 'workerPhotos';

export class WorkerPhotosService {
  public static async getWorkerPhotos(workerId: string, orgId?: string): Promise<WorkerPhoto[]> {
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [where('workerId', '==', workerId)],
      orgId
    );
    const photos = docs.map((d) => ({
      id: d.id,
      ...d,
    })) as WorkerPhoto[];

    return photos.sort((a, b) => {
      const timeA = (a.createdAt as any)?.seconds || 0;
      const timeB = (b.createdAt as any)?.seconds || 0;
      return timeB - timeA;
    });
  }

  public static async uploadWorkerPhoto(
    workerId: string,
    file: File,
    orgId?: string
  ): Promise<WorkerPhoto> {
    const activeOrgId = orgId || OrgContextService.getOrgId();
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let photoUrl = '';
    let storagePath = `organizations/${activeOrgId}/workers/${workerId}/photos/${photoId}`;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workerId', workerId);
      formData.append('organizationId', activeOrgId);

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

    const colRef = OrgContextService.getCollection(COLLECTION_NAME, activeOrgId);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      organizationId: activeOrgId,
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
