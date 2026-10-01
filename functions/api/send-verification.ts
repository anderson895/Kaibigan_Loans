// Cloudflare Pages Function: POST /api/send-verification
// Secrets (npx wrangler pages secret put <NAME> --project-name kaibigan-loans):
//   FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD
import { handleSendVerification, type SendVerificationEnv } from "../../src/server/sendVerification";

export const onRequestPost = ({ request, env }: { request: Request; env: SendVerificationEnv }) =>
  handleSendVerification(request, env);
