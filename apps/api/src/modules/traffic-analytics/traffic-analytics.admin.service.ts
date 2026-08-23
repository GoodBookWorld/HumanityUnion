import type { TrafficAdminReport, TrafficPeriod } from "@hu/types";
import { getCountryLabel } from "@hu/geography";

import { assertTrafficAnalyticsAdmin } from "./traffic-analytics.ingest.js";
import {
  aggregateTrafficGeography,
  aggregateTrafficReferrers,
  aggregateTrafficSummary,
  aggregateTrafficTopPages,
} from "./traffic-analytics.repository.js";
import { resolveTrafficPeriodWindow } from "./traffic-period.js";

function sharePercent(part: number, total: number): number {
  if (total <= 0 || part <= 0) {
    return 0;
  }
  return Math.round((part / total) * 1000) / 10;
}

function referrerLabel(
  referrerType: string,
  host: string | null,
): string {
  if (referrerType === "DIRECT") {
    return "Direct";
  }
  if (referrerType === "INTERNAL") {
    return "Internal";
  }
  return host ?? "External";
}

export async function getTrafficAdminReport(input: {
  actorUserId: string;
  period: TrafficPeriod;
  now?: Date;
}): Promise<TrafficAdminReport> {
  await assertTrafficAnalyticsAdmin(input.actorUserId);

  const window = resolveTrafficPeriodWindow(input.period, input.now ?? new Date());
  const { start, end } = window;

  const [summaryRow, topPagesRaw, referrersRaw, geographyRaw] = await Promise.all([
    aggregateTrafficSummary(start, end),
    aggregateTrafficTopPages(start, end),
    aggregateTrafficReferrers(start, end),
    aggregateTrafficGeography(start, end),
  ]);

  const views = summaryRow.views;

  return {
    summary: {
      period: window.period,
      periodLabel: window.periodLabel,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      views: summaryRow.views,
      visitors: summaryRow.visitors,
      sessions: summaryRow.sessions,
    },
    topPages: topPagesRaw.map((row) => ({
      path: row.path,
      views: row.views,
      visitors: row.visitors,
      sharePercent: sharePercent(row.views, views),
    })),
    referrers: referrersRaw.map((row) => ({
      label: referrerLabel(row.referrerType, row.host),
      referrerType: row.referrerType,
      host: row.host,
      views: row.views,
      sharePercent: sharePercent(row.views, views),
    })),
    geography: geographyRaw.map((row) => ({
      countryCode: row.countryCode,
      countryLabel: row.countryCode
        ? (getCountryLabel(row.countryCode) ?? row.countryCode)
        : "Unknown",
      views: row.views,
      visitors: row.visitors,
    })),
  };
}
