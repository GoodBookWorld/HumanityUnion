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

export type GlobalExperiencePublicProjections = PublicParticipationEvidenceProjections;

export interface CommunityExperiencePageData {
  projections: CommunityExperiencePublicProjections;
  catalog: CommunityCatalogPublicProjection;
}

export interface CountryExperiencePageData {
  projections: CountryExperiencePublicProjections;
}

export interface RegionExperiencePageData {
  projections: RegionExperiencePublicProjections;
}
