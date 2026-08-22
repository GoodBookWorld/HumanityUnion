import { normalizeCountryInput, normalizeRegionInput } from "@hu/geography";
import type {
  Initiative,
  InitiativeLifecycleProfile,
  TrustedMediaResource,
  WorldInitiativeCardProjection,
} from "@hu/types";
import {
  isInitiativeAdministrativelyBlocked,
  publicChoiceElectionVotingStatusLabel,
  resolveInitiativeCoverMedia,
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { formatPublicGeography } from "../../shared/format-public-geography.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listPublicChoiceCandidatesByInitiative } from "../public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { listPublicCountryTrustedMedia } from "../media-resources/media-resource.service.js";
import { resolveInitiativeSearchGeography } from "../initiatives/initiative-geography.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { listInitiatives } from "../initiatives/initiative.store.js";

const COUNTRY_INITIATIVES_LIMIT = 12;
const COUNTRY_INITIATIVES_MAX_LIMIT = 18;
const COUNTRY_MEDIA_LIMIT = 12;

export interface CountryDiscoveryQuery {
  regionCode?: string;
  communityCode?: string;
  lifecycleProfile?: InitiativeLifecycleProfile;
  limit?: number;
}

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

function formatPublicStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveElectionVotingFields(initiative: Initiative): Pick<
  WorldInitiativeCardProjection,
  "electionVotingStatus" | "electionVotingStatusLabel"
> {
  const decisions = listDecisionsByInitiative(initiative.initiativeId);
  const decision =
    decisions.find((entry) => entry.status === "opened") ??
    decisions.find((entry) => entry.status === "closed") ??
    decisions[0];

  const electionVotingStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: decision?.status,
    openedAt: decision?.openedAt,
    closesAt: decision?.closesAt,
    closedAt: decision?.closedAt,
    resultsExpiredAt: initiative.metadata.publicChoiceResultsExpiredAt,
    resultsRetentionStatus: initiative.metadata.publicChoiceResultsExpiredAt
      ? "results_expired"
      : undefined,
  });

  return {
    electionVotingStatus,
    electionVotingStatusLabel: publicChoiceElectionVotingStatusLabel(electionVotingStatus),
  };
}

export function toCountryInitiativeCardProjection(
  initiative: Initiative,
): WorldInitiativeCardProjection {
  const activityArea =
    initiative.metadata.activityArea === "Other" && initiative.metadata.activityAreaOther
      ? initiative.metadata.activityAreaOther
      : initiative.metadata.activityArea;
  const lifecycleProfile = resolveInitiativeLifecycleProfile(initiative.lifecycleProfile);
  const isPublicChoice = lifecycleProfile === "PUBLIC_CHOICE";

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    summary: summarizeText(initiative.description),
    activityArea,
    geographyLabel: formatPublicGeography({
      countryCode: initiative.metadata.countrySlug,
      regionCode: initiative.metadata.regionSlug,
      communitySlug: initiative.metadata.communitySlug,
      regionLabel: initiative.metadata.region,
      communityAssociation: initiative.metadata.communityAssociation,
    }),
    imageUrl: initiative.metadata.imageUrl,
    coverMedia: resolveInitiativeCoverMedia(initiative.metadata),
    startDate: initiative.metadata.startDate,
    completionDate: initiative.metadata.completionDate,
    publicStatus: formatPublicStatus(initiative.status),
    currentStageLabel: formatPublicStatus(initiative.status),
    publicInitiativeHref: buildPublicInitiativeHref(initiative.initiativeId),
    publishedAt: initiative.updatedAt,
    lifecycleProfile,
    administrativelyBlocked: isPublicChoice
      ? isInitiativeAdministrativelyBlocked(initiative)
      : undefined,
    ...(isPublicChoice ? resolveElectionVotingFields(initiative) : {}),
  };
}

function matchesCountryDiscoveryGeography(
  initiative: Initiative,
  countryCode: string,
  query: CountryDiscoveryQuery,
): boolean {
  const geography = resolveInitiativeSearchGeography(initiative);

  if (geography.country !== countryCode) {
    return false;
  }

  // Country discovery never includes World-scope records.
  if ((initiative.metadata.participationScope ?? "") === "world") {
    return false;
  }

  const regionFilter = query.regionCode?.trim();
  const communityFilter = query.communityCode?.trim();

  if (communityFilter) {
    const normalizedCommunity = communityFilter.toLowerCase();
    if (geography.community !== normalizedCommunity && geography.community !== communityFilter) {
      return false;
    }

    if (regionFilter) {
      const normalizedRegion =
        normalizeRegionInput(countryCode, regionFilter) ?? regionFilter.toUpperCase();
      if (geography.region !== normalizedRegion && geography.region !== regionFilter) {
        return false;
      }
    }

    return true;
  }

  if (regionFilter) {
    const normalizedRegion =
      normalizeRegionInput(countryCode, regionFilter) ?? regionFilter.toUpperCase();
    return geography.region === normalizedRegion || geography.region === regionFilter;
  }

  return true;
}

function matchesLifecycleProfile(
  initiative: Initiative,
  lifecycleProfile: InitiativeLifecycleProfile | undefined,
): boolean {
  if (!lifecycleProfile) {
    return true;
  }

  return resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === lifecycleProfile;
}

export async function listCountryInitiativeCardProjections(
  countryCodeInput: string,
  query: CountryDiscoveryQuery = {},
): Promise<WorldInitiativeCardProjection[]> {
  const countryCode = normalizeCountryInput(countryCodeInput);

  if (!countryCode) {
    return [];
  }

  const boundedLimit = Math.min(
    Math.max(query.limit ?? COUNTRY_INITIATIVES_LIMIT, 1),
    COUNTRY_INITIATIVES_MAX_LIMIT,
  );

  const matched = listInitiatives()
    .filter((initiative) => {
      if (!isInitiativeEligibleForPublicProjection(initiative)) {
        return false;
      }

      if (!matchesLifecycleProfile(initiative, query.lifecycleProfile)) {
        return false;
      }

      return matchesCountryDiscoveryGeography(initiative, countryCode, query);
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, boundedLimit)
    .map(toCountryInitiativeCardProjection);

  await Promise.all(
    matched.map(async (card) => {
      if (card.lifecycleProfile !== "PUBLIC_CHOICE") {
        return;
      }

      try {
        const candidates = await listPublicChoiceCandidatesByInitiative(card.initiativeId);
        card.candidateCount = candidates.length;
      } catch {
        card.candidateCount = undefined;
      }
    }),
  );

  return matched;
}

export async function listCountryTrustedMediaResources(
  countryCodeInput: string,
  limit = COUNTRY_MEDIA_LIMIT,
): Promise<TrustedMediaResource[]> {
  return listPublicCountryTrustedMedia(countryCodeInput, limit);
}
