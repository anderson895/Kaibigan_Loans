import { formatPeso, roundMoney } from "./money";

export type InterestType = "fixed" | "percent" | "none";
export type TermUnit = "months" | "weeks";

export interface InterestStrategy {
  readonly type: InterestType;
  /** `periods` = number of months or weeks in the term. */
  compute(principal: number, periods: number): number;
  describe(unit?: TermUnit): string;
}

/** A flat amount agreed per loan, e.g. ₱1,000 on a ₱5,000 loan. */
export class FixedInterest implements InterestStrategy {
  readonly type = "fixed" as const;
  constructor(private readonly amount: number) {
    if (amount < 0) throw new Error("Interest amount cannot be negative");
  }
  compute(): number {
    return roundMoney(this.amount);
  }
  describe(): string {
    return `${formatPeso(this.amount)} fixed`;
  }
}

/** A percentage of the principal charged every period (month or week) of the term. */
export class PercentPerPeriodInterest implements InterestStrategy {
  readonly type = "percent" as const;
  constructor(private readonly ratePercent: number) {
    if (ratePercent < 0) throw new Error("Interest rate cannot be negative");
  }
  compute(principal: number, periods: number): number {
    return roundMoney(principal * (this.ratePercent / 100) * Math.max(1, periods));
  }
  describe(unit: TermUnit = "months"): string {
    return `${this.ratePercent}% / ${unit === "weeks" ? "week" : "month"}`;
  }
}

export class NoInterest implements InterestStrategy {
  readonly type = "none" as const;
  compute(): number {
    return 0;
  }
  describe(): string {
    return "No interest";
  }
}

export function createInterestStrategy(type: InterestType, value: number): InterestStrategy {
  switch (type) {
    case "fixed":
      return new FixedInterest(value);
    case "percent":
      return new PercentPerPeriodInterest(value);
    case "none":
      return new NoInterest();
  }
}
