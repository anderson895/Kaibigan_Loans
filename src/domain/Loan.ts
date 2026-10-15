import { addDays, addMonths, dayOfMonth, daysBetween, weekdayOf, type IsoDate } from "./dates";
import { createInterestStrategy, type InterestType, type TermUnit } from "./InterestStrategy";
import { roundMoney } from "./money";

export type PaymentPlan = "installment" | "lump";
export type LoanStatus = "pending" | "ongoing" | "overdue" | "paid" | "rejected";
export type ScheduleStatus = "pending" | "partial" | "paid";

/**
 * The day(s) payments fall on. `null` = counted from the loan date (every 7 days / same date every month).
 * Weekly terms: 0–6 = Sunday–Saturday. Monthly terms: a date 1–31, or two dates for twice a month,
 * e.g. [10, 25] or [15, 31]. 31 = end of the month; shorter months use their last day.
 */
export type PayDay = number | [number, number] | null;

export interface ScheduleItem {
  dueDate: IsoDate;
  amountDue: number;
  status: ScheduleStatus;
  paidDate: IsoDate | null;
}

/** Proof that the lender sent the money to the borrower (GCash/bank screenshot). */
export interface Disbursement {
  receiptUrl: string;
  receiptPublicId: string;
  referenceNo: string;
  sentOn: IsoDate;
  uploadedAt: number;
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
  payDay: PayDay;
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
  disbursement: Disbursement | null;
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
  payDay?: PayDay;
  startDate: IsoDate;
  notes?: string;
  payoutDetails?: string;
  /** Loans created by a borrower start as a pending request. */
  asRequest?: boolean;
  /** Amount already paid, used when importing existing records. */
  amountPaid?: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

const dateName = (day: number) => (day >= 31 ? "month end" : ordinal(day));

/** "Friday", "15th", "month end", "10th & 25th"; null when payments follow the loan date. */
export function payDayName(payDay: PayDay, unit: TermUnit, joiner = " & "): string | null {
  if (payDay === null) return null;
  if (Array.isArray(payDay)) return payDay.map(dateName).join(joiner);
  return unit === "weeks" ? WEEKDAYS[payDay] : dateName(payDay);
}

/** Two pay dates a month (e.g. 10th & 25th), which doubles the number of installments. */
export function isTwiceAMonth(payDay: PayDay): payDay is [number, number] {
  return Array.isArray(payDay);
}

/** Twice-a-month dates are kept in order, so [25, 10] and [10, 25] are the same pay day. */
function normalizePayDay(payDay: PayDay): PayDay {
  return isTwiceAMonth(payDay) ? [Math.min(...payDay), Math.max(...payDay)] : payDay;
}

export function samePayDay(a: PayDay, b: PayDay): boolean {
  return String(normalizePayDay(a)) === String(normalizePayDay(b));
}

function checkPayDay(payDay: PayDay, unit: TermUnit): void {
  if (payDay === null) return;
  const isDate = (day: number) => Number.isInteger(day) && day >= 1 && day <= 31;
  const fits =
    unit === "weeks"
      ? typeof payDay === "number" && Number.isInteger(payDay) && payDay >= 0 && payDay <= 6
      : isTwiceAMonth(payDay)
        ? payDay.length === 2 && payDay.every(isDate) && payDay[0] !== payDay[1]
        : isDate(payDay);
  if (!fits) throw new Error("Pick a pay day that fits the term: a weekday for weeks, one or two dates for months.");
}

/** The dates a pay day falls on, as steps backward and forward from any date. */
interface PayCalendar {
  /** Latest pay date on or before `date`. */
  onOrBefore(date: IsoDate): IsoDate;
  /** First pay date after `date`. */
  after(date: IsoDate): IsoDate;
}

function weeklyCalendar(weekday: number): PayCalendar {
  return {
    onOrBefore: (date) => addDays(date, -((weekdayOf(date) - weekday + 7) % 7)),
    after: (date) => addDays(date, (weekday - weekdayOf(date) + 7) % 7 || 7),
  };
}

const last = <T,>(items: T[]): T | undefined => items[items.length - 1];

function monthlyCalendar(days: number[]): PayCalendar {
  const sorted = [...days].sort((a, b) => a - b);
  // Pay dates in the month of `date`, without repeats (the 30th and 31st are both Feb 28).
  const datesIn = (date: IsoDate, monthOffset = 0) => [...new Set(sorted.map((day) => dayOfMonth(date, day, monthOffset)))];
  return {
    onOrBefore: (date) => last(datesIn(date).filter((d) => d <= date)) ?? last(datesIn(date, -1))!,
    after: (date) => datesIn(date).find((d) => d > date) ?? datesIn(date, 1)[0],
  };
}

function payCalendar(payDay: number | [number, number], unit: TermUnit): PayCalendar {
  if (isTwiceAMonth(payDay)) return monthlyCalendar(payDay);
  return unit === "weeks" ? weeklyCalendar(payDay) : monthlyCalendar([payDay]);
}

/** The pay date closest to `date`; a tie goes to the later one, so the borrower gets the extra days. */
function nearestPayDate(calendar: PayCalendar, date: IsoDate): IsoDate {
  const before = calendar.onOrBefore(date);
  if (before === date) return date;
  const next = calendar.after(date);
  return daysBetween(before, date) < daysBetween(date, next) ? before : next;
}

/** The first pay date on or after `date`. */
function payDateFrom(calendar: PayCalendar, date: IsoDate): IsoDate {
  return calendar.onOrBefore(date) === date ? date : calendar.after(date);
}

/** `count` pay dates in a row, starting with `first`. */
function payDatesFrom(calendar: PayCalendar, first: IsoDate, count: number): IsoDate[] {
  const dates = [first];
  while (dates.length < count) dates.push(calendar.after(dates[dates.length - 1]));
  return dates;
}

/** Splits `total` into `count` even parts; the last one absorbs rounding. */
function splitEvenly(total: number, count: number): number[] {
  const each = roundMoney(total / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? roundMoney(total - each * (count - 1)) : each));
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
      // An early build saved "15th & month end" as "kinsenas".
      payDay: (rest.payDay as unknown) === "kinsenas" ? [15, 31] : (rest.payDay ?? null),
      disbursement: rest.disbursement ?? null,
      schedule: rest.schedule.map((s) => ({ ...s })),
    });
  }

  static create(input: NewLoanInput, id = ""): Loan {
    if (!(input.principal > 0)) throw new Error("Loan amount must be greater than zero");
    const term = Math.max(1, Math.floor(input.term || 1));
    const termUnit = input.termUnit ?? "months";
    const payDay = normalizePayDay(input.payDay ?? null);
    checkPayDay(payDay, termUnit);
    const interestAmount = createInterestStrategy(input.interestType, input.interestValue || 0).compute(
      input.principal,
      term,
    );
    const totalAmount = roundMoney(input.principal + interestAmount);
    const schedule = Loan.buildSchedule(totalAmount, input.paymentPlan, term, input.startDate, termUnit, payDay);

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
      payDay,
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
      disbursement: null,
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
    payDay: PayDay = null,
  ): ScheduleItem[] {
    const dueDates = Loan.dueDates(plan, term, startDate, unit, payDay);
    const amounts = splitEvenly(total, dueDates.length);
    return dueDates.map((dueDate, i) => ({ dueDate, amountDue: amounts[i], status: "pending" as ScheduleStatus, paidDate: null }));
  }

  /**
   * Without a pay day, payments are due every week/month counted from the loan date. With one, the
   * first payment moves to the pay day nearest that date, then falls on every pay day after it
   * (twice a month = twice as many installments).
   */
  private static dueDates(plan: PaymentPlan, term: number, startDate: IsoDate, unit: TermUnit, payDay: PayDay): IsoDate[] {
    const after = (periods: number) => (unit === "weeks" ? addDays(startDate, periods * 7) : addMonths(startDate, periods));
    if (payDay === null) {
      return plan === "lump" ? [after(term)] : Array.from({ length: term }, (_, i) => after(i + 1));
    }
    const calendar = payCalendar(payDay, unit);
    if (plan === "lump") return [nearestPayDate(calendar, after(term))];
    const twice = isTwiceAMonth(payDay);
    return payDatesFrom(calendar, nearestPayDate(calendar, twice ? addDays(startDate, 15) : after(1)), twice ? term * 2 : term);
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
  get payDay() { return this.props.payDay; }
  get startDate() { return this.props.startDate; }
  get dueDate() { return this.props.dueDate; }
  get storedStatus() { return this.props.status; }
  get schedule(): readonly ScheduleItem[] { return this.props.schedule; }
  get notes() { return this.props.notes; }
  get payoutDetails() { return this.props.payoutDetails; }
  get createdAt() { return this.props.createdAt; }
  get disbursement() { return this.props.disbursement; }

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

  /** e.g. "4 weeks, weekly installments every Friday", "One-time payment after 1 month, on the nearest 10th or 25th". */
  planLabel(): string {
    const { paymentPlan, termUnit, payDay } = this.props;
    if (paymentPlan === "lump") {
      const plan = `One-time payment after ${this.termLabel()}`;
      const day = payDayName(payDay, termUnit, " or ");
      return day ? `${plan}, on the nearest ${day}` : plan;
    }
    const day = payDayName(payDay, termUnit);
    const often = isTwiceAMonth(payDay) ? "twice-a-month" : termUnit === "weeks" ? "weekly" : "monthly";
    return `${this.termLabel()}, ${often} installments${day ? ` every ${day}` : ""}`;
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

  /** How much is still owed on installment `index` (0 when it is fully paid). */
  remainingFor(index: number): number {
    const item = this.props.schedule[index];
    if (!item) return 0;
    const dueBefore = this.props.schedule.slice(0, index).reduce((sum, s) => sum + s.amountDue, 0);
    const coveredHere = Math.min(item.amountDue, Math.max(0, this.props.amountPaid - dueBefore));
    return roundMoney(item.amountDue - coveredHere);
  }

  /** Returns a new Loan with the payment applied to the balance and schedule (oldest installment first). */
  applyPayment(amount: number, paidOn: IsoDate): Loan {
    if (!this.isActive) throw new Error("Payments can only be applied to active loans");
    if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
    return this.withAmountPaid(roundMoney(this.props.amountPaid + amount), paidOn);
  }

  /**
   * Undoes a payment that was applied earlier (e.g. the admin recorded a wrong amount):
   * the balance goes back up and installments it had covered become unpaid/partial again.
   */
  removePayment(amount: number): Loan {
    if (this.props.status === "pending" || this.props.status === "rejected") {
      throw new Error("This loan has no payments to remove.");
    }
    if (!(amount > 0)) throw new Error("Payment amount must be greater than zero");
    if (amount > this.props.amountPaid + 0.001) throw new Error("Cannot remove more than what was paid on this loan.");
    return this.withAmountPaid(roundMoney(Math.max(0, this.props.amountPaid - amount)), null);
  }

  /** Recomputes balance, status and the schedule for a new total paid amount. */
  private withAmountPaid(amountPaid: number, paidOn: IsoDate | null): Loan {
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

  /** Editing is only safe before any payment was applied — otherwise the schedule history would be lost. */
  get canEditTerms(): boolean {
    return this.isActive && this.props.amountPaid === 0;
  }

  /**
   * Returns the loan with new terms: interest, total, balance and schedule are recalculated.
   * Keeps the borrower, payout details, proof of send and creation date.
   */
  withTerms(terms: Omit<NewLoanInput, "borrowerId" | "borrowerName" | "borrowerEmail" | "asRequest" | "amountPaid">): Loan {
    if (!this.isActive) throw new Error("Only active loans can be edited.");
    if (this.props.amountPaid > 0) throw new Error("This loan already has approved payments, so its terms can no longer be edited.");
    const rebuilt = Loan.create(
      {
        ...terms,
        borrowerId: this.props.borrowerId,
        borrowerName: this.props.borrowerName,
        borrowerEmail: this.props.borrowerEmail,
        payoutDetails: terms.payoutDetails ?? this.props.payoutDetails,
      },
      this.props.id,
    );
    return new Loan({ ...rebuilt.toProps(), createdAt: this.props.createdAt, disbursement: this.props.disbursement });
  }

  /**
   * Moves the unpaid installments to a new pay day, e.g. when the borrower now gets paid on other days.
   * Allowed even after payments: paid installments, the total and the balance stay the same. Switching
   * between once and twice a month doubles or halves the unpaid installments. Nothing lands before
   * `today`, so an overdue installment moves to the next pay day instead of staying overdue.
   */
  withPayDay(payDay: PayDay, today: IsoDate): Loan {
    if (!this.isActive) throw new Error("Only active loans can be rescheduled.");
    const { termUnit, startDate, schedule, paymentPlan, amountPaid } = this.props;
    const next = normalizePayDay(payDay);
    checkPayDay(next, termUnit);

    const settled = schedule.filter((s) => s.status === "paid");
    const open = schedule.slice(settled.length);
    const installments = paymentPlan === "installment";
    const split = installments && !isTwiceAMonth(this.props.payDay) && isTwiceAMonth(next);
    const merged = installments && isTwiceAMonth(this.props.payDay) && !isTwiceAMonth(next);
    const count = split ? open.length * 2 : merged ? Math.ceil(open.length / 2) : open.length;
    const amounts =
      count === open.length
        ? open.map((s) => s.amountDue)
        : splitEvenly(roundMoney(open.reduce((sum, s) => sum + s.amountDue, 0)), count);

    // Start near the next unpaid due date: half a month earlier when installments are split in two,
    // at the second one when two are merged, so the money falls due about when it did before.
    const anchor = split ? addDays(open[0].dueDate, -15) : merged ? (open[1] ?? open[0]).dueDate : open[0].dueDate;
    const calendar = payCalendar(next ?? this.loanDatePayDay(), termUnit);
    const nearest = nearestPayDate(calendar, anchor);
    const notPast = nearest >= today ? nearest : payDateFrom(calendar, today);
    const floor = last(settled)?.dueDate ?? startDate;
    const dates = payDatesFrom(calendar, notPast > floor ? notPast : calendar.after(floor), count);

    const rescheduled: ScheduleItem[] = [
      ...settled,
      ...dates.map((dueDate, i) => ({ dueDate, amountDue: amounts[i], status: "pending" as ScheduleStatus, paidDate: null })),
    ];
    return new Loan({ ...this.props, payDay: next, schedule: rescheduled, dueDate: dates[dates.length - 1] }).withAmountPaid(
      amountPaid,
      null,
    );
  }

  /** The day payments counted from the loan date fall on: its weekday, or its date in the month. */
  private loanDatePayDay(): number {
    const { termUnit, startDate } = this.props;
    return termUnit === "weeks" ? weekdayOf(startDate) : Number(startDate.slice(8));
  }

  withDisbursement(disbursement: Disbursement): Loan {
    if (this.props.status === "pending" || this.props.status === "rejected") {
      throw new Error("Approve the loan request before uploading proof of send.");
    }
    if (!disbursement.receiptUrl) throw new Error("Receipt is required");
    return new Loan({ ...this.props, disbursement: { ...disbursement } });
  }

  toProps(): LoanProps {
    return { ...this.props, schedule: this.props.schedule.map((s) => ({ ...s })) };
  }
}
