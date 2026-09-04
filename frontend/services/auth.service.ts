import {
  onAuthStateChanged,
  signOut,
  User,
  NextOrObserver,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
   * Sign in with Email and Password.
   */
  public static async signInWithEmail(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  }

  /**
   * Register/Sign up with Email, Password, and optional Display Name.
   */
  public static async signUpWithEmail(email: string, password: string, displayName?: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      } catch (profileErr) {
        console.warn('Could not update display name:', profileErr);
      }
    }
    return cred.user;
  }

  /**
   * Sign in with Google Popup.
   */
  public static async signInWithGoogle(): Promise<User> {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  }

  /**
   * Send Password Reset Email.
   */
  public static async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
  }

  /**
   * Sign out the currently authenticated user session.
   */
  public static async logout(): Promise<void> {
    await signOut(auth);
  }
}
