/**
 * RSS-HEALTH-01 — per-source ingestion telemetry collected during the existing
 * refresh, plus the Admin health status rules. Observes outcomes only: nothing here
 * changes which feeds are fetched or which articles are kept.
 */

import type {
  ApprovedNewsSource,
  PublicNewsRejectionReason,
  PublicNewsSourceCheckOutcome,
  PublicNewsSourceHealthError,
  PublicNewsSourceHealthRecord,
  PublicNewsSourceHealthStatus,
  PublicNewsSourceHealthStatusReason,
} from "@hu/types";

import { ExternalFetchPolicyError, ExternalRequestError } from "./public-news.fetch.js";

/** One source's result for a single refresh, before merging with stored history. */
export interface PublicNewsSourceCheck {
  readonly mediaResourceId: string;
  readonly sourceName: string;
  readonly providerId: string;
  readonly feedHost: string | null;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outcome: PublicNewsSourceCheckOutcome;
  readonly httpStatus: number | null;
  readonly durationMs: number;
  readonly parsedCount: number;
  readonly acceptedCount: number;
  readonly rejectionReasons: Partial<Record<PublicNewsRejectionReason, number>>;
  readonly storedSourceNames: readonly string[];
  readonly newestItemAt: string | null;
  readonly error: PublicNewsSourceHealthError | null;
}

interface MutableCheck {
  mediaResourceId: string;
  sourceName: string;
  providerId: string;
  feedHost: string | null;
  startedAt: string;
  outcome: PublicNewsSourceCheckOutcome;
  httpStatus: number | null;
  durationMs: number;
  parsedCount: number;
  acceptedCount: number;
  rejectionReasons: Partial<Record<PublicNewsRejectionReason, number>>;
  storedSourceNames: Set<string>;
  newestItemAt: string | null;
  error: PublicNewsSourceHealthError | null;
}

function feedHostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

const INVALID_FEED: PublicNewsSourceHealthError = {
  code: "invalid_feed",
  message: "The feed contained no readable RSS or Atom items.",
  httpStatus: null,
};

export const UNAPPROVED_FEED_ERROR: PublicNewsSourceHealthError = {
  code: "unapproved_feed",
  message: "The feed URL is not approved for ingestion.",
  httpStatus: null,
};

const FETCH_POLICY_ERRORS: Record<ExternalFetchPolicyError["code"], PublicNewsSourceHealthError> = {
  blocked_host: {
    code: "blocked_host",
    message: "The feed host is not allowed.",
    httpStatus: null,
  },
  too_many_redirects: {
    code: "too_many_redirects",
    message: "The feed redirected too many times.",
    httpStatus: null,
  },
  unsupported_content_type: {
    code: "unsupported_content_type",
    message: "The feed response was not a supported text or XML document.",
    httpStatus: null,
  },
  response_too_large: {
    code: "response_too_large",
    message: "The feed response exceeded the size limit.",
    httpStatus: null,
  },
  timeout: { code: "timeout", message: "The feed request timed out.", httpStatus: null },
};

/** Maps an exception to a fixed, sanitized summary; raw messages may contain URLs or addresses. */
export function classifySourceFetchError(error: unknown): PublicNewsSourceHealthError {
  if (error instanceof ExternalRequestError) {
    return {
      code: "http_error",
      message: `The feed responded with HTTP ${error.status}.`,
      httpStatus: error.status,
    };
  }
  if (error instanceof ExternalFetchPolicyError) {
    return FETCH_POLICY_ERRORS[error.code];
  }
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "AbortError" || name === "TimeoutError" || /\baborted\b/i.test(message)) {
    return { code: "timeout", message: "The feed request timed out.", httpStatus: null };
  }
  if (/exceeded size limit/i.test(message)) {
    return {
      code: "response_too_large",
      message: "The feed response exceeded the size limit.",
      httpStatus: null,
    };
  }
  if (/^Blocked |Only http and https/i.test(message)) {
    return { code: "blocked_host", message: "The feed host is not allowed.", httpStatus: null };
  }
  if (/approved media registry/i.test(message)) {
    return UNAPPROVED_FEED_ERROR;
  }
  if (
    error instanceof TypeError ||
    /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|getaddrinfo|certificate|socket/i.test(
      message,
    )
  ) {
    return {
      code: "network_error",
      message: "The feed host could not be reached.",
      httpStatus: null,
    };
  }
  return { code: "unknown_error", message: "The feed check failed.", httpStatus: null };
}

/**
 * Collects per-source outcomes during one refresh. Sources without a MediaResource id
 * (static registry fallback before the Admin catalog loads) are not tracked.
 */
export class PublicNewsIngestionTelemetry {
  private readonly checks = new Map<string, MutableCheck>();

  begin(source: ApprovedNewsSource, now: Date = new Date()): void {
    if (!source.mediaResourceId) {
      return;
    }
    this.checks.set(source.mediaResourceId, {
      mediaResourceId: source.mediaResourceId,
      sourceName: source.sourceName,
      providerId: source.providerId,
      feedHost: feedHostOf(source.rssFeedUrl),
      startedAt: now.toISOString(),
      outcome: "fetch_failed",
      httpStatus: null,
      durationMs: 0,
      parsedCount: 0,
      acceptedCount: 0,
      rejectionReasons: {},
      storedSourceNames: new Set(),
      newestItemAt: null,
      error: null,
    });
  }

  fetchSucceeded(id: string | undefined, httpStatus: number | null, durationMs: number): void {
    const check = id ? this.checks.get(id) : undefined;
    if (!check) {
      return;
    }
    check.outcome = "success";
    check.httpStatus = httpStatus;
    check.durationMs = durationMs;
    check.error = null;
  }

  fetchFailed(
    id: string | undefined,
    error: PublicNewsSourceHealthError,
    durationMs: number,
  ): void {
    const check = id ? this.checks.get(id) : undefined;
    if (!check) {
      return;
    }
    check.outcome = "fetch_failed";
    check.httpStatus = error.httpStatus;
    check.durationMs = durationMs;
    check.parsedCount = 0;
    check.error = error;
  }

  parsed(id: string | undefined, items: readonly { publishedAt: string }[]): void {
    const check = id ? this.checks.get(id) : undefined;
    if (!check) {
      return;
    }
    check.parsedCount = items.length;
    let newest = Number.NEGATIVE_INFINITY;
    for (const item of items) {
      const time = Date.parse(item.publishedAt);
      if (!Number.isNaN(time) && time > newest) {
        newest = time;
      }
    }
    check.newestItemAt = Number.isFinite(newest) ? new Date(newest).toISOString() : null;
    if (items.length === 0) {
      check.outcome = "parse_failed";
      check.error = INVALID_FEED;
    }
  }

  reject(id: string | undefined, reason: PublicNewsRejectionReason, count = 1): void {
    const check = id ? this.checks.get(id) : undefined;
    if (!check || count <= 0) {
      return;
    }
    check.rejectionReasons[reason] = (check.rejectionReasons[reason] ?? 0) + count;
  }

  accept(id: string | undefined, storedSourceName: string): void {
    const check = id ? this.checks.get(id) : undefined;
    if (!check) {
      return;
    }
    check.acceptedCount += 1;
    check.storedSourceNames.add(storedSourceName);
  }

  completed(now: Date = new Date()): PublicNewsSourceCheck[] {
    const completedAt = now.toISOString();
    return [...this.checks.values()].map((check) => ({
      mediaResourceId: check.mediaResourceId,
      sourceName: check.sourceName,
      providerId: check.providerId,
      feedHost: check.feedHost,
      startedAt: check.startedAt,
      completedAt,
      outcome: check.outcome,
      httpStatus: check.httpStatus,
      durationMs: check.durationMs,
      parsedCount: check.parsedCount,
      acceptedCount: check.acceptedCount,
      rejectionReasons: { ...check.rejectionReasons },
      storedSourceNames: [...check.storedSourceNames].sort(),
      newestItemAt: check.newestItemAt,
      error: check.error,
    }));
  }
}

/** Merges one check with the stored record: failures accumulate, success resets them. */
export function mergeSourceCheck(
  previous: PublicNewsSourceHealthRecord | null,
  check: PublicNewsSourceCheck,
): PublicNewsSourceHealthRecord {
  const succeeded = check.outcome === "success";
  return {
    mediaResourceId: check.mediaResourceId,
    sourceName: check.sourceName,
    providerId: check.providerId,
    feedHost: check.feedHost,
    lastCheckStartedAt: check.startedAt,
    lastCheckCompletedAt: check.completedAt,
    lastOutcome: check.outcome,
    lastSuccessAt: succeeded ? check.completedAt : (previous?.lastSuccessAt ?? null),
    lastHttpStatus: check.httpStatus,
    lastDurationMs: check.durationMs,
    lastParsedCount: check.parsedCount,
    lastAcceptedCount: check.acceptedCount,
    lastRejectedCount: Object.values(check.rejectionReasons).reduce(
      (total, count) => total + (count ?? 0),
      0,
    ),
    lastRejectionReasons: check.rejectionReasons,
    lastStoredSourceNames: [...check.storedSourceNames],
    lastItemPublishedAt: check.newestItemAt,
    lastError: check.error,
    consecutiveFailures: succeeded ? 0 : (previous?.consecutiveFailures ?? 0) + 1,
    updatedAt: check.completedAt,
  };
}

/**
 * Admin health status, evaluated in order:
 * 1. never_checked — no telemetry for this resource yet.
 * 2. failing       — the latest check failed to fetch or to parse the feed.
 * 3. stale         — no successful check within `staleAfterMs` (2 x refresh interval).
 * 4. failing       — checked successfully, but no article is publicly available
 *                    under this exact source name.
 * 5. stale         — the newest feed item is older than the retention window.
 * 6. healthy       — otherwise.
 */
export function resolveNewsSourceHealthStatus(input: {
  readonly record: PublicNewsSourceHealthRecord | null;
  readonly publicArticleCount: number;
  readonly now: number;
  readonly staleAfterMs: number;
  readonly retentionDays: number;
}): { status: PublicNewsSourceHealthStatus; statusReason: PublicNewsSourceHealthStatusReason } {
  const { record } = input;
  if (!record) {
    return { status: "never_checked", statusReason: "no_telemetry" };
  }
  if (record.lastOutcome === "fetch_failed") {
    return { status: "failing", statusReason: "fetch_failed" };
  }
  if (record.lastOutcome === "parse_failed") {
    return { status: "failing", statusReason: "parse_failed" };
  }
  const lastSuccess = record.lastSuccessAt ? Date.parse(record.lastSuccessAt) : Number.NaN;
  if (Number.isNaN(lastSuccess) || input.now - lastSuccess > input.staleAfterMs) {
    return { status: "stale", statusReason: "not_checked_recently" };
  }
  if (input.publicArticleCount <= 0) {
    return { status: "failing", statusReason: "no_public_articles" };
  }
  const newest = record.lastItemPublishedAt ? Date.parse(record.lastItemPublishedAt) : Number.NaN;
  if (Number.isNaN(newest) || input.now - newest > input.retentionDays * 86_400_000) {
    return { status: "stale", statusReason: "feed_not_updating" };
  }
  return { status: "healthy", statusReason: "ok" };
}
