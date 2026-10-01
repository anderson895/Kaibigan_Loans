import { orderBy, where, limit, type Firestore } from "firebase/firestore";
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
  | "loan_requested"
  | "request_approved"
  | "request_rejected"
  | "payment_submitted"
  | "payment_approved"
  | "payment_rejected";

export interface ActivityProps {
  id: string;
  type: ActivityType;
  message: string;
  loanId: string;
  borrowerName: string;
  amount: number | null;
  actorEmail: string;
  createdAt: number;
}

/** Activity entries are plain records, so the entity is its props. */
export class ActivityRepository extends BaseRepository<ActivityProps, ActivityProps> {
  constructor(db: Firestore) {
    super(db, "activity");
  }
  protected toEntity(props: ActivityProps) { return props; }
  protected toProps(entity: ActivityProps) { return entity; }

  recent(count = 8) {
    return this.list(orderBy("createdAt", "desc"), limit(count));
  }
}
