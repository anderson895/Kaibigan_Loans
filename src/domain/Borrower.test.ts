import { describe, expect, it } from "vitest";
import { Borrower } from "./Borrower";

describe("Borrower", () => {
  it("can be added by name only (no website account)", () => {
    const b = Borrower.create({ name: " Lola Nena ", email: "", phone: "0917 000 0000", payoutDetails: "" });
    expect(b.name).toBe("Lola Nena");
    expect(b.hasEmail).toBe(false);
  });

  it("normalizes and validates the email when given", () => {
    expect(Borrower.create({ name: "Anna", email: " Anna@Gmail.com ", phone: "", payoutDetails: "" }).email).toBe("anna@gmail.com");
    expect(() => Borrower.create({ name: "Anna", email: "not-an-email", phone: "", payoutDetails: "" })).toThrow();
  });

  it("requires a name", () => {
    expect(() => Borrower.create({ name: "  ", email: "", phone: "", payoutDetails: "" })).toThrow();
  });
});
