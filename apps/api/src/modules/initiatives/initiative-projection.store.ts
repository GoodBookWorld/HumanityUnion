import type { Initiative, LatestInitiativeCardProjection } from "@hu/types";

import { isInitiativeEligibleForPublicProjection } from "./initiative-public-projection.access.js";
import { toLatestInitiativeCardProjection } from "./initiative-latest-initiatives.projection.js";

const projectedInitiativesByCommunity = new Map<string, LatestInitiativeCardProjection[]>();

export function rebuildProjectedInitiativeCards(initiatives: Initiative[]): void {
  projectedInitiativesByCommunity.clear();

  const projectedInitiatives = initiatives
    .filter(isInitiativeEligibleForPublicProjection)
    .sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );

  projectedInitiatives.forEach((initiative, index) => {
    const card = toLatestInitiativeCardProjection(initiative, index);
    upsertProjectedInitiativeCard(initiative.metadata.communitySlug, card);
  });
}

export function upsertProjectedInitiativeCard(
  communitySlug: string,
  card: LatestInitiativeCardProjection,
): void {
  const existing = projectedInitiativesByCommunity.get(communitySlug) ?? [];
  const filtered = existing.filter((entry) => entry.initiativeId !== card.initiativeId);
  projectedInitiativesByCommunity.set(communitySlug, [card, ...filtered]);
}

/** @deprecated Use upsertProjectedInitiativeCard. */
export function addProjectedInitiativeCard(
  communitySlug: string,
  card: LatestInitiativeCardProjection,
): void {
  upsertProjectedInitiativeCard(communitySlug, card);
}

export function removeProjectedInitiativeCard(communitySlug: string, initiativeId: string): void {
  const existing = projectedInitiativesByCommunity.get(communitySlug) ?? [];
  const filtered = existing.filter((entry) => entry.initiativeId !== initiativeId);

  if (filtered.length === 0) {
    projectedInitiativesByCommunity.delete(communitySlug);
    return;
  }

  projectedInitiativesByCommunity.set(communitySlug, filtered);
}

export function removeProjectedInitiativeCardFromAllCommunities(initiativeId: string): void {
  for (const communitySlug of listAllProjectedCommunitySlugs()) {
    removeProjectedInitiativeCard(communitySlug, initiativeId);
  }
}

export function listProjectedInitiativeCards(
  communitySlug: string,
): LatestInitiativeCardProjection[] {
  const cards = projectedInitiativesByCommunity.get(communitySlug);

  return cards ? cards.map((card) => structuredClone(card)) : [];
}

export function listAllProjectedCommunitySlugs(): string[] {
  return Array.from(projectedInitiativesByCommunity.keys());
}
