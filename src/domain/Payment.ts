import type { IsoDate } from "./dates";

export type PaymentStatus = "pending" | "approved" | "rejected";

/** "upload" = the borrower uploaded a receipt in the app; the others are recorded by the admin. */
export type PaymentMethod = "upload" | "cash" | "gcash" | "bank" | "other";
export type ManualPaymentMethod = Exclude<PaymentMethod, "upload">;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upload: "Uploaded receipt",
  cash: "Cash",
  gcash: "GCash",
  bank: "Bank transfer",
  other: "Other",
};

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
  method: PaymentMethod;
  /** Admin email when the admin recorded the payment; "" when the borrower uploaded it. */
  recordedBy: string;
  note: string;
}

/** What the borrower provides when uploading a receipt. */
export type NewPaymentInput = Omit<
  PaymentProps,
  "id" | "status" | "rejectReason" | "submittedAt" | "reviewedAt" | "method" | "recordedBy" | "note"
>;

/** What the admin provides when recording a payment they received (cash, GCash, ...). */
export interface ManualPaymentInput {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerEmail: string;
  amount: number;
  paidOn: IsoDate;
  method: ManualPaymentMethod;
  recordedBy: string;
  referenceNo?: string;
  note?: string;
  receiptUrl?: string;
  receiptPublicId?: string;
}

export class Payment {
  private constructor(private readonly props: PaymentProps) {}

  static fromProps(props: Partial<PaymentProps> & Omit<PaymentProps, "method" | "recordedBy" | "note">): Payment {
    // Payments saved before manual recording existed were all borrower uploads.
    return new Payment({ method: "upload", recordedBy: "", note: "", ...props } as PaymentProps);
  }

  static submit(input: NewPaymentInput): Payment {
    if (!(input.amount > 0)) throw new Error("Payment amount must be greater than zero");
    if (!input.receiptUrl) throw new Error("Receipt is required");
    return new Payment({
      ...input,
      id: "",
      status: "pending",
      rejectReason: "",
      submittedAt: Date.now(),
      reviewedAt: null,
      method: "upload",
      recordedBy: "",
      note: "",
    });
  }

  /** A payment the admin received directly. It counts immediately — there is nothing to review. */
  static record(input: ManualPaymentInput): Payment {
    if (!(input.amount > 0)) throw new Error("Payment amount must be greater than zero");
    if (!input.paidOn) throw new Error("Payment date is required");
    const now = Date.now();
    return new Payment({
      id: "",
      loanId: input.loanId,
      borrowerId: input.borrowerId,
      borrowerName: input.borrowerName,
      borrowerEmail: input.borrowerEmail,
      amount: input.amount,
      referenceNo: (input.referenceNo ?? "").trim(),
      paidOn: input.paidOn,
      receiptUrl: input.receiptUrl ?? "",
      receiptPublicId: input.receiptPublicId ?? "",
      ocr: null,
      status: "approved",
      rejectReason: "",
      submittedAt: now,
      reviewedAt: now,
      method: input.method,
      recordedBy: input.recordedBy,
      note: (input.note ?? "").trim(),
    });
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
  get method() { return this.props.method; }
  get recordedBy() { return this.props.recordedBy; }
  get note() { return this.props.note; }
  get isPending() { return this.props.status === "pending"; }
  get isApproved() { return this.props.status === "approved"; }
  /** Recorded by the admin (cash, GCash received, ...) rather than uploaded by the borrower. */
  get isManual() { return this.props.method !== "upload"; }
  get methodLabel() { return PAYMENT_METHOD_LABELS[this.props.method]; }

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
