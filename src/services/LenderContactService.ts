import { doc, getDoc, writeBatch, type Firestore } from "firebase/firestore";
import type { ActivityRepository } from "@/data/repositories";

export interface LenderContact {
  /** Normalized https://m.me/<id> link, or "" when not set. */
  messengerUrl: string;
  /** Where email borrowing requests go, or "" when not set. */
  email: string;
  /** Contact number as typed (e.g. 0945-445-4744), or "" when not set. */
  phone: string;
}

/** The lender's number, shown until a different one is saved in Settings. */
export const DEFAULT_LENDER_PHONE = "0945-445-4744";

// Facebook paths that are never a username — linking m.me/<these> would be a dead end.
const RESERVED_FB_PATHS = /^(people|profile\.php|pages|groups|p|marketplace|events|watch|share)$/i;

/**
 * Turns a username, facebook.com profile link, messenger.com link or m.me link into an
 * https://m.me/<id> URL, which opens the Messenger app on phones and the chat on desktop.
 * Note: m.me cannot pre-fill the message for personal accounts, so the request is copied instead.
 */
export function toMessengerUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (/^https?:\/\/(www\.)?m\.me\/[A-Za-z0-9.]+\/?$/i.test(raw)) return raw.replace(/\/$/, "");

  // profile.php?id=123… and /people/Name/123… both key off the numeric account id.
  const numericId = raw.match(/[?&]id=(\d+)/) ?? raw.match(/\/people\/[^/]+\/(\d+)/i);
  if (numericId) return `https://m.me/${numericId[1]}`;

  const handle = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.|m\.|web\.)?((facebook|fb)\.com|messenger\.com\/t|m\.me)\/?/i, "")
    .split(/[/?#]/)[0];
  if (!handle || RESERVED_FB_PATHS.test(handle) || !/^[A-Za-z0-9.]{5,}$/.test(handle)) {
    throw new Error("Enter a Facebook username or profile link (e.g. facebook.com/juan.delacruz).");
  }
  return `https://m.me/${handle}`;
}

function normalizeEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

/** Converts a PH mobile number (0945-445-4744 / +63 945…) to +63XXXXXXXXXX for tel:/sms: links. */
export function toE164(phone: string): string {
  const intl = phone.trim().startsWith("+");
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (!intl && digits.startsWith("0")) digits = "63" + digits.slice(1);
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
}

/** SMS link with the message pre-filled. `?&body=` works on both Android and iOS. */
export function toSmsUrl(phone: string, body: string): string {
  return `sms:${toE164(phone)}?&body=${encodeURIComponent(body)}`;
}

/** Builds a mailto: link with the subject and body pre-filled (unlike Messenger, email supports this). */
export function toMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The lender's contact details shown to borrowers, stored at meta/contact (admin-writable). */
export class LenderContactService {
  constructor(
    private readonly db: Firestore,
    private readonly activity: ActivityRepository,
  ) {}

  private get ref() {
    return doc(this.db, "meta", "contact");
  }

  async get(): Promise<LenderContact> {
    const data = (await getDoc(this.ref)).data() ?? {};
    return {
      messengerUrl: (data.messengerUrl as string | undefined) ?? "",
      email: (data.email as string | undefined) ?? "",
      phone: (data.phone as string | undefined) || DEFAULT_LENDER_PHONE,
    };
  }

  async save(input: { messenger: string; email: string; phone: string }, actorEmail: string): Promise<LenderContact> {
    const phone = input.phone.trim();
    if (phone && !toE164(phone)) throw new Error("Enter a valid mobile number (e.g. 0945-445-4744).");
    const contact = { messengerUrl: toMessengerUrl(input.messenger), email: normalizeEmail(input.email), phone };
    const batch = writeBatch(this.db);
    batch.set(this.ref, contact);
    batch.set(this.activity.newDocRef(), this.activity.entry({ type: "contact_updated", message: "Contact details updated", actorEmail }));
    await batch.commit();
    return contact;
  }
}
