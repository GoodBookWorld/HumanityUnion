import { COMMUNITY_SIMILARITY_ALGORITHM_VERSION } from "./community-intelligence.constants.js";
import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

export interface CommunityIntelligenceCacheEntry {
  readonly expiresAt: number;
  readonly items: readonly CommunityInitiativeRelationshipProjection[];
  readonly providerId: string;
  readonly algorithmVersion: string;
}

const relatedCache = new Map<string, CommunityIntelligenceCacheEntry>();

export function getCommunityIntelligenceCacheEntry(
  initiativeId: string,
): CommunityIntelligenceCacheEntry | undefined {
  return relatedCache.get(initiativeId);
}

export function setCommunityIntelligenceCacheEntry(
  initiativeId: string,
  entry: CommunityIntelligenceCacheEntry,
): void {
  relatedCache.set(initiativeId, entry);
}

/**
 * Pack 02 — invalidate related-Initiative cache when public Initiative signals change.
 * Safe to call from Initiative/Analysis modules (no reverse heavy imports).
 *
 * Clears the source Initiative entry and any other cached source whose results
 * still reference that Initiative (so peer pages do not keep stale edges).
 */
export function invalidateCommunityIntelligenceCache(initiativeId?: string): void {
  if (!initiativeId) {
    relatedCache.clear();
    return;
  }

  relatedCache.delete(initiativeId);

  for (const [key, entry] of relatedCache.entries()) {
    if (entry.items.some((item) => item.initiativeId === initiativeId)) {
      relatedCache.delete(key);
    }
  }
}

export function isCommunityIntelligenceCacheEntryFresh(
  entry: CommunityIntelligenceCacheEntry | undefined,
): entry is CommunityIntelligenceCacheEntry {
  return Boolean(
    entry &&
      entry.expiresAt > Date.now() &&
      entry.algorithmVersion === COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
  );
}

export function clearCommunityIntelligenceCacheForTests(): void {
  relatedCache.clear();
}
