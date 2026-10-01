import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch, type Firestore } from "firebase/firestore";

export type Role = "admin" | "borrower";

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
