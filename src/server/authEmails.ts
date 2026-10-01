import { createRemoteJWKSet, jwtVerify } from "jose";
import { TURNSTILE_ACTIONS } from "../lib/turnstileActions";
import { renderBrandedEmail } from "./emailTemplate";
import { createActionCode, EmailNotFoundError, serviceAccountToken } from "./firebaseAdmin";
import type { SendMail } from "./mail";
import { verifyTurnstile } from "./turnstile";

/**
 * Server-only. Account emails (verification, password reset) sent from our Gmail with our own template
 * and our own pages, instead of Firebase's built-in mailer. Shared by the Pages Functions in functions/api
 * and the local dev routes in src/app/api (*.dev.ts).
 */
export interface AuthEmailEnv {
  FIREBASE_PROJECT_ID?: string;
  /** Service account (Firebase console → Project settings → Service accounts → Generate new private key). */
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  /** Gmail address and its 16-character App Password (Google Account → Security → App passwords). */
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
  /** Cloudflare Turnstile secret. When set, requests must carry a valid Turnstile token. */
  TURNSTILE_SECRET_KEY?: string;
}

/** Builds the Gmail sender for the current runtime (Nodemailer in Node, native sockets on Cloudflare). */
export type MailerFactory = (gmailUser: string, appPassword: string) => SendMail;

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

type Configured = Required<Omit<AuthEmailEnv, "TURNSTILE_SECRET_KEY">> & Pick<AuthEmailEnv, "TURNSTILE_SECRET_KEY">;

function configured(env: AuthEmailEnv): Configured | null {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD } = env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  return { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY };
}

/**
 * Returns an error response when Turnstile is configured and the token is missing, invalid, or was solved
 * on another site or for another form than `actions`.
 */
async function rejectIfNotHuman(
  request: Request,
  secret: string | undefined,
  token: unknown,
  actions: readonly string[],
): Promise<Response | null> {
  if (!secret) return null; // Not configured (e.g. local dev without keys).
  const result = await verifyTurnstile(
    typeof token === "string" ? token : null,
    secret,
    { hostname: new URL(request.url).hostname, actions },
    request.headers.get("CF-Connecting-IP"),
  );
  if (result.success) return null;
  return Response.json({ error: "Please complete the security check and try again.", codes: result.errorCodes }, { status: 403 });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
}

const notConfigured = () => Response.json({ error: "Email sending is not configured" }, { status: 500 });

/**
 * POST /api/send-verification — for the signed-in (not yet verified) user only.
 * Body: { turnstileToken }. The link points to our own /verify-email page.
 */
export async function handleSendVerification(request: Request, env: AuthEmailEnv, createMailer: MailerFactory): Promise<Response> {
  const cfg = configured(env);
  if (!cfg) return notConfigured();

  const idToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!idToken) return Response.json({ error: "Missing token" }, { status: 401 });

  let email: string;
  let name: string;
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: `https://securetoken.google.com/${cfg.FIREBASE_PROJECT_ID}`,
      audience: cfg.FIREBASE_PROJECT_ID,
    });
    if (typeof payload.email !== "string") throw new Error("No email");
    if (payload.email_verified === true) return Response.json({ alreadyVerified: true });
    email = payload.email;
    name = typeof payload.name === "string" && payload.name ? payload.name : email.split("@")[0];
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await readJson(request);
  const blocked = await rejectIfNotHuman(request, cfg.TURNSTILE_SECRET_KEY, body.turnstileToken, [
    TURNSTILE_ACTIONS.signup,
    TURNSTILE_ACTIONS.resendVerification,
  ]);
  if (blocked) return blocked;

  try {
    const accessToken = await serviceAccountToken(cfg.FIREBASE_CLIENT_EMAIL, cfg.FIREBASE_PRIVATE_KEY);
    const code = await createActionCode(cfg.FIREBASE_PROJECT_ID, accessToken, "VERIFY_EMAIL", email);
    const link = `${new URL(request.url).origin}/verify-email?oobCode=${encodeURIComponent(code)}`;
    const { html, text } = renderBrandedEmail({
      heading: "I-verify ang iyong email",
      intro: `Hi ${name}! Salamat sa pag-register. I-click ang button sa ibaba para ma-verify ang iyong email at makapasok sa iyong account.`,
      buttonLabel: "Verify Email",
      link,
      footer: "Kung hindi ikaw ang nag-register, balewalain lang ang email na ito.",
    });
    await createMailer(cfg.GMAIL_USER, cfg.GMAIL_APP_PASSWORD)({
      fromName: "Kaibigan Loans",
      to: email,
      subject: "I-verify ang iyong email — Kaibigan Loans",
      text,
      html,
    });
    return Response.json({ sent: true });
  } catch (e) {
    console.error("send-verification failed", e);
    return Response.json({ error: "Could not send the verification email. Please try again." }, { status: 502 });
  }
}

/**
 * POST /api/send-password-reset — public. Body: { email, turnstileToken }.
 * Always answers { sent: true } for a well-formed request, so it can't be used to find out who has an account.
 * The link points to our own /reset-password page.
 */
export async function handleSendPasswordReset(request: Request, env: AuthEmailEnv, createMailer: MailerFactory): Promise<Response> {
  const cfg = configured(env);
  if (!cfg) return notConfigured();

  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  const blocked = await rejectIfNotHuman(request, cfg.TURNSTILE_SECRET_KEY, body.turnstileToken, [TURNSTILE_ACTIONS.forgotPassword]);
  if (blocked) return blocked;

  try {
    const accessToken = await serviceAccountToken(cfg.FIREBASE_CLIENT_EMAIL, cfg.FIREBASE_PRIVATE_KEY);
    const code = await createActionCode(cfg.FIREBASE_PROJECT_ID, accessToken, "PASSWORD_RESET", email);
    const link = `${new URL(request.url).origin}/reset-password?oobCode=${encodeURIComponent(code)}`;
    const { html, text } = renderBrandedEmail({
      heading: "I-reset ang iyong password",
      intro: `Hi! May nag-request na palitan ang password ng iyong Kaibigan Loans account (${email}). I-click ang button sa ibaba para gumawa ng bagong password. Mag-e-expire ang link na ito pagkalipas ng isang oras.`,
      buttonLabel: "Reset Password",
      link,
      footer: "Kung hindi ikaw ang nag-request nito, balewalain lang ang email na ito — hindi magbabago ang password mo.",
    });
    await createMailer(cfg.GMAIL_USER, cfg.GMAIL_APP_PASSWORD)({
      fromName: "Kaibigan Loans",
      to: email,
      subject: "I-reset ang iyong password — Kaibigan Loans",
      text,
      html,
    });
    return Response.json({ sent: true });
  } catch (e) {
    if (e instanceof EmailNotFoundError) return Response.json({ sent: true }); // Don't reveal whether the account exists.
    console.error("send-password-reset failed", e);
    return Response.json({ error: "Could not send the reset email. Please try again." }, { status: 502 });
  }
}
