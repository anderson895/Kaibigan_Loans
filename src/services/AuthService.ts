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
  "auth/invalid-credential": "Mali ang email o password.",
  "auth/wrong-password": "Mali ang email o password.",
  "auth/user-not-found": "Mali ang email o password.",
  "auth/invalid-email": "Mali ang format ng email.",
  "auth/email-already-in-use": "May account na ang email na ito. Mag-login na lang, o gamitin ang Sign in with Google.",
  "auth/weak-password": "Masyadong mahina ang password (dapat 8 characters pataas).",
  "auth/too-many-requests": "Masyadong maraming subok. Maghintay muna ng ilang minuto.",
  "auth/popup-closed-by-user": "Naisara ang Google sign-in window.",
  "auth/network-request-failed": "Walang internet connection. Subukan ulit.",
  "auth/operation-not-allowed": "Hindi pa naka-enable ang Email/Password login sa Firebase.",
  "auth/unauthorized-domain": "Hindi pa naka-authorize ang domain na ito sa Firebase.",
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
    if (!name.trim()) throw new Error("Kailangan ang pangalan.");
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Dapat ${MIN_PASSWORD_LENGTH} characters pataas ang password.`);
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Mali ang email");
    await setDoc(doc(this.db, "admins", normalized), { email: normalized, addedAt: Date.now() });
  }

  async removeAdmin(email: string): Promise<void> {
    if (email === this.auth.currentUser?.email?.toLowerCase()) throw new Error("Hindi mo pwedeng tanggalin ang sarili mo");
    await deleteDoc(doc(this.db, "admins", email));
  }
}
