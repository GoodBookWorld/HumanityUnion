import type {
  CommunityExperiencePublicProjections,
  LatestInitiativesPublicProjection,
} from "@hu/types";

export function mergeCommunityLatestInitiatives(
  bootstrapProjections: CommunityExperiencePublicProjections,
  liveProjection: LatestInitiativesPublicProjection | null,
): CommunityExperiencePublicProjections {
  if (!liveProjection || liveProjection.initiatives.length === 0) {
    return bootstrapProjections;
  }

  const liveCards = liveProjection.initiatives.map((card, index) => ({
    ...card,
    recencyOrder: index,
  }));

  const bootstrapCards = bootstrapProjections.latestInitiatives.initiatives.map((card, index) => ({
    ...card,
    recencyOrder: liveCards.length + index,
  }));

  return {
    ...bootstrapProjections,
    latestInitiatives: {
      ...bootstrapProjections.latestInitiatives,
      generatedAt: liveProjection.generatedAt,
      initiatives: [...liveCards, ...bootstrapCards],
    },
  };
}
