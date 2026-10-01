// Cloudflare Pages Function: POST /api/send-verification
// Secrets (npx wrangler pages secret put <NAME> --project-name kaibigan-loans):
//   FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, TURNSTILE_SECRET_KEY
import { handleSendVerification, type AuthEmailEnv } from "../../src/server/authEmails";
import { gmailWorkerMailer } from "../../src/server/mail-worker";

// Gmail SMTP over Cloudflare's native sockets: Nodemailer can't open connections in Pages Functions.
export const onRequestPost = ({ request, env }: { request: Request; env: AuthEmailEnv }) =>
  handleSendVerification(request, env, gmailWorkerMailer);
