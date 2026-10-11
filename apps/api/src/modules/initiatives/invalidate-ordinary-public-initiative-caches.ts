import { invalidateCommunityIntelligenceCache } from "../community-intelligence/community-intelligence-cache.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";

/**
 * Drop warm ordinary-public caches after an administrative block or unblock.
 * Does not change lifecyclePhase, status, or visibility.policy.
 */
export function invalidateOrdinaryPublicInitiativeCaches(initiativeId: string): void {
  invalidateGlobalSearchIndex();
  invalidateCommunityIntelligenceCache(initiativeId);
}
