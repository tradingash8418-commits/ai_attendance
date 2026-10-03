import { NextResponse } from 'next/server';
import { WorkersService } from '@/services/workers.service';
import { ImageStorageServer } from '@/services/image-storage.server';
import { normalizeWorkerCode } from '@/lib/formatters';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = (formData.get('name') as string || '').trim();
    const rawWorkerCode = (formData.get('workerCode') as string || '').trim();
    const phone = (formData.get('phone') as string || '').trim();
    const role = (formData.get('role') as string || 'General Worker').trim();
    const dailyRateStr = (formData.get('dailyRate') as string || '0').trim();
    const dailyRate = !isNaN(parseFloat(dailyRateStr)) && parseFloat(dailyRateStr) >= 0 ? parseFloat(dailyRateStr) : 0;
    const file = formData.get('file') as File | null;

    const reqOrgId = (formData.get('orgId') as string) || request.headers.get('x-organization-id') || undefined;

    if (!name) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }

    const allWorkers = await WorkersService.getWorkers(reqOrgId);
    let workerCode = rawWorkerCode
      ? normalizeWorkerCode(rawWorkerCode)
      : WorkersService.generateNextWorkerCode(allWorkers);

    // If the workerCode is already taken in Firestore, auto-increment to the next guaranteed unique code
    if (WorkersService.isWorkerCodeTaken(workerCode, allWorkers)) {
      workerCode = WorkersService.generateNextWorkerCode(allWorkers);
      console.log(`[Worker Enroll API] Worker code was taken; auto-incremented to guaranteed unique code: ${workerCode}`);
    }

    let photoUrl = '';

    // 1. If profile photo file uploaded, save to disk for profile/ID display
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      photoUrl = await ImageStorageServer.saveAttendancePhoto({
        date: 'profile',
        siteId: 'profile_photos',
        sessionId: `profile_${workerCode}_${Date.now()}`,
        buffer,
        mimeType: file.type || 'image/jpeg',
      });

      console.log(`[Worker Enroll API] Saved worker profile photo to: ${photoUrl}`);
    }

    // 2. Save Worker Record in Firestore
    const workerId = await WorkersService.createWorker(
      {
        name,
        workerCode,
        phone,
        role,
        dailyRate,
        photoUrl,
      },
      reqOrgId
    );

    return NextResponse.json({
      success: true,
      workerId,
      workerCode,
      name,
      photoUrl,
    });
  } catch (err: any) {
    console.error('[Worker Enroll API] Fatal enrollment error:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
