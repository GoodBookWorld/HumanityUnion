import type {
  TrafficInsightsPeriod,
  TrafficInsightsReport,
  TrafficReferrerType,
  TrafficTrendPoint,
} from "@hu/types";
import { getCountryLabel } from "@hu/geography";

import { assertTrafficAnalyticsAdmin } from "./traffic-analytics.ingest.js";
import {
  countAllTimeTrafficVisitors,
  getTrafficAnalyticsMeta,
  listDimensionAggregatesBetween,
  listTotalAggregatesBetween,
  sumTotalAggregatesBetween,
  type TrafficDailyAggregateDocument,
} from "./traffic-aggregate.repository.js";
import {
  eachUtcDay,
  eachUtcMonth,
  formatDayLabel,
  formatMonthLabel,
  monthKeyFromDay,
  percentChange,
  resolveInsightsPeriodWindow,
} from "./traffic-insights-period.js";

function sharePercent(part: number, total: number): number {
  if (total <= 0 || part <= 0) {
    return 0;
  }
  return Math.round((part / total) * 1000) / 10;
}

function buildDailyTrend(
  startDay: string,
  endDay: string,
  rows: TrafficDailyAggregateDocument[],
): TrafficTrendPoint[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return eachUtcDay(startDay, endDay).map((day) => {
    const row = byDay.get(day);
    return {
      bucket: day,
      label: formatDayLabel(day),
      views: row?.views ?? 0,
      visitors: row?.visitors ?? 0,
      sessions: row?.sessions ?? 0,
    };
  });
}

function buildMonthlyTrend(
  startDay: string,
  endDay: string,
  rows: TrafficDailyAggregateDocument[],
): TrafficTrendPoint[] {
  const months = eachUtcMonth(startDay, endDay);
  const totals = new Map<string, { views: number; visitors: number; sessions: number }>();

  for (const month of months) {
    totals.set(month, { views: 0, visitors: 0, sessions: 0 });
  }

  for (const row of rows) {
    const month = monthKeyFromDay(row.day);
    const bucket = totals.get(month);
    if (!bucket) {
      continue;
    }
    bucket.views += row.views;
    bucket.visitors += row.visitors;
    bucket.sessions += row.sessions;
  }

  return months.map((month) => {
    const bucket = totals.get(month)!;
    return {
      bucket: month,
      label: formatMonthLabel(month),
      views: bucket.views,
      visitors: bucket.visitors,
      sessions: bucket.sessions,
    };
  });
}

function parseReferrerDimension(dimensionKey: string): {
  referrerType: TrafficReferrerType;
  host: string | null;
  label: string;
} {
  if (dimensionKey === "DIRECT") {
    return { referrerType: "DIRECT", host: null, label: "Direct" };
  }
  if (dimensionKey === "INTERNAL") {
    return { referrerType: "INTERNAL", host: null, label: "Internal" };
  }
  if (dimensionKey.startsWith("EXTERNAL|")) {
    const host = dimensionKey.slice("EXTERNAL|".length) || null;
    return { referrerType: "EXTERNAL", host, label: host ?? "External" };
  }
  if (dimensionKey === "EXTERNAL") {
    return { referrerType: "EXTERNAL", host: null, label: "External" };
  }
  return { referrerType: "DIRECT", host: null, label: dimensionKey };
}

export async function getTrafficInsightsReport(input: {
  actorUserId: string;
  period: TrafficInsightsPeriod;
  now?: Date;
}): Promise<TrafficInsightsReport> {
  await assertTrafficAnalyticsAdmin(input.actorUserId);

  const now = input.now ?? new Date();
  const window = resolveInsightsPeriodWindow(input.period, now);
  const meta = await getTrafficAnalyticsMeta();
  const allTimeVisitors = await countAllTimeTrafficVisitors();

  const collectionStartedAt = meta?.collectionStartedAt ?? null;
  const rangeStartDay =
    window.startDay ??
    (collectionStartedAt ? collectionStartedAt.toISOString().slice(0, 10) : window.endDay);

  const totalRows = await listTotalAggregatesBetween(rangeStartDay, window.endDay);
  const trend =
    window.bucketGranularity === "month"
      ? buildMonthlyTrend(rangeStartDay, window.endDay, totalRows)
      : buildDailyTrend(rangeStartDay, window.endDay, totalRows);

  const periodTotals =
    window.startDay === null
      ? {
          views: meta?.allTimeViews ?? 0,
          visitors: allTimeVisitors,
          sessions: meta?.allTimeSessions ?? 0,
        }
      : await sumTotalAggregatesBetween(window.startDay, window.endDay);

  let comparison: TrafficInsightsReport["comparison"] = null;
  if (window.previous) {
    const previousTotals = await sumTotalAggregatesBetween(
      window.previous.startDay,
      window.previous.endDay,
    );
    const viewsDelta = percentChange(periodTotals.views, previousTotals.views);
    const visitorsDelta = percentChange(periodTotals.visitors, previousTotals.visitors);
    const sessionsDelta = percentChange(periodTotals.sessions, previousTotals.sessions);
    comparison = {
      previousViews: previousTotals.views,
      previousVisitors: previousTotals.visitors,
      previousSessions: previousTotals.sessions,
      viewsChangePercent: viewsDelta.percent,
      visitorsChangePercent: visitorsDelta.percent,
      sessionsChangePercent: sessionsDelta.percent,
      viewsIsNew: viewsDelta.isNew,
      visitorsIsNew: visitorsDelta.isNew,
      sessionsIsNew: sessionsDelta.isNew,
    };
  }

  const [countryRows, referrerRows] = await Promise.all([
    listDimensionAggregatesBetween("country", rangeStartDay, window.endDay),
    listDimensionAggregatesBetween("referrer", rangeStartDay, window.endDay),
  ]);

  const geographyMap = new Map<string, { views: number; visitors: number }>();
  for (const row of countryRows) {
    const key = row.dimensionKey || "_unknown";
    const existing = geographyMap.get(key) ?? { views: 0, visitors: 0 };
    existing.views += row.views;
    existing.visitors += row.visitors;
    geographyMap.set(key, existing);
  }

  const geography = [...geographyMap.entries()]
    .map(([key, value]) => ({
      countryCode: key === "_unknown" ? null : key,
      countryLabel:
        key === "_unknown" ? "Unknown" : (getCountryLabel(key) ?? key),
      views: value.views,
      visitors: value.visitors,
      sharePercent: sharePercent(value.views, periodTotals.views),
    }))
    .sort((a, b) => b.views - a.views || a.countryLabel.localeCompare(b.countryLabel));

  const referrerMap = new Map<
    string,
    { views: number; visitors: number; sessions: number; meta: ReturnType<typeof parseReferrerDimension> }
  >();
  for (const row of referrerRows) {
    const parsed = parseReferrerDimension(row.dimensionKey);
    const mapKey = row.dimensionKey;
    const existing = referrerMap.get(mapKey) ?? {
      views: 0,
      visitors: 0,
      sessions: 0,
      meta: parsed,
    };
    existing.views += row.views;
    existing.visitors += row.visitors;
    existing.sessions += row.sessions;
    referrerMap.set(mapKey, existing);
  }

  const referrers = [...referrerMap.values()]
    .map((value) => ({
      label: value.meta.label,
      referrerType: value.meta.referrerType,
      host: value.meta.host,
      views: value.views,
      sessions: value.sessions,
      sharePercent: sharePercent(value.views, periodTotals.views),
    }))
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label));

  const viewsPerSession =
    periodTotals.sessions > 0
      ? Math.round((periodTotals.views / periodTotals.sessions) * 10) / 10
      : null;

  return {
    period: window.period,
    periodLabel: window.periodLabel,
    periodStart: window.startInclusive?.toISOString() ?? collectionStartedAt?.toISOString() ?? null,
    periodEnd: window.endExclusive.toISOString(),
    bucketGranularity: window.bucketGranularity,
    allTime: {
      views: meta?.allTimeViews ?? 0,
      visitors: allTimeVisitors,
      sessions: meta?.allTimeSessions ?? 0,
      collectionStartedAt: collectionStartedAt?.toISOString() ?? null,
    },
    trend,
    comparison,
    geography,
    referrers,
    sessions: {
      totalSessions: periodTotals.sessions,
      viewsPerSession,
      // Session docs share 90d TTL; aggregates do not store duration sums.
      averageDurationSeconds: null,
    },
    periodTotals,
  };
}
