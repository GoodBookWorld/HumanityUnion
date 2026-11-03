/**
 * SEO-12B.2 — Admin view model for GET /api/v1/admin/seo/search-performance (SEO-12B.1).
 *
 * Google and Bing figures stay separate. `null` from the API means the provider
 * did not supply a value; it is shown as "No data", never as zero.
 */

export const SEARCH_PERFORMANCE_PROVIDERS = ["google", "bing"] as const;
export type SearchPerformanceProvider = (typeof SEARCH_PERFORMANCE_PROVIDERS)[number];

export const SEARCH_PERFORMANCE_PERIOD_OPTIONS = [
  { id: "7d", label: "7 days" },
  { id: "28d", label: "28 days" },
  { id: "90d", label: "90 days" },
] as const;
export type SearchPerformancePeriod = (typeof SEARCH_PERFORMANCE_PERIOD_OPTIONS)[number]["id"];

export type SearchProviderStatus = "not_configured" | "never_synced" | "fresh" | "stale" | "error";

export interface SearchSeriesPoint {
  readonly day: string;
  readonly clicks: number | null;
  readonly impressions: number | null;
  readonly ctr: number | null;
  readonly position: number | null;
  readonly dataState: "final" | "fresh" | "reported" | null;
}

export interface SearchWindowSummary {
  readonly startDay: string;
  readonly endDay: string;
  readonly expectedDays: number;
  readonly availableDays: number;
  readonly clicks: number | null;
  readonly impressions: number | null;
  readonly ctr: number | null;
}

export interface GooglePeriodTotals {
  readonly periodDays: number;
  readonly startDay: string;
  readonly endDay: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number | null;
  readonly position: number | null;
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
  readonly metricsSource: "provider" | "impression_weighted_from_provider_rows";
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

export interface SearchSyncError {
  readonly code: string;
  readonly message: string;
  readonly at: string;
}

export interface AdminSearchProviderView {
  readonly provider: SearchPerformanceProvider;
  readonly configured: boolean;
  readonly configurationIssues: readonly string[];
  readonly siteUrl: string | null;
  readonly status: SearchProviderStatus;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastError: SearchSyncError | null;
  readonly dataThrough: string | null;
  readonly current: SearchWindowSummary | null;
  readonly previous: SearchWindowSummary | null;
  readonly providerPeriodTotals: GooglePeriodTotals | null;
  readonly series: readonly SearchSeriesPoint[];
  readonly snapshotCollectedAt: string | null;
  readonly topQueries: SearchTopRowsSnapshot | null;
  readonly topPages: SearchTopRowsSnapshot | null;
  readonly googleSitemaps: readonly GoogleSitemapStatus[] | null;
  readonly bingCrawl: readonly BingCrawlDay[] | null;
  readonly unavailableMetrics: readonly string[];
}

export interface AdminSearchPerformanceResponse {
  readonly period: SearchPerformancePeriod;
  readonly generatedAt: string;
  readonly syncEnabled: boolean;
  readonly providers: Readonly<Record<SearchPerformanceProvider, AdminSearchProviderView>>;
}

export const SEARCH_PROVIDER_LABELS: Record<SearchPerformanceProvider, string> = {
  google: "Google Search Console",
  bing: "Bing Webmaster Tools",
};

export const SEARCH_PROVIDER_SHORT_LABELS: Record<SearchPerformanceProvider, string> = {
  google: "Google",
  bing: "Bing",
};

export const SEARCH_STATUS_LABELS: Record<SearchProviderStatus, string> = {
  not_configured: "Not configured",
  never_synced: "Never synced",
  fresh: "Fresh",
  stale: "Stale",
  error: "Error",
};

/** Reuses the SEO diagnostics badge palette. */
export const SEARCH_STATUS_BADGE: Record<SearchProviderStatus, string> = {
  not_configured: "not_applicable",
  never_synced: "deferred",
  fresh: "healthy",
  stale: "warning",
  error: "missing",
};

const UNSUPPORTED_METRIC_LABELS: Record<string, string> = {
  site_indexed_page_count: "Site-wide indexed page count — Google offers no API for it",
  sitemap_indexed_url_count: "Indexed URLs per sitemap — deprecated by Google",
  daily_ctr: "Daily CTR — Bing reports daily clicks and impressions only",
  daily_average_position: "Daily average position — not reported by Bing",
  site_average_position:
    "Site-wide average position — Bing reports position per query and page only",
};

export function describeUnsupportedMetric(code: string): string {
  return UNSUPPORTED_METRIC_LABELS[code] ?? code.replace(/_/g, " ");
}

const numberFormatter = new Intl.NumberFormat("en-US");
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const NO_DATA_LABEL = "No data";

export function formatSearchCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? numberFormatter.format(value)
    : NO_DATA_LABEL;
}

export function formatSearchCtr(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return NO_DATA_LABEL;
  }
  const percent = value * 100;
  return `${percent.toFixed(percent > 0 && percent < 10 ? 2 : 1).replace(/\.?0+$/, "")}%`;
}

export function formatSearchPosition(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : NO_DATA_LABEL;
}

export function formatSearchDay(day: string | null | undefined): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NO_DATA_LABEL;
  }
  return dayFormatter.format(new Date(`${day}T00:00:00.000Z`));
}

export function formatSearchShortDay(day: string): string {
  return shortDayFormatter.format(new Date(`${day}T00:00:00.000Z`));
}

export function formatSearchDateTime(value: string | null | undefined): string {
  if (!value || Number.isNaN(Date.parse(value))) {
    return NO_DATA_LABEL;
  }
  return dateTimeFormatter.format(new Date(value));
}

export function formatSearchDayRange(startDay: string, endDay: string): string {
  return `${formatSearchDay(startDay)} – ${formatSearchDay(endDay)}`;
}

export interface SearchProviderStatusDescription {
  readonly label: string;
  readonly badge: string;
  readonly message: string;
}

export function describeSearchProviderStatus(
  view: AdminSearchProviderView,
  syncEnabled: boolean,
): SearchProviderStatusDescription {
  const label = SEARCH_STATUS_LABELS[view.status];
  const badge = SEARCH_STATUS_BADGE[view.status];
  switch (view.status) {
    case "not_configured":
      return {
        label,
        badge,
        message: "Credentials for this provider are not set on the API service.",
      };
    case "never_synced":
      return {
        label,
        badge,
        message: syncEnabled
          ? "Configured. Waiting for the first daily sync."
          : "Configured, but the daily sync is turned off (SEO_SEARCH_SYNC_ENABLED).",
      };
    case "fresh":
      return {
        label,
        badge,
        message: `Last synced ${formatSearchDateTime(view.lastSuccessAt)}.`,
      };
    case "stale":
      return {
        label,
        badge,
        message: `Last successful sync ${formatSearchDateTime(view.lastSuccessAt)} is more than 36 hours old.`,
      };
    case "error":
      return {
        label,
        badge,
        message: `The last sync failed${view.lastError ? ` (${view.lastError.message})` : ""}.${
          view.dataThrough ? " Showing the last good data." : ""
        }`,
      };
  }
}

export interface SearchProviderKpis {
  readonly startDay: string;
  readonly endDay: string;
  /** `provider`: Google's own totals for finalized days. `daily`: sum of stored daily values. */
  readonly source: "provider" | "daily";
  readonly clicks: number | null;
  readonly impressions: number | null;
  readonly ctr: number | null;
  readonly ctrSource: "provider" | "calculated" | null;
  readonly position: number | null;
  readonly positionNote: string | null;
  readonly availableDays: number | null;
  readonly expectedDays: number | null;
}

export function hasSearchData(view: AdminSearchProviderView): boolean {
  return Boolean(view.providerPeriodTotals) || (view.current?.availableDays ?? 0) > 0;
}

export function buildSearchProviderKpis(view: AdminSearchProviderView): SearchProviderKpis | null {
  const totals = view.providerPeriodTotals;
  if (view.provider === "google" && totals) {
    return {
      startDay: totals.startDay,
      endDay: totals.endDay,
      source: "provider",
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.ctr,
      ctrSource: totals.ctr === null ? null : "provider",
      position: totals.position,
      positionNote: totals.position === null ? "Not reported for this period" : null,
      availableDays: null,
      expectedDays: null,
    };
  }
  const current = view.current;
  if (!current || current.availableDays === 0) {
    return null;
  }
  return {
    startDay: current.startDay,
    endDay: current.endDay,
    source: "daily",
    clicks: current.clicks,
    impressions: current.impressions,
    ctr: current.ctr,
    ctrSource: current.ctr === null ? null : "calculated",
    position: null,
    positionNote:
      view.provider === "bing"
        ? "Not provided by Bing for the whole site"
        : "Not available until Google period totals are collected",
    availableDays: current.availableDays,
    expectedDays: current.expectedDays,
  };
}

export interface SearchTrendPoint {
  readonly day: string;
  readonly label: string;
  readonly value: number | null;
}

export function buildSearchTrendPoints(
  series: readonly SearchSeriesPoint[],
  metric: "clicks" | "impressions",
): SearchTrendPoint[] {
  return series.map((point) => ({
    day: point.day,
    label: formatSearchShortDay(point.day),
    value: point[metric],
  }));
}

export function latestBingCrawlDay(view: AdminSearchProviderView): BingCrawlDay | null {
  const days = view.bingCrawl ?? [];
  return days.length > 0 ? days[days.length - 1]! : null;
}

export interface SearchVisibilityProviderSummary {
  readonly provider: SearchPerformanceProvider;
  readonly label: string;
  readonly status: SearchProviderStatusDescription;
  readonly kpis: SearchProviderKpis | null;
}

export interface SearchVisibilitySummary {
  readonly anyData: boolean;
  readonly providers: readonly SearchVisibilityProviderSummary[];
}

export function summarizeSearchVisibility(
  response: AdminSearchPerformanceResponse,
): SearchVisibilitySummary {
  const providers = SEARCH_PERFORMANCE_PROVIDERS.map((provider) => {
    const view = response.providers[provider];
    return {
      provider,
      label: SEARCH_PROVIDER_SHORT_LABELS[provider],
      status: describeSearchProviderStatus(view, response.syncEnabled),
      kpis: hasSearchData(view) ? buildSearchProviderKpis(view) : null,
    };
  });
  return { anyData: providers.some((provider) => provider.kpis !== null), providers };
}
