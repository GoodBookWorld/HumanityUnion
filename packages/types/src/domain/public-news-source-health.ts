/**
 * RSS-HEALTH-01 — per-source RSS ingestion telemetry (one record per NEWS_SOURCE
 * MediaResource id, overwritten by each check) and the Admin read model.
 */

/** Why an item read from a feed did not reach article persistence. */
export type PublicNewsRejectionReason =
  | "per_source_cap"
  | "global_cap"
  | "sponsored"
  | "invalid_url"
  | "duplicate"
  | "placeholder_url"
  | "homepage_url"
  | "no_registry_provider"
  | "not_article_url"
  | "outside_retention_window"
  | "missing_title_or_source"
  | "too_short"
  | "url_validation_failed"
  | "normalization_failed";

/** Sanitized failure classes; raw exception text is never stored. */
export type PublicNewsSourceErrorCode =
  | "http_error"
  | "timeout"
  | "network_error"
  | "response_too_large"
  | "blocked_host"
  | "unapproved_feed"
  | "invalid_feed"
  | "unknown_error";

export type PublicNewsSourceCheckOutcome = "success" | "fetch_failed" | "parse_failed";

export interface PublicNewsSourceHealthError {
  code: PublicNewsSourceErrorCode;
  message: string;
  httpStatus: number | null;
}

export interface PublicNewsSourceHealthRecord {
  mediaResourceId: string;
  /** Source name used for the check (the MediaResource name at that time). */
  sourceName: string;
  providerId: string;
  /** Feed hostname only; the full RSS URL is never stored here. */
  feedHost: string | null;
  lastCheckStartedAt: string;
  lastCheckCompletedAt: string;
  lastOutcome: PublicNewsSourceCheckOutcome;
  /** Last check whose fetch and parse both succeeded. */
  lastSuccessAt: string | null;
  lastHttpStatus: number | null;
  lastDurationMs: number;
  /** Items parsed from the feed in the last check (0 when fetch or parse failed). */
  lastParsedCount: number;
  /** Items that passed every rule and were sent to article persistence. */
  lastAcceptedCount: number;
  lastRejectedCount: number;
  lastRejectionReasons: Partial<Record<PublicNewsRejectionReason, number>>;
  /** Distinct `sourceName` values the accepted articles were stored under. */
  lastStoredSourceNames: string[];
  /** Newest publication date among parsed feed items. */
  lastItemPublishedAt: string | null;
  lastError: PublicNewsSourceHealthError | null;
  consecutiveFailures: number;
  updatedAt: string;
}

export type PublicNewsSourceHealthStatus = "healthy" | "stale" | "failing" | "never_checked";

export type PublicNewsSourceHealthStatusReason =
  | "ok"
  | "no_telemetry"
  | "fetch_failed"
  | "parse_failed"
  | "not_checked_recently"
  | "no_public_articles"
  | "feed_not_updating";

export interface AdminNewsSourceHealthItem {
  mediaResourceId: string;
  name: string;
  active: boolean;
  scopeType: "WORLD" | "COUNTRY";
  countryCode: string | null;
  providerId: string | null;
  status: PublicNewsSourceHealthStatus;
  statusReason: PublicNewsSourceHealthStatusReason;
  /** Active, unexpired public articles stored under this exact name (capped). */
  publicArticleCount: number;
  publicArticleCountCapped: boolean;
  lastCheckCompletedAt: string | null;
  lastSuccessAt: string | null;
  lastOutcome: PublicNewsSourceCheckOutcome | null;
  lastHttpStatus: number | null;
  lastDurationMs: number | null;
  lastParsedCount: number | null;
  lastAcceptedCount: number | null;
  lastRejectedCount: number | null;
  lastRejectionReasons: Partial<Record<PublicNewsRejectionReason, number>>;
  lastStoredSourceNames: string[];
  lastItemPublishedAt: string | null;
  lastError: PublicNewsSourceHealthError | null;
  consecutiveFailures: number;
}

export interface AdminNewsSourceHealthListing {
  items: AdminNewsSourceHealthItem[];
  generatedAt: string;
  /** A successful check older than this is "stale" (2 x refresh interval). */
  staleAfterHours: number;
  retentionDays: number;
  publicArticleCountCap: number;
  truncated: boolean;
}
