import { addDays, addMonths, dayOfMonth, daysBetween, weekdayOf, type IsoDate } from "./dates";
import { createInterestStrategy, type InterestType, type TermUnit } from "./InterestStrategy";
import { roundMoney } from "./money";

export type PaymentPlan = "installment" | "lump";
export type LoanStatus = "pending" | "ongoing" | "overdue" | "paid" | "rejected";
export type ScheduleStatus = "pending" | "partial" | "paid";

/**
 * The day(s) payments fall on, whatever the term unit (a weekly loan may be paid every 10th & 25th).
 * `null` = counted from the loan date, every week or month as the term is counted.
 * `weekday`: every week, 0 = Sunday … 6 = Saturday.
 * `dates`: every month on one or two dates, e.g. [10, 25]; 31 = end of the month (shorter months use their last day).
 */
export type PayDay = { weekday: number } | { dates: number[] } | null;

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
export function payDayName(payDay: PayDay, joiner = " & "): string | null {
  if (payDay === null) return null;
  return "weekday" in payDay ? WEEKDAYS[payDay.weekday] : payDay.dates.map(dateName).join(joiner);
}

/** How often payments come: every week, every month, or every half month (two dates a month). */
type PayEvery = "week" | "month" | "half-month";

function payEvery(payDay: PayDay, unit: TermUnit): PayEvery {
  if (payDay === null) return unit === "weeks" ? "week" : "month";
  if ("weekday" in payDay) return "week";
  return payDay.dates.length === 2 ? "half-month" : "month";
}

function onePeriodAfter(date: IsoDate, every: PayEvery): IsoDate {
  return every === "week" ? addDays(date, 7) : every === "half-month" ? addDays(date, 15) : addMonths(date, 1);
}

/** Dates are kept in order, so [25, 10] and [10, 25] are the same pay day. */
function normalizePayDay(payDay: PayDay): PayDay {
  return payDay !== null && "dates" in payDay ? { dates: [...payDay.dates].sort((a, b) => a - b) } : payDay;
}

export function samePayDay(a: PayDay, b: PayDay): boolean {
  return JSON.stringify(normalizePayDay(a)) === JSON.stringify(normalizePayDay(b));
}

function checkPayDay(payDay: PayDay): void {
  if (payDay === null) return;
  const fits =
    "weekday" in payDay
      ? Number.isInteger(payDay.weekday) && payDay.weekday >= 0 && payDay.weekday <= 6
      : (payDay.dates.length === 1 || payDay.dates.length === 2) &&
        payDay.dates.every((d) => Number.isInteger(d) && d >= 1 && d <= 31) &&
        new Set(payDay.dates).size === payDay.dates.length;
  if (!fits) throw new Error("Pick a valid pay day: a weekday, or one or two dates of the month.");
}

/**
 * Reads pay days saved by earlier builds too: a bare number (a weekday on weekly loans, a date on
 * monthly ones), two dates as a plain array, or "kinsenas" (15th & month end).
 */
function readPayDay(saved: unknown, unit: TermUnit): PayDay {
  if (saved === "kinsenas") return { dates: [15, 31] };
  if (typeof saved === "number") return unit === "weeks" ? { weekday: saved } : { dates: [saved] };
  if (Array.isArray(saved)) return { dates: saved };
  return (saved as PayDay) ?? null;
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

function payCalendar(payDay: NonNullable<PayDay>): PayCalendar {
  return "weekday" in payDay ? weeklyCalendar(payDay.weekday) : monthlyCalendar(payDay.dates);
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

/** Every pay date from `first` through `end` (at least `first`). */
function payDatesThrough(calendar: PayCalendar, first: IsoDate, end: IsoDate): IsoDate[] {
  const dates = [first];
  for (let next = calendar.after(first); next <= end; next = calendar.after(next)) dates.push(next);
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
      payDay: readPayDay(rest.payDay, rest.termUnit ?? "months"),
      disbursement: rest.disbursement ?? null,
      schedule: rest.schedule.map((s) => ({ ...s })),
    });
  }

  static create(input: NewLoanInput, id = ""): Loan {
    if (!(input.principal > 0)) throw new Error("Loan amount must be greater than zero");
    const term = Math.max(1, Math.floor(input.term || 1));
    const termUnit = input.termUnit ?? "months";
    const payDay = normalizePayDay(input.payDay ?? null);
    checkPayDay(payDay);
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
   * first payment is the pay day nearest one pay period after the loan date, then every pay day after
   * it. Paying at the term's own pace gives a fixed count (twice a month = twice as many); a different
   * pace (e.g. weekly on a 3-month loan) runs until the pay day nearest the end of the term.
   */
  private static dueDates(plan: PaymentPlan, term: number, startDate: IsoDate, unit: TermUnit, payDay: PayDay): IsoDate[] {
    const after = (periods: number) => (unit === "weeks" ? addDays(startDate, periods * 7) : addMonths(startDate, periods));
    if (payDay === null) {
      return plan === "lump" ? [after(term)] : Array.from({ length: term }, (_, i) => after(i + 1));
    }
    const calendar = payCalendar(payDay);
    const end = nearestPayDate(calendar, after(term));
    if (plan === "lump") return [end];
    const every = payEvery(payDay, unit);
    const first = nearestPayDate(calendar, onePeriodAfter(startDate, every));
    if (unit === "weeks" && every === "week") return payDatesFrom(calendar, first, term);
    if (unit === "months" && every !== "week") return payDatesFrom(calendar, first, every === "half-month" ? term * 2 : term);
    return payDatesThrough(calendar, first, end);
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
      const day = payDayName(payDay, " or ");
      return day ? `${plan}, on the nearest ${day}` : plan;
    }
    const day = payDayName(payDay);
    const often = { week: "weekly", month: "monthly", "half-month": "twice-a-month" }[payEvery(payDay, termUnit)];
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
   * Allowed even after payments: paid installments, the total and the balance stay the same.
   * - Same pace (e.g. Thursdays to Saturdays): each unpaid installment moves to the nearest new pay day.
   * - New pace (e.g. weekly to every 10th & 25th): the unpaid balance is spread evenly over the new pay
   *   days until the old last due date.
   * Nothing lands before `today`, so an overdue installment moves to the next pay day instead of staying overdue.
   */
  withPayDay(payDay: PayDay, today: IsoDate): Loan {
    if (!this.isActive) throw new Error("Only active loans can be rescheduled.");
    const { termUnit, startDate, schedule, paymentPlan, amountPaid } = this.props;
    const next = normalizePayDay(payDay);
    checkPayDay(next);

    const settled = schedule.filter((s) => s.status === "paid");
    const open = schedule.slice(settled.length);
    const floor = last(settled)?.dueDate ?? startDate;
    const every = payEvery(next, termUnit);
    const calendar = payCalendar(next ?? this.loanDatePayDay());
    let dates =
      paymentPlan === "lump" || every === payEvery(this.props.payDay, termUnit)
        ? payDatesFrom(calendar, nearestPayDate(calendar, open[0].dueDate), open.length)
        : payDatesThrough(
            calendar,
            nearestPayDate(calendar, onePeriodAfter(floor, every)),
            nearestPayDate(calendar, last(open)!.dueDate),
          );
    // Not before today (it would be overdue right away), and after the last paid installment.
    let first = dates[0] < today ? payDateFrom(calendar, today) : dates[0];
    if (first <= floor) first = calendar.after(floor);
    if (first !== dates[0]) dates = payDatesFrom(calendar, first, dates.length);

    const amounts =
      dates.length === open.length
        ? open.map((s) => s.amountDue)
        : splitEvenly(roundMoney(open.reduce((sum, s) => sum + s.amountDue, 0)), dates.length);
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
  private loanDatePayDay(): NonNullable<PayDay> {
    const { termUnit, startDate } = this.props;
    return termUnit === "weeks" ? { weekday: weekdayOf(startDate) } : { dates: [Number(startDate.slice(8))] };
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
