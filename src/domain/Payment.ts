import type { IsoDate } from "./dates";

export type PaymentStatus = "pending" | "approved" | "rejected";

export interface OcrResult {
  amount: number | null;
  referenceNo: string | null;
  /** Raw text, kept short, so the admin can double-check what was read. */
  text: string;
}

export interface PaymentProps {
  id: string;
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerEmail: string;
  amount: number;
  referenceNo: string;
  paidOn: IsoDate;
  receiptUrl: string;
  receiptPublicId: string;
  ocr: OcrResult | null;
  status: PaymentStatus;
  rejectReason: string;
  submittedAt: number;
  reviewedAt: number | null;
}

export type NewPaymentInput = Omit<PaymentProps, "id" | "status" | "rejectReason" | "submittedAt" | "reviewedAt">;

export class Payment {
  private constructor(private readonly props: PaymentProps) {}

  static fromProps(props: PaymentProps): Payment {
    return new Payment({ ...props });
  }

  static submit(input: NewPaymentInput): Payment {
    if (!(input.amount > 0)) throw new Error("Payment amount must be greater than zero");
    if (!input.receiptUrl) throw new Error("Receipt is required");
    return new Payment({ ...input, id: "", status: "pending", rejectReason: "", submittedAt: Date.now(), reviewedAt: null });
  }

  get id() { return this.props.id; }
  get loanId() { return this.props.loanId; }
  get borrowerId() { return this.props.borrowerId; }
  get borrowerName() { return this.props.borrowerName; }
  get borrowerEmail() { return this.props.borrowerEmail; }
  get amount() { return this.props.amount; }
  get referenceNo() { return this.props.referenceNo; }
  get paidOn() { return this.props.paidOn; }
  get receiptUrl() { return this.props.receiptUrl; }
  get ocr() { return this.props.ocr; }
  get status() { return this.props.status; }
  get rejectReason() { return this.props.rejectReason; }
  get submittedAt() { return this.props.submittedAt; }
  get reviewedAt() { return this.props.reviewedAt; }
  get isPending() { return this.props.status === "pending"; }

  /** True when OCR read an amount that differs from what the borrower declared. */
  get hasOcrMismatch(): boolean {
    const ocrAmount = this.props.ocr?.amount;
    return ocrAmount != null && Math.abs(ocrAmount - this.props.amount) > 0.009;
  }

  /** Admin may correct the amount (e.g. to the OCR-read value) when approving. */
  approve(amount = this.props.amount): Payment {
    if (!this.isPending) throw new Error("Payment was already reviewed");
    if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
    return new Payment({ ...this.props, amount, status: "approved", reviewedAt: Date.now() });
  }

  reject(reason: string): Payment {
    if (!this.isPending) throw new Error("Payment was already reviewed");
    return new Payment({ ...this.props, status: "rejected", rejectReason: reason.trim(), reviewedAt: Date.now() });
  }

  toProps(): PaymentProps {
    return { ...this.props };
  }
}
