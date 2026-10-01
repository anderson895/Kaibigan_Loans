import { writeBatch, type Firestore } from "firebase/firestore";
import { Borrower, type BorrowerInput } from "@/domain/Borrower";
import { Loan, type NewLoanInput } from "@/domain/Loan";
import type { ActivityRepository, ActivityType, BorrowerRepository, LoanRepository } from "@/data/repositories";

export type LoanTermsInput = Pick<NewLoanInput, "principal" | "interestType" | "interestValue" | "term" | "termUnit" | "paymentPlan" | "startDate" | "notes">;

export class LoanService {
  constructor(
    private readonly db: Firestore,
    private readonly loans: LoanRepository,
    private readonly borrowers: BorrowerRepository,
    private readonly activity: ActivityRepository,
  ) {}

  // ---- Borrowers ----

  listBorrowers() {
    return this.borrowers.listAll();
  }

  findBorrowerByEmail(email: string) {
    return this.borrowers.findByEmail(email);
  }

  async createBorrower(input: BorrowerInput): Promise<string> {
    const borrower = Borrower.create(input);
    if (await this.borrowers.findByEmail(borrower.email)) throw new Error("May borrower na gamit ang email na ito.");
    return this.borrowers.create(borrower);
  }

  async updateBorrower(borrower: Borrower, changes: Partial<BorrowerInput>): Promise<void> {
    await this.borrowers.save(borrower.id, borrower.update(changes));
  }

  async deleteBorrower(id: string): Promise<void> {
    const borrower = await this.borrowers.get(id);
    if (!borrower) return;
    const loans = await this.loans.listByEmail(borrower.email);
    if (loans.some((l) => l.isActive || l.isRequest)) throw new Error("May active na loan pa ang borrower na ito.");
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

  async deleteLoan(id: string): Promise<void> {
    await this.loans.delete(id);
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
