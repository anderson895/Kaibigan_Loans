import nodemailer from "nodemailer";
import { GMAIL_SMTP, normalizeAppPassword, type SendMail } from "./mail";

/**
 * Gmail SMTP via Nodemailer — for Node.js (`npm run dev`). Nodemailer needs Node's `net`/`tls`
 * sockets, which Cloudflare's Pages Functions bundler doesn't provide; production uses mail-worker.ts.
 */
export function gmailNodemailer(user: string, appPassword: string): SendMail {
  const transporter = nodemailer.createTransport({
    host: GMAIL_SMTP.host,
    port: GMAIL_SMTP.port,
    secure: true,
    auth: { user, pass: normalizeAppPassword(appPassword) },
  });
  return async (mail) => {
    await transporter.sendMail({
      from: `"${mail.fromName}" <${user}>`,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  };
}
