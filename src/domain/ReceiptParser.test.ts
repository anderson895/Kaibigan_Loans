import { describe, expect, it } from "vitest";
import { Payment } from "./Payment";
import { ReceiptParser } from "./ReceiptParser";

const parser = new ReceiptParser();

describe("ReceiptParser", () => {
  it("reads a GCash send-money receipt", () => {
    const text = [
      "GCash",
      "Sent via GCash",
      "Juan Dela Cruz",
      "+63 917 123 4567",
      "Amount 1,200.00",
      "Total Amount Sent ₱1,200.00",
      "Ref No. 5012 345 678901",
      "Apr 30, 2025 3:15 PM",
    ].join("\n");
    expect(parser.parse(text)).toMatchObject({ amount: 1200, referenceNo: "5012 345 678901" });
  });

  it("reads amount on the line after its label", () => {
    const text = "Transfer Successful\nAmount\nPHP 5,000.00\nReference ID: ABC1234567";
    expect(parser.parse(text)).toMatchObject({ amount: 5000, referenceNo: "ABC1234567" });
  });

  it("falls back to the largest value and ignores reference digits", () => {
    const text = "Paid to Juan\n₱ 950.50\nfee 0.00\nTransaction No. 998877665544";
    expect(parser.parse(text)).toMatchObject({ amount: 950.5, referenceNo: "998877665544" });
  });

  it("reads a reference number on the line after its label (Maya / InstaPay)", () => {
    const text = ["Transfer successful", "Amount", "2,000.00", "Reference ID", "7A3F 9921 0045", "Date Oct 1, 2026"].join("\n");
    expect(parser.parse(text)).toMatchObject({ amount: 2000, referenceNo: "7A3F 9921 0045" });
  });

  it("recognizes other reference labels", () => {
    expect(parser.parse("Trace No. 123456789").referenceNo).toBe("123456789");
    expect(parser.parse("Confirmation Number: 88812345").referenceNo).toBe("88812345");
    expect(parser.parse("InstaPay Ref No. 20261001ABC123").referenceNo).toBe("20261001ABC123");
  });

  it("finds no reference on a pre-transfer confirmation screen", () => {
    const text = ["You're about to transfer", "Amount 2,000.00", "Fee 10.00", "Total P 2,010.00", "Pay PHP 2,010.00"].join("\n");
    expect(parser.parse(text)).toMatchObject({ amount: 2000, referenceNo: null });
  });

  it("returns nulls when nothing is readable", () => {
    expect(parser.parse("blurry image")).toMatchObject({ amount: null, referenceNo: null });
  });
});

describe("Payment", () => {
  const input = {
    loanId: "l1",
    borrowerId: "b1",
    borrowerName: "Anna",
    borrowerEmail: "anna@gmail.com",
    amount: 1200,
    referenceNo: "",
    paidOn: "2025-04-30",
    receiptUrl: "https://res.cloudinary.com/x.png",
    receiptPublicId: "x",
    ocr: { amount: 1000, referenceNo: null, text: "" },
  };

  it("flags OCR mismatch and lets admin approve with corrected amount", () => {
    const payment = Payment.submit(input);
    expect(payment.hasOcrMismatch).toBe(true);
    const approved = payment.approve(1000);
    expect(approved).toMatchObject({ status: "approved", amount: 1000 });
    expect(() => approved.reject("x")).toThrow();
  });

  it("rejects with a reason", () => {
    expect(Payment.submit(input).reject("  Malabo ang resibo ").rejectReason).toBe("Malabo ang resibo");
  });
});
