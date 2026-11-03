/**
 * SEO-12B.1 — Google Search Console and Bing Webmaster search performance.
 *
 * Every figure here comes from a provider response. `null` means the provider
 * did not supply the value (or it has not been collected); `0` is a reported zero.
 */

export const SEARCH_PROVIDERS = ["google", "bing"] as const;
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number];

export type SearchProviderErrorCode =
  | "not_configured"
  | "auth_failed"
  | "permission_denied"
  | "rate_limited"
  | "provider_unavailable"
  | "request_rejected"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "response_too_large";

/**
 * `final` / `fresh` follow Google's dataState (fresh = may still change).
 * `reported` is a Bing daily value (Bing does not label finality).
 */
export type SearchMetricDataState = "final" | "fresh" | "reported";

export interface SearchDailyMetricRecord {
  readonly provider: SearchProvider;
  readonly siteUrl: string;
  /** Provider reporting day, YYYY-MM-DD (Google: Pacific time; Bing: offset in its date). */
  readonly day: string;
  readonly clicks: number;
  readonly impressions: number;
  /** Provider-reported CTR (0–1); null when the provider does not report it. */
  readonly ctr: number | null;
  /** Provider-reported average position; null when not reported. */
  readonly position: number | null;
  readonly dataState: SearchMetricDataState;
  readonly collectedAt: string;
  readonly syncRunId: string;
  /** TTL — daily metrics are kept for up to 16 months. */
  readonly expiresAt: Date;
}

export interface SearchTopRow {
  readonly key: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number | null;
  readonly position: number | null;
}

export interface SearchTopRowsSnapshot {
  readonly dimension: "query" | "page";
  readonly startDay: string;
  readonly endDay: string;
  readonly rows: readonly SearchTopRow[];
  /**
   * `provider`: Google returned CTR and position for the window.
   * `impression_weighted_from_provider_rows`: Bing rows were combined over the
   * window; CTR = clicks / impressions, position = impression-weighted average.
   */
  readonly metricsSource: "provider" | "impression_weighted_from_provider_rows";
}

export interface GooglePeriodTotals {
  readonly periodDays: SearchPerformancePeriodDays;
  readonly startDay: string;
  readonly endDay: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number | null;
  readonly position: number | null;
}

export interface GoogleSitemapStatus {
  readonly path: string;
  readonly type: string | null;
  readonly isSitemapsIndex: boolean;
  readonly isPending: boolean;
  readonly lastSubmitted: string | null;
  readonly lastDownloaded: string | null;
  readonly errors: number | null;
  readonly warnings: number | null;
  /** URLs submitted in the sitemap. Google's `indexed` count is deprecated and never read. */
  readonly submittedUrls: number | null;
}

export interface BingCrawlDay {
  readonly day: string;
  readonly inIndex: number | null;
  readonly crawledPages: number | null;
  readonly crawlErrors: number | null;
  readonly blockedByRobotsTxt: number | null;
  readonly code4xx: number | null;
  readonly code5xx: number | null;
}

export interface SearchProviderSnapshot {
  readonly collectedAt: string;
  /** Query/page snapshots are kept for 90 days. */
  readonly expiresAt: string;
  readonly topQueries: SearchTopRowsSnapshot | null;
  readonly topPages: SearchTopRowsSnapshot | null;
  readonly googlePeriodTotals: readonly GooglePeriodTotals[] | null;
  readonly googleSitemaps: readonly GoogleSitemapStatus[] | null;
  readonly bingCrawl: readonly BingCrawlDay[] | null;
}

export interface SearchSyncLease {
  readonly holder: string;
  readonly acquiredAt: Date;
  readonly expiresAt: Date;
}

export interface SearchSyncError {
  readonly code: SearchProviderErrorCode;
  readonly message: string;
  readonly at: string;
}

export interface SearchSyncStateRecord {
  readonly provider: SearchProvider;
  readonly siteUrl: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly lastError: SearchSyncError | null;
  readonly consecutiveFailures: number;
  readonly lastDataDay: string | null;
  readonly lastRunId: string | null;
  readonly snapshot: SearchProviderSnapshot | null;
  readonly lease: SearchSyncLease | null;
  readonly updatedAt: string;
}

export const SEARCH_PERFORMANCE_PERIODS = ["7d", "28d", "90d"] as const;
export type SearchPerformancePeriod = (typeof SEARCH_PERFORMANCE_PERIODS)[number];
export type SearchPerformancePeriodDays = 7 | 28 | 90;

export const SEARCH_PERFORMANCE_PERIOD_DAYS: Record<
  SearchPerformancePeriod,
  SearchPerformancePeriodDays
> = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
};
