import type { Initiative, LatestInitiativesPublicProjection } from "@hu/types";

import {
  getKnownInitiativeCommunity,
  KNOWN_INITIATIVE_COMMUNITIES,
} from "./initiative-communities.js";
import { listProjectedInitiativeCards } from "./initiative-projection.store.js";

export function isInitiativeEligibleForPublicProjection(initiative: Initiative): boolean {
  return initiative.lifecyclePhase === "projected" && initiative.visibility.policy === "public";
}

export function buildCommunityLatestInitiativesProjection(
  communitySlug: string,
): LatestInitiativesPublicProjection | null {
  const community = getKnownInitiativeCommunity(communitySlug);

  if (!community) {
    return null;
  }

  const initiatives = listProjectedInitiativeCards(communitySlug);

  return {
    scope: "community",
    scopeLabel: community.name,
    source: "projection",
    generatedAt: new Date().toISOString(),
    initiatives,
  };
}

export function listPublicProjectionCommunitySlugs(): readonly string[] {
  return KNOWN_INITIATIVE_COMMUNITIES.map((community) => community.slug);
}
