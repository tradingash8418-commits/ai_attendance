import type { Timestamp } from 'firebase/firestore';

export interface WorkerFaceEmbedding {
  id: string;
  workerId: string;
  workerPhotoId: string;
  model: string;           // "ArcFace"
  detector: string;        // "opencv" | "retinaface"
  distanceMetric: string;  // "cosine"
  embedding: number[];     // 512-dimensional vector array
  sourcePhotoHash?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
