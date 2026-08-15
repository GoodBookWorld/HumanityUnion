import type { Initiative, ParticipationScope, WorldInitiativeCardProjection } from "@hu/types";
import { resolveInitiativeCoverMedia } from "@hu/types";

import { formatPublicGeography } from "../../shared/format-public-geography.js";
import { isInitiativeEligibleForPublicProjection } from "./initiative-public-projection.access.js";

export const WORLD_INITIATIVES_DEFAULT_LIMIT = 18;
const WORLD_INITIATIVES_MAX_LIMIT = 18;

function summarizeText(text: string, maxLength = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildPublicInitiativeHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

function formatPublicStatus(status: Initiative["status"]): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveGeographyLabel(initiative: Initiative): string {
  const metadata = initiative.metadata;

  return formatPublicGeography({
    countryCode: metadata.countrySlug,
    regionCode: metadata.regionSlug,
    communitySlug: metadata.communitySlug,
    regionLabel: metadata.region,
    communityAssociation: metadata.communityAssociation,
  });
}

export function resolveInitiativeParticipationScope(initiative: Initiative): ParticipationScope {
  return initiative.metadata.participationScope ?? "community";
}

export function isWorldScopedInitiative(initiative: Initiative): boolean {
  return resolveInitiativeParticipationScope(initiative) === "world";
}

export function toWorldInitiativeCardProjection(
  initiative: Initiative,
): WorldInitiativeCardProjection {
  const activityArea =
    initiative.metadata.activityArea === "Other" && initiative.metadata.activityAreaOther
      ? initiative.metadata.activityAreaOther
      : initiative.metadata.activityArea;

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    summary: summarizeText(initiative.description),
    activityArea,
    geographyLabel: resolveGeographyLabel(initiative),
    imageUrl: initiative.metadata.imageUrl,
    coverMedia: resolveInitiativeCoverMedia(initiative.metadata),
    startDate: initiative.metadata.startDate,
    completionDate: initiative.metadata.completionDate,
    publicStatus: formatPublicStatus(initiative.status),
    currentStageLabel: formatPublicStatus(initiative.status),
    publicInitiativeHref: buildPublicInitiativeHref(initiative.initiativeId),
    publishedAt: initiative.updatedAt,
  };
}

export function isEligibleForWorldInitiativesListing(initiative: Initiative): boolean {
  return (
    isInitiativeEligibleForPublicProjection(initiative) &&
    isWorldScopedInitiative(initiative) &&
    initiative.visibility.policy === "public"
  );
}

export function listWorldInitiativeCardProjections(
  initiatives: Initiative[],
  limit = WORLD_INITIATIVES_DEFAULT_LIMIT,
): WorldInitiativeCardProjection[] {
  const boundedLimit = Math.min(Math.max(limit, 1), WORLD_INITIATIVES_MAX_LIMIT);

  return initiatives
    .filter(isEligibleForWorldInitiativesListing)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, boundedLimit)
    .map(toWorldInitiativeCardProjection);
}
