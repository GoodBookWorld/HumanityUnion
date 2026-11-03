/**
 * SEO-12B.1 — daily search performance sync. Off unless SEO_SEARCH_SYNC_ENABLED=true.
 * Checks hourly; each provider syncs at most once a day under a shared Mongo lease.
 */
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import {
  collectSearchPerformanceSecrets,
  resolveSearchPerformanceConfig,
  SEO_SEARCH_SYNC_ENABLED_ENV,
  type SearchPerformanceConfig,
} from "./search-performance.config.js";
import { redactSearchPerformanceText } from "./search-performance.redaction.js";
import {
  getSearchPerformanceStore,
  type SearchPerformanceStore,
} from "./search-performance.store.js";
import {
  runSearchProviderSync,
  type SearchSyncDeps,
  type SearchSyncOutcome,
} from "./search-performance.sync.js";
import { SEARCH_PROVIDERS, type SearchProvider } from "./search-performance.types.js";

export const SEARCH_SCHEDULER_INITIAL_DELAY_MS = 10 * 60_000;
export const SEARCH_SCHEDULER_INTERVAL_MS = 60 * 60_000;

let startupTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

export interface SearchSchedulerDeps {
  readonly config?: SearchPerformanceConfig;
  readonly store?: SearchPerformanceStore;
  readonly setTimeoutFn?: typeof setTimeout;
  readonly setIntervalFn?: typeof setInterval;
  readonly log?: (message: string) => void;
  readonly sync?: Partial<Omit<SearchSyncDeps, "config" | "store" | "holder">>;
}

const instanceHolder = `${hostname()}:${process.pid}:${randomUUID()}`;

export async function runSearchPerformanceTick(
  deps: SearchSchedulerDeps = {},
): Promise<Record<SearchProvider, SearchSyncOutcome | "error">> {
  const config = deps.config ?? resolveSearchPerformanceConfig();
  const store = deps.store ?? getSearchPerformanceStore();
  const log = deps.log ?? ((message: string) => console.warn(message));
  const secrets = collectSearchPerformanceSecrets(config);
  const outcomes = {} as Record<SearchProvider, SearchSyncOutcome | "error">;

  if (config.syncEnabled) {
    await store.clearExpiredSnapshots(new Date()).catch(() => 0);
  }
  for (const provider of SEARCH_PROVIDERS) {
    try {
      outcomes[provider] = await runSearchProviderSync(provider, {
        ...deps.sync,
        config,
        store,
        holder: instanceHolder,
      });
    } catch (error) {
      outcomes[provider] = "error";
      const message = error instanceof Error ? error.message : String(error);
      log(
        `[seo-search-performance] ${provider} sync tick failed: ${redactSearchPerformanceText(message, secrets)}`,
      );
    }
  }
  return outcomes;
}

/** Starts the hourly check only when sync is enabled. Returns whether timers were started. */
export function startSearchPerformanceScheduler(deps: SearchSchedulerDeps = {}): boolean {
  const config = deps.config ?? resolveSearchPerformanceConfig();
  const log = deps.log ?? ((message: string) => console.warn(message));

  if (!config.syncEnabled) {
    return false;
  }
  if (startupTimer || intervalTimer) {
    return true;
  }
  for (const provider of SEARCH_PROVIDERS) {
    const resolution = config[provider];
    if (!resolution.configured) {
      log(
        `[seo-search-performance] ${provider} is not configured: ${resolution.issues.join("; ")}`,
      );
    }
  }
  if (!config.google.configured && !config.bing.configured) {
    log(
      `[seo-search-performance] ${SEO_SEARCH_SYNC_ENABLED_ENV}=true but no provider is configured.`,
    );
    return false;
  }

  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const setIntervalFn = deps.setIntervalFn ?? setInterval;
  const tick = () => {
    if (tickInFlight) {
      return;
    }
    tickInFlight = true;
    void runSearchPerformanceTick({ ...deps, config: undefined })
      .catch(() => undefined)
      .finally(() => {
        tickInFlight = false;
      });
  };

  startupTimer = setTimeoutFn(tick, SEARCH_SCHEDULER_INITIAL_DELAY_MS);
  startupTimer.unref?.();
  intervalTimer = setIntervalFn(tick, SEARCH_SCHEDULER_INTERVAL_MS);
  intervalTimer.unref?.();
  return true;
}

export function stopSearchPerformanceScheduler(): void {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  tickInFlight = false;
}
