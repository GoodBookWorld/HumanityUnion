import {
  isInitiativeAdministrativelyBlocked,
  type Initiative,
  type LatestInitiativesPublicProjection,
} from "@hu/types";

import {
  getKnownInitiativeCommunity,
  KNOWN_INITIATIVE_COMMUNITIES,
} from "./initiative-communities.js";
import { listProjectedInitiativeCards } from "./initiative-projection.store.js";

/**
 * Ordinary-public Initiative eligibility.
 * Administrative block does not change lifecyclePhase, status, or visibility.policy.
 * A blocked record stays stored and admin-visible, and is not ordinary-public.
 */
export function isInitiativeEligibleForPublicProjection(initiative: Initiative): boolean {
  return (
    initiative.lifecyclePhase === "projected" &&
    initiative.visibility.policy === "public" &&
    !isInitiativeAdministrativelyBlocked(initiative)
  );
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
