import { describe, expect, it } from "vitest";
import { addMonths } from "./dates";
import { Loan, type NewLoanInput } from "./Loan";

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
    expect(loan.planLabel()).toBe("Isang bagsak after 1 week");
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
