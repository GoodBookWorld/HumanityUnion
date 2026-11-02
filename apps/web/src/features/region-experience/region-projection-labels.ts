import type {
  ParticipationPipelinePublicProjection,
  ParticipationPipelineStageId,
  ParticipationPublicStatisticsProjection,
  RegionExperiencePublicProjections,
} from "@hu/types";

/**
 * REGION-500B.2 — existing translated catalog keys for the statistic ids and
 * pipeline stage ids of the real region projection (API provider). The API
 * label is kept only when no catalog entry exists. Bootstrap projections keep
 * their own labels.
 */
export const REGION_INDICATOR_LABEL_KEYS: Readonly<Record<string, string>> = {
  "region-initiatives": "publicStatistics.metrics.initiatives.label",
  "region-collaborative-analyses": "search.entityTypes.analysis",
  "region-collective-decisions": "publicStatistics.metrics.collectiveDecisions.label",
  "region-petitions": "search.entityTypes.petition",
  "region-civic-action-packages": "publicStatistics.metrics.civicActionPackages.label",
  "region-official-responses": "publicStatistics.metrics.officialResponses.label",
  "region-civic-archive": "publicStatistics.metrics.civicArchive.label",
  "region-communities": "publicStatistics.metrics.citiesCommunities.label",
};

export const REGION_PIPELINE_STAGE_LABEL_KEYS: Readonly<
  Record<ParticipationPipelineStageId, string>
> = {
  initiative: "search.entityTypes.initiative",
  "collaborative-analysis": "search.entityTypes.analysis",
  "collective-decision": "search.entityTypes.collective_decision",
  petition: "search.entityTypes.petition",
  "implementation-commitment": "search.entityTypes.implementation_commitment",
  implementation: "search.entityTypes.implementation_tracking",
};

export interface CatalogTranslator {
  (key: string): string;
  has(key: string): boolean;
}

function translate(t: CatalogTranslator, key: string | undefined, fallback: string): string {
  return key && t.has(key) ? t(key) : fallback;
}

export function localizeRegionStatistics(
  projection: ParticipationPublicStatisticsProjection,
  t: CatalogTranslator,
): ParticipationPublicStatisticsProjection {
  if (projection.source !== "projection") {
    return projection;
  }

  return {
    ...projection,
    indicators: projection.indicators.map((indicator) => ({
      ...indicator,
      label: translate(t, REGION_INDICATOR_LABEL_KEYS[indicator.id], indicator.label),
    })),
  };
}

/**
 * Replaces the API's English country name with the server-resolved localized
 * name (identity, initiative geography suffix, community catalog). Region names
 * stay as published by the registry.
 */
export function withLocalizedCountryName(
  projections: RegionExperiencePublicProjections,
  countryName: string,
): RegionExperiencePublicProjections {
  const english = projections.identity.countryLabel;

  if (projections.identity.source !== "projection" || !countryName || countryName === english) {
    return projections;
  }

  const suffix = ` · ${english}`;

  return {
    ...projections,
    identity: { ...projections.identity, countryLabel: countryName },
    latestInitiatives: {
      ...projections.latestInitiatives,
      initiatives: projections.latestInitiatives.initiatives.map((card) =>
        card.geographicScope.endsWith(suffix)
          ? {
              ...card,
              geographicScope: `${card.geographicScope.slice(0, -suffix.length)} · ${countryName}`,
            }
          : card,
      ),
    },
    communityCatalog: {
      ...projections.communityCatalog,
      communities: projections.communityCatalog.communities.map((community) =>
        community.countryLabel === english
          ? { ...community, countryLabel: countryName }
          : community,
      ),
    },
  };
}

export function localizeRegionPipeline(
  projection: ParticipationPipelinePublicProjection,
  t: CatalogTranslator,
): ParticipationPipelinePublicProjection {
  if (projection.source !== "projection") {
    return projection;
  }

  return {
    ...projection,
    stages: projection.stages.map((stage) => ({
      ...stage,
      label: translate(t, REGION_PIPELINE_STAGE_LABEL_KEYS[stage.stageId], stage.label),
    })),
  };
}
