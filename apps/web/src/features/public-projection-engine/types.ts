import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
  CountryExperiencePublicProjections,
  LatestInitiativesPublicProjection,
  ParticipationPipelinePublicProjection,
  ParticipationPublicStatisticsProjection,
  PublicGeographicScope,
  RegionExperiencePublicProjections,
} from "@hu/types";

export type PublicProjectionProviderMode = "bootstrap" | "api";

/** Geographic scope key passed to provider scope-based getters (Capability 02 contract). */
export interface PublicProjectionScopeRef {
  scope: PublicGeographicScope;
  /** Country code, region identifier, or community slug when the scope requires a key. */
  scopeKey?: string;
}

export interface PublicParticipationEvidenceProjections {
  statistics: ParticipationPublicStatisticsProjection;
  pipeline: ParticipationPipelinePublicProjection;
  latestInitiatives: LatestInitiativesPublicProjection;
}

/** Page bundle returned to Global Experience — statistics, pipeline, latest initiatives. */
export type GlobalExperiencePublicProjections = PublicParticipationEvidenceProjections;

/** Page bundle returned to Country Experience. */
export interface CountryExperiencePageData {
  projections: CountryExperiencePublicProjections;
}

/** Page bundle returned to Region Experience. */
export interface RegionExperiencePageData {
  projections: RegionExperiencePublicProjections;
}

/** Page bundle returned to Community Experience. */
export interface CommunityExperiencePageData {
  projections: CommunityExperiencePublicProjections;
  catalog: CommunityCatalogPublicProjection;
}
