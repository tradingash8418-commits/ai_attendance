import { onAuthStateChanged, signOut, User, NextOrObserver } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export class AuthService {
  /**
   * Subscribe to Firebase Auth state changes.
   */
  public static onAuthStateChange(observer: NextOrObserver<User>): () => void {
    return onAuthStateChanged(auth, observer);
  }

  /**
   * Get the current authenticated user instance if logged in.
   */
  public static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Sign out the currently authenticated user session.
   */
  public static async logout(): Promise<void> {
    await signOut(auth);
  }
}
