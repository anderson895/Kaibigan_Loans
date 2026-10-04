import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { collection, doc, getDoc, getDocs, writeBatch, type Firestore } from "firebase/firestore";
import type { ActivityRepository } from "@/data/repositories";

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
  "auth/invalid-action-code": "This link is invalid or was already used. Request a new one.",
  "auth/expired-action-code": "This link has expired. Request a new one.",
  "auth/requires-recent-login": "For your security, log out and log in again, then try again.",
};

/** Turns Firebase auth errors into friendly Taglish messages. */
export function authErrorMessage(e: unknown): string {
  if (e instanceof FirebaseError) return AUTH_ERRORS[e.code] ?? e.message;
  return e instanceof Error ? e.message : String(e);
}

export const MIN_PASSWORD_LENGTH = 8;

/** POSTs JSON to our own API and turns an error response into a readable Error. */
async function postJson(url: string, body: unknown, authorization?: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed (${res.status}). Please try again.`);
  }
}

/**
 * Admins are stored as `admins/{email}`. The very first person to sign in (while `meta/setup`
 * does not exist yet) can claim admin — see firestore.rules.
 */
export class AuthService {
  constructor(
    private readonly auth: Auth,
    private readonly db: Firestore,
    private readonly activity: ActivityRepository,
  ) {}

  onChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(this.auth, callback);
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const { user } = await signInWithPopup(this.auth, provider);
    this.logSignIn(user, "Google");
    return user;
  }

  /** `remember` keeps the session after the browser closes; otherwise it ends with the tab session. */
  async signInWithEmail(email: string, password: string, remember: boolean): Promise<User> {
    await setPersistence(this.auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const { user } = await signInWithEmailAndPassword(this.auth, email.trim(), password);
    this.logSignIn(user, "email");
    return user;
  }

  /**
   * Audit log entry for a sign-in from the login page (restored sessions are not logged). Unverified
   * accounts cannot write yet, and a failed entry must never block the sign-in.
   */
  private logSignIn(user: User, method: string): void {
    if (!user.emailVerified || !user.email) return;
    const email = user.email.toLowerCase();
    this.activity
      .log({ type: "signed_in", message: `${user.displayName || email} signed in with ${method}`, actorEmail: email })
      .catch(() => undefined);
  }

  /** Creates an email/password account and sends a verification link (required before data access). */
  async register(name: string, email: string, password: string, turnstileToken?: string | null): Promise<User> {
    if (!name.trim()) throw new Error("Name is required.");
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    const { user } = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
    await updateProfile(user, { displayName: name.trim() });
    // Display name must be in the ID token so the email can greet the user by name.
    await user.getIdToken(true);
    await this.sendVerificationEmail(turnstileToken);
    return user;
  }

  /** Our own mailer (Gmail SMTP on the server), not Firebase's built-in email. */
  private async sendVerificationEmail(turnstileToken?: string | null): Promise<void> {
    await postJson("/api/send-verification", { turnstileToken }, `Bearer ${await this.idToken()}`);
  }

  /** Applies the code from our /verify-email link (sent by our own mailer). */
  verifyEmail(oobCode: string): Promise<void> {
    return applyActionCode(this.auth, oobCode);
  }

  /** Emails a reset link to our own /reset-password page (sent from our Gmail, not by Firebase). */
  async sendPasswordReset(email: string, turnstileToken?: string | null): Promise<void> {
    await postJson("/api/send-password-reset", { email: email.trim(), turnstileToken });
  }

  /** Checks the code from the reset link and returns the account's email. */
  checkResetCode(oobCode: string): Promise<string> {
    return verifyPasswordResetCode(this.auth, oobCode);
  }

  async resetPassword(oobCode: string, newPassword: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    await confirmPasswordReset(this.auth, oobCode, newPassword);
  }

  async resendVerification(turnstileToken?: string | null): Promise<void> {
    if (this.auth.currentUser) await this.sendVerificationEmail(turnstileToken);
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
    // A separate write: inside the batch above, the rules would not see them as admin yet.
    await this.activity
      .log({ type: "admin_claimed", message: `${user.displayName || email} became the first admin`, actorEmail: email })
      .catch(() => undefined);
  }

  async listAdmins(): Promise<string[]> {
    const snapshot = await getDocs(collection(this.db, "admins"));
    return snapshot.docs.map((d) => d.id).sort();
  }

  async addAdmin(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Invalid email");
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, "admins", normalized), { email: normalized, addedAt: Date.now() });
    batch.set(this.activity.newDocRef(), this.activity.entry({ type: "admin_added", message: `Admin access given to ${normalized}`, actorEmail: this.myEmail() }));
    await batch.commit();
  }

  async removeAdmin(email: string): Promise<void> {
    if (email === this.myEmail()) throw new Error("You cannot remove yourself");
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, "admins", email));
    batch.set(this.activity.newDocRef(), this.activity.entry({ type: "admin_removed", message: `Admin access removed from ${email}`, actorEmail: this.myEmail() }));
    await batch.commit();
  }

  private myEmail(): string {
    return this.auth.currentUser?.email?.toLowerCase() ?? "";
  }
}
