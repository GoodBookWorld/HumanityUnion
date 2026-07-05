import type { Initiative, LatestInitiativeCardProjection } from "@hu/types";

import { getKnownInitiativeCommunity } from "./initiative-communities.js";

function buildPublicInitiativeHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

function summarizeDescription(description: string, maxLength = 160): string {
  if (description.length <= maxLength) {
    return description;
  }

  return `${description.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatPublicStatus(status: Initiative["status"]): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toLatestInitiativeCardProjection(
  initiative: Initiative,
  recencyOrder = 0,
): LatestInitiativeCardProjection {
  const community = getKnownInitiativeCommunity(initiative.metadata.communitySlug);

  const geographicScope = community
    ? `${community.name}, ${community.regionLabel}, ${community.countryLabel}`
    : initiative.metadata.region;

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    summary: summarizeDescription(initiative.description),
    geographicScope,
    participationStage: "Initiative",
    publicStatus: formatPublicStatus(initiative.status),
    publicRouteStatus: "active",
    publicInitiativeHref: buildPublicInitiativeHref(initiative.initiativeId),
    recencyOrder,
    relatedPublicLinks: [],
  };
}
