/**
 * Pack 11C — first-party platform traffic analytics (Admin Views → Traffic).
 *
 * VIEW: one accepted human-facing page navigation (not React remount / API / assets).
 * VISITOR: opaque first-party analytics id (hu_traffic_vid) — not Participant / Public Choice visitorKey.
 * SESSION: views from one visitor within 30 minutes of inactivity (hu_traffic_sid).
 *
 * Storage: UTC. Raw events retained 90 days via expireAt TTL.
 */

export type TrafficPeriod = "today" | "7d" | "30d";

export type TrafficInsightsPeriod = "30d" | "90d" | "12m" | "all";

export type TrafficReferrerType = "DIRECT" | "INTERNAL" | "EXTERNAL";

export interface TrafficAdminSummary {
  period: TrafficPeriod;
  periodLabel: string;
  /** Inclusive UTC period start (ISO-8601). */
  periodStart: string;
  /** Exclusive UTC period end (ISO-8601). */
  periodEnd: string;
  views: number;
  visitors: number;
  sessions: number;
}

export interface TrafficTopPageRow {
  path: string;
  views: number;
  visitors: number;
  sharePercent: number;
}

export interface TrafficReferrerRow {
  label: string;
  referrerType: TrafficReferrerType;
  host: string | null;
  views: number;
  sharePercent: number;
}

export interface TrafficGeographyRow {
  countryCode: string | null;
  countryLabel: string;
  views: number;
  visitors: number;
}

export interface TrafficAdminReport {
  summary: TrafficAdminSummary;
  topPages: TrafficTopPageRow[];
  referrers: TrafficReferrerRow[];
  geography: TrafficGeographyRow[];
}

/** Public ingest body — client may only supply navigation hints. */
export interface TrafficPageviewIngestRequest {
  pathname: string;
  /** document.referrer when available; server classifies. */
  referrer?: string;
  /**
   * Client navigation token for dedupe (Strict Mode / remount).
   * Opaque; max 64 chars.
   */
  navigationId?: string;
}

export interface TrafficTrendPoint {
  /** Bucket start (ISO date YYYY-MM-DD or month YYYY-MM). */
  bucket: string;
  label: string;
  views: number;
  visitors: number;
  sessions: number;
}

export interface TrafficPeriodComparison {
  previousViews: number;
  previousVisitors: number;
  previousSessions: number;
  viewsChangePercent: number | null;
  visitorsChangePercent: number | null;
  sessionsChangePercent: number | null;
  /** When previous was 0 and current > 0. */
  viewsIsNew: boolean;
  visitorsIsNew: boolean;
  sessionsIsNew: boolean;
}

export interface TrafficInsightsAllTime {
  views: number;
  /**
   * Exact unique analytics visitors since collection began
   * (opaque registry count — not sum of daily uniques).
   */
  visitors: number;
  sessions: number;
  /** ISO timestamp when first accepted traffic event was recorded. */
  collectionStartedAt: string | null;
}

export interface TrafficInsightsSessionsPanel {
  totalSessions: number;
  viewsPerSession: number | null;
  /** Omitted when duration cannot be derived from long-lived aggregates. */
  averageDurationSeconds: number | null;
}

export interface TrafficInsightsGeographyRow {
  countryCode: string | null;
  countryLabel: string;
  views: number;
  visitors: number;
  sharePercent: number;
}

export interface TrafficInsightsReferrerRow {
  label: string;
  referrerType: TrafficReferrerType;
  host: string | null;
  views: number;
  sessions: number;
  sharePercent: number;
}

export interface TrafficInsightsReport {
  period: TrafficInsightsPeriod;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string;
  bucketGranularity: "day" | "month";
  allTime: TrafficInsightsAllTime;
  trend: TrafficTrendPoint[];
  comparison: TrafficPeriodComparison | null;
  geography: TrafficInsightsGeographyRow[];
  referrers: TrafficInsightsReferrerRow[];
  sessions: TrafficInsightsSessionsPanel;
  periodTotals: {
    views: number;
    visitors: number;
    sessions: number;
  };
}
