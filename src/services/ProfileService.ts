import { FirebaseError } from "firebase/app";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile, type Auth, type User } from "firebase/auth";
import { writeBatch, type Firestore } from "firebase/firestore";
import type { ActivityRepository, BorrowerRepository, LoanRepository, PaymentRepository } from "@/data/repositories";
import { MIN_PASSWORD_LENGTH } from "./AuthService";

export const MAX_NAME_LENGTH = 100;

/** The signed-in user's own account (My Profile): their name and password. */
export class ProfileService {
  constructor(
    private readonly auth: Auth,
    private readonly db: Firestore,
    private readonly borrowers: BorrowerRepository,
    private readonly loans: LoanRepository,
    private readonly payments: PaymentRepository,
    private readonly activity: ActivityRepository,
  ) {}

  /** False for Google-only accounts: their password is managed by Google. */
  static hasPassword(user: User): boolean {
    return user.providerData.some((p) => p.providerId === "password");
  }

  /**
   * Renames the user everywhere: their account, their borrower profile (the name the lender sees) and
   * the name copied onto their loans and payments. The Firestore part is one batch with the audit entry.
   */
  async updateName(name: string): Promise<void> {
    const user = this.currentUser();
    const email = user.email!.toLowerCase();
    const next = name.trim();
    if (!next) throw new Error("Name is required.");
    if (next.length > MAX_NAME_LENGTH) throw new Error(`Name is too long (${MAX_NAME_LENGTH} characters max).`);

    const borrower = await this.borrowers.findByEmail(email);
    const renameBorrower = !!borrower && borrower.name !== next;
    if (!renameBorrower && user.displayName === next) return;

    const batch = writeBatch(this.db);
    if (borrower && renameBorrower) {
      // By email, not borrower id: that is the only query the rules let a borrower run.
      const linked = (await Promise.all([this.loans.refsWhere("borrowerEmail", email), this.payments.refsWhere("borrowerEmail", email)])).flat();
      batch.update(this.borrowers.docRef(borrower.id), { name: next });
      linked.forEach((ref) => batch.update(ref, { borrowerName: next }));
    }
    const before = (renameBorrower ? borrower?.name : user.displayName) || email;
    batch.set(
      this.activity.newDocRef(),
      this.activity.entry({ type: "profile_updated", message: `${before} changed their name to ${next}`, borrowerName: borrower ? next : "", actorEmail: email }),
    );
    await batch.commit();
    await updateProfile(user, { displayName: next });
  }

  /** Email/password accounts only. Firebase asks for the current password before a new one is set. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.currentUser();
    const email = user.email!.toLowerCase();
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (newPassword === currentPassword) throw new Error("The new password must be different from your current one.");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, currentPassword));
    } catch (e) {
      if (e instanceof FirebaseError && (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password")) {
        throw new Error("Your current password is incorrect.");
      }
      throw e;
    }
    await updatePassword(user, newPassword);
    await this.activity.log({ type: "password_changed", message: `${user.displayName || email} changed their password`, actorEmail: email });
  }

  private currentUser(): User {
    const user = this.auth.currentUser;
    if (!user?.email) throw new Error("Not signed in");
    return user;
  }
}
