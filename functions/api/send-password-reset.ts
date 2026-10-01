// Cloudflare Pages Function: POST /api/send-password-reset (same secrets as send-verification).
import { handleSendPasswordReset, type AuthEmailEnv } from "../../src/server/authEmails";
import { gmailWorkerMailer } from "../../src/server/mail-worker";

export const onRequestPost = ({ request, env }: { request: Request; env: AuthEmailEnv }) =>
  handleSendPasswordReset(request, env, gmailWorkerMailer);
