import { WorkerEmbeddingsService } from './workerEmbeddings.service';

export interface FaceRecognitionResult {
  matchedWorkerIds: string[];
  faces: {
    workerId: string | null;
    status: 'matched' | 'unknown' | 'needs_review';
    confidence: number;
    distance: number;
  }[];
  recognizedCount: number;
  unknownFaceCount: number;
}

export class FaceRecognitionService {
  /**
   * Dispatches group selfie image to Python face-service /recognize endpoint.
   * Compares faces against active worker SFace Deep Neural Network reference embeddings.
   */
  public static async recognizeGroupSelfie(
    photoUrl: string,
    threshold: number = 0.68
  ): Promise<FaceRecognitionResult> {
    const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const defaultFaceUrl = isProd ? 'https://ai-attendance-zfu0.onrender.com' : 'http://localhost:8000';
    const faceServiceUrl = process.env.FACE_SERVICE_URL || defaultFaceUrl;
    const faceServiceSecret = process.env.FACE_SERVICE_SECRET || 'contractor_ai_face_secret_key_123';

    // 1. Fetch reference embeddings directly from python face-service seed dataset
    let referenceEmbeddings: { worker_id: string; embedding: number[] }[] = [];

    try {
      const seedRes = await fetch(`${faceServiceUrl}/embeddings/seed-dataset`);
      if (seedRes.ok) {
        const seedData = await seedRes.json();
        if (Array.isArray(seedData)) {
          referenceEmbeddings = seedData.map((item: any) => ({
            worker_id: item.workerCode,
            embedding: item.embedding,
          }));
        }
      }
    } catch (seedErr) {
      console.warn('[FaceRecognitionService] Notice fetching seed dataset from face-service:', seedErr);
    }

    // Fallback: Fetch stored embeddings from Firestore
    if (referenceEmbeddings.length === 0) {
      const storedEmbeddings = await WorkerEmbeddingsService.getActiveEmbeddingsForWorkers();
      referenceEmbeddings = storedEmbeddings.map((ref) => ({
        worker_id: ref.workerId,
        embedding: ref.embedding,
      }));
    }

    if (referenceEmbeddings.length === 0) {
      console.warn('[FaceRecognitionService] Empty reference embeddings list.');
      return {
        matchedWorkerIds: [],
        faces: [],
        recognizedCount: 0,
        unknownFaceCount: 0,
      };
    }

    // 2. Format payload for python face-service /recognize
    const payload = {
      image_url: photoUrl,
      threshold,
      reference_embeddings: referenceEmbeddings,
    };

    try {
      const res = await fetch(`${faceServiceUrl}/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Face-Service-Secret': faceServiceSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Face service recognition call failed (${res.status}): ${errText}`);
      }

      const data = await res.json();

      return {
        matchedWorkerIds: data.matched_worker_ids || [],
        faces: (data.faces || []).map((f: any) => ({
          workerId: f.worker_id || null,
          status: f.status,
          confidence: f.confidence,
          distance: f.distance,
        })),
        recognizedCount: data.recognized_count || 0,
        unknownFaceCount: data.unknown_face_count || 0,
      };
    } catch (err) {
      console.error('[FaceRecognitionService] Error calling face recognition service:', err);
      return {
        matchedWorkerIds: [],
        faces: [],
        recognizedCount: 0,
        unknownFaceCount: 0,
      };
    }
  }
}
