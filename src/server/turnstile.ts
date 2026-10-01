/** Server-only: checks a Cloudflare Turnstile token. Works in Node and on Cloudflare (plain fetch). */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

/** Where and for what the token must have been solved, so tokens from another site or form are refused. */
export interface TurnstileExpectation {
  /** Hostname of the site receiving the token (the widget runs on the same site). */
  hostname: string;
  /** Widget actions this endpoint accepts. */
  actions: readonly string[];
}

interface SiteverifyResponse {
  success?: boolean;
  "error-codes"?: string[];
  hostname?: string;
  action?: string;
}

export async function verifyTurnstile(
  token: string | undefined | null,
  secret: string,
  expected: TurnstileExpectation,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);
  let data: SiteverifyResponse;
  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    data = (await res.json()) as SiteverifyResponse;
  } catch {
    return { success: false, errorCodes: ["internal-error"] };
  }
  if (data.success !== true) return { success: false, errorCodes: data["error-codes"] ?? [] };
  // A real token can still be replayed from elsewhere (e.g. solved on localhost, which the widget allows).
  if (data.hostname !== expected.hostname) return { success: false, errorCodes: ["hostname-mismatch"] };
  if (!expected.actions.includes(data.action ?? "")) return { success: false, errorCodes: ["action-mismatch"] };
  return { success: true, errorCodes: [] };
}
