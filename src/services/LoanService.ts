import { writeBatch, type Firestore } from "firebase/firestore";
import { Borrower, type BorrowerInput } from "@/domain/Borrower";
import { Loan, type NewLoanInput } from "@/domain/Loan";
import type { ActivityRepository, ActivityType, BorrowerRepository, LoanRepository, PaymentRepository } from "@/data/repositories";
import { today } from "@/domain/dates";
import type { UploadService } from "./UploadService";

export type LoanTermsInput = Pick<NewLoanInput, "principal" | "interestType" | "interestValue" | "term" | "termUnit" | "paymentPlan" | "startDate" | "notes">;

export class LoanService {
  constructor(
    private readonly db: Firestore,
    private readonly loans: LoanRepository,
    private readonly borrowers: BorrowerRepository,
    private readonly activity: ActivityRepository,
    private readonly uploads: UploadService,
    private readonly payments: PaymentRepository,
  ) {}

  // ---- Borrowers ----

  listBorrowers() {
    return this.borrowers.listAll();
  }

  findBorrowerByEmail(email: string) {
    return this.borrowers.findByEmail(email);
  }

  /**
   * Makes sure a registered (verified) user has a borrower profile, so the lender sees them in
   * Borrowers without adding them by hand. Profiles created by the lender earlier are matched by email.
   */
  async ensureBorrowerFor(user: { uid: string; email: string; displayName: string | null }): Promise<void> {
    if (await this.borrowers.findByEmail(user.email)) return;
    await this.borrowers.save(user.uid, Borrower.forRegisteredUser(user.uid, user.displayName ?? "", user.email));
  }

  async createBorrower(input: BorrowerInput): Promise<string> {
    const borrower = Borrower.create(input);
    // Only check duplicates by email when there is one (borrowers can be added by name only).
    if (borrower.hasEmail && (await this.borrowers.findByEmail(borrower.email))) {
      throw new Error("A borrower with this email already exists.");
    }
    return this.borrowers.create(borrower);
  }

  /**
   * Saves the borrower and, when the name or email changed, copies them onto their loans and payments.
   * Those copies decide who can see a loan, so adding an email to a borrower who was added by name
   * lets them see their existing loans once they register with that email.
   */
  async updateBorrower(borrower: Borrower, changes: Partial<BorrowerInput>): Promise<void> {
    const updated = borrower.update(changes);
    if (updated.hasEmail && updated.email !== borrower.email) {
      const existing = await this.borrowers.findByEmail(updated.email);
      if (existing && existing.id !== borrower.id) {
        throw new Error("Another borrower already uses this email (they may have registered already).");
      }
    }

    const identityChanged = updated.email !== borrower.email || updated.name !== borrower.name;
    const linked = identityChanged
      ? (await Promise.all([this.loans.refsWhere("borrowerId", borrower.id), this.payments.refsWhere("borrowerId", borrower.id)])).flat()
      : [];

    const batch = writeBatch(this.db);
    batch.set(this.borrowers.docRef(borrower.id), this.borrowers.toData(updated));
    linked.forEach((ref) => batch.update(ref, { borrowerEmail: updated.email, borrowerName: updated.name }));
    await batch.commit();
  }

  async deleteBorrower(id: string): Promise<void> {
    const borrower = await this.borrowers.get(id);
    if (!borrower) return;
    const loans = await this.loans.listByBorrower(borrower.id);
    if (loans.some((l) => l.isActive || l.isRequest)) throw new Error("This borrower still has an active loan.");
    await this.borrowers.delete(id);
  }

  // ---- Loans ----

  listLoans() {
    return this.loans.listAll();
  }

  listMyLoans(email: string) {
    return this.loans.listByEmail(email);
  }

  getLoan(id: string) {
    return this.loans.get(id);
  }

  /** Admin creates a loan directly (also used to import old records with `amountPaid`). */
  async createLoan(borrower: Borrower, terms: LoanTermsInput & { amountPaid?: number }, actorEmail: string): Promise<string> {
    const loan = Loan.create({ ...terms, ...this.borrowerFields(borrower), payoutDetails: borrower.payoutDetails });
    const ref = this.loans.newDocRef();
    const batch = writeBatch(this.db);
    batch.set(ref, this.loans.toData(loan));
    this.logActivity(batch, "loan_created", `New loan for ${borrower.name}`, ref.id, borrower.name, loan.principal, actorEmail);
    await batch.commit();
    return ref.id;
  }

  /** Borrower asks for a loan; the admin sets final terms when approving. */
  async requestLoan(
    borrower: Borrower,
    request: Pick<NewLoanInput, "principal" | "term" | "termUnit" | "paymentPlan" | "notes" | "payoutDetails">,
    startDate: string,
  ): Promise<string> {
    const loan = Loan.create({
      ...request,
      ...this.borrowerFields(borrower),
      interestType: "none",
      interestValue: 0,
      startDate,
      asRequest: true,
    });
    const ref = this.loans.newDocRef();
    const batch = writeBatch(this.db);
    batch.set(ref, this.loans.toData(loan));
    this.logActivity(batch, "loan_requested", `${borrower.name} requested a loan`, ref.id, borrower.name, loan.principal, borrower.email);
    await batch.commit();
    return ref.id;
  }

  /** Approves a request with the admin's final terms (interest, term, start date). */
  async approveRequest(request: Loan, terms: LoanTermsInput, actorEmail: string): Promise<void> {
    const approved = Loan.create(
      {
        ...terms,
        borrowerId: request.borrowerId,
        borrowerName: request.borrowerName,
        borrowerEmail: request.borrowerEmail,
        payoutDetails: request.payoutDetails,
        asRequest: true,
      },
      request.id,
    ).approveRequest();
    const batch = writeBatch(this.db);
    batch.set(this.loans.docRef(request.id), { ...this.loans.toData(approved), createdAt: request.createdAt });
    this.logActivity(batch, "request_approved", `Loan request of ${request.borrowerName} approved`, request.id, request.borrowerName, approved.principal, actorEmail);
    await batch.commit();
  }

  async rejectRequest(request: Loan, actorEmail: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.set(this.loans.docRef(request.id), this.loans.toData(request.rejectRequest()));
    this.logActivity(batch, "request_rejected", `Loan request of ${request.borrowerName} declined`, request.id, request.borrowerName, request.principal, actorEmail);
    await batch.commit();
  }

  /** Lender uploads proof that the money was sent (GCash/bank screenshot); the borrower can view it. */
  async attachDisbursement(
    loan: Loan,
    input: { file: File; referenceNo: string; sentOn?: string },
    actorEmail: string,
  ): Promise<void> {
    const receipt = await this.uploads.uploadReceipt(input.file, "disbursements");
    const updated = loan.withDisbursement({
      receiptUrl: receipt.url,
      receiptPublicId: receipt.publicId,
      referenceNo: input.referenceNo.trim(),
      sentOn: input.sentOn || today(),
      uploadedAt: Date.now(),
    });
    const batch = writeBatch(this.db);
    batch.update(this.loans.docRef(loan.id), { disbursement: updated.disbursement });
    this.logActivity(batch, "loan_disbursed", `Money sent to ${loan.borrowerName}`, loan.id, loan.borrowerName, loan.principal, actorEmail);
    await batch.commit();
  }

  /** Changes the terms of a loan that has no approved payments yet (schedule is recalculated). */
  async updateLoanTerms(loan: Loan, terms: LoanTermsInput, actorEmail: string): Promise<void> {
    const updated = loan.withTerms(terms);
    const batch = writeBatch(this.db);
    batch.set(this.loans.docRef(loan.id), this.loans.toData(updated));
    this.logActivity(batch, "loan_updated", `Loan terms updated for ${loan.borrowerName}`, loan.id, loan.borrowerName, updated.totalAmount, actorEmail);
    await batch.commit();
  }

  /** Deletes a loan together with its payments and activity entries, so nothing is left orphaned. */
  async deleteLoan(id: string): Promise<void> {
    const [paymentRefs, activityRefs] = await Promise.all([
      this.payments.refsWhere("loanId", id),
      this.activity.refsWhere("loanId", id),
    ]);
    const refs = [...paymentRefs, ...activityRefs, this.loans.docRef(id)];
    // Firestore batches hold up to 500 writes; the loan itself goes in the last batch.
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(this.db);
      refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  recentActivity(count?: number) {
    return this.activity.recent(count);
  }

  private borrowerFields(borrower: Borrower) {
    return { borrowerId: borrower.id, borrowerName: borrower.name, borrowerEmail: borrower.email };
  }

  private logActivity(
    batch: ReturnType<typeof writeBatch>,
    type: ActivityType,
    message: string,
    loanId: string,
    borrowerName: string,
    amount: number | null,
    actorEmail: string,
  ) {
    batch.set(this.activity.newDocRef(), { type, message, loanId, borrowerName, amount, actorEmail, createdAt: Date.now() });
  }
}
