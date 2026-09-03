import { NextRequest, NextResponse } from 'next/server';
import { ImageStorageServer } from '@/services/image-storage.server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const workerId = formData.get('workerId') as string | null;

    if (!file || !workerId) {
      return NextResponse.json({ error: 'Missing file or workerId' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const photoUrl = await ImageStorageServer.saveWorkerPhoto({
      workerId,
      photoId,
      buffer,
      mimeType: file.type || 'image/jpeg',
      filename: `${photoId}.jpg`,
    });

    return NextResponse.json({ photoUrl, photoId, storagePath: `local/${workerId}/${photoId}.jpg` });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Upload failed';
    console.error('[UploadWorkerPhoto API Error]:', err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
