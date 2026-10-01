import { describe, expect, it } from "vitest";
import { toE164, toMailtoUrl, toMessengerUrl, toSmsUrl } from "./LenderContactService";

describe("toMessengerUrl", () => {
  it("accepts a plain username", () => {
    expect(toMessengerUrl("juan.delacruz")).toBe("https://m.me/juan.delacruz");
  });

  it("accepts facebook.com, messenger.com and m.me links", () => {
    expect(toMessengerUrl("https://www.facebook.com/juan.delacruz/")).toBe("https://m.me/juan.delacruz");
    expect(toMessengerUrl("facebook.com/juan.delacruz?ref=bookmarks")).toBe("https://m.me/juan.delacruz");
    expect(toMessengerUrl("https://m.me/juan.delacruz/")).toBe("https://m.me/juan.delacruz");
    expect(toMessengerUrl("https://www.messenger.com/t/juan.delacruz")).toBe("https://m.me/juan.delacruz");
  });

  it("accepts numeric profile ids", () => {
    expect(toMessengerUrl("https://www.facebook.com/profile.php?id=100012345678")).toBe("https://m.me/100012345678");
    expect(toMessengerUrl("https://www.facebook.com/people/Juan-Dela-Cruz/61234567890/")).toBe("https://m.me/61234567890");
  });

  it("clears when empty and rejects junk or reserved paths", () => {
    expect(toMessengerUrl("  ")).toBe("");
    expect(() => toMessengerUrl("not a link!")).toThrow();
    expect(() => toMessengerUrl("facebook.com/groups/12345")).toThrow();
  });
});

describe("toMailtoUrl", () => {
  it("pre-fills subject and body", () => {
    expect(toMailtoUrl("lender@gmail.com", "Loan request", "Amount: ₱5,000\nThanks")).toBe(
      "mailto:lender@gmail.com?subject=Loan%20request&body=Amount%3A%20%E2%82%B15%2C000%0AThanks",
    );
  });
});

describe("phone links", () => {
  it("normalizes PH mobile numbers", () => {
    expect(toE164("0945-445-4744")).toBe("+639454454744");
    expect(toE164("+63 945 445 4744")).toBe("+639454454744");
    expect(toE164("12")).toBe("");
  });

  it("builds an SMS link with the body pre-filled", () => {
    expect(toSmsUrl("0945-445-4744", "Hi po")).toBe("sms:+639454454744?&body=Hi%20po");
  });
});
