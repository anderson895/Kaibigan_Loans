/** A ready-to-send email. The sender address is the configured Gmail account. */
export interface OutgoingMail {
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends one email through Gmail SMTP. Implemented per runtime (see mail-node.ts / mail-worker.ts). */
export type SendMail = (mail: OutgoingMail) => Promise<void>;

export const GMAIL_SMTP = { host: "smtp.gmail.com", port: 465 } as const;

/** App Passwords are shown with spaces ("abcd efgh ijkl mnop"); SMTP wants them without. */
export function normalizeAppPassword(password: string): string {
  return password.replace(/\s+/g, "");
}
