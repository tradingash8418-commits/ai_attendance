import { NextResponse } from 'next/server';
import { ImageStorageServer } from '@/services/image-storage.server';
import { FaceRecognitionService } from '@/services/face-recognition.service';
import { WorkersService } from '@/services/workers.service';
import { getTodayDateString, getWorkerDisplayName } from '@/lib/formatters';

const TEST_WORKER_CODE_MAP: Record<string, string> = {
  'worker-1': 'WRK-001',
  'worker-2': 'WRK-002',
  'worker-3': 'WRK-003',
  'worker-4': 'WRK-004',
  'worker-5': 'WRK-005',
};

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

    // 1. Save uploaded image to active storage (Supabase / Data URL)
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

    const matchedWorkerObjects = new Set<any>();

    for (const matchedId of result.matchedWorkerIds) {
      const mappedCode = TEST_WORKER_CODE_MAP[matchedId] || matchedId;
      const found = allWorkers.find(
        (w) => w.id === matchedId || w.workerCode === matchedId || w.workerCode === mappedCode
      );
      if (found) {
        matchedWorkerObjects.add(found);
      }
    }

    const recognizedWorkers = Array.from(matchedWorkerObjects).map((w) => ({
      id: w.id,
      name: getWorkerDisplayName(w),
      code: w.workerCode || 'WRK-000',
      role: w.role || 'Worker',
    }));

    return NextResponse.json({
      success: true,
      photoUrl,
      recognizedCount: recognizedWorkers.length,
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
