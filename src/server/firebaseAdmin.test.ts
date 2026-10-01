import { afterEach, describe, expect, it, vi } from "vitest";
import { createActionCode, EmailNotFoundError } from "./firebaseAdmin";

afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("createActionCode", () => {
  it("returns the code from Firebase's link without Firebase sending an email", async () => {
    const fetchMock = reply(200, { oobLink: "https://x.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123&apiKey=k" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await createActionCode("proj", "token", "PASSWORD_RESET", "a@b.com")).toBe("ABC123");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ requestType: "PASSWORD_RESET", email: "a@b.com", returnOobLink: true });
  });

  it("treats unknown emails as 'not found' (error reply or enumeration-protected empty reply)", async () => {
    vi.stubGlobal("fetch", reply(400, { error: { message: "EMAIL_NOT_FOUND" } }));
    await expect(createActionCode("p", "t", "PASSWORD_RESET", "x@y.com")).rejects.toBeInstanceOf(EmailNotFoundError);
    vi.stubGlobal("fetch", reply(200, { kind: "identitytoolkit#GetOobConfirmationCodeResponse", email: "x@y.com" }));
    await expect(createActionCode("p", "t", "PASSWORD_RESET", "x@y.com")).rejects.toBeInstanceOf(EmailNotFoundError);
  });

  it("surfaces other Firebase errors", async () => {
    vi.stubGlobal("fetch", reply(400, { error: { message: "TOO_MANY_ATTEMPTS_TRY_LATER" } }));
    await expect(createActionCode("p", "t", "VERIFY_EMAIL", "x@y.com")).rejects.toThrow(/TOO_MANY_ATTEMPTS/);
  });
});
