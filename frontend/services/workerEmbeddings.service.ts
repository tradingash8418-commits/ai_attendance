import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkerFaceEmbedding } from '@/types/embedding';

const COLLECTION_NAME = 'workerFaceEmbeddings';

export class WorkerEmbeddingsService {
  /**
   * Fetch stored face embeddings for a specific worker.
   */
  public static async getEmbeddingsForWorker(workerId: string): Promise<WorkerFaceEmbedding[]> {
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
   * Calls Python face-service /embeddings/generate and stores the ArcFace embedding vector in Firestore.
   */
  public static async generateAndStoreEmbedding(
    workerId: string,
    workerPhotoId: string,
    photoUrl: string
  ): Promise<WorkerFaceEmbedding> {
    const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:8000';
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
        detector: data.detector || 'opencv',
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
        detector: data.detector || 'opencv',
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
}
