import type { Initiative, LatestInitiativesPublicProjection } from "@hu/types";

import { getKnownInitiativeCommunity } from "./initiative-communities.js";
import { listProjectedInitiativeCards } from "./initiative-projection.store.js";

export function buildCommunityLatestInitiativesProjection(
  communitySlug: string,
): LatestInitiativesPublicProjection | null {
  const community = getKnownInitiativeCommunity(communitySlug);

  if (!community) {
    return null;
  }

  const initiatives = listProjectedInitiativeCards(communitySlug);

  if (initiatives.length === 0) {
    return null;
  }

  return {
    scope: "community",
    scopeLabel: community.name,
    source: "projection",
    generatedAt: new Date().toISOString(),
    initiatives,
  };
}

export function isInitiativeEligibleForPublicProjection(initiative: Initiative): boolean {
  return initiative.lifecyclePhase === "projected" && initiative.visibility.policy === "public";
}
