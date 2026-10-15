/** Dates are stored as ISO calendar strings (YYYY-MM-DD) to avoid timezone shifts. */
export type IsoDate = string;

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

/** Adds months, clamping to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toIsoDate(target);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: IsoDate): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Day `day` of the month of `iso` (moved by `monthOffset` months), clamped to that month's last day:
 * day 30 in February is Feb 28/29, and day 31 is always the end of the month.
 */
export function dayOfMonth(iso: IsoDate, day: number, monthOffset = 0): IsoDate {
  const [y, m] = iso.split("-").map(Number);
  const lastDay = new Date(y, m + monthOffset, 0).getDate();
  return toIsoDate(new Date(y, m - 1 + monthOffset, Math.min(day, lastDay)));
}

export function formatDate(iso: IsoDate | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
