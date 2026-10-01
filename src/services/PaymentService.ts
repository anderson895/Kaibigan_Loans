import { runTransaction, writeBatch, type Firestore } from "firebase/firestore";
import { today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { Payment, type OcrResult } from "@/domain/Payment";
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
    if (!loan.isActive) throw new Error("Hindi na tumatanggap ng payment ang loan na ito.");
    if (amount > loan.balance) throw new Error(`Mas malaki ang amount kaysa sa natitirang balance (${loan.balance}).`);
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
