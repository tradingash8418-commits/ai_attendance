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
  needsReviewCount: number;
}

export class FaceRecognitionService {
  /**
   * Dispatches group selfie image to Python face-service /recognize endpoint.
   * Includes automatic retry mechanism to handle Render Free Tier container cold starts cleanly.
   */
  public static async recognizeGroupSelfie(
    photoUrl: string,
    overrideThreshold?: number
  ): Promise<FaceRecognitionResult> {
    const startTime = Date.now();
    const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const defaultFaceUrl = isProd ? 'https://ai-attendance-zfu0.onrender.com' : 'http://localhost:8000';
    const faceServiceUrl = process.env.FACE_SERVICE_URL || defaultFaceUrl;
    const faceServiceSecret = process.env.FACE_SERVICE_SECRET || 'contractor_ai_face_secret_key_123';

    const dataSource = (process.env.FACE_RECOGNITION_DATA_SOURCE || 'firestore').toLowerCase();
    // Default Cosine Distance Threshold for SFace: 0.75 (handles compressed WhatsApp / web uploads cleanly)
    const threshold = overrideThreshold || (process.env.FACE_RECOGNITION_THRESHOLD ? parseFloat(process.env.FACE_RECOGNITION_THRESHOLD) : 0.75);

    let referenceEmbeddings: { worker_id: string; embedding: number[] }[] = [];

    // 1. Production Mode: Load active worker embeddings strictly from Firestore
    if (dataSource === 'firestore') {
      try {
        const storedEmbeddings = await WorkerEmbeddingsService.getActiveEmbeddingsForWorkers();
        referenceEmbeddings = storedEmbeddings.map((ref) => ({
          worker_id: ref.workerId, // Firestore Document ID
          embedding: ref.embedding,
        }));
        console.log(`[FaceRecognitionService] Loaded ${referenceEmbeddings.length} active reference embeddings from Firestore.`);
      } catch (fsErr) {
        console.error('[FaceRecognitionService] Error loading active embeddings from Firestore:', fsErr);
      }
    } else if (dataSource === 'seed') {
      // 2. Dev/Test Mode: Explicit seed dataset override
      try {
        console.log('[FaceRecognitionService] Dev Mode: Querying GET /embeddings/seed-dataset...');
        const seedRes = await fetch(`${faceServiceUrl}/embeddings/seed-dataset`);
        if (seedRes.ok) {
          const seedData = await seedRes.json();
          if (Array.isArray(seedData)) {
            referenceEmbeddings = seedData.map((item: any) => ({
              worker_id: item.workerCode || item.worker_id,
              embedding: item.embedding,
            }));
          }
        }
      } catch (seedErr) {
        console.warn('[FaceRecognitionService] Dev seed dataset fetch warning:', seedErr);
      }
    }

    if (referenceEmbeddings.length === 0) {
      console.warn('[FaceRecognitionService] Zero reference embeddings loaded. Skipping recognition.');
      return {
        matchedWorkerIds: [],
        faces: [],
        recognizedCount: 0,
        unknownFaceCount: 0,
        needsReviewCount: 0,
      };
    }

    // 2. Format payload for python face-service /recognize
    const payload = {
      image_url: photoUrl,
      threshold,
      reference_embeddings: referenceEmbeddings,
    };

    const maxRetries = 3;
    let attempt = 0;
    let res: Response | null = null;
    let lastError: any = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        res = await fetch(`${faceServiceUrl}/recognize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Face-Service-Secret': faceServiceSecret,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          break;
        }

        const errText = await res.text();
        lastError = new Error(`Face service recognition call failed (${res.status}): ${errText}`);
        console.warn(`[FaceRecognitionService] Attempt ${attempt}/${maxRetries} status ${res.status}. Retrying in 2.5s...`);

        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        } else {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[FaceRecognitionService] Attempt ${attempt}/${maxRetries} network error: ${err?.message}. Retrying in 2.5s...`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
    }

    if (!res || !res.ok) {
      console.error('[FaceRecognitionService] All recognition retry attempts exhausted:', lastError);
      return {
        matchedWorkerIds: [],
        faces: [],
        recognizedCount: 0,
        unknownFaceCount: 0,
        needsReviewCount: 0,
      };
    }

    try {
      const data = await res.json();
      const duration = Date.now() - startTime;

      const faces = (data.faces || []).map((f: any) => ({
        workerId: f.worker_id || null,
        status: (f.status as 'matched' | 'unknown' | 'needs_review') || (f.worker_id ? 'matched' : 'unknown'),
        confidence: f.confidence || 0,
        distance: f.distance || 1.0,
      }));

      const matchedWorkerIds: string[] = data.matched_worker_ids || [];
      const recognizedCount = data.recognized_count || matchedWorkerIds.length;
      const unknownFaceCount = data.unknown_face_count || faces.filter((f: any) => f.status === 'unknown').length;
      const needsReviewCount = faces.filter((f: any) => f.status === 'needs_review').length;

      // Safe production logging
      console.log(
        `[FaceRecognitionService] Recognition Completed in ${duration}ms | ` +
        `Model: ${data.model || 'ArcFace'}, Detector: ${data.detector || 'YuNet'}, ` +
        `Faces Detected: ${faces.length}, References Loaded: ${referenceEmbeddings.length}, ` +
        `Matched Workers: ${matchedWorkerIds.length}, Needs Review: ${needsReviewCount}, Unknown: ${unknownFaceCount}`
      );

      return {
        matchedWorkerIds,
        faces,
        recognizedCount,
        unknownFaceCount,
        needsReviewCount,
      };
    } catch (err: any) {
      console.error('[FaceRecognitionService] Error parsing recognition response JSON:', err?.message || err);
      return {
        matchedWorkerIds: [],
        faces: [],
        recognizedCount: 0,
        unknownFaceCount: 0,
        needsReviewCount: 0,
      };
    }
  }
}
