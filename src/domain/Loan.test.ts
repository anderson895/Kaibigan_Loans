import { describe, expect, it } from "vitest";
import { addMonths } from "./dates";
import { Loan, payDayName, type NewLoanInput } from "./Loan";

const base: NewLoanInput = {
  borrowerId: "b1",
  borrowerName: "Anna Reyes",
  borrowerEmail: "Anna@Gmail.com",
  principal: 5000,
  interestType: "fixed",
  interestValue: 1000,
  term: 5,
  paymentPlan: "installment",
  startDate: "2025-04-01",
};

describe("Loan interest", () => {
  it("fixed interest adds a flat amount", () => {
    const loan = Loan.create(base);
    expect(loan.interestAmount).toBe(1000);
    expect(loan.totalAmount).toBe(6000);
    expect(loan.balance).toBe(6000);
    expect(loan.borrowerEmail).toBe("anna@gmail.com");
  });

  it("percent interest is charged per month of the term", () => {
    const loan = Loan.create({ ...base, interestType: "percent", interestValue: 5, term: 3 });
    expect(loan.interestAmount).toBe(750);
    expect(loan.totalAmount).toBe(5750);
  });

  it("no interest keeps total equal to principal", () => {
    const loan = Loan.create({ ...base, interestType: "none", interestValue: 999 });
    expect(loan.totalAmount).toBe(5000);
  });

  it("rejects zero or negative principal", () => {
    expect(() => Loan.create({ ...base, principal: 0 })).toThrow();
  });
});

describe("Loan schedule", () => {
  it("splits installments evenly per month", () => {
    const loan = Loan.create(base);
    expect(loan.schedule).toHaveLength(5);
    expect(loan.schedule.map((s) => s.amountDue)).toEqual([1200, 1200, 1200, 1200, 1200]);
    expect(loan.schedule[0].dueDate).toBe("2025-05-01");
    expect(loan.dueDate).toBe("2025-09-01");
  });

  it("last installment absorbs rounding", () => {
    const loan = Loan.create({ ...base, principal: 1000, interestType: "none", term: 3 });
    const amounts = loan.schedule.map((s) => s.amountDue);
    expect(amounts).toEqual([333.33, 333.33, 333.34]);
  });

  it("lump sum has a single due date at the end of the term", () => {
    const loan = Loan.create({ ...base, paymentPlan: "lump", term: 2 });
    expect(loan.schedule).toHaveLength(1);
    expect(loan.schedule[0]).toMatchObject({ amountDue: 6000, dueDate: "2025-06-01" });
  });

  it("addMonths clamps to month end", () => {
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2025-11-15", 3)).toBe("2026-02-15");
  });
});

describe("Weekly terms", () => {
  it("1-week one-time payment is due 7 days later", () => {
    const loan = Loan.create({ ...base, principal: 1000, interestValue: 100, paymentPlan: "lump", term: 1, termUnit: "weeks", startDate: "2025-04-28" });
    expect(loan.schedule).toEqual([{ dueDate: "2025-05-05", amountDue: 1100, status: "pending", paidDate: null }]);
    expect(loan.planLabel()).toBe("One-time payment after 1 week");
  });

  it("weekly installments are 7 days apart", () => {
    const loan = Loan.create({ ...base, principal: 2000, interestType: "none", term: 4, termUnit: "weeks" });
    expect(loan.schedule.map((s) => s.dueDate)).toEqual(["2025-04-08", "2025-04-15", "2025-04-22", "2025-04-29"]);
    expect(loan.schedule.map((s) => s.amountDue)).toEqual([500, 500, 500, 500]);
  });

  it("percent interest is charged per week", () => {
    const loan = Loan.create({ ...base, interestType: "percent", interestValue: 5, term: 2, termUnit: "weeks" });
    expect(loan.interestAmount).toBe(500);
    expect(loan.interestLabel()).toBe("5% / week");
  });

  it("reads loans saved before weekly terms existed as months", () => {
    const { term: _t, termUnit: _u, ...legacy } = Loan.create(base).toProps();
    const loan = Loan.fromProps({ ...legacy, termMonths: 5 } as never);
    expect(loan.term).toBe(5);
    expect(loan.termUnit).toBe("months");
    expect(loan.toProps()).not.toHaveProperty("termMonths");
  });
});

describe("Pay day", () => {
  // 2026-10-14 is a Wednesday.
  const weekly: NewLoanInput = { ...base, principal: 2000, interestType: "none", term: 4, termUnit: "weeks", startDate: "2026-10-14" };

  it("weekly installments fall on the chosen weekday, starting with the nearest one", () => {
    const loan = Loan.create({ ...weekly, payDay: 5 });
    expect(loan.schedule.map((s) => s.dueDate)).toEqual(["2026-10-23", "2026-10-30", "2026-11-06", "2026-11-13"]);
    expect(loan.planLabel()).toBe("4 weeks, weekly installments every Friday");
  });

  it("monthly installments fall on the chosen date", () => {
    const loan = Loan.create({ ...base, principal: 3000, interestType: "none", term: 3, startDate: "2026-10-20", payDay: 15 });
    expect(loan.schedule.map((s) => s.dueDate)).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
    expect(loan.planLabel()).toBe("3 months, monthly installments every 15th");
  });

  it("dates past a month's end use its last day, then go back to the chosen date", () => {
    const monthEnd = Loan.create({ ...base, term: 4, startDate: "2026-12-05", payDay: 31 });
    expect(monthEnd.schedule.map((s) => s.dueDate)).toEqual(["2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
    const thirtieth = Loan.create({ ...base, term: 3, startDate: "2027-01-10", payDay: 30 });
    expect(thirtieth.schedule.map((s) => s.dueDate)).toEqual(["2027-01-30", "2027-02-28", "2027-03-30"]);
  });

  it("kinsenas: twice a month, on the 15th and at month end", () => {
    const loan = Loan.create({ ...base, principal: 4000, interestType: "none", term: 2, startDate: "2026-10-14", payDay: [15, 31] });
    expect(loan.schedule.map((s) => [s.dueDate, s.amountDue])).toEqual([
      ["2026-10-31", 1000],
      ["2026-11-15", 1000],
      ["2026-11-30", 1000],
      ["2026-12-15", 1000],
    ]);
    expect(loan.planLabel()).toBe("2 months, twice-a-month installments every 15th & month end");
  });

  it("twice a month on any two dates, e.g. every 10th & 25th", () => {
    const loan = Loan.create({ ...base, principal: 4000, interestType: "none", term: 2, startDate: "2026-10-14", payDay: [25, 10] });
    expect(loan.payDay).toEqual([10, 25]);
    expect(loan.schedule.map((s) => s.dueDate)).toEqual(["2026-10-25", "2026-11-10", "2026-11-25", "2026-12-10"]);
    expect(loan.planLabel()).toBe("2 months, twice-a-month installments every 10th & 25th");
  });

  it("twice a month uses the last day of short months", () => {
    const loan = Loan.create({ ...base, term: 2, startDate: "2027-01-20", payDay: [15, 30] });
    expect(loan.schedule.map((s) => s.dueDate)).toEqual(["2027-01-30", "2027-02-15", "2027-02-28", "2027-03-15"]);
  });

  it("a one-time payment moves to the nearest pay day", () => {
    const loan = Loan.create({ ...weekly, paymentPlan: "lump", term: 1, payDay: 5 });
    expect(loan.schedule.map((s) => s.dueDate)).toEqual(["2026-10-23"]);
    expect(loan.planLabel()).toBe("One-time payment after 1 week, on the nearest Friday");
  });

  it("names dates as ordinals", () => {
    expect([1, 2, 3, 11, 12, 13, 21, 22, 23, 31].map((d) => payDayName(d, "months"))).toEqual([
      "1st", "2nd", "3rd", "11th", "12th", "13th", "21st", "22nd", "23rd", "month end",
    ]);
  });

  it("rejects a pay day that does not fit the term", () => {
    expect(() => Loan.create({ ...weekly, payDay: [15, 31] })).toThrow(/pay day/);
    expect(() => Loan.create({ ...weekly, payDay: 15 })).toThrow(/pay day/);
    expect(() => Loan.create({ ...base, payDay: 0 })).toThrow(/pay day/);
    expect(() => Loan.create({ ...base, payDay: [10, 10] })).toThrow(/pay day/);
  });

  it("loans saved before pay days existed follow the loan date", () => {
    const { payDay: _p, ...legacy } = Loan.create(base).toProps();
    expect(Loan.fromProps(legacy as never).payDay).toBeNull();
  });

  it("reads the early 'kinsenas' value as the 15th & month end", () => {
    const props = Loan.create({ ...base, payDay: [15, 31] }).toProps();
    expect(Loan.fromProps({ ...props, payDay: "kinsenas" } as never).payDay).toEqual([15, 31]);
  });
});

describe("Changing the pay day after payments", () => {
  // ₱2,000 + ₱400 over 4 weeks from Thursday, Oct 1: ₱600 every Thursday (Oct 8, 15, 22, 29).
  const weekly = Loan.create({ ...base, principal: 2000, interestValue: 400, term: 4, termUnit: "weeks", startDate: "2026-10-01" });

  it("moves the unpaid installments and keeps the paid ones", () => {
    const moved = weekly.applyPayment(600, "2026-10-10").withPayDay(6, "2026-10-10");
    expect(moved.schedule.map((s) => [s.dueDate, s.amountDue, s.status, s.paidDate])).toEqual([
      ["2026-10-08", 600, "paid", "2026-10-10"],
      ["2026-10-17", 600, "pending", null],
      ["2026-10-24", 600, "pending", null],
      ["2026-10-31", 600, "pending", null],
    ]);
    expect([moved.totalAmount, moved.balance, moved.dueDate]).toEqual([2400, 1800, "2026-10-31"]);
    expect(moved.planLabel()).toBe("4 weeks, weekly installments every Saturday");
  });

  it("keeps a partly paid installment partly paid", () => {
    const moved = weekly.applyPayment(900, "2026-10-10").withPayDay(6, "2026-10-10");
    expect(moved.schedule[1]).toMatchObject({ dueDate: "2026-10-17", status: "partial" });
    expect(moved.remainingFor(1)).toBe(300);
  });

  it("moves an overdue installment to the next pay day instead of leaving it overdue", () => {
    // On Friday, Oct 16 the Oct 15 installment is overdue. Mondays: the nearest is Oct 12, already past.
    const late = weekly.applyPayment(600, "2026-10-10");
    expect(late.statusOn("2026-10-16")).toBe("overdue");
    const moved = late.withPayDay(1, "2026-10-16");
    expect(moved.schedule.slice(1).map((s) => s.dueDate)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(moved.statusOn("2026-10-16")).toBe("ongoing");
  });

  it("keeping the same weekday moves overdue installments to the coming ones", () => {
    const moved = weekly.applyPayment(600, "2026-10-10").withPayDay(4, "2026-10-16");
    expect(moved.schedule.slice(1).map((s) => s.dueDate)).toEqual(["2026-10-22", "2026-10-29", "2026-11-05"]);
  });

  it("splits the unpaid months in two when switching to twice a month, and merges them back", () => {
    // ₱3,000 over 3 months from Oct 1: ₱1,000 on Nov 1, Dec 1 and Jan 1.
    const monthly = Loan.create({ ...base, principal: 3000, interestType: "none", term: 3, startDate: "2026-10-01" });
    const twice = monthly.applyPayment(1000, "2026-11-01").withPayDay([15, 31], "2026-11-01");
    expect(twice.schedule.map((s) => [s.dueDate, s.amountDue])).toEqual([
      ["2026-11-01", 1000],
      ["2026-11-15", 500],
      ["2026-11-30", 500],
      ["2026-12-15", 500],
      ["2026-12-31", 500],
    ]);
    const once = twice.withPayDay(30, "2026-11-01");
    expect(once.schedule.map((s) => [s.dueDate, s.amountDue])).toEqual([
      ["2026-11-01", 1000],
      ["2026-11-30", 1000],
      ["2026-12-30", 1000],
    ]);
    expect(once.balance).toBe(2000);
  });

  it("can go back to counting from the loan date", () => {
    const back = weekly.applyPayment(600, "2026-10-10").withPayDay(6, "2026-10-10").withPayDay(null, "2026-10-10");
    expect(back.schedule.map((s) => s.dueDate)).toEqual(["2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"]);
    expect(back.payDay).toBeNull();
  });

  it("only works on active loans with a fitting pay day", () => {
    expect(() => weekly.applyPayment(2400, "2026-10-10").withPayDay(6, "2026-10-10")).toThrow(/active/);
    expect(() => Loan.create({ ...base, asRequest: true }).withPayDay(15, "2026-10-10")).toThrow(/active/);
    expect(() => weekly.withPayDay(15, "2026-10-10")).toThrow(/pay day/);
  });
});

describe("Loan payments", () => {
  it("deducts approved payment from balance and marks installments", () => {
    const loan = Loan.create(base).applyPayment(1200, "2025-04-30");
    expect(loan.balance).toBe(4800);
    expect(loan.amountPaid).toBe(1200);
    expect(loan.schedule[0]).toMatchObject({ status: "paid", paidDate: "2025-04-30" });
    expect(loan.schedule[1].status).toBe("pending");
  });

  it("partial payments carry over to the next installment", () => {
    const loan = Loan.create(base).applyPayment(1000, "2025-04-30").applyPayment(1000, "2025-05-30");
    expect(loan.balance).toBe(4000);
    expect(loan.schedule[0]).toMatchObject({ status: "paid", paidDate: "2025-05-30" });
    expect(loan.schedule[1].status).toBe("partial");
  });

  it("becomes paid when balance reaches zero, and overpayment does not go negative", () => {
    const loan = Loan.create(base).applyPayment(7000, "2025-05-01");
    expect(loan.balance).toBe(0);
    expect(loan.storedStatus).toBe("paid");
    expect(loan.statusOn("2030-01-01")).toBe("paid");
    expect(() => loan.applyPayment(1, "2025-05-02")).toThrow();
  });

  it("imports existing records with an amount already paid", () => {
    const loan = Loan.create({ ...base, amountPaid: 3000 });
    expect(loan.balance).toBe(3000);
    expect(loan.schedule.filter((s) => s.status === "paid")).toHaveLength(2);
  });
});

describe("Editing loan terms", () => {
  const disbursement = { receiptUrl: "https://x/r.png", receiptPublicId: "r", referenceNo: "123456", sentOn: "2026-10-01", uploadedAt: 1 };
  const original = Loan.create(
    { ...base, principal: 2000, interestValue: 400, term: 1, termUnit: "months", startDate: "2026-10-01" },
    "loan-1",
  ).withDisbursement(disbursement);

  it("switches a 1-month loan to 4 weekly installments of ₱600", () => {
    const edited = original.withTerms({
      principal: 2000,
      interestType: "fixed",
      interestValue: 400,
      paymentPlan: "installment",
      term: 4,
      termUnit: "weeks",
      startDate: "2026-10-01",
    });
    expect(edited.totalAmount).toBe(2400);
    expect(edited.balance).toBe(2400);
    expect(edited.schedule.map((s) => [s.dueDate, s.amountDue])).toEqual([
      ["2026-10-08", 600],
      ["2026-10-15", 600],
      ["2026-10-22", 600],
      ["2026-10-29", 600],
    ]);
  });

  it("keeps id, borrower, creation date and proof of send", () => {
    const edited = original.withTerms({ ...base, principal: 3000, term: 2 });
    expect(edited.id).toBe("loan-1");
    expect(edited.borrowerEmail).toBe(original.borrowerEmail);
    expect(edited.createdAt).toBe(original.createdAt);
    expect(edited.disbursement).toEqual(disbursement);
    expect(edited.storedStatus).toBe("ongoing");
  });

  it("is blocked once a payment was approved", () => {
    const paid = original.applyPayment(600, "2026-10-08");
    expect(original.canEditTerms).toBe(true);
    expect(paid.canEditTerms).toBe(false);
    expect(() => paid.withTerms({ ...base })).toThrow(/approved payments/);
  });

  it("is blocked for requests and paid loans", () => {
    expect(() => Loan.create({ ...base, asRequest: true }).withTerms({ ...base })).toThrow();
    expect(Loan.create({ ...base, asRequest: true }).canEditTerms).toBe(false);
  });
});

describe("Manual payments and corrections", () => {
  // ₱2,000 + ₱400 fixed, 4 weekly installments of ₱600.
  const weekly = Loan.create({
    ...base,
    principal: 2000,
    interestValue: 400,
    term: 4,
    termUnit: "weeks",
    startDate: "2026-10-01",
  });

  it("knows how much is left on each installment", () => {
    const paid = weekly.applyPayment(800, "2026-10-08");
    expect([0, 1, 2, 3].map((i) => paid.remainingFor(i))).toEqual([0, 400, 600, 600]);
    expect(paid.remainingFor(9)).toBe(0);
  });

  it("removing a payment restores the balance and the schedule", () => {
    const paid = weekly.applyPayment(600, "2026-10-08").applyPayment(600, "2026-10-15");
    const undone = paid.removePayment(600);
    expect(undone.balance).toBe(1800);
    expect(undone.amountPaid).toBe(600);
    expect(undone.schedule[0]).toMatchObject({ status: "paid", paidDate: "2026-10-08" });
    expect(undone.schedule[1]).toMatchObject({ status: "pending", paidDate: null });
  });

  it("removing a payment from a fully paid loan makes it active again", () => {
    const done = weekly.applyPayment(2400, "2026-10-29");
    expect(done.storedStatus).toBe("paid");
    const undone = done.removePayment(600);
    expect(undone.storedStatus).toBe("ongoing");
    expect(undone.balance).toBe(600);
    expect(undone.schedule[3]).toMatchObject({ status: "pending", paidDate: null });
    // Back to unpaid means the terms can be edited again once every payment is removed.
    expect(undone.removePayment(1800).canEditTerms).toBe(true);
  });

  it("cannot remove more than was paid", () => {
    expect(() => weekly.applyPayment(600, "2026-10-08").removePayment(700)).toThrow();
    expect(() => weekly.removePayment(1)).toThrow();
  });
});

describe("Loan status", () => {
  it("is overdue when an unpaid installment is past due", () => {
    const loan = Loan.create(base);
    expect(loan.statusOn("2025-05-01")).toBe("ongoing");
    expect(loan.statusOn("2025-05-02")).toBe("overdue");
    expect(loan.applyPayment(1200, "2025-05-01").statusOn("2025-05-02")).toBe("ongoing");
  });

  it("requests stay pending until approved", () => {
    const request = Loan.create({ ...base, asRequest: true });
    expect(request.statusOn("2030-01-01")).toBe("pending");
    expect(() => request.applyPayment(100, "2025-04-02")).toThrow();
    expect(request.approveRequest().statusOn("2025-04-02")).toBe("ongoing");
    expect(request.rejectRequest().storedStatus).toBe("rejected");
  });
});
