import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

afterEach(() => vi.unstubAllGlobals());

describe("verifyTurnstile", () => {
  it("rejects a missing token without calling Cloudflare", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile("", "secret")).toEqual({ success: false, errorCodes: ["missing-input-response"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends secret, token and IP to siteverify and reads the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, "error-codes": [] })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile("tok", "sec", "1.2.3.4")).toEqual({ success: true, errorCodes: [] });
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect([body.get("secret"), body.get("response"), body.get("remoteip")]).toEqual(["sec", "tok", "1.2.3.4"]);
  });

  it("treats Cloudflare errors as a failed check", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }))));
    expect(await verifyTurnstile("tok", "sec")).toEqual({ success: false, errorCodes: ["timeout-or-duplicate"] });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await verifyTurnstile("tok", "sec")).success).toBe(false);
  });
});
