import type { TrafficInsightsPeriod } from "@hu/types";

import { utcDayKey } from "./traffic-aggregate.repository.js";

export interface InsightsPeriodWindow {
  period: TrafficInsightsPeriod;
  periodLabel: string;
  /** Inclusive UTC day YYYY-MM-DD, or null for all-time. */
  startDay: string | null;
  /** Inclusive UTC day YYYY-MM-DD (yesterday or today depending). */
  endDay: string;
  /** Exclusive end Date for ISO periodEnd. */
  endExclusive: Date;
  /** Inclusive start Date, or null for all-time. */
  startInclusive: Date | null;
  bucketGranularity: "day" | "month";
  previous: {
    startDay: string;
    endDay: string;
  } | null;
}

function addUtcDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + delta);
  return utcDayKey(date);
}

function daysInclusive(startDay: string, endDay: string): number {
  const start = Date.parse(`${startDay}T00:00:00.000Z`);
  const end = Date.parse(`${endDay}T00:00:00.000Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function parseTrafficInsightsPeriod(raw: unknown): TrafficInsightsPeriod | null {
  if (raw === "30d" || raw === "90d" || raw === "12m" || raw === "all") {
    return raw;
  }
  return null;
}

export function resolveInsightsPeriodWindow(
  period: TrafficInsightsPeriod,
  now: Date = new Date(),
): InsightsPeriodWindow {
  const endExclusive = new Date(now.getTime());
  const endDay = utcDayKey(now);

  if (period === "all") {
    return {
      period,
      periodLabel: "All time",
      startDay: null,
      endDay,
      endExclusive,
      startInclusive: null,
      bucketGranularity: "month",
      previous: null,
    };
  }

  if (period === "12m") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const startDay = utcDayKey(start);
    const span = daysInclusive(startDay, endDay);
    const prevEnd = addUtcDays(startDay, -1);
    const prevStart = addUtcDays(prevEnd, -(span - 1));
    return {
      period,
      periodLabel: "Last 12 months",
      startDay,
      endDay,
      endExclusive,
      startInclusive: start,
      bucketGranularity: "month",
      previous: { startDay: prevStart, endDay: prevEnd },
    };
  }

  const dayCount = period === "30d" ? 30 : 90;
  const startDay = addUtcDays(endDay, -(dayCount - 1));
  const prevEnd = addUtcDays(startDay, -1);
  const prevStart = addUtcDays(prevEnd, -(dayCount - 1));

  return {
    period,
    periodLabel: period === "30d" ? "Last 30 days" : "Last 90 days",
    startDay,
    endDay,
    endExclusive,
    startInclusive: new Date(`${startDay}T00:00:00.000Z`),
    bucketGranularity: "day",
    previous: { startDay: prevStart, endDay: prevEnd },
  };
}

export function eachUtcDay(startDay: string, endDay: string): string[] {
  const days: string[] = [];
  let cursor = startDay;
  while (cursor <= endDay) {
    days.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return days;
}

export function monthKeyFromDay(day: string): string {
  return day.slice(0, 7);
}

export function eachUtcMonth(startDay: string, endDay: string): string[] {
  const months: string[] = [];
  let [y, m] = startDay.split("-").map(Number) as [number, number];
  const endY = Number(endDay.slice(0, 4));
  const endM = Number(endDay.slice(5, 7));

  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export function formatDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function percentChange(current: number, previous: number): {
  percent: number | null;
  isNew: boolean;
} {
  if (previous === 0 && current === 0) {
    return { percent: 0, isNew: false };
  }
  if (previous === 0 && current > 0) {
    return { percent: null, isNew: true };
  }
  return {
    percent: Math.round(((current - previous) / previous) * 1000) / 10,
    isNew: false,
  };
}
