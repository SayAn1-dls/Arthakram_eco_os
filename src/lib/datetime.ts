/**
 * <input type="datetime-local"> carries no timezone. Arthakram treats those
 * values as India Standard Time (the platform's home timezone) on both ends,
 * so the server's own TZ never shifts an event by hours.
 */
const OFFSET = "+05:30";
const OFFSET_MS = 5.5 * 3600 * 1000;

export function parseLocalInput(v: string): Date {
  if (/[zZ]|[+-]\d\d:\d\d$/.test(v)) return new Date(v);
  const withSeconds = /T\d\d:\d\d$/.test(v) ? `${v}:00` : /^\d{4}-\d\d-\d\d$/.test(v) ? `${v}T23:59:00` : v;
  return new Date(withSeconds + OFFSET);
}

export function toLocalInput(d: Date | number | null | undefined): string {
  if (d == null) return "";
  return new Date(new Date(d).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}
