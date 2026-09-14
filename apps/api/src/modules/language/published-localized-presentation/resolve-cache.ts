/**
 * Reset 03D — bounded in-process cache for published Media PLP resolve results.
 * Key includes entity + locale + canonicalVersion + localizationSchemaVersion.
 * No browser persistence; no translation build on miss; bounded size.
 */

import type { ResolvePublishedPresentationResult } from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

export const MEDIA_PLP_RESOLVE_CACHE_MAX_ENTRIES = 512;
export const MEDIA_PLP_RESOLVE_CACHE_PUBLISHED_TTL_MS = 60_000;
export const MEDIA_PLP_RESOLVE_CACHE_FALLBACK_TTL_MS = 15_000;

export type MediaPlpResolveCacheKeyInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly liveCanonicalVersion: string;
  readonly localizationSchemaVersion?: string;
};

type CacheEntry = {
  readonly result: ResolvePublishedPresentationResult;
  readonly expiresAtMs: number;
};

const store = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

export function buildMediaPlpResolveCacheKey(input: MediaPlpResolveCacheKeyInput): string {
  const schema =
    input.localizationSchemaVersion ?? PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  return [
    input.entityType,
    input.entityId,
    input.locale,
    input.liveCanonicalVersion,
    schema,
  ].join("|");
}

export function resetMediaPlpResolveCacheForTests(): void {
  store.clear();
  hits = 0;
  misses = 0;
}

export function getMediaPlpResolveCacheStats(): {
  readonly size: number;
  readonly hits: number;
  readonly misses: number;
} {
  return { size: store.size, hits, misses };
}

export function invalidateMediaPlpResolveCacheForEntity(input: {
  readonly entityType: string;
  readonly entityId: string;
}): void {
  const prefix = `${input.entityType}|${input.entityId}|`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

function ttlFor(result: ResolvePublishedPresentationResult): number {
  return result.mode === "PUBLISHED_LOCALIZED"
    ? MEDIA_PLP_RESOLVE_CACHE_PUBLISHED_TTL_MS
    : MEDIA_PLP_RESOLVE_CACHE_FALLBACK_TTL_MS;
}

function evictIfNeeded(): void {
  while (store.size >= MEDIA_PLP_RESOLVE_CACHE_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest == null) {
      return;
    }
    store.delete(oldest);
  }
}

export function getCachedMediaPlpResolve(
  key: string,
): ResolvePublishedPresentationResult | null {
  const hit = store.get(key);
  if (!hit) {
    misses += 1;
    return null;
  }
  if (Date.now() > hit.expiresAtMs) {
    store.delete(key);
    misses += 1;
    return null;
  }
  hits += 1;
  return hit.result;
}

export function setCachedMediaPlpResolve(
  key: string,
  result: ResolvePublishedPresentationResult,
): void {
  evictIfNeeded();
  store.set(key, {
    result,
    expiresAtMs: Date.now() + ttlFor(result),
  });
}
