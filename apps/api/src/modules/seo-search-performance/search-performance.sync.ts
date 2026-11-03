/**
 * SEO-12B.1 — one bounded daily sync per provider.
 *
 * Google: about 7 requests (daily series, 7/28/90-day totals, top queries, top
 * pages, sitemaps). Bing: 4 requests (traffic, queries, pages, crawl stats).
 * A failed run records a redacted error and keeps the previous data.
 */
import { randomUUID } from "node:crypto";

import {
  createBingWebmasterClient,
  type BingKeyedStatsRow,
  type BingWebmasterClient,
} from "./bing-webmaster.client.js";
import {
  createGoogleSearchConsoleClient,
  type GoogleSearchConsoleClient,
} from "./google-search-console.client.js";
import {
  collectSearchPerformanceSecrets,
  SEARCH_PERFORMANCE_MAX_RESPONSE_BYTES,
  SEARCH_PERFORMANCE_REQUEST_TIMEOUT_MS,
  SEARCH_PERFORMANCE_TOP_ROWS,
  type BingWebmasterConfig,
  type GoogleSearchConsoleConfig,
  type SearchPerformanceConfig,
} from "./search-performance.config.js";
import {
  addDays,
  addMonthsToDay,
  compareDays,
  listDays,
  pacificDayKey,
} from "./search-performance.dates.js";
import {
  SearchProviderError,
  type FetchLike,
  type RetryOptions,
} from "./search-performance.http.js";
import { redactSearchPerformanceText } from "./search-performance.redaction.js";
import type { SearchPerformanceStore } from "./search-performance.store.js";
import type {
  BingCrawlDay,
  GooglePeriodTotals,
  SearchDailyMetricRecord,
  SearchPerformancePeriodDays,
  SearchProvider,
  SearchProviderSnapshot,
  SearchSyncStateRecord,
  SearchTopRow,
  SearchTopRowsSnapshot,
} from "./search-performance.types.js";

export const SEARCH_SYNC_LEASE_TTL_MS = 15 * 60_000;
export const SEARCH_SYNC_SUCCESS_INTERVAL_MS = 24 * 60 * 60_000;
export const SEARCH_SYNC_FAILURE_BACKOFF_MS = 6 * 60 * 60_000;
export const SEARCH_SNAPSHOT_RETENTION_MS = 90 * 24 * 60 * 60_000;
export const SEARCH_DAILY_RETENTION_MONTHS = 16;

const GOOGLE_ROUTINE_WINDOW_DAYS = 10;
const GOOGLE_TOP_WINDOW_DAYS = 28;
const BING_TOP_WINDOW_DAYS = 28;
const BING_CRAWL_WINDOW_DAYS = 90;
const GOOGLE_PERIODS: readonly SearchPerformancePeriodDays[] = [7, 28, 90];

export type SearchSyncOutcome =
  | "skipped_disabled"
  | "skipped_not_configured"
  | "skipped_not_due"
  | "skipped_lease_held"
  | "succeeded"
  | "failed";

export interface SearchSyncDeps {
  readonly store: SearchPerformanceStore;
  readonly config: SearchPerformanceConfig;
  readonly holder: string;
  readonly now?: () => Date;
  readonly fetchImpl?: FetchLike;
  readonly retry?: RetryOptions;
  readonly googleClient?: GoogleSearchConsoleClient;
  readonly bingClient?: BingWebmasterClient;
}

interface ProviderSyncResult {
  readonly records: SearchDailyMetricRecord[];
  readonly lastDataDay: string | null;
  readonly snapshot: SearchProviderSnapshot;
}

export function isSearchSyncDue(state: SearchSyncStateRecord | null, now: Date): boolean {
  if (!state) {
    return true;
  }
  const lastSuccess = state.lastSuccessAt ? Date.parse(state.lastSuccessAt) : null;
  const lastFailure = state.lastFailureAt ? Date.parse(state.lastFailureAt) : null;
  if (lastSuccess !== null && now.getTime() - lastSuccess < SEARCH_SYNC_SUCCESS_INTERVAL_MS) {
    return false;
  }
  if (
    lastFailure !== null &&
    (lastSuccess === null || lastFailure > lastSuccess) &&
    now.getTime() - lastFailure < SEARCH_SYNC_FAILURE_BACKOFF_MS
  ) {
    return false;
  }
  return true;
}

function dailyExpiresAt(day: string): Date {
  return new Date(`${addMonthsToDay(day, SEARCH_DAILY_RETENTION_MONTHS)}T00:00:00.000Z`);
}

function snapshotTimes(now: Date): { collectedAt: string; expiresAt: string } {
  return {
    collectedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SEARCH_SNAPSHOT_RETENTION_MS).toISOString(),
  };
}

function maxDay(days: readonly string[]): string | null {
  return days.reduce<string | null>(
    (max, day) => (max === null || compareDays(day, max) > 0 ? day : max),
    null,
  );
}

function minDay(days: readonly string[]): string | null {
  return days.reduce<string | null>(
    (min, day) => (min === null || compareDays(day, min) < 0 ? day : min),
    null,
  );
}

async function syncGoogle(input: {
  readonly client: GoogleSearchConsoleClient;
  readonly config: GoogleSearchConsoleConfig;
  readonly state: SearchSyncStateRecord | null;
  readonly now: Date;
  readonly runId: string;
}): Promise<ProviderSyncResult> {
  const { client, config, now, runId } = input;
  const today = pacificDayKey(now);
  const backfill = !input.state?.lastSuccessAt;
  const startDay = backfill
    ? addDays(addMonthsToDay(today, -SEARCH_DAILY_RETENTION_MONTHS), 1)
    : addDays(today, -(GOOGLE_ROUTINE_WINDOW_DAYS - 1));

  const series = await client.querySearchAnalytics({
    startDate: startDay,
    endDate: today,
    dimensions: ["date"],
    rowLimit: 1000,
    dataState: "all",
  });
  const byDay = new Map(series.rows.map((row) => [row.keys[0]!, row] as const));
  const reportedDays = [...byDay.keys()];
  const firstReported = minDay(reportedDays);
  const lastReported = maxDay(reportedDays);
  const firstIncomplete = series.firstIncompleteDate;
  const collectedAt = now.toISOString();

  // Google omits days without data from a date-grouped query. Between the first
  // and last reported day such a gap is a real zero; outside that range the day
  // stays unavailable (no record).
  const records: SearchDailyMetricRecord[] = [];
  if (firstReported && lastReported) {
    for (const day of listDays(firstReported, lastReported)) {
      const row = byDay.get(day);
      records.push({
        provider: "google",
        siteUrl: config.siteUrl,
        day,
        clicks: row?.clicks ?? 0,
        impressions: row?.impressions ?? 0,
        ctr: row ? row.ctr : null,
        position: row ? row.position : null,
        dataState: firstIncomplete && compareDays(day, firstIncomplete) >= 0 ? "fresh" : "final",
        collectedAt,
        syncRunId: runId,
        expiresAt: dailyExpiresAt(day),
      });
    }
  }

  const lastFinalDay = firstIncomplete ? addDays(firstIncomplete, -1) : lastReported;
  let periodTotals: GooglePeriodTotals[] | null = null;
  let topQueries: SearchTopRowsSnapshot | null = null;
  let topPages: SearchTopRowsSnapshot | null = null;

  if (lastFinalDay && lastReported) {
    periodTotals = [];
    for (const periodDays of GOOGLE_PERIODS) {
      const periodStart = addDays(lastFinalDay, -(periodDays - 1));
      const totals = await client.querySearchAnalytics({
        startDate: periodStart,
        endDate: lastFinalDay,
        dimensions: [],
        rowLimit: 1,
        dataState: "final",
      });
      const row = totals.rows[0];
      if (row) {
        periodTotals.push({
          periodDays,
          startDay: periodStart,
          endDay: lastFinalDay,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        });
      }
    }

    const topStart = addDays(lastFinalDay, -(GOOGLE_TOP_WINDOW_DAYS - 1));
    const toTopRows = (
      rows: Awaited<ReturnType<GoogleSearchConsoleClient["querySearchAnalytics"]>>["rows"],
    ): SearchTopRow[] =>
      rows.slice(0, SEARCH_PERFORMANCE_TOP_ROWS).map((row) => ({
        key: row.keys[0]!,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
    const queries = await client.querySearchAnalytics({
      startDate: topStart,
      endDate: lastFinalDay,
      dimensions: ["query"],
      rowLimit: SEARCH_PERFORMANCE_TOP_ROWS,
      dataState: "final",
    });
    topQueries = {
      dimension: "query",
      startDay: topStart,
      endDay: lastFinalDay,
      rows: toTopRows(queries.rows),
      metricsSource: "provider",
    };
    const pages = await client.querySearchAnalytics({
      startDate: topStart,
      endDate: lastFinalDay,
      dimensions: ["page"],
      rowLimit: SEARCH_PERFORMANCE_TOP_ROWS,
      dataState: "final",
    });
    topPages = {
      dimension: "page",
      startDay: topStart,
      endDay: lastFinalDay,
      rows: toTopRows(pages.rows),
      metricsSource: "provider",
    };
  }

  const sitemaps = await client.listSitemaps();

  return {
    records,
    lastDataDay: lastReported,
    snapshot: {
      ...snapshotTimes(now),
      topQueries,
      topPages,
      googlePeriodTotals: periodTotals,
      googleSitemaps: sitemaps,
      bingCrawl: null,
    },
  };
}

function aggregateBingRows(
  rows: readonly BingKeyedStatsRow[],
  dimension: "query" | "page",
): SearchTopRowsSnapshot | null {
  const endDay = maxDay(rows.map((row) => row.day));
  if (!endDay) {
    return null;
  }
  const startDay = addDays(endDay, -(BING_TOP_WINDOW_DAYS - 1));
  const totals = new Map<
    string,
    { clicks: number; impressions: number; weighted: number; weight: number }
  >();
  for (const row of rows) {
    if (compareDays(row.day, startDay) < 0 || compareDays(row.day, endDay) > 0) {
      continue;
    }
    const entry = totals.get(row.key) ?? { clicks: 0, impressions: 0, weighted: 0, weight: 0 };
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    if (row.avgImpressionPosition !== null && row.impressions > 0) {
      entry.weighted += row.avgImpressionPosition * row.impressions;
      entry.weight += row.impressions;
    }
    totals.set(row.key, entry);
  }
  const topRows: SearchTopRow[] = [...totals.entries()]
    .map(([key, entry]) => ({
      key,
      clicks: entry.clicks,
      impressions: entry.impressions,
      ctr: entry.impressions > 0 ? entry.clicks / entry.impressions : null,
      position: entry.weight > 0 ? entry.weighted / entry.weight : null,
    }))
    .sort(
      (a, b) => b.clicks - a.clicks || b.impressions - a.impressions || (a.key < b.key ? -1 : 1),
    )
    .slice(0, SEARCH_PERFORMANCE_TOP_ROWS);
  return {
    dimension,
    startDay,
    endDay,
    rows: topRows,
    metricsSource: "impression_weighted_from_provider_rows",
  };
}

async function syncBing(input: {
  readonly client: BingWebmasterClient;
  readonly config: BingWebmasterConfig;
  readonly now: Date;
  readonly runId: string;
}): Promise<ProviderSyncResult> {
  const { client, config, now, runId } = input;
  const traffic = await client.getRankAndTrafficStats();
  const queries = await client.getQueryStats();
  const pages = await client.getPageStats();
  const crawl = await client.getCrawlStats();
  const collectedAt = now.toISOString();

  // Bing does not document gap semantics, so only days it reports are stored.
  const byDay = new Map(traffic.map((row) => [row.day, row] as const));
  const records: SearchDailyMetricRecord[] = [...byDay.values()].map((row) => ({
    provider: "bing",
    siteUrl: config.siteUrl,
    day: row.day,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: null,
    position: null,
    dataState: "reported",
    collectedAt,
    syncRunId: runId,
    expiresAt: dailyExpiresAt(row.day),
  }));

  const crawlEnd = maxDay(crawl.map((row) => row.day));
  const crawlByDay = new Map(crawl.map((row) => [row.day, row] as const));
  const bingCrawl: BingCrawlDay[] = crawlEnd
    ? [...crawlByDay.values()]
        .filter(
          (row) => compareDays(row.day, addDays(crawlEnd, -(BING_CRAWL_WINDOW_DAYS - 1))) >= 0,
        )
        .sort((a, b) => compareDays(a.day, b.day))
    : [];

  return {
    records,
    lastDataDay: maxDay([...byDay.keys()]),
    snapshot: {
      ...snapshotTimes(now),
      topQueries: aggregateBingRows(queries, "query"),
      topPages: aggregateBingRows(pages, "page"),
      googlePeriodTotals: null,
      googleSitemaps: null,
      bingCrawl,
    },
  };
}

function toStoredError(error: unknown, secrets: readonly string[]) {
  if (error instanceof SearchProviderError) {
    return { code: error.code, message: redactSearchPerformanceText(error.message, secrets) };
  }
  return {
    code: "provider_unavailable" as const,
    message: "Search performance sync failed unexpectedly.",
  };
}

/** Runs one provider sync when enabled, configured, due, and the lease is free. */
export async function runSearchProviderSync(
  provider: SearchProvider,
  deps: SearchSyncDeps,
): Promise<SearchSyncOutcome> {
  const now = deps.now ?? (() => new Date());
  if (!deps.config.syncEnabled) {
    return "skipped_disabled";
  }
  const resolution = deps.config[provider];
  if (!resolution.configured) {
    return "skipped_not_configured";
  }
  const state = await deps.store.getSyncState(provider);
  if (!isSearchSyncDue(state, now())) {
    return "skipped_not_due";
  }
  if (!(await deps.store.acquireLease(provider, deps.holder, now(), SEARCH_SYNC_LEASE_TTL_MS))) {
    return "skipped_lease_held";
  }

  const runId = `search-sync-${provider}-${randomUUID()}`;
  const secrets = collectSearchPerformanceSecrets(deps.config);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clientDeps = {
    fetchImpl,
    now,
    timeoutMs: SEARCH_PERFORMANCE_REQUEST_TIMEOUT_MS,
    maxBytes: SEARCH_PERFORMANCE_MAX_RESPONSE_BYTES,
    retry: deps.retry,
  };
  try {
    await deps.store.recordSyncAttempt(provider, deps.holder, now());
    let result: ProviderSyncResult;
    if (provider === "google" && deps.config.google.configured) {
      const client =
        deps.googleClient ?? createGoogleSearchConsoleClient(deps.config.google.config, clientDeps);
      result = await syncGoogle({
        client,
        config: deps.config.google.config,
        state,
        now: now(),
        runId,
      });
    } else if (provider === "bing" && deps.config.bing.configured) {
      const client =
        deps.bingClient ?? createBingWebmasterClient(deps.config.bing.config, clientDeps);
      result = await syncBing({ client, config: deps.config.bing.config, now: now(), runId });
    } else {
      return "skipped_not_configured";
    }

    const latest = await deps.store.getSyncState(provider);
    if (latest?.lease?.holder !== deps.holder) {
      return "skipped_lease_held";
    }
    await deps.store.upsertDailyMetrics(result.records);
    const recorded = await deps.store.recordSyncSuccess(provider, deps.holder, {
      siteUrl: resolution.config.siteUrl,
      at: now(),
      runId,
      lastDataDay: result.lastDataDay,
      snapshot: result.snapshot,
    });
    return recorded ? "succeeded" : "skipped_lease_held";
  } catch (error) {
    const recorded = await deps.store.recordSyncFailure(provider, deps.holder, {
      siteUrl: resolution.config.siteUrl,
      at: now(),
      runId,
      error: toStoredError(error, secrets),
    });
    return recorded ? "failed" : "skipped_lease_held";
  } finally {
    await deps.store.releaseLease(provider, deps.holder).catch(() => undefined);
  }
}
