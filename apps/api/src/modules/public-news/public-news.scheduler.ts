import { resolvePublicNewsConfig } from "./public-news.config.js";
import { PUBLIC_NEWS_REFRESH_LEASE_TTL_MS } from "./public-news-refresh-lease.js";
import {
  cleanupExpiredPublicNews,
  refreshPublicNews,
  type PublicNewsRefreshResult,
} from "./public-news.service.js";

let schedulerStarted = false;
let refreshTimer: NodeJS.Timeout | null = null;
let followUpTimer: NodeJS.Timeout | null = null;

/** Follow-ups after a skipped refresh, per skip chain. */
export const MAX_LEASE_FOLLOW_UPS = 3;
const MIN_FOLLOW_UP_DELAY_MS = 60_000;
const FOLLOW_UP_JITTER_MS = 60_000;
/** Retry delay after a lease store failure (no refresh ran; articles untouched). */
const LEASE_UNAVAILABLE_RETRY_MS = 5 * 60_000;

let scheduledFollowUpsForTests = 0;

export function getScheduledLeaseFollowUpsForTests(): {
  scheduled: number;
  pending: boolean;
} {
  return { scheduled: scheduledFollowUpsForTests, pending: followUpTimer !== null };
}

/**
 * When another instance holds the lease, retry once it expires, but only if no
 * refresh has completed since the skip (a holder that dies mid-refresh must not
 * leave news stale until the next interval). A lease store failure retries after a
 * fixed delay. Lost leases and completed refreshes need no follow-up.
 */
export function resolveLeaseFollowUpDelayMs(
  result: PublicNewsRefreshResult,
  now: number,
  random: () => number = Math.random,
): number | null {
  if (result.skipped === "lease_unavailable") {
    return LEASE_UNAVAILABLE_RETRY_MS + Math.floor(random() * FOLLOW_UP_JITTER_MS);
  }
  if (result.skipped !== "lease_held") {
    return null;
  }
  const untilExpiry = (result.retryAt ?? now + PUBLIC_NEWS_REFRESH_LEASE_TTL_MS) - now;
  const bounded = Math.min(
    Math.max(untilExpiry, MIN_FOLLOW_UP_DELAY_MS),
    PUBLIC_NEWS_REFRESH_LEASE_TTL_MS,
  );
  return bounded + Math.floor(random() * FOLLOW_UP_JITTER_MS);
}

/** One scheduled refresh (boot, interval or follow-up); at most one follow-up is pending. */
export async function runScheduledRefresh(
  options: { skipIfCompletedSince?: Date } = {},
  followUps = 0,
): Promise<void> {
  const skippedAt = new Date();
  const result = await refreshPublicNews(options);
  const delay = resolveLeaseFollowUpDelayMs(result, skippedAt.getTime());

  if (delay === null || followUps >= MAX_LEASE_FOLLOW_UPS || followUpTimer || !schedulerStarted) {
    return;
  }

  const since = options.skipIfCompletedSince ?? skippedAt;
  scheduledFollowUpsForTests += 1;
  followUpTimer = setTimeout(() => {
    followUpTimer = null;
    void runScheduledRefresh({ skipIfCompletedSince: since }, followUps + 1).catch((error) => {
      console.error(
        "[public-news] Follow-up refresh failed:",
        error instanceof Error ? error.message : error,
      );
    });
  }, delay);
  followUpTimer.unref?.();
}

export function startPublicNewsScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  const config = resolvePublicNewsConfig();
  const intervalMs = config.refreshIntervalHours * 60 * 60 * 1000;

  void runScheduledRefresh().catch((error) => {
    console.error(
      "[public-news] Startup refresh failed:",
      error instanceof Error ? error.message : error,
    );
  });

  refreshTimer = setInterval(() => {
    void runScheduledRefresh().catch((error) => {
      console.error(
        "[public-news] Scheduled refresh failed:",
        error instanceof Error ? error.message : error,
      );
    });
  }, intervalMs);

  refreshTimer.unref?.();
}

export function stopPublicNewsScheduler(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (followUpTimer) {
    clearTimeout(followUpTimer);
    followUpTimer = null;
  }

  schedulerStarted = false;
}

export async function runPublicNewsMaintenance(): Promise<void> {
  await cleanupExpiredPublicNews();
  await refreshPublicNews();
}
