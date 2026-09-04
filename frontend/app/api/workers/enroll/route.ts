import { NextResponse } from 'next/server';
import { WorkersService } from '@/services/workers.service';
import { WorkerEmbeddingsService } from '@/services/workerEmbeddings.service';
import { ImageStorageServer } from '@/services/image-storage.server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = (formData.get('name') as string || '').trim();
    const workerCode = (formData.get('workerCode') as string || '').trim();
    const phone = (formData.get('phone') as string || '').trim();
    const role = (formData.get('role') as string || 'General Worker').trim();
    const dailyRateStr = (formData.get('dailyRate') as string || '500').trim();
    const dailyRate = !isNaN(parseFloat(dailyRateStr)) ? parseFloat(dailyRateStr) : 500;
    const file = formData.get('file') as File | null;

    if (!name) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }

    if (!workerCode) {
      return NextResponse.json({ error: 'Worker Code (e.g. WRK-006) is required' }, { status: 400 });
    }

    let photoUrl = '';
    let embeddingVector: number[] = [];

    // 1. If photo file uploaded, save to disk and extract SFace Neural Vector
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      photoUrl = await ImageStorageServer.saveAttendancePhoto({
        date: 'reference',
        siteId: 'reference_photos',
        sessionId: `ref_${workerCode}_${Date.now()}`,
        buffer,
        mimeType: file.type || 'image/jpeg',
      });

      console.log(`[Worker Enroll API] Saved reference photo to: ${photoUrl}`);

      // Call Python face-service /embeddings/generate
      const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:8000';
      const faceServiceSecret = process.env.FACE_SERVICE_SECRET || 'contractor_ai_face_secret_key_123';

      try {
        const embRes = await fetch(`${faceServiceUrl}/embeddings/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Face-Service-Secret': faceServiceSecret,
          },
          body: JSON.stringify({
            image_url: photoUrl,
            worker_id: workerCode,
            worker_photo_id: `ref_photo_${workerCode}`,
          }),
        });

        if (embRes.ok) {
          const embData = await embRes.json();
          embeddingVector = embData.embedding || [];
          console.log(`[Worker Enroll API] Extracted ${embeddingVector.length}-d SFace neural vector for ${name}`);
        } else {
          console.warn(`[Worker Enroll API] Python face service returned status ${embRes.status}`);
        }
      } catch (embErr) {
        console.error('[Worker Enroll API] Error generating face embedding:', embErr);
      }
    }

    // 2. Save Worker Record in Firestore
    const workerId = await WorkersService.createWorker({
      name,
      workerCode,
      phone,
      role,
      dailyRate,
      photoUrl,
    });

    // 3. Save Worker Embedding in Firestore
    if (embeddingVector.length > 0) {
      await WorkerEmbeddingsService.createEmbedding({
        workerId: workerCode,
        photoId: `ref_photo_${workerCode}`,
        embedding: embeddingVector,
        model: 'ArcFace/SFace',
        detector: 'yunet',
        distanceMetric: 'cosine',
      });
    }

    return NextResponse.json({
      success: true,
      workerId,
      workerCode,
      name,
      photoUrl,
      hasEmbedding: embeddingVector.length > 0,
    });
  } catch (err: any) {
    console.error('[Worker Enroll API] Fatal enrollment error:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
