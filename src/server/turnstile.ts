/** Server-only: checks a Cloudflare Turnstile token. Works in Node and on Cloudflare (plain fetch). */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

export async function verifyTurnstile(
  token: string | undefined | null,
  secret: string,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);
  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return { success: data.success === true, errorCodes: data["error-codes"] ?? [] };
  } catch {
    return { success: false, errorCodes: ["internal-error"] };
  }
}
