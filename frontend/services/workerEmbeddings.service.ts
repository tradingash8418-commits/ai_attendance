import {
  addDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { WorkersService } from './workers.service';
import { OrgContextService } from './org-context.service';
import type { WorkerFaceEmbedding } from '@/types/embedding';

const COLLECTION_NAME = 'workerFaceEmbeddings';

export class WorkerEmbeddingsService {
  /**
   * Fetch stored face embeddings for a specific worker using canonical Firestore document ID.
   */
  public static async getEmbeddingsForWorker(workerId: string, orgId?: string): Promise<WorkerFaceEmbedding[]> {
    if (!workerId) return [];
    const docs = await OrgContextService.getDocsWithFallback(
      COLLECTION_NAME,
      [where('workerId', '==', workerId)],
      orgId
    );
    return docs.map((d) => ({
      id: d.id,
      ...d,
    })) as WorkerFaceEmbedding[];
  }

  /**
   * Fetch all active worker embeddings for recognition comparisons.
   */
  public static async getActiveEmbeddingsForWorkers(
    workerIds?: string[],
    orgId?: string
  ): Promise<WorkerFaceEmbedding[]> {
    const docs = await OrgContextService.getDocsWithFallback(COLLECTION_NAME, [], orgId);

    let records = docs.map((d) => ({
      id: d.id,
      ...d,
    })) as WorkerFaceEmbedding[];

    if (workerIds && workerIds.length > 0) {
      records = records.filter((r) => workerIds.includes(r.workerId));
    }

    return records;
  }

  /**
   * Deterministically repairs any legacy workerFaceEmbeddings records where workerId was stored as a workerCode (e.g. WRK-001).
   */
  public static async repairWorkerEmbeddingMappings(orgId?: string): Promise<number> {
    const allWorkers = await WorkersService.getWorkers(orgId);
    const codeToDocIdMap: Record<string, string> = {};
    allWorkers.forEach((w) => {
      if (w.workerCode && w.id) {
        codeToDocIdMap[w.workerCode] = w.id;
      }
    });

    const docs = await OrgContextService.getDocsWithFallback(COLLECTION_NAME, [], orgId);
    let repairedCount = 0;

    for (const docData of docs) {
      const currentWorkerId = docData.workerId;

      if (currentWorkerId && codeToDocIdMap[currentWorkerId]) {
        const canonicalId = codeToDocIdMap[currentWorkerId];
        if (canonicalId !== currentWorkerId) {
          const res = await OrgContextService.getDocWithFallback(COLLECTION_NAME, docData.id, orgId);
          await updateDoc(res.ref, {
            workerId: canonicalId,
            updatedAt: serverTimestamp(),
          });
          repairedCount++;
          console.log(`[WorkerEmbeddingsService] Repaired embedding ${docData.id}: ${currentWorkerId} -> ${canonicalId}`);
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
    photoUrl: string,
    orgId?: string
  ): Promise<WorkerFaceEmbedding> {
    const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const defaultFaceUrl = isProd ? 'https://ai-attendance-zfu0.onrender.com' : 'http://localhost:8000';
    const faceServiceUrl = process.env.NEXT_PUBLIC_FACE_SERVICE_URL || process.env.FACE_SERVICE_URL || defaultFaceUrl;
    const faceServiceSecret = process.env.NEXT_PUBLIC_FACE_SERVICE_SECRET || process.env.FACE_SERVICE_SECRET || 'contractor_ai_face_secret_key_123';

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
      const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
      const now = serverTimestamp();
      const docRef = await addDoc(colRef, {
        organizationId: orgId || OrgContextService.getOrgId(),
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
  public static async createEmbedding(
    data: {
      workerId: string;
      photoId?: string;
      workerPhotoId?: string;
      embedding: number[];
      model?: string;
      detector?: string;
      distanceMetric?: string;
    },
    orgId?: string
  ): Promise<string> {
    const colRef = OrgContextService.getCollection(COLLECTION_NAME, orgId);
    const now = serverTimestamp();
    const docRef = await addDoc(colRef, {
      organizationId: orgId || OrgContextService.getOrgId(),
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
