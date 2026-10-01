import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import nodemailer from "nodemailer";

/**
 * Server-only. Sends the email-verification link with Nodemailer + Gmail SMTP instead of Firebase's
 * built-in mailer. Shared by the Pages Function (functions/api/send-verification.ts) and the local
 * dev route (src/app/api/send-verification/route.dev.ts).
 */
export interface SendVerificationEnv {
  FIREBASE_PROJECT_ID?: string;
  /** Service account (Firebase console → Project settings → Service accounts → Generate new private key). */
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  /** Gmail address and its 16-character App Password (Google Account → Security → App passwords). */
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
}

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

/** Exchanges the service account key for a short-lived Google OAuth access token. */
async function serviceAccountToken(clientEmail: string, privateKeyPem: string): Promise<string> {
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

/** Asks Firebase for the verification link without letting Firebase send its own email. */
async function verificationOobCode(projectId: string, accessToken: string, email: string): Promise<string> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requestType: "VERIFY_EMAIL", email, returnOobLink: true }),
  });
  const data = (await res.json()) as { oobLink?: string; error?: { message?: string } };
  const code = data.oobLink ? new URL(data.oobLink).searchParams.get("oobCode") : null;
  if (!code) throw new Error(`Could not create verification link: ${data.error?.message ?? res.status}`);
  return code;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailHtml(name: string, link: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f1f3d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:#1d6ef2">Kaibigan Loans</td></tr>
<tr><td style="font-size:13px;color:#64748b;padding-bottom:24px">Tulong sa mga Kaibigan</td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:12px">I-verify ang iyong email</td></tr>
<tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px">Hi ${escapeHtml(name)}! Salamat sa pag-register. I-click ang button sa ibaba para ma-verify ang iyong email at makapasok sa iyong account.</td></tr>
<tr><td align="center" style="padding-bottom:24px"><a href="${link}" style="display:inline-block;background:#1d6ef2;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:999px">Verify Email</a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;color:#64748b">Kung hindi gumana ang button, i-copy ang link na ito:<br><a href="${link}" style="color:#1d6ef2;word-break:break-all">${link}</a><br><br>Kung hindi ikaw ang nag-register, balewalain lang ang email na ito.</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * POST /api/send-verification — for the signed-in (not yet verified) user only.
 * The link points to our own /verify-email page, which applies the code in the browser.
 */
export async function handleSendVerification(request: Request, env: SendVerificationEnv): Promise<Response> {
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD } = env;
  if (!projectId || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return Response.json({ error: "Email sending is not configured" }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Missing token" }, { status: 401 });

  let email: string;
  let name: string;
  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (typeof payload.email !== "string") throw new Error("No email");
    if (payload.email_verified === true) return Response.json({ alreadyVerified: true });
    email = payload.email;
    name = typeof payload.name === "string" && payload.name ? payload.name : email.split("@")[0];
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const accessToken = await serviceAccountToken(FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY);
    const oobCode = await verificationOobCode(projectId, accessToken, email);
    const link = `${new URL(request.url).origin}/verify-email?oobCode=${encodeURIComponent(oobCode)}`;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
    });
    await transporter.sendMail({
      from: `"Kaibigan Loans" <${GMAIL_USER}>`,
      to: email,
      subject: "I-verify ang iyong email — Kaibigan Loans",
      text: `Hi ${name}! I-verify ang iyong email gamit ang link na ito: ${link}\n\nKung hindi ikaw ang nag-register, balewalain lang ang email na ito.`,
      html: emailHtml(name, link),
    });
    return Response.json({ sent: true });
  } catch (e) {
    console.error("send-verification failed", e);
    return Response.json({ error: "Could not send the verification email. Please try again." }, { status: 502 });
  }
}
