import { getDoc, orderBy, where, limit, startAfter, type DocumentData, type Firestore, type QueryConstraint } from "firebase/firestore";
import { Borrower, type BorrowerProps } from "@/domain/Borrower";
import { Loan, type LoanProps } from "@/domain/Loan";
import { Payment, type PaymentProps } from "@/domain/Payment";
import { BaseRepository } from "./BaseRepository";

export class BorrowerRepository extends BaseRepository<Borrower, BorrowerProps> {
  constructor(db: Firestore) {
    super(db, "borrowers");
  }
  protected toEntity(props: BorrowerProps) { return Borrower.fromProps(props); }
  protected toProps(entity: Borrower) { return entity.toProps(); }

  listAll() {
    return this.list(orderBy("name"));
  }

  async findByEmail(email: string): Promise<Borrower | null> {
    const [found] = await this.list(where("email", "==", email.toLowerCase()), limit(1));
    return found ?? null;
  }
}

export class LoanRepository extends BaseRepository<Loan, LoanProps> {
  constructor(db: Firestore) {
    super(db, "loans");
  }
  protected toEntity(props: LoanProps) { return Loan.fromProps(props); }
  protected toProps(entity: Loan) { return entity.toProps(); }

  listAll() {
    return this.list(orderBy("createdAt", "desc"));
  }

  /** Admin only: every loan of one borrower (works for borrowers without an email too). */
  listByBorrower(borrowerId: string) {
    return this.list(where("borrowerId", "==", borrowerId));
  }

  /** Borrowers may only query by their own email (enforced by security rules). */
  listByEmail(email: string) {
    return this.list(where("borrowerEmail", "==", email.toLowerCase()), orderBy("createdAt", "desc"));
  }
}

export class PaymentRepository extends BaseRepository<Payment, PaymentProps> {
  constructor(db: Firestore) {
    super(db, "payments");
  }
  protected toEntity(props: PaymentProps) { return Payment.fromProps(props); }
  protected toProps(entity: Payment) { return entity.toProps(); }

  listAll() {
    return this.list(orderBy("submittedAt", "desc"));
  }

  listByLoan(loanId: string, borrowerEmail?: string) {
    const constraints = [where("loanId", "==", loanId), orderBy("submittedAt", "desc")];
    // Borrower queries must include their email so the rules can verify ownership.
    if (borrowerEmail) constraints.unshift(where("borrowerEmail", "==", borrowerEmail.toLowerCase()));
    return this.list(...constraints);
  }
}

export type ActivityType =
  | "loan_created"
  | "loan_disbursed"
  | "loan_updated"
  | "loan_deleted"
  | "loan_requested"
  | "request_approved"
  | "request_rejected"
  | "payment_submitted"
  | "payment_approved"
  | "payment_recorded"
  | "payment_deleted"
  | "payment_rejected"
  | "borrower_registered"
  | "borrower_created"
  | "borrower_updated"
  | "borrower_deleted"
  | "signed_in"
  | "profile_updated"
  | "password_changed"
  | "admin_claimed"
  | "admin_added"
  | "admin_removed"
  | "contact_updated";

export interface ActivityProps {
  id: string;
  type: ActivityType;
  message: string;
  loanId: string;
  borrowerName: string;
  amount: number | null;
  /** Who did it: the signed-in user's email. */
  actorEmail: string;
  createdAt: number;
}

/** A new entry. `loanId`, `borrowerName` and `amount` only apply to some actions. */
export type NewActivity = Pick<ActivityProps, "type" | "message" | "actorEmail"> &
  Partial<Pick<ActivityProps, "loanId" | "borrowerName" | "amount">>;

/**
 * The activity collection doubles as the audit log: every action by an admin or a borrower adds an
 * entry, and entries are never edited or deleted (see firestore.rules).
 */
export class ActivityRepository extends BaseRepository<ActivityProps, ActivityProps> {
  constructor(db: Firestore) {
    super(db, "activity");
  }
  protected toEntity(props: ActivityProps) { return props; }
  protected toProps(entity: ActivityProps) { return entity; }

  /** Document data for a new entry, to write inside a batch or transaction. */
  entry(input: NewActivity): DocumentData {
    return { loanId: "", borrowerName: "", amount: null, ...input, createdAt: Date.now() };
  }

  /** Adds an entry on its own (for actions that are not a batch or transaction). */
  async log(input: NewActivity): Promise<void> {
    await this.create({ id: "", ...this.entry(input) } as ActivityProps);
  }

  recent(count = 8) {
    return this.list(orderBy("createdAt", "desc"), limit(count));
  }

  /** Newest first, `count` at a time; pass the last entry's id to get the page after it. */
  async page(count: number, afterId?: string): Promise<ActivityProps[]> {
    const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
    if (afterId) constraints.push(startAfter(await getDoc(this.docRef(afterId))));
    return this.list(...constraints, limit(count));
  }
}
