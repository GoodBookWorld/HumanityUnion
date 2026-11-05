/**
 * REGION-500B.1 — public region projection from real records only.
 *
 * Geography comes from the @hu/geography registry. A region's records are its
 * ordinary-public initiatives (same country/region rule as country discovery,
 * World scope excluded) plus the published records linked to those initiatives,
 * read from the global search index (which applies each record type's
 * publication rules). No bootstrap or demonstration data is used.
 */
import {
  getCountryByCode,
  getRegionByCode,
  normalizeCountryInput,
  normalizeRegionInput,
} from "@hu/geography";
import type {
  CivicEntityType,
  CommunityPublicRecord,
  Initiative,
  LatestInitiativeCardProjection,
  ParticipationPipelineStageCount,
  ParticipationPublicStatisticsIndicator,
  RegionExperiencePublicProjections,
  WorldInitiativeCardProjection,
} from "@hu/types";

import {
  getGlobalSearchIndex,
  isSearchIndexEntryOrdinaryPublic,
} from "../global-search/global-search.index.js";
import { resolveInitiativeSearchGeography } from "../initiatives/initiative-geography.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { listInitiatives } from "../initiatives/initiative.store.js";
import { loadCommunitiesForRegion } from "../participation-area/participation-area-community.loader.js";
import {
  DEMONSTRATION_INITIATIVE_ID_PREFIX,
  listCountryInitiativeCardProjections,
  matchesCountryDiscoveryGeography,
} from "./country-public.service.js";

export const REGION_LATEST_INITIATIVES_LIMIT = 12;

/** Ordinary-public, non-demonstration initiative; geography is checked separately. */
function isRegionCandidateInitiative(initiative: Initiative): boolean {
  return (
    !initiative.initiativeId.startsWith(DEMONSTRATION_INITIATIVE_ID_PREFIX) &&
    isInitiativeEligibleForPublicProjection(initiative)
  );
}

export interface PublicRegionWithContent {
  countryCode: string;
  regionCode: string;
  initiativeCount: number;
  /** Latest updatedAt among the region's public initiatives. */
  updatedAt: string;
}

/**
 * REGION-500B.3 — registry regions that have at least one public regional
 * initiative under the same rules as buildRegionPublicProjection (World scope
 * excluded), in one pass over the initiative store. Used for the sitemap.
 */
export function listPublicRegionsWithContent(
  initiatives: readonly Initiative[] = listInitiatives(),
): PublicRegionWithContent[] {
  const regions = new Map<string, PublicRegionWithContent>();

  for (const initiative of initiatives) {
    if (!isRegionCandidateInitiative(initiative)) {
      continue;
    }

    const { country, region } = resolveInitiativeSearchGeography(initiative);
    const resolved = country && region ? resolvePublicRegion(country, region) : null;

    if (
      !resolved ||
      resolved.regionCode !== region ||
      !matchesCountryDiscoveryGeography(initiative, resolved.countryCode, {
        regionCode: resolved.regionCode,
      })
    ) {
      continue;
    }

    const key = `${resolved.countryCode}::${resolved.regionCode}`;
    const current = regions.get(key);

    regions.set(key, {
      countryCode: resolved.countryCode,
      regionCode: resolved.regionCode,
      initiativeCount: (current?.initiativeCount ?? 0) + 1,
      updatedAt:
        current && current.updatedAt > initiative.updatedAt
          ? current.updatedAt
          : initiative.updatedAt,
    });
  }

  return [...regions.values()].sort((left, right) =>
    left.regionCode.localeCompare(right.regionCode),
  );
}

export interface ResolvedPublicRegion {
  countryCode: string;
  countryName: string;
  regionCode: string;
  regionName: string;
  administrativeType: string | null;
}

export interface RegionPublicProjectionPayload {
  region: ResolvedPublicRegion;
  /** True when the request already used the canonical ISO 3166-2 code. */
  canonical: boolean;
  projections: RegionExperiencePublicProjections;
}

/**
 * Resolves a country and a region of that country. Accepts the ISO 3166-2 code
 * (any case), the local code, the English name or its slug; always returns the
 * canonical ISO code. Regions of other countries and "other / not listed" are rejected.
 */
export function resolvePublicRegion(
  countryInput: string,
  regionInput: string,
): ResolvedPublicRegion | null {
  const countryCode = normalizeCountryInput(countryInput);
  const country = countryCode ? getCountryByCode(countryCode) : undefined;

  if (!countryCode || !country) {
    return null;
  }

  const regionCode = normalizeRegionInput(countryCode, regionInput);
  const region = regionCode ? getRegionByCode(countryCode, regionCode) : undefined;

  if (!region || region.countryCode !== countryCode) {
    return null;
  }

  return {
    countryCode,
    countryName: country.name,
    regionCode: region.code,
    regionName: region.name,
    administrativeType: region.type ?? null,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function toLatestInitiativeCard(
  card: WorldInitiativeCardProjection,
  index: number,
): LatestInitiativeCardProjection {
  return {
    initiativeId: card.initiativeId,
    title: card.title,
    summary: card.summary,
    geographicScope: card.geographyLabel,
    participationStage: card.currentStageLabel ?? card.publicStatus,
    publicStatus: card.publicStatus,
    publicRouteStatus: "active",
    publicInitiativeHref: card.publicInitiativeHref,
    relatedPublicLinks: [],
    recencyOrder: index + 1,
  };
}

function countLinkedRecordsByType(
  entries: Awaited<ReturnType<typeof getGlobalSearchIndex>>,
  initiativeIds: ReadonlySet<string>,
): Map<CivicEntityType, number> {
  const counts = new Map<CivicEntityType, number>();

  for (const entry of entries) {
    if (entry.entityType === "initiative" || entry.entityType === "initiative_revision") {
      continue;
    }

    if (!entry.initiativeId || !initiativeIds.has(entry.initiativeId)) {
      continue;
    }

    if (!isSearchIndexEntryOrdinaryPublic(entry)) {
      continue;
    }

    counts.set(entry.entityType, (counts.get(entry.entityType) ?? 0) + 1);
  }

  return counts;
}

export async function buildRegionPublicProjection(
  countryInput: string,
  regionInput: string,
): Promise<RegionPublicProjectionPayload | null> {
  const region = resolvePublicRegion(countryInput, regionInput);

  if (!region) {
    return null;
  }

  const { countryCode, countryName, regionCode, regionName } = region;
  const generatedAt = new Date().toISOString();

  const regionInitiatives = listInitiatives().filter(
    (initiative) =>
      isRegionCandidateInitiative(initiative) &&
      matchesCountryDiscoveryGeography(initiative, countryCode, { regionCode }),
  );
  const initiativeIds = new Set(regionInitiatives.map((initiative) => initiative.initiativeId));

  const linked =
    initiativeIds.size > 0
      ? countLinkedRecordsByType(await getGlobalSearchIndex(), initiativeIds)
      : new Map<CivicEntityType, number>();
  const linkedCount = (type: CivicEntityType) => linked.get(type) ?? 0;

  const communityLabels =
    initiativeIds.size > 0
      ? new Map(loadCommunitiesForRegion(countryCode, regionCode).map((c) => [c.code, c.label]))
      : new Map<string, string>();
  const initiativesByCommunity = new Map<string, number>();

  for (const initiative of regionInitiatives) {
    const { community } = resolveInitiativeSearchGeography(initiative);

    if (community && communityLabels.has(community)) {
      initiativesByCommunity.set(community, (initiativesByCommunity.get(community) ?? 0) + 1);
    }
  }

  const communities: CommunityPublicRecord[] = [...initiativesByCommunity.entries()]
    .map(([code, initiativeCount]) => ({
      slug: code,
      name: communityLabels.get(code) ?? code,
      description: "",
      activityArea: "",
      regionLabel: regionName,
      countryLabel: countryName,
      regionSlug: regionCode,
      countrySlug: countryCode,
      initiativeCount,
      communityHref: `/search?${new URLSearchParams({
        country: countryCode,
        region: regionCode,
        community: code,
      }).toString()}`,
      communityRouteStatus: "active" as const,
    }))
    .sort(
      (left, right) =>
        right.initiativeCount - left.initiativeCount || left.name.localeCompare(right.name),
    );

  const latestCards = (
    await listCountryInitiativeCardProjections(countryCode, {
      regionCode,
      limit: REGION_LATEST_INITIATIVES_LIMIT,
    })
  ).filter((card) => initiativeIds.has(card.initiativeId));

  const indicators: ParticipationPublicStatisticsIndicator[] = [
    { id: "region-initiatives", label: "Public initiatives", value: initiativeIds.size },
    {
      id: "region-collaborative-analyses",
      label: "Collaborative analyses",
      value: linkedCount("analysis"),
    },
    {
      id: "region-collective-decisions",
      label: "Collective decisions",
      value: linkedCount("collective_decision"),
    },
    { id: "region-petitions", label: "Petitions", value: linkedCount("petition") },
    {
      id: "region-civic-action-packages",
      label: "Civic action packages",
      value: linkedCount("civic_action_package"),
    },
    {
      id: "region-official-responses",
      label: "Official responses",
      value: linkedCount("official_response"),
    },
    {
      id: "region-civic-archive",
      label: "Civic archive records",
      value: linkedCount("civic_archive"),
    },
    {
      id: "region-communities",
      label: "Communities with public initiatives",
      value: communities.length,
    },
  ].map((indicator) => ({ ...indicator, derived: false }));

  const stages: ParticipationPipelineStageCount[] = [
    { stageId: "initiative", label: "Initiative", count: initiativeIds.size },
    {
      stageId: "collaborative-analysis",
      label: "Collaborative Analysis",
      count: linkedCount("analysis"),
    },
    {
      stageId: "collective-decision",
      label: "Collective Decision",
      count: linkedCount("collective_decision"),
    },
    { stageId: "petition", label: "Petition", count: linkedCount("petition") },
    {
      stageId: "implementation-commitment",
      label: "Implementation Commitment",
      count: linkedCount("implementation_commitment"),
    },
    {
      stageId: "implementation",
      label: "Implementation",
      count: linkedCount("implementation_tracking"),
    },
  ];

  return {
    region,
    canonical: regionInput.trim() === regionCode,
    projections: {
      identity: {
        slug: regionCode,
        name: regionName,
        description: "",
        countrySlug: countryCode,
        countryLabel: countryName,
        representativeVisual: {
          kind: "placeholder",
          caption: regionName,
          initials: initials(regionName),
        },
        source: "projection",
        regionCode,
        countryCode,
        administrativeType: region.administrativeType,
      },
      statistics: {
        scope: "region",
        scopeLabel: regionName,
        indicators,
        generatedAt,
        source: "projection",
      },
      pipeline: {
        scope: "region",
        scopeLabel: regionName,
        stages,
        generatedAt,
        source: "projection",
      },
      latestInitiatives: {
        scope: "region",
        scopeLabel: regionName,
        source: "projection",
        generatedAt,
        initiatives: latestCards.map(toLatestInitiativeCard),
      },
      communityCatalog: { communities, generatedAt, source: "projection" },
    },
  };
}
