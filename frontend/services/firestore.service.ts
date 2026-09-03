import { Firestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export class FirestoreService {
  /**
   * Access the initialized Firestore instance safely.
   */
  public static getDb(): Firestore {
    return db;
  }
}
