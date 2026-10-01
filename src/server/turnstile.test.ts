import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

afterEach(() => vi.unstubAllGlobals());

const expected = { hostname: "kaibigan-loans.pages.dev", actions: ["signup", "resend_verification"] };
const siteverify = (body: object) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));

describe("verifyTurnstile", () => {
  it("rejects a missing token without calling Cloudflare", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile("", "secret", expected)).toEqual({ success: false, errorCodes: ["missing-input-response"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends secret, token and IP to siteverify and accepts a token solved on this site for this form", async () => {
    const fetchMock = siteverify({ success: true, "error-codes": [], hostname: "kaibigan-loans.pages.dev", action: "signup" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile("tok", "sec", expected, "1.2.3.4")).toEqual({ success: true, errorCodes: [] });
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect([body.get("secret"), body.get("response"), body.get("remoteip")]).toEqual(["sec", "tok", "1.2.3.4"]);
  });

  it("refuses a real token solved on another site or for another form", async () => {
    vi.stubGlobal("fetch", siteverify({ success: true, hostname: "localhost", action: "signup" }));
    expect(await verifyTurnstile("tok", "sec", expected)).toEqual({ success: false, errorCodes: ["hostname-mismatch"] });
    vi.stubGlobal("fetch", siteverify({ success: true, hostname: "kaibigan-loans.pages.dev", action: "login" }));
    expect(await verifyTurnstile("tok", "sec", expected)).toEqual({ success: false, errorCodes: ["action-mismatch"] });
  });

  it("treats Cloudflare errors as a failed check", async () => {
    vi.stubGlobal("fetch", siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] }));
    expect(await verifyTurnstile("tok", "sec", expected)).toEqual({ success: false, errorCodes: ["timeout-or-duplicate"] });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await verifyTurnstile("tok", "sec", expected)).success).toBe(false);
  });
});
