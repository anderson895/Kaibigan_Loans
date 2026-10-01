import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch, type Firestore } from "firebase/firestore";

export type Role = "admin" | "borrower";

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/invalid-email": "Invalid email format.",
  "auth/email-already-in-use": "An account with this email already exists. Log in instead, or use Sign in with Google.",
  "auth/weak-password": "Password is too weak (at least 8 characters).",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed.",
  "auth/network-request-failed": "No internet connection. Please try again.",
  "auth/operation-not-allowed": "Email/Password login is not enabled in Firebase yet.",
  "auth/unauthorized-domain": "This domain is not authorized in Firebase yet.",
};

/** Turns Firebase auth errors into friendly Taglish messages. */
export function authErrorMessage(e: unknown): string {
  if (e instanceof FirebaseError) return AUTH_ERRORS[e.code] ?? e.message;
  return e instanceof Error ? e.message : String(e);
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Admins are stored as `admins/{email}`. The very first person to sign in (while `meta/setup`
 * does not exist yet) can claim admin — see firestore.rules.
 */
export class AuthService {
  constructor(
    private readonly auth: Auth,
    private readonly db: Firestore,
  ) {}

  onChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(this.auth, callback);
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const { user } = await signInWithPopup(this.auth, provider);
    return user;
  }

  /** `remember` keeps the session after the browser closes; otherwise it ends with the tab session. */
  async signInWithEmail(email: string, password: string, remember: boolean): Promise<User> {
    await setPersistence(this.auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const { user } = await signInWithEmailAndPassword(this.auth, email.trim(), password);
    return user;
  }

  /** Creates an email/password account and sends a verification link (required before data access). */
  async register(name: string, email: string, password: string): Promise<User> {
    if (!name.trim()) throw new Error("Name is required.");
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    const { user } = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
    await updateProfile(user, { displayName: name.trim() });
    await sendEmailVerification(user);
    return user;
  }

  sendPasswordReset(email: string) {
    return sendPasswordResetEmail(this.auth, email.trim());
  }

  async resendVerification(): Promise<void> {
    if (this.auth.currentUser) await sendEmailVerification(this.auth.currentUser);
  }

  /** Reloads the user after they click the verification link, and refreshes the token's email_verified claim. */
  async reloadUser(): Promise<User | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    await user.reload();
    if (user.emailVerified) await user.getIdToken(true);
    return this.auth.currentUser;
  }

  signOut() {
    return signOut(this.auth);
  }

  async idToken(): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error("Not signed in");
    return user.getIdToken();
  }

  async resolveRole(user: User): Promise<Role> {
    const email = user.email?.toLowerCase();
    if (!email) return "borrower";
    const admin = await getDoc(doc(this.db, "admins", email));
    return admin.exists() ? "admin" : "borrower";
  }

  async isSetupDone(): Promise<boolean> {
    return (await getDoc(doc(this.db, "meta", "setup"))).exists();
  }

  /** One-time: makes the current user the first admin. */
  async claimFirstAdmin(user: User): Promise<void> {
    const email = user.email!.toLowerCase();
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, "admins", email), { email, addedAt: Date.now() });
    batch.set(doc(this.db, "meta", "setup"), { owner: email, at: Date.now() });
    await batch.commit();
  }

  async listAdmins(): Promise<string[]> {
    const snapshot = await getDocs(collection(this.db, "admins"));
    return snapshot.docs.map((d) => d.id).sort();
  }

  async addAdmin(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Invalid email");
    await setDoc(doc(this.db, "admins", normalized), { email: normalized, addedAt: Date.now() });
  }

  async removeAdmin(email: string): Promise<void> {
    if (email === this.auth.currentUser?.email?.toLowerCase()) throw new Error("You cannot remove yourself");
    await deleteDoc(doc(this.db, "admins", email));
  }
}
