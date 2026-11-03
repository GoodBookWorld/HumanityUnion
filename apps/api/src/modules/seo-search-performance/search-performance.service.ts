/**
 * SEO-12B.1 — Admin read model for search performance. Reads stored data only;
 * never calls Google or Bing and never returns credentials.
 */
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import {
  resolveSearchPerformanceConfig,
  type SearchPerformanceConfig,
} from "./search-performance.config.js";
import { addDays, listDays } from "./search-performance.dates.js";
import {
  getSearchPerformanceStore,
  type SearchPerformanceStore,
} from "./search-performance.store.js";
import {
  SEARCH_PERFORMANCE_PERIOD_DAYS,
  SEARCH_PERFORMANCE_PERIODS,
  SEARCH_PROVIDERS,
  type BingCrawlDay,
  type GooglePeriodTotals,
  type GoogleSitemapStatus,
  type SearchDailyMetricRecord,
  type SearchMetricDataState,
  type SearchPerformancePeriod,
  type SearchProvider,
  type SearchSyncError,
  type SearchTopRowsSnapshot,
} from "./search-performance.types.js";

export const SEARCH_DATA_STALE_AFTER_MS = 36 * 60 * 60_000;

export type SearchProviderStatus = "not_configured" | "never_synced" | "fresh" | "stale" | "error";

export interface SearchSeriesPoint {
  readonly day: string;
  /** null = no provider value for this day (unavailable); 0 = reported zero. */
  readonly clicks: number | null;
  readonly impressions: number | null;
  readonly ctr: number | null;
  readonly position: number | null;
  readonly dataState: SearchMetricDataState | null;
}

export interface SearchWindowSummary {
  readonly startDay: string;
  readonly endDay: string;
  readonly expectedDays: number;
  readonly availableDays: number;
  /** Sums over available days; null when no day in the window is available. */
  readonly clicks: number | null;
  readonly impressions: number | null;
  /** clicks / impressions over the window; null when impressions are 0 or unavailable. */
  readonly ctr: number | null;
}

export interface AdminSearchProviderView {
  readonly provider: SearchProvider;
  readonly configured: boolean;
  /** Names of missing or invalid environment variables; never values. */
  readonly configurationIssues: readonly string[];
  readonly siteUrl: string | null;
  readonly status: SearchProviderStatus;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastError: SearchSyncError | null;
  readonly dataThrough: string | null;
  readonly current: SearchWindowSummary | null;
  readonly previous: SearchWindowSummary | null;
  /** Google's own totals for the period (exact CTR and average position); Google only. */
  readonly providerPeriodTotals: GooglePeriodTotals | null;
  readonly series: readonly SearchSeriesPoint[];
  readonly snapshotCollectedAt: string | null;
  readonly topQueries: SearchTopRowsSnapshot | null;
  readonly topPages: SearchTopRowsSnapshot | null;
  readonly googleSitemaps: readonly GoogleSitemapStatus[] | null;
  readonly bingCrawl: readonly BingCrawlDay[] | null;
  /** What this provider's API does not supply, so the UI never implies it. */
  readonly unavailableMetrics: readonly string[];
}

export interface AdminSearchPerformanceResponse {
  readonly period: SearchPerformancePeriod;
  readonly generatedAt: string;
  readonly syncEnabled: boolean;
  readonly providers: Readonly<Record<SearchProvider, AdminSearchProviderView>>;
}

const UNAVAILABLE_METRICS: Record<SearchProvider, readonly string[]> = {
  google: ["site_indexed_page_count", "sitemap_indexed_url_count"],
  bing: ["daily_ctr", "daily_average_position", "site_average_position"],
};

async function assertActiveAdmin(userId: string): Promise<void> {
  if (!userId?.trim()) {
    throw new AdministrationUnauthorizedError();
  }
  const user = await findAuthUserById(userId);
  if (!user || user.status !== "active") {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}

export function parseSearchPerformancePeriod(raw: unknown): SearchPerformancePeriod {
  if (raw === undefined || raw === null || raw === "") {
    return "28d";
  }
  if (typeof raw === "string" && (SEARCH_PERFORMANCE_PERIODS as readonly string[]).includes(raw)) {
    return raw as SearchPerformancePeriod;
  }
  throw new AdministrationValidationError("period must be one of 7d, 28d, 90d.");
}

function summarize(
  rows: ReadonlyMap<string, SearchDailyMetricRecord>,
  startDay: string,
  endDay: string,
): SearchWindowSummary {
  const days = listDays(startDay, endDay);
  let clicks = 0;
  let impressions = 0;
  let availableDays = 0;
  for (const day of days) {
    const row = rows.get(day);
    if (row) {
      availableDays += 1;
      clicks += row.clicks;
      impressions += row.impressions;
    }
  }
  const available = availableDays > 0;
  return {
    startDay,
    endDay,
    expectedDays: days.length,
    availableDays,
    clicks: available ? clicks : null,
    impressions: available ? impressions : null,
    ctr: available && impressions > 0 ? clicks / impressions : null,
  };
}

function resolveStatus(
  configured: boolean,
  state: { lastSuccessAt: string | null; lastFailureAt: string | null } | null,
  now: Date,
): SearchProviderStatus {
  if (!configured) {
    return "not_configured";
  }
  const lastSuccess = state?.lastSuccessAt ? Date.parse(state.lastSuccessAt) : null;
  const lastFailure = state?.lastFailureAt ? Date.parse(state.lastFailureAt) : null;
  if (lastFailure !== null && (lastSuccess === null || lastFailure > lastSuccess)) {
    return "error";
  }
  if (lastSuccess === null) {
    return "never_synced";
  }
  return now.getTime() - lastSuccess > SEARCH_DATA_STALE_AFTER_MS ? "stale" : "fresh";
}

async function buildProviderView(input: {
  provider: SearchProvider;
  config: SearchPerformanceConfig;
  store: SearchPerformanceStore;
  period: SearchPerformancePeriod;
  now: Date;
}): Promise<AdminSearchProviderView> {
  const { provider, config, store, period, now } = input;
  const resolution = config[provider];
  const siteUrl = resolution.configured ? resolution.config.siteUrl : null;
  const state = await store.getSyncState(provider);
  // Data collected for a different property (site URL changed) is not shown.
  const sameSite = Boolean(siteUrl && state?.siteUrl === siteUrl);
  const dataThrough = sameSite ? (state?.lastDataDay ?? null) : null;
  const snapshot =
    sameSite && state?.snapshot && Date.parse(state.snapshot.expiresAt) > now.getTime()
      ? state.snapshot
      : null;

  let current: SearchWindowSummary | null = null;
  let previous: SearchWindowSummary | null = null;
  let series: SearchSeriesPoint[] = [];
  if (siteUrl && dataThrough) {
    const days = SEARCH_PERFORMANCE_PERIOD_DAYS[period];
    const startDay = addDays(dataThrough, -(days - 1));
    const previousEnd = addDays(startDay, -1);
    const previousStart = addDays(previousEnd, -(days - 1));
    const rows = await store.listDailyMetrics({
      provider,
      siteUrl,
      fromDay: previousStart,
      toDay: dataThrough,
    });
    const byDay = new Map(rows.map((row) => [row.day, row] as const));
    current = summarize(byDay, startDay, dataThrough);
    previous = summarize(byDay, previousStart, previousEnd);
    series = listDays(startDay, dataThrough).map((day) => {
      const row = byDay.get(day);
      return row
        ? {
            day,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            dataState: row.dataState,
          }
        : { day, clicks: null, impressions: null, ctr: null, position: null, dataState: null };
    });
  }

  const periodDays = SEARCH_PERFORMANCE_PERIOD_DAYS[period];
  return {
    provider,
    configured: resolution.configured,
    configurationIssues: resolution.issues,
    siteUrl,
    status: resolveStatus(resolution.configured, sameSite ? state : null, now),
    lastAttemptAt: sameSite ? (state?.lastAttemptAt ?? null) : null,
    lastSuccessAt: sameSite ? (state?.lastSuccessAt ?? null) : null,
    lastError: sameSite ? (state?.lastError ?? null) : null,
    dataThrough,
    current,
    previous,
    providerPeriodTotals:
      snapshot?.googlePeriodTotals?.find((totals) => totals.periodDays === periodDays) ?? null,
    series,
    snapshotCollectedAt: snapshot?.collectedAt ?? null,
    topQueries: snapshot?.topQueries ?? null,
    topPages: snapshot?.topPages ?? null,
    googleSitemaps: snapshot?.googleSitemaps ?? null,
    bingCrawl: snapshot?.bingCrawl ?? null,
    unavailableMetrics: UNAVAILABLE_METRICS[provider],
  };
}

export async function getAdminSearchPerformance(input: {
  actorUserId: string;
  period?: unknown;
  now?: Date;
  config?: SearchPerformanceConfig;
  store?: SearchPerformanceStore;
}): Promise<AdminSearchPerformanceResponse> {
  await assertActiveAdmin(input.actorUserId);
  const period = parseSearchPerformancePeriod(input.period);
  const now = input.now ?? new Date();
  const config = input.config ?? resolveSearchPerformanceConfig();
  const store = input.store ?? getSearchPerformanceStore();

  const views = await Promise.all(
    SEARCH_PROVIDERS.map((provider) => buildProviderView({ provider, config, store, period, now })),
  );
  return {
    period,
    generatedAt: now.toISOString(),
    syncEnabled: config.syncEnabled,
    providers: { google: views[0]!, bing: views[1]! },
  };
}
