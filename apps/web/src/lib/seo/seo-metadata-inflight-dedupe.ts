/**
 * Process-wide in-flight dedupe for equivalent public SEO metadata resolutions.
 *
 * The map holds only work that is still running. Fulfillment and removal
 * happen in the same synchronous turn, before promise reactions run, so a
 * later call cannot join a settled result.
 * Tracking limits are counters, not a waiting queue. A request past a limit
 * runs the normal resolution and is not failed or rewritten.
 *
 * Map keys are SHA-256 digests. The raw cookie and Accept-Language stay in the
 * leader closure until that resolution finishes, and are never logged.
 *
 * Limits are an experimental staging bound on dedupe bookkeeping:
 * - 8 tracked identities: the same bound as the evidence-fetch cap, so a mixed
 *   crawl cannot accumulate an unbounded key map.
 * - 32 followers on one identity and 32 followers in total: enough for a
 *   repeated URL to collapse the observed 75-operation burst's first wave,
 *   without a follower list. Each follower is an integer, not a stored request.
 * Past those limits the normal path runs, so total SEO work is not bounded.
 */

import { createHash } from "node:crypto";

import type { PublicSeoMetadataEquivalenceSignals } from "../../features/language/resolve-document-locale";

const SEO_METADATA_DEDUPE_KEY = "__huSeoMetadataInflightDedupe";

export const SEO_METADATA_DEDUPE_MAX_KEYS = 8;
export const SEO_METADATA_DEDUPE_MAX_FOLLOWERS_PER_KEY = 32;
export const SEO_METADATA_DEDUPE_MAX_TOTAL_FOLLOWERS = 32;

interface DedupeEntry<T> {
  promise: Promise<T>;
  followers: number;
}

interface SeoMetadataDedupeState {
  readonly entries: Map<string, DedupeEntry<unknown>>;
  totalFollowers: number;
  hits: number;
  bypasses: number;
  peakKeys: number;
  peakFollowers: number;
}

export interface SeoMetadataDedupeSnapshot {
  readonly activeKeys: number;
  readonly activeFollowers: number;
  readonly hits: number;
  readonly bypasses: number;
  readonly peakKeys: number;
  readonly peakFollowers: number;
}

function dedupeState(): SeoMetadataDedupeState {
  const host = globalThis as unknown as Record<string, SeoMetadataDedupeState | undefined>;
  const existing = host[SEO_METADATA_DEDUPE_KEY];
  if (existing) {
    return existing;
  }
  const created: SeoMetadataDedupeState = {
    entries: new Map(),
    totalFollowers: 0,
    hits: 0,
    bypasses: 0,
    peakKeys: 0,
    peakFollowers: 0,
  };
  host[SEO_METADATA_DEDUPE_KEY] = created;
  return created;
}

function notePeaks(state: SeoMetadataDedupeState): void {
  if (state.entries.size > state.peakKeys) {
    state.peakKeys = state.entries.size;
  }
  if (state.totalFollowers > state.peakFollowers) {
    state.peakFollowers = state.totalFollowers;
  }
}

export function seoMetadataEquivalenceKey(
  localeFreePath: string,
  signals: PublicSeoMetadataEquivalenceSignals,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        localeFreePath,
        signals.pathname,
        signals.urlLocaleSegment,
        signals.huLangCookie,
        signals.acceptLanguage,
      ]),
    )
    .digest("hex");
}

/**
 * Share `work` while an equivalent resolution is running.
 * Returns the leader promise for an accepted follower, or a fresh `work()`
 * call when tracking limits are already full.
 */
export function shareInFlightSeoMetadataResolution<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const state = dedupeState();
  const existing = state.entries.get(key) as DedupeEntry<T> | undefined;
  if (existing) {
    if (
      existing.followers >= SEO_METADATA_DEDUPE_MAX_FOLLOWERS_PER_KEY ||
      state.totalFollowers >= SEO_METADATA_DEDUPE_MAX_TOTAL_FOLLOWERS
    ) {
      state.bypasses += 1;
      return work();
    }
    existing.followers += 1;
    state.totalFollowers += 1;
    state.hits += 1;
    notePeaks(state);
    return existing.promise;
  }

  if (state.entries.size >= SEO_METADATA_DEDUPE_MAX_KEYS) {
    state.bypasses += 1;
    return work();
  }

  const entry: DedupeEntry<T> = {
    followers: 0,
    promise: undefined as unknown as Promise<T>,
  };
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  entry.promise = promise;
  state.entries.set(key, entry);
  notePeaks(state);

  void (async () => {
    try {
      resolvePromise(await work());
    } catch (error) {
      rejectPromise(error);
    } finally {
      if (state.entries.get(key) === entry) {
        state.entries.delete(key);
        state.totalFollowers -= entry.followers;
        if (state.totalFollowers < 0) {
          state.totalFollowers = 0;
        }
      }
    }
  })();

  return promise;
}

export function readSeoMetadataDedupeSnapshot(): SeoMetadataDedupeSnapshot {
  const state = dedupeState();
  return {
    activeKeys: state.entries.size,
    activeFollowers: state.totalFollowers,
    hits: state.hits,
    bypasses: state.bypasses,
    peakKeys: state.peakKeys,
    peakFollowers: state.peakFollowers,
  };
}

export function resetSeoMetadataInflightDedupeForTests(): void {
  const state = dedupeState();
  state.entries.clear();
  state.totalFollowers = 0;
  state.hits = 0;
  state.bypasses = 0;
  state.peakKeys = 0;
  state.peakFollowers = 0;
}
