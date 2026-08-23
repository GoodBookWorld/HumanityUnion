import type { TrafficPeriod } from "@hu/types";

export interface TrafficPeriodWindow {
  period: TrafficPeriod;
  periodLabel: string;
  /** Inclusive UTC start. */
  start: Date;
  /** Exclusive UTC end. */
  end: Date;
}

/**
 * Period boundaries in UTC.
 * Today = [00:00:00.000Z today, now+epsilon) using end = now for live reporting,
 * but for stable queries we use end = current instant.
 */
export function resolveTrafficPeriodWindow(
  period: TrafficPeriod,
  now: Date = new Date(),
): TrafficPeriodWindow {
  const end = new Date(now.getTime());

  if (period === "today") {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    return {
      period,
      periodLabel: "Today",
      start,
      end,
    };
  }

  if (period === "7d") {
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      period,
      periodLabel: "Last 7 days",
      start,
      end,
    };
  }

  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    period,
    periodLabel: "Last 30 days",
    start,
    end,
  };
}

export function parseTrafficPeriod(raw: unknown): TrafficPeriod | null {
  if (raw === "today" || raw === "7d" || raw === "30d") {
    return raw;
  }
  return null;
}
