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
  const diagnosticLogs: string[] = [];
  const log = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    diagnosticLogs.push(`[${timestamp}] ${msg}`);
  };

  try {
    log('Initializing AI Photo Analysis Pipeline...');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      log('ERROR: No image file attached in request.');
      return NextResponse.json({ error: 'No image file uploaded', diagnosticLogs }, { status: 400 });
    }

    log(`File received: ${file.name} (${Math.round(file.size / 1024)} KB, ${file.type})`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const today = getTodayDateString();

    // 1. Save uploaded image to active storage (Supabase / Data URL)
    log('Step 1: Uploading image to Supabase Storage bucket (attendance-photos)...');
    const photoUrl = await ImageStorageServer.saveAttendancePhoto({
      date: today,
      siteId: 'test_site',
      sessionId: `test_upload_${Date.now()}`,
      buffer,
      mimeType: file.type || 'image/jpeg',
    });

    log(`Image saved to Storage: ${photoUrl}`);

    // 2. Dispatch to YuNet AI Face Recognition microservice with buffer for direct Base64 delivery
    log('Step 2: Loading reference 128-D SFace embeddings & dispatching Base64 payload to Python AI face-service...');
    const result = await FaceRecognitionService.recognizeGroupSelfie(photoUrl, buffer);

    log(`Step 3: AI Service Response Received | Faces Scanned: ${result.faces.length}, Matched: ${result.matchedWorkerIds.length}, Unknown: ${result.unknownFaceCount}`);

    result.faces.forEach((f, idx) => {
      log(`  Face #${idx + 1}: Status = ${f.status.toUpperCase()}, Distance = ${f.distance.toFixed(4)}, Confidence = ${(f.confidence * 100).toFixed(1)}%${f.workerId ? `, Matched Worker ID = ${f.workerId}` : ''}`);
    });

    // 3. Resolve worker names for matched worker IDs
    log('Step 4: Resolving Worker IDs against Firestore Database records...');
    const allWorkers = await WorkersService.getWorkers();
    log(`Fetched ${allWorkers.length} worker documents from Firestore DB.`);

    const matchedWorkerObjects = new Set<any>();

    for (const matchedId of result.matchedWorkerIds) {
      const mappedCode = TEST_WORKER_CODE_MAP[matchedId] || matchedId;
      const found = allWorkers.find(
        (w) => w.id === matchedId || w.workerCode === matchedId || w.workerCode === mappedCode
      );
      if (found) {
        matchedWorkerObjects.add(found);
        log(`  Match Confirmed: ${getWorkerDisplayName(found)} (ID: ${found.id}, Code: ${found.workerCode || 'N/A'})`);
      } else {
        log(`  Notice: Matched ID ${matchedId} not found in Firestore worker records.`);
      }
    }

    const recognizedWorkers = Array.from(matchedWorkerObjects).map((w) => ({
      id: w.id,
      name: getWorkerDisplayName(w),
      code: w.workerCode || 'WRK-000',
      role: w.role || 'Worker',
    }));

    log(`Step 5: Pipeline Completed | Total Recognized Workers = ${recognizedWorkers.length}`);

    return NextResponse.json({
      success: true,
      photoUrl,
      recognizedCount: recognizedWorkers.length,
      unknownFaceCount: result.unknownFaceCount,
      totalFacesDetected: result.faces.length,
      matchedWorkerIds: result.matchedWorkerIds,
      recognizedWorkers,
      facesDetail: result.faces,
      diagnosticLogs,
    });
  } catch (err: any) {
    log(`CRITICAL ERROR: ${err?.message || 'Internal server error'}`);
    console.error('[Test AI Upload] Error analyzing uploaded photo:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error', diagnosticLogs }, { status: 500 });
  }
}
