import { WorkerMailer } from "worker-mailer";
import { GMAIL_SMTP, normalizeAppPassword, type SendMail } from "./mail";

/**
 * Gmail SMTP for Cloudflare Pages Functions, over Cloudflare's native TCP sockets (`cloudflare:sockets`).
 * Only import this from functions/ — it does not run in Node.js (use mail-node.ts there).
 */
export function gmailWorkerMailer(user: string, appPassword: string): SendMail {
  return (mail) =>
    WorkerMailer.send(
      {
        host: GMAIL_SMTP.host,
        port: GMAIL_SMTP.port,
        secure: true,
        credentials: { username: user, password: normalizeAppPassword(appPassword) },
        authType: "plain",
        socketTimeoutMs: 15_000,
        responseTimeoutMs: 15_000,
      },
      {
        from: { name: mail.fromName, email: user },
        to: { email: mail.to },
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      },
    );
}
