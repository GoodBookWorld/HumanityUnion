import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
  CountryExperiencePublicProjections,
  LatestInitiativesPublicProjection,
  ParticipationPipelinePublicProjection,
  ParticipationPublicStatisticsProjection,
  RegionExperiencePublicProjections,
} from "@hu/types";

import type { PublicProjectionProviderMode, PublicProjectionScopeRef } from "./types";

/**
 * Capability 02 integration boundary for Public Experience projection retrieval.
 * Implementations: BootstrapPublicProjectionProvider (today), ApiPublicProjectionProvider (future).
 * Experience UI depends on @hu/types models returned by PublicProjectionEngine loaders only.
 */
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

  getRegionExperienceProjections(
    regionSlug: string,
  ): Promise<RegionExperiencePublicProjections | null>;

  /** Slugs for Next.js generateStaticParams. API providers may return []. */
  getKnownCommunitySlugs(): Promise<readonly string[]>;

  getKnownCountrySlugs(): Promise<readonly string[]>;

  getKnownRegionSlugs(): Promise<readonly string[]>;
}
