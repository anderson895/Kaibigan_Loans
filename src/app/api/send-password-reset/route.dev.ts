// Local development only (`npm run dev`); production uses functions/api/send-password-reset.ts.
import { handleSendPasswordReset } from "@/server/authEmails";
import { devAuthEmailEnv } from "@/server/devEnv";
import { gmailNodemailer } from "@/server/mail-node";

export function POST(request: Request) {
  return handleSendPasswordReset(request, devAuthEmailEnv(), gmailNodemailer);
}
