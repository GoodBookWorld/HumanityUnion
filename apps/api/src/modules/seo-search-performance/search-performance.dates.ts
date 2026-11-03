/**
 * SEO-12B.1 — reporting-day helpers. Days are `YYYY-MM-DD` strings.
 * Google Search Console reports in Pacific time; Bing dates carry their own offset.
 */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pacificDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function pacificDayKey(date: Date): string {
  return pacificDayFormatter.format(date);
}

function dayToUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function addDays(day: string, delta: number): string {
  const date = dayToUtcDate(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function addMonthsToDay(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return target.toISOString().slice(0, 10);
}

export function compareDays(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive list of days from `start` to `end`; empty when start > end. */
export function listDays(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; compareDays(day, end) <= 0; day = addDays(day, 1)) {
    days.push(day);
    if (days.length > 1000) {
      break;
    }
  }
  return days;
}

/**
 * Bing JSON dates look like `/Date(1316156400000-0700)/`. Returns the calendar
 * day in the offset Bing supplied (UTC when no offset is present).
 */
export function parseBingDateToDay(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^\/Date\((-?\d+)([+-]\d{4})?\)\/$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const epochMs = Number(match[1]);
  if (!Number.isFinite(epochMs)) {
    return null;
  }
  let offsetMinutes = 0;
  if (match[2]) {
    const sign = match[2].startsWith("-") ? -1 : 1;
    const hours = Number(match[2].slice(1, 3));
    const minutes = Number(match[2].slice(3, 5));
    offsetMinutes = sign * (hours * 60 + minutes);
  }
  const local = new Date(epochMs + offsetMinutes * 60_000);
  return Number.isNaN(local.getTime()) ? null : local.toISOString().slice(0, 10);
}
