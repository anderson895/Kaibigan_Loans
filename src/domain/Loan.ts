import { addDays, addMonths, type IsoDate } from "./dates";
import { createInterestStrategy, type InterestType, type TermUnit } from "./InterestStrategy";
import { roundMoney } from "./money";

export type PaymentPlan = "installment" | "lump";
export type LoanStatus = "pending" | "ongoing" | "overdue" | "paid" | "rejected";
export type ScheduleStatus = "pending" | "partial" | "paid";

export interface ScheduleItem {
  dueDate: IsoDate;
  amountDue: number;
  status: ScheduleStatus;
  paidDate: IsoDate | null;
}

export interface LoanProps {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  interestType: InterestType;
  interestValue: number;
  /** Length of the term, counted in `termUnit`. */
  term: number;
  termUnit: TermUnit;
  paymentPlan: PaymentPlan;
  interestAmount: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  startDate: IsoDate;
  dueDate: IsoDate;
  status: LoanStatus;
  schedule: ScheduleItem[];
  notes: string;
  payoutDetails: string;
  createdAt: number;
}

export interface NewLoanInput {
  borrowerId: string;
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  interestType: InterestType;
  interestValue: number;
  term: number;
  termUnit?: TermUnit;
  paymentPlan: PaymentPlan;
  startDate: IsoDate;
  notes?: string;
  payoutDetails?: string;
  /** Loans created by a borrower start as a pending request. */
  asRequest?: boolean;
  /** Amount already paid, used when importing existing records. */
  amountPaid?: number;
}

export class Loan {
  private constructor(private readonly props: LoanProps) {}

  static fromProps(props: LoanProps & { termMonths?: number }): Loan {
    // Loans saved before weekly terms existed only have `termMonths`.
    const { termMonths, ...rest } = props;
    return new Loan({
      ...rest,
      term: rest.term ?? termMonths ?? 1,
      termUnit: rest.termUnit ?? "months",
      schedule: rest.schedule.map((s) => ({ ...s })),
    });
  }

  static create(input: NewLoanInput, id = ""): Loan {
    if (!(input.principal > 0)) throw new Error("Loan amount must be greater than zero");
    const term = Math.max(1, Math.floor(input.term || 1));
    const termUnit = input.termUnit ?? "months";
    const interestAmount = createInterestStrategy(input.interestType, input.interestValue || 0).compute(
      input.principal,
      term,
    );
    const totalAmount = roundMoney(input.principal + interestAmount);
    const schedule = Loan.buildSchedule(totalAmount, input.paymentPlan, term, input.startDate, termUnit);

    let loan = new Loan({
      id,
      borrowerId: input.borrowerId,
      borrowerName: input.borrowerName,
      borrowerEmail: input.borrowerEmail.toLowerCase(),
      principal: roundMoney(input.principal),
      interestType: input.interestType,
      interestValue: input.interestValue || 0,
      term,
      termUnit,
      paymentPlan: input.paymentPlan,
      interestAmount,
      totalAmount,
      amountPaid: 0,
      balance: totalAmount,
      startDate: input.startDate,
      dueDate: schedule[schedule.length - 1].dueDate,
      status: input.asRequest ? "pending" : "ongoing",
      schedule,
      notes: input.notes ?? "",
      payoutDetails: input.payoutDetails ?? "",
      createdAt: Date.now(),
    });
    if (!input.asRequest && input.amountPaid && input.amountPaid > 0) {
      loan = loan.applyPayment(input.amountPaid, input.startDate);
    }
    return loan;
  }

  /**
   * Installments split the total evenly per period (month or week); the last one absorbs rounding.
   * Lump sum = one due date at the end of the term.
   */
  static buildSchedule(
    total: number,
    plan: PaymentPlan,
    term: number,
    startDate: IsoDate,
    unit: TermUnit = "months",
  ): ScheduleItem[] {
    const count = plan === "lump" ? 1 : term;
    const each = roundMoney(total / count);
    const after = (periods: number) => (unit === "weeks" ? addDays(startDate, periods * 7) : addMonths(startDate, periods));
    return Array.from({ length: count }, (_, i) => ({
      dueDate: after(plan === "lump" ? term : i + 1),
      amountDue: i === count - 1 ? roundMoney(total - each * (count - 1)) : each,
      status: "pending" as ScheduleStatus,
      paidDate: null,
    }));
  }

  get id() { return this.props.id; }
  get borrowerId() { return this.props.borrowerId; }
  get borrowerName() { return this.props.borrowerName; }
  get borrowerEmail() { return this.props.borrowerEmail; }
  get principal() { return this.props.principal; }
  get interestType() { return this.props.interestType; }
  get interestValue() { return this.props.interestValue; }
  get interestAmount() { return this.props.interestAmount; }
  get totalAmount() { return this.props.totalAmount; }
  get amountPaid() { return this.props.amountPaid; }
  get balance() { return this.props.balance; }
  get term() { return this.props.term; }
  get termUnit() { return this.props.termUnit; }
  get paymentPlan() { return this.props.paymentPlan; }
  get startDate() { return this.props.startDate; }
  get dueDate() { return this.props.dueDate; }
  get storedStatus() { return this.props.status; }
  get schedule(): readonly ScheduleItem[] { return this.props.schedule; }
  get notes() { return this.props.notes; }
  get payoutDetails() { return this.props.payoutDetails; }
  get createdAt() { return this.props.createdAt; }

  get isRequest() { return this.props.status === "pending"; }
  get isActive() { return this.props.status === "ongoing" || this.props.status === "overdue"; }

  interestLabel(): string {
    return createInterestStrategy(this.props.interestType, this.props.interestValue).describe(this.props.termUnit);
  }

  /** e.g. "1 week", "3 months". */
  termLabel(): string {
    const unit = this.props.termUnit === "weeks" ? "week" : "month";
    return `${this.props.term} ${unit}${this.props.term === 1 ? "" : "s"}`;
  }

  planLabel(): string {
    if (this.props.paymentPlan === "lump") return `Isang bagsak after ${this.termLabel()}`;
    return `${this.termLabel()} na hulugan (${this.props.termUnit === "weeks" ? "weekly" : "monthly"})`;
  }

  /** Next unpaid installment, if any. */
  nextDue(): ScheduleItem | null {
    return this.props.schedule.find((s) => s.status !== "paid") ?? null;
  }

  /** Status as of `today`: overdue when an unpaid installment is past due. */
  statusOn(today: IsoDate): LoanStatus {
    const { status, balance } = this.props;
    if (status === "pending" || status === "rejected") return status;
    if (balance <= 0) return "paid";
    return this.props.schedule.some((s) => s.status !== "paid" && s.dueDate < today) ? "overdue" : "ongoing";
  }

  /** Returns a new Loan with the payment applied to the balance and schedule (oldest installment first). */
  applyPayment(amount: number, paidOn: IsoDate): Loan {
    if (!this.isActive) throw new Error("Payments can only be applied to active loans");
    if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
    const amountPaid = roundMoney(this.props.amountPaid + amount);
    const balance = roundMoney(Math.max(0, this.props.totalAmount - amountPaid));

    let covered = amountPaid;
    const schedule = this.props.schedule.map((item) => {
      if (covered >= item.amountDue - 0.001) {
        covered = roundMoney(covered - item.amountDue);
        return { ...item, status: "paid" as const, paidDate: item.paidDate ?? paidOn };
      }
      const status: ScheduleStatus = covered > 0 ? "partial" : "pending";
      covered = 0;
      return { ...item, status, paidDate: null };
    });

    return new Loan({ ...this.props, amountPaid, balance, schedule, status: balance <= 0 ? "paid" : "ongoing" });
  }

  approveRequest(): Loan {
    if (!this.isRequest) throw new Error("Only pending requests can be approved");
    return new Loan({ ...this.props, status: "ongoing" });
  }

  rejectRequest(): Loan {
    if (!this.isRequest) throw new Error("Only pending requests can be rejected");
    return new Loan({ ...this.props, status: "rejected" });
  }

  toProps(): LoanProps {
    return { ...this.props, schedule: this.props.schedule.map((s) => ({ ...s })) };
  }
}
