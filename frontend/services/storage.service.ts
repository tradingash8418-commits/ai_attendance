import { FirebaseStorage } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export class StorageService {
  /**
   * Access the initialized Firebase Storage instance safely.
   */
  public static getStorage(): FirebaseStorage {
    return storage;
  }
}
