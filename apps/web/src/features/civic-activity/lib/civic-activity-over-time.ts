/**
 * Civic Activity Over Time — derived daily series (Step 15D.8C).
 *
 * Counting contract:
 * - One civic action = one unique `CivicTimelineEntry.id` from the same
 *   timeline builders used for Activity Timeline.
 * - Entries MUST be deduplicated by `id` before bucketing.
 * - Day key = UTC calendar date (`YYYY-MM-DD`) of `occurredAt`.
 * - Window = last N UTC calendar days inclusive of "today" (default 30).
 * - Chronological order is always oldest → newest (never reversed for RTL).
 * - The UI timeline `slice(0, 40)` must NOT feed this series.
 * - This is civic actions by day — not visits, attendance, or time spent.
 */

import type { CivicActivityDayBucket, CivicActivityOverTime, CivicTimelineEntry } from "../types";

export const CIVIC_ACTIVITY_OVER_TIME_WINDOW_DAYS = 30;

export function utcDayKey(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addUtcDays(dayKey: string, deltaDays: number): string {
  const [year, month, day] = dayKey.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return utcDayKey(date);
}

/**
 * Deduplicate timeline entries by stable event id (first occurrence wins).
 */
export function dedupeCivicTimelineEntries(
  entries: readonly CivicTimelineEntry[],
): CivicTimelineEntry[] {
  const byId = new Map<string, CivicTimelineEntry>();
  for (const entry of entries) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
}

/**
 * Build a fixed-length daily series from unique civic timeline events.
 */
export function buildCivicActivityOverTime(
  uniqueEntries: readonly CivicTimelineEntry[],
  options?: {
    readonly now?: Date;
    readonly windowDays?: number;
  },
): CivicActivityOverTime {
  const windowDays = options?.windowDays ?? CIVIC_ACTIVITY_OVER_TIME_WINDOW_DAYS;
  const now = options?.now ?? new Date();
  const todayKey = utcDayKey(now);
  const startKey = addUtcDays(todayKey, -(windowDays - 1));

  const counts = new Map<string, number>();
  for (const entry of uniqueEntries) {
    const day = utcDayKey(entry.occurredAt);
    if (!day) {
      continue;
    }
    if (day < startKey || day > todayKey) {
      continue;
    }
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const days: CivicActivityDayBucket[] = [];
  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = addUtcDays(startKey, offset);
    days.push({
      date,
      actionCount: counts.get(date) ?? 0,
    });
  }

  const actionsInPeriod = days.reduce((sum, bucket) => sum + bucket.actionCount, 0);
  const activeCivicDays = days.filter((bucket) => bucket.actionCount > 0).length;

  return {
    windowDays,
    days,
    actionsInPeriod,
    activeCivicDays,
  };
}
