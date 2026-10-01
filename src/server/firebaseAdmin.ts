import { importPKCS8, SignJWT } from "jose";

/**
 * Server-only. Minimal Firebase Admin over REST using the service account (no firebase-admin SDK,
 * which doesn't run on Cloudflare). Used to create email action links without Firebase sending emails.
 */

/** Exchanges the service account key for a short-lived Google OAuth access token. */
export async function serviceAccountToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const key = await importPKCS8(privateKeyPem.replace(/\\n/g, "\n"), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/identitytoolkit" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(`Service account auth failed: ${data.error_description ?? res.status}`);
  return data.access_token;
}

export type OobRequestType = "VERIFY_EMAIL" | "PASSWORD_RESET";

/** Thrown when Firebase has no account for the email (callers may hide this to avoid leaking accounts). */
export class EmailNotFoundError extends Error {}

/**
 * Asks Firebase for an action code (email verification or password reset) for `email`
 * and returns it — Firebase does not send anything. We email our own link instead.
 */
export async function createActionCode(
  projectId: string,
  accessToken: string,
  requestType: OobRequestType,
  email: string,
): Promise<string> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requestType, email, returnOobLink: true }),
  });
  const data = (await res.json()) as { oobLink?: string; error?: { message?: string } };
  const message = data.error?.message ?? "";
  if (message.startsWith("EMAIL_NOT_FOUND") || message.startsWith("USER_NOT_FOUND")) throw new EmailNotFoundError(message);
  // With Firebase's email enumeration protection on, unknown emails get a 200 with no link instead of an error.
  if (res.ok && !data.oobLink) throw new EmailNotFoundError("No account for this email");
  const code = data.oobLink ? new URL(data.oobLink).searchParams.get("oobCode") : null;
  if (!code) throw new Error(`Could not create the ${requestType} link: ${message || res.status}`);
  return code;
}
