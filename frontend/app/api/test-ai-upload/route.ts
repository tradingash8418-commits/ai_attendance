import { NextResponse } from 'next/server';
import { ImageStorageServer } from '@/services/image-storage.server';
import { FaceRecognitionService } from '@/services/face-recognition.service';
import { WorkersService } from '@/services/workers.service';
import { getTodayDateString, getWorkerDisplayName } from '@/lib/formatters';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const today = getTodayDateString();

    // 1. Save uploaded image to face-service/runtime-data/attendance-photos
    const photoUrl = await ImageStorageServer.saveAttendancePhoto({
      date: today,
      siteId: 'test_site',
      sessionId: `test_upload_${Date.now()}`,
      buffer,
      mimeType: file.type || 'image/jpeg',
    });

    console.log(`[Test AI Upload] Image uploaded and saved to: ${photoUrl}`);

    // 2. Dispatch to YuNet AI Face Recognition microservice
    const result = await FaceRecognitionService.recognizeGroupSelfie(photoUrl);

    // 3. Resolve worker names for matched worker IDs
    const allWorkers = await WorkersService.getWorkers();
    const recognizedWorkers = allWorkers
      .filter((w) => result.matchedWorkerIds.includes(w.id) || result.matchedWorkerIds.includes(w.workerCode))
      .map((w) => ({
        id: w.id,
        name: getWorkerDisplayName(w),
        code: w.workerCode || 'WRK-000',
        role: w.role || 'Worker',
      }));

    return NextResponse.json({
      success: true,
      photoUrl,
      recognizedCount: result.recognizedCount,
      unknownFaceCount: result.unknownFaceCount,
      totalFacesDetected: result.faces.length,
      matchedWorkerIds: result.matchedWorkerIds,
      recognizedWorkers,
      facesDetail: result.faces,
    });
  } catch (err: any) {
    console.error('[Test AI Upload] Error analyzing uploaded photo:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
