import { getCountryByCode, getRegionsByCountry, normalizeCountryInput } from "@hu/geography";
import type { CountryStatisticsCounts, CountryStatisticsPayload } from "@hu/types";
import { MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE } from "@hu/types";

import { countVerifiedActiveAuthUsers } from "../auth/auth-user.repository.js";
import { listDecisions as listInitiativeCollectiveDecisions } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listCaps } from "../civic-action-package/civic-action-package.store.js";
import { resolveInitiativeSearchGeography } from "../initiatives/initiative-geography.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { listInitiatives } from "../initiatives/initiative.store.js";
import { countActiveMembershipMembersByCountry } from "../membership/membership.repository.js";
import { listResponses as listOfficialResponses } from "../official-response/official-response.store.js";
import { listActiveParticipationAreas } from "../participation-area/participation-area.store.js";
import { listPublishedArchiveRecords } from "../public-civic-archive/public-civic-archive.store.js";
import { countVerifiedParticipantsByCountry } from "../member-profile/member-profile.repository.js";

const PUBLIC_COLLECTIVE_DECISION_STATUSES = new Set(["opened", "closed", "cancelled"]);

function initiativeMatchesCountry(initiativeCountryCode: string, countryCode: string): boolean {
  return initiativeCountryCode === countryCode;
}

function countPublicInitiativesForCountry(countryCode: string): number {
  return listInitiatives().filter((initiative) => {
    if (!isInitiativeEligibleForPublicProjection(initiative)) {
      return false;
    }

    const geography = resolveInitiativeSearchGeography(initiative);
    return initiativeMatchesCountry(geography.country, countryCode);
  }).length;
}

function countPublicCollectiveDecisionsForCountry(countryCode: string): number {
  const initiativeIdsInCountry = new Set(
    listInitiatives()
      .filter((initiative) => {
        const geography = resolveInitiativeSearchGeography(initiative);
        return initiativeMatchesCountry(geography.country, countryCode);
      })
      .map((initiative) => initiative.initiativeId),
  );

  return listInitiativeCollectiveDecisions().filter(
    (decision) =>
      PUBLIC_COLLECTIVE_DECISION_STATUSES.has(decision.status) &&
      initiativeIdsInCountry.has(decision.initiativeId),
  ).length;
}

function countPublicOfficialResponsesForCountry(countryCode: string): number {
  const initiativeIdsInCountry = new Set(
    listInitiatives()
      .filter((initiative) => {
        const geography = resolveInitiativeSearchGeography(initiative);
        return initiativeMatchesCountry(geography.country, countryCode);
      })
      .map((initiative) => initiative.initiativeId),
  );

  return listOfficialResponses().filter(
    (response) =>
      (response.publicationStatus === "published" || response.publicationStatus === "archived") &&
      initiativeIdsInCountry.has(response.initiativeId),
  ).length;
}

function countIssuedCivicActionPackagesForCountry(countryCode: string): number {
  const initiativeIdsInCountry = new Set(
    listInitiatives()
      .filter((initiative) => {
        const geography = resolveInitiativeSearchGeography(initiative);
        return initiativeMatchesCountry(geography.country, countryCode);
      })
      .map((initiative) => initiative.initiativeId),
  );

  return listCaps().filter(
    (capPackage) =>
      capPackage.status === "issued" && initiativeIdsInCountry.has(capPackage.initiativeId),
  ).length;
}

function countPublishedCivicArchiveForCountry(countryCode: string): number {
  const initiativeIdsInCountry = new Set(
    listInitiatives()
      .filter((initiative) => {
        const geography = resolveInitiativeSearchGeography(initiative);
        return initiativeMatchesCountry(geography.country, countryCode);
      })
      .map((initiative) => initiative.initiativeId),
  );

  return listPublishedArchiveRecords().filter((record) =>
    initiativeIdsInCountry.has(record.initiativeId),
  ).length;
}

function countParticipationGeographyForCountry(countryCode: string): {
  regions: number;
  citiesCommunities: number;
} {
  const activeAreas = listActiveParticipationAreas().filter((area) => {
    const normalized = normalizeCountryInput(area.countrySlug);
    return normalized === countryCode;
  });

  const regions = new Set<string>();
  const communities = new Set<string>();

  for (const area of activeAreas) {
    if (area.regionSlug?.trim()) {
      regions.add(area.regionSlug.trim().toUpperCase());
    }

    if (area.communitySlug?.trim()) {
      communities.add(area.communitySlug.trim().toLowerCase());
    }
  }

  if (regions.size === 0) {
    return {
      regions: getRegionsByCountry(countryCode).length,
      citiesCommunities: communities.size,
    };
  }

  return {
    regions: regions.size,
    citiesCommunities: communities.size,
  };
}

async function buildCountryStatisticsCounts(countryCode: string): Promise<CountryStatisticsCounts> {
  const geography = countParticipationGeographyForCountry(countryCode);

  let members = 0;
  let participants = 0;

  try {
    members = await countActiveMembershipMembersByCountry(countryCode);
    const verifiedInCountry = await countVerifiedParticipantsByCountry(countryCode);
    participants = Math.max(0, verifiedInCountry - members);
  } catch {
    const verifiedTotal = await countVerifiedActiveAuthUsers().catch(() => 0);
    members = 0;
    participants = verifiedTotal;
  }

  return {
    participants,
    members,
    regions: geography.regions,
    citiesCommunities: geography.citiesCommunities,
    initiatives: countPublicInitiativesForCountry(countryCode),
    collectiveDecisions: countPublicCollectiveDecisionsForCountry(countryCode),
    civicActionPackages: countIssuedCivicActionPackagesForCountry(countryCode),
    officialResponses: countPublicOfficialResponsesForCountry(countryCode),
    civicArchive: countPublishedCivicArchiveForCountry(countryCode),
  };
}

export async function getCountryStatisticsPayload(
  countryCodeInput: string,
): Promise<CountryStatisticsPayload | null> {
  const countryCode = normalizeCountryInput(countryCodeInput);

  if (!countryCode) {
    return null;
  }

  const country = getCountryByCode(countryCode);

  if (!country) {
    return null;
  }

  return {
    countryCode,
    countryName: country.name,
    data: await buildCountryStatisticsCounts(countryCode),
    meta: {
      generatedAt: new Date().toISOString(),
      transparencyNote: MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE,
    },
  };
}
