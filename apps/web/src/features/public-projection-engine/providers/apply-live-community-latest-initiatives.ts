import type {
  CommunityExperiencePublicProjections,
  LatestInitiativesPublicProjection,
} from "@hu/types";

/**
 * Applies live Capability 02 latest-initiatives projection for API provider mode.
 * Does not merge bootstrap demonstration initiative cards.
 */
export function applyLiveCommunityLatestInitiatives(
  experienceProjections: CommunityExperiencePublicProjections,
  liveProjection: LatestInitiativesPublicProjection | null,
): CommunityExperiencePublicProjections {
  const initiatives = (liveProjection?.initiatives ?? []).map((card, index) => ({
    ...card,
    recencyOrder: index,
  }));

  return {
    ...experienceProjections,
    latestInitiatives: {
      scope: "community",
      scopeLabel: experienceProjections.latestInitiatives.scopeLabel,
      source: "projection",
      generatedAt: liveProjection?.generatedAt ?? new Date().toISOString(),
      initiatives,
    },
  };
}
