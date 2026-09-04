import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WorkersService } from './workers.service';
import type { WorkerFaceEmbedding } from '@/types/embedding';

const COLLECTION_NAME = 'workerFaceEmbeddings';

export class WorkerEmbeddingsService {
  /**
   * Fetch stored face embeddings for a specific worker using canonical Firestore document ID.
   */
  public static async getEmbeddingsForWorker(workerId: string): Promise<WorkerFaceEmbedding[]> {
    if (!workerId) return [];
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('workerId', '==', workerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkerFaceEmbedding[];
  }

  /**
   * Fetch all active worker embeddings for recognition comparisons.
   */
  public static async getActiveEmbeddingsForWorkers(
    workerIds?: string[]
  ): Promise<WorkerFaceEmbedding[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);

    let records = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkerFaceEmbedding[];

    if (workerIds && workerIds.length > 0) {
      records = records.filter((r) => workerIds.includes(r.workerId));
    }

    return records;
  }

  /**
   * Deterministically repairs any legacy workerFaceEmbeddings records where workerId was stored as a workerCode (e.g. WRK-001).
   * Maps workerCode to its canonical Firestore worker document ID without fabricating data.
   */
  public static async repairWorkerEmbeddingMappings(): Promise<number> {
    const allWorkers = await WorkersService.getWorkers();
    const codeToDocIdMap: Record<string, string> = {};
    allWorkers.forEach((w) => {
      if (w.workerCode && w.id) {
        codeToDocIdMap[w.workerCode] = w.id;
      }
    });

    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    let repairedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const currentWorkerId = data.workerId;

      if (currentWorkerId && codeToDocIdMap[currentWorkerId]) {
        const canonicalId = codeToDocIdMap[currentWorkerId];
        if (canonicalId !== currentWorkerId) {
          const embDocRef = doc(db, COLLECTION_NAME, docSnap.id);
          await updateDoc(embDocRef, {
            workerId: canonicalId,
            updatedAt: serverTimestamp(),
          });
          repairedCount++;
          console.log(`[WorkerEmbeddingsService] Repaired embedding ${docSnap.id}: ${currentWorkerId} -> ${canonicalId}`);
        }
      }
    }

    return repairedCount;
  }

  /**
   * Calls Python face-service /embeddings/generate and stores the ArcFace embedding vector in Firestore.
   */
  public static async generateAndStoreEmbedding(
    workerId: string,
    workerPhotoId: string,
    photoUrl: string
  ): Promise<WorkerFaceEmbedding> {
    const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const defaultFaceUrl = isProd ? 'https://ai-attendance-zfu0.onrender.com' : 'http://localhost:8000';
    const faceServiceUrl = process.env.FACE_SERVICE_URL || defaultFaceUrl;
    const faceServiceSecret = process.env.FACE_SERVICE_SECRET || 'contractor_ai_face_secret_key_123';

    try {
      const res = await fetch(`${faceServiceUrl}/embeddings/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Face-Service-Secret': faceServiceSecret,
        },
        body: JSON.stringify({
          image_url: photoUrl,
          worker_id: workerId,
          worker_photo_id: workerPhotoId,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Face service embedding generation failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const embeddingVector: number[] = data.embedding;

      // Save to Firestore workerFaceEmbeddings collection
      const colRef = collection(db, COLLECTION_NAME);
      const now = serverTimestamp();
      const docRef = await addDoc(colRef, {
        workerId,
        workerPhotoId,
        model: data.model || 'ArcFace',
        detector: data.detector || 'YuNet',
        distanceMetric: data.distance_metric || 'cosine',
        embedding: embeddingVector,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id: docRef.id,
        workerId,
        workerPhotoId,
        model: data.model || 'ArcFace',
        detector: data.detector || 'YuNet',
        distanceMetric: data.distance_metric || 'cosine',
        embedding: embeddingVector,
        createdAt: now as any,
        updatedAt: now as any,
      };
    } catch (err) {
      console.error('[WorkerEmbeddingsService] Error generating/storing embedding:', err);
      throw err;
    }
  }
  /**
   * Directly stores a pre-computed face embedding vector in Firestore.
   */
  public static async createEmbedding(data: {
    workerId: string;
    photoId?: string;
    workerPhotoId?: string;
    embedding: number[];
    model?: string;
    detector?: string;
    distanceMetric?: string;
  }): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      workerId: data.workerId,
      workerPhotoId: data.photoId || data.workerPhotoId || `ref_photo_${data.workerId}`,
      model: data.model || 'ArcFace/SFace',
      detector: data.detector || 'yunet',
      distanceMetric: data.distanceMetric || 'cosine',
      embedding: data.embedding,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }
}
