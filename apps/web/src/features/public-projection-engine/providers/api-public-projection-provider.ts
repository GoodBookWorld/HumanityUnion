import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
  CountryExperiencePublicProjections,
  LatestInitiativesPublicProjection,
  ParticipationPipelinePublicProjection,
  ParticipationPublicStatisticsProjection,
  RegionExperiencePublicProjections,
} from "@hu/types";
import { getRegionByIsoCode } from "@hu/geography";

import { apiRequestOptional } from "../../../lib/api-client";
import type { PublicProjectionProvider } from "../provider";
import type { PublicProjectionScopeRef } from "../types";
import { applyLiveCommunityLatestInitiatives } from "./apply-live-community-latest-initiatives";
import {
  BOOTSTRAP_COMMUNITY_CATALOG,
  BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG,
  BOOTSTRAP_COMMUNITY_SLUGS,
  isBootstrapCommunitySlug,
} from "./bootstrap/communities";
import {
  fetchCommunityLatestInitiativesProjection,
  fetchPublicProjectionCommunitySlugs,
} from "./live-community-latest-initiatives";

function getBootstrapCommunityExperienceShell(
  slug: string,
): CommunityExperiencePublicProjections | null {
  if (!isBootstrapCommunitySlug(slug)) {
    return null;
  }

  return BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG[slug] ?? null;
}

/**
 * Capability 02 live projection provider.
 * Community latest initiatives are API-backed; other scopes/blocks defer to bootstrap shell or null.
 */
export class ApiPublicProjectionProvider implements PublicProjectionProvider {
  readonly mode = "api" as const;

  async getParticipationStatistics(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPublicStatisticsProjection | null> {
    if (scopeRef.scope === "community" && scopeRef.scopeKey) {
      return getBootstrapCommunityExperienceShell(scopeRef.scopeKey)?.statistics ?? null;
    }

    return null;
  }

  async getParticipationPipeline(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPipelinePublicProjection | null> {
    if (scopeRef.scope === "community" && scopeRef.scopeKey) {
      return getBootstrapCommunityExperienceShell(scopeRef.scopeKey)?.pipeline ?? null;
    }

    return null;
  }

  async getLatestInitiatives(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<LatestInitiativesPublicProjection | null> {
    if (scopeRef.scope !== "community" || !scopeRef.scopeKey) {
      return null;
    }

    return fetchCommunityLatestInitiativesProjection(scopeRef.scopeKey);
  }

  async getCommunityExperienceProjections(
    slug: string,
  ): Promise<CommunityExperiencePublicProjections | null> {
    const experienceShell = getBootstrapCommunityExperienceShell(slug);

    if (!experienceShell) {
      return null;
    }

    const liveLatestInitiatives = await fetchCommunityLatestInitiativesProjection(slug);

    return applyLiveCommunityLatestInitiatives(experienceShell, liveLatestInitiatives);
  }

  async getCommunityCatalog(): Promise<CommunityCatalogPublicProjection> {
    return BOOTSTRAP_COMMUNITY_CATALOG;
  }

  async getCountryExperienceProjections(
    _countrySlug: string,
  ): Promise<CountryExperiencePublicProjections | null> {
    return null;
  }

  /**
   * REGION-500B.2 — real public region projection. Unknown regions are null (404);
   * API failures throw so the page never falls back to bootstrap data.
   */
  async getRegionExperienceProjections(
    regionCode: string,
  ): Promise<RegionExperiencePublicProjections | null> {
    const region = getRegionByIsoCode(regionCode);

    if (!region) {
      return null;
    }

    return apiRequestOptional<RegionExperiencePublicProjections>(
      `/api/v1/public/countries/${encodeURIComponent(region.countryCode)}/regions/${encodeURIComponent(region.code)}`,
    );
  }

  async getKnownCommunitySlugs(): Promise<readonly string[]> {
    const liveSlugs = await fetchPublicProjectionCommunitySlugs();

    return liveSlugs.length > 0 ? liveSlugs : BOOTSTRAP_COMMUNITY_SLUGS;
  }

  async getKnownCountrySlugs(): Promise<readonly string[]> {
    return [];
  }

  async getKnownRegionSlugs(): Promise<readonly string[]> {
    return [];
  }
}

export const apiPublicProjectionProvider = new ApiPublicProjectionProvider();
