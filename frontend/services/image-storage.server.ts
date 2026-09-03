import fs from 'fs';
import path from 'path';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';

export type StorageMode = 'local' | 'firebase' | 'supabase';

export interface SaveAttendancePhotoParams {
  date: string;
  siteId: string;
  sessionId: string;
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
}

export interface SaveWorkerPhotoParams {
  workerId: string;
  photoId: string;
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
}

export class ImageStorageServer {
  /**
   * Retrieves configured storage mode: 'local' (default for dev), 'firebase', or 'supabase'.
   */
  public static getStorageMode(): StorageMode {
    const envMode = process.env.IMAGE_STORAGE_MODE?.toLowerCase();
    if (envMode === 'supabase') return 'supabase';
    if (envMode === 'firebase') return 'firebase';
    return 'local';
  }

  /**
   * Saves an attendance group selfie photo using the active storage engine.
   */
  public static async saveAttendancePhoto(params: SaveAttendancePhotoParams): Promise<string> {
    const mode = this.getStorageMode();
    const fileName = params.filename || `group_${Date.now()}.jpg`;

    if (mode === 'supabase') {
      return this.saveAttendancePhotoSupabase(params, fileName);
    } else if (mode === 'firebase') {
      return this.saveAttendancePhotoFirebase(params, fileName);
    } else {
      return this.saveAttendancePhotoLocal(params, fileName);
    }
  }

  /**
   * Saves a worker reference photo using the active storage engine.
   */
  public static async saveWorkerPhoto(params: SaveWorkerPhotoParams): Promise<string> {
    const mode = this.getStorageMode();
    const fileName = params.filename || `ref_${params.photoId}_${Date.now()}.jpg`;

    if (mode === 'supabase') {
      return this.saveWorkerPhotoSupabase(params, fileName);
    } else if (mode === 'firebase') {
      return this.saveWorkerPhotoFirebase(params, fileName);
    } else {
      return this.saveWorkerPhotoLocal(params, fileName);
    }
  }

  // --- Supabase Storage Provider ---

  private static async saveAttendancePhotoSupabase(
    params: SaveAttendancePhotoParams,
    fileName: string
  ): Promise<string> {
    try {
      const bucketName = 'attendance-photos';
      const filePath = `attendance/${params.date}/${params.siteId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, params.buffer, {
          contentType: params.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.warn('[ImageStorageServer] Supabase upload notice:', error.message);
        // Fallback to local if bucket is not created yet
        return this.saveAttendancePhotoLocal(params, fileName);
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.warn('[ImageStorageServer] Supabase Storage Error:', err);
      return this.saveAttendancePhotoLocal(params, fileName);
    }
  }

  private static async saveWorkerPhotoSupabase(
    params: SaveWorkerPhotoParams,
    fileName: string
  ): Promise<string> {
    try {
      const bucketName = 'attendance-photos';
      const filePath = `workers/${params.workerId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, params.buffer, {
          contentType: params.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.warn('[ImageStorageServer] Supabase upload notice:', error.message);
        return this.saveWorkerPhotoLocal(params, fileName);
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.warn('[ImageStorageServer] Supabase Worker Photo Error:', err);
      return this.saveWorkerPhotoLocal(params, fileName);
    }
  }

  // --- Local Storage Provider ---

  private static async saveAttendancePhotoLocal(
    params: SaveAttendancePhotoParams,
    fileName: string
  ): Promise<string> {
    const rootDir = process.cwd();
    const localDir = path.resolve(rootDir, '..', 'face-service', 'runtime-data', 'attendance-photos');
    fs.mkdirSync(localDir, { recursive: true });

    const fullFilePath = path.join(localDir, fileName);
    fs.writeFileSync(fullFilePath, params.buffer);

    const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:8000';
    return `${faceServiceUrl}/runtime-data/attendance-photos/${fileName}`;
  }

  private static async saveWorkerPhotoLocal(
    params: SaveWorkerPhotoParams,
    fileName: string
  ): Promise<string> {
    const rootDir = process.cwd();
    const localDir = path.resolve(rootDir, '..', 'face-service', 'runtime-data', 'worker-photos');
    fs.mkdirSync(localDir, { recursive: true });

    const fullFilePath = path.join(localDir, fileName);
    fs.writeFileSync(fullFilePath, params.buffer);

    const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:8000';
    return `${faceServiceUrl}/runtime-data/worker-photos/${fileName}`;
  }

  // --- Firebase Storage Provider ---

  private static async saveAttendancePhotoFirebase(
    params: SaveAttendancePhotoParams,
    fileName: string
  ): Promise<string> {
    try {
      const storagePath = `attendance/${params.date}/${params.siteId}/${params.sessionId}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      const uint8Array = new Uint8Array(params.buffer);

      await uploadBytes(storageRef, uint8Array, {
        contentType: params.mimeType || 'image/jpeg',
      });

      return await getDownloadURL(storageRef);
    } catch (err: any) {
      console.error('[ImageStorageServer] Firebase Storage Upload Failed:', err);
      return this.saveAttendancePhotoLocal(params, fileName);
    }
  }

  private static async saveWorkerPhotoFirebase(
    params: SaveWorkerPhotoParams,
    fileName: string
  ): Promise<string> {
    try {
      const storagePath = `workers/${params.workerId}/photos/${fileName}`;
      const storageRef = ref(storage, storagePath);
      const uint8Array = new Uint8Array(params.buffer);

      await uploadBytes(storageRef, uint8Array, {
        contentType: params.mimeType || 'image/jpeg',
      });

      return await getDownloadURL(storageRef);
    } catch (err: any) {
      console.error('[ImageStorageServer] Firebase Storage Worker Photo Upload Failed:', err);
      return this.saveWorkerPhotoLocal(params, fileName);
    }
  }
}
