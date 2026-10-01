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

export function formatDate(iso: IsoDate | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
