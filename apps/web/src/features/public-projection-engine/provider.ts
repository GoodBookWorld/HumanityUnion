import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
  CountryExperiencePublicProjections,
  LatestInitiativesPublicProjection,
  ParticipationPipelinePublicProjection,
  ParticipationPublicStatisticsProjection,
} from "@hu/types";

import type { PublicProjectionProviderMode, PublicProjectionScopeRef } from "./types";

export interface PublicProjectionProvider {
  readonly mode: PublicProjectionProviderMode;

  getParticipationStatistics(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPublicStatisticsProjection | null>;

  getParticipationPipeline(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPipelinePublicProjection | null>;

  getLatestInitiatives(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<LatestInitiativesPublicProjection | null>;

  getCommunityExperienceProjections(
    slug: string,
  ): Promise<CommunityExperiencePublicProjections | null>;

  getCommunityCatalog(): Promise<CommunityCatalogPublicProjection>;

  getCountryExperienceProjections(
    countrySlug: string,
  ): Promise<CountryExperiencePublicProjections | null>;
}
