import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
  CountryExperiencePublicProjections,
  LatestInitiativesPublicProjection,
  ParticipationPipelinePublicProjection,
  ParticipationPublicStatisticsProjection,
  RegionExperiencePublicProjections,
} from "@hu/types";

import type { PublicProjectionProvider } from "../provider";
import type { PublicProjectionScopeRef } from "../types";

const CAPABILITY_02_NOT_IMPLEMENTED =
  "Capability 02 Projection API provider is not implemented. Set PUBLIC_PROJECTION_PROVIDER=bootstrap.";

/**
 * Placeholder Capability 02 provider. Implements PublicProjectionProvider so the engine
 * can swap providers without Experience page changes when live APIs ship.
 */
export class ApiPublicProjectionProvider implements PublicProjectionProvider {
  readonly mode = "api" as const;

  async getParticipationStatistics(
    _scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPublicStatisticsProjection | null> {
    return null;
  }

  async getParticipationPipeline(
    _scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPipelinePublicProjection | null> {
    return null;
  }

  async getLatestInitiatives(
    _scopeRef: PublicProjectionScopeRef,
  ): Promise<LatestInitiativesPublicProjection | null> {
    return null;
  }

  async getCommunityExperienceProjections(
    _slug: string,
  ): Promise<CommunityExperiencePublicProjections | null> {
    return null;
  }

  async getCommunityCatalog(): Promise<CommunityCatalogPublicProjection> {
    throw new Error(CAPABILITY_02_NOT_IMPLEMENTED);
  }

  async getCountryExperienceProjections(
    _countrySlug: string,
  ): Promise<CountryExperiencePublicProjections | null> {
    return null;
  }

  async getRegionExperienceProjections(
    _regionSlug: string,
  ): Promise<RegionExperiencePublicProjections | null> {
    return null;
  }

  async getKnownCommunitySlugs(): Promise<readonly string[]> {
    return [];
  }

  async getKnownCountrySlugs(): Promise<readonly string[]> {
    return [];
  }

  async getKnownRegionSlugs(): Promise<readonly string[]> {
    return [];
  }
}

export const apiPublicProjectionProvider = new ApiPublicProjectionProvider();
