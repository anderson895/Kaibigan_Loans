// Local development only (`npm run dev`); production uses functions/api/send-verification.ts.
import { handleSendVerification } from "@/server/authEmails";
import { devAuthEmailEnv } from "@/server/devEnv";
import { gmailNodemailer } from "@/server/mail-node";

export function POST(request: Request) {
  return handleSendVerification(request, devAuthEmailEnv(), gmailNodemailer);
}
