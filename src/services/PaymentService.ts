import { runTransaction, writeBatch, type Firestore } from "firebase/firestore";
import { today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { roundMoney } from "@/domain/money";
import { Payment, type ManualPaymentMethod, type OcrResult } from "@/domain/Payment";
import type { ActivityRepository, LoanRepository, PaymentRepository } from "@/data/repositories";
import type { UploadService } from "./UploadService";

export interface SubmitPaymentInput {
  loan: Loan;
  amount: number;
  referenceNo: string;
  paidOn: string;
  file: File;
  ocr: OcrResult | null;
}

export interface RecordPaymentInput {
  loan: Loan;
  amount: number;
  paidOn: string;
  method: ManualPaymentMethod;
  referenceNo?: string;
  note?: string;
  /** Optional photo (e.g. of the cash or an acknowledgement). */
  file?: File | null;
}

export class PaymentService {
  constructor(
    private readonly db: Firestore,
    private readonly payments: PaymentRepository,
    private readonly loans: LoanRepository,
    private readonly activity: ActivityRepository,
    private readonly uploads: UploadService,
  ) {}

  listAll() {
    return this.payments.listAll();
  }

  listForLoan(loanId: string, borrowerEmail?: string) {
    return this.payments.listByLoan(loanId, borrowerEmail);
  }

  /** Borrower uploads a receipt; it waits for admin approval before touching the balance. */
  async submit({ loan, amount, referenceNo, paidOn, file, ocr }: SubmitPaymentInput): Promise<string> {
    if (!loan.isActive) throw new Error("This loan no longer accepts payments.");
    if (amount > loan.balance) throw new Error(`Amount is greater than the remaining balance (${loan.balance}).`);
    const receipt = await this.uploads.uploadReceipt(file);
    const payment = Payment.submit({
      loanId: loan.id,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrowerName,
      borrowerEmail: loan.borrowerEmail,
      amount,
      referenceNo: referenceNo.trim(),
      paidOn,
      receiptUrl: receipt.url,
      receiptPublicId: receipt.publicId,
      ocr,
    });
    const ref = this.payments.newDocRef();
    const batch = writeBatch(this.db);
    batch.set(ref, this.payments.toData(payment));
    batch.set(this.activity.newDocRef(), {
      type: "payment_submitted",
      message: `${loan.borrowerName} uploaded a payment`,
      loanId: loan.id,
      borrowerName: loan.borrowerName,
      amount,
      actorEmail: loan.borrowerEmail,
      createdAt: Date.now(),
    });
    await batch.commit();
    return ref.id;
  }

  /**
   * Approves a payment and deducts it from the loan balance atomically.
   * `amount` lets the admin correct the declared value (e.g. accept the OCR-read amount).
   */
  async approve(paymentId: string, actorEmail: string, amount?: number): Promise<void> {
    await runTransaction(this.db, async (tx) => {
      const paymentRef = this.payments.docRef(paymentId);
      const payment = this.payments.fromSnapshot(await tx.get(paymentRef));
      if (!payment) throw new Error("Payment not found");
      const loanRef = this.loans.docRef(payment.loanId);
      const loan = this.loans.fromSnapshot(await tx.get(loanRef));
      if (!loan) throw new Error("Loan not found");

      const approved = payment.approve(amount ?? payment.amount);
      const updatedLoan = loan.applyPayment(approved.amount, approved.paidOn || today());

      tx.set(paymentRef, this.payments.toData(approved));
      tx.set(loanRef, this.loans.toData(updatedLoan));
      tx.set(this.activity.newDocRef(), {
        type: "payment_approved",
        message: `Payment of ${loan.borrowerName} approved`,
        loanId: loan.id,
        borrowerName: loan.borrowerName,
        amount: approved.amount,
        actorEmail,
        createdAt: Date.now(),
      });
    });
  }

  /**
   * The admin records a payment they received directly (cash, or GCash/bank they already checked).
   * It is approved and deducted from the balance right away, in one transaction.
   */
  async record(input: RecordPaymentInput, actorEmail: string): Promise<string> {
    const { loan, amount } = input;
    if (!loan.isActive) throw new Error("This loan no longer accepts payments.");
    if (!(amount > 0)) throw new Error("Payment amount must be greater than zero.");
    if (amount > loan.balance + 0.001) throw new Error(`Amount is greater than the remaining balance (${loan.balance}).`);
    const receipt = input.file ? await this.uploads.uploadReceipt(input.file) : null;

    const ref = this.payments.newDocRef();
    await runTransaction(this.db, async (tx) => {
      const loanRef = this.loans.docRef(loan.id);
      const current = this.loans.fromSnapshot(await tx.get(loanRef));
      if (!current) throw new Error("Loan not found");
      if (amount > current.balance + 0.001) throw new Error(`Amount is greater than the remaining balance (${current.balance}).`);

      const payment = Payment.record({
        loanId: current.id,
        borrowerId: current.borrowerId,
        borrowerName: current.borrowerName,
        borrowerEmail: current.borrowerEmail,
        amount: roundMoney(amount),
        paidOn: input.paidOn || today(),
        method: input.method,
        recordedBy: actorEmail,
        referenceNo: input.referenceNo,
        note: input.note,
        receiptUrl: receipt?.url,
        receiptPublicId: receipt?.publicId,
      });
      tx.set(ref, this.payments.toData(payment));
      tx.set(loanRef, this.loans.toData(current.applyPayment(payment.amount, payment.paidOn)));
      tx.set(this.activity.newDocRef(), {
        type: "payment_recorded",
        message: `${payment.methodLabel} payment recorded for ${current.borrowerName}`,
        loanId: current.id,
        borrowerName: current.borrowerName,
        amount: payment.amount,
        actorEmail,
        createdAt: Date.now(),
      });
    });
    return ref.id;
  }

  /**
   * Deletes a payment (e.g. recorded by mistake). If it was approved, its amount is added
   * back to the loan balance and the schedule is recalculated, in one transaction.
   */
  async remove(paymentId: string, actorEmail: string): Promise<void> {
    await runTransaction(this.db, async (tx) => {
      const paymentRef = this.payments.docRef(paymentId);
      const payment = this.payments.fromSnapshot(await tx.get(paymentRef));
      if (!payment) throw new Error("Payment not found");
      const loanRef = this.loans.docRef(payment.loanId);
      const loan = payment.isApproved ? this.loans.fromSnapshot(await tx.get(loanRef)) : null;

      if (loan) tx.set(loanRef, this.loans.toData(loan.removePayment(payment.amount)));
      tx.delete(paymentRef);
      tx.set(this.activity.newDocRef(), {
        type: "payment_deleted",
        message: `Payment of ${payment.borrowerName} deleted${payment.isApproved ? " (added back to balance)" : ""}`,
        loanId: payment.loanId,
        borrowerName: payment.borrowerName,
        amount: payment.amount,
        actorEmail,
        createdAt: Date.now(),
      });
    });
  }

  async reject(paymentId: string, reason: string, actorEmail: string): Promise<void> {
    await runTransaction(this.db, async (tx) => {
      const paymentRef = this.payments.docRef(paymentId);
      const payment = this.payments.fromSnapshot(await tx.get(paymentRef));
      if (!payment) throw new Error("Payment not found");
      tx.set(paymentRef, this.payments.toData(payment.reject(reason)));
      tx.set(this.activity.newDocRef(), {
        type: "payment_rejected",
        message: `Payment of ${payment.borrowerName} rejected`,
        loanId: payment.loanId,
        borrowerName: payment.borrowerName,
        amount: payment.amount,
        actorEmail,
        createdAt: Date.now(),
      });
    });
  }
}
