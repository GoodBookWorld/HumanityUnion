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
import {
  BOOTSTRAP_COMMUNITY_CATALOG,
  BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG,
  BOOTSTRAP_COMMUNITY_SLUGS,
  isBootstrapCommunitySlug,
} from "./bootstrap/communities";
import { fetchCommunityLatestInitiativesProjection } from "./live-community-latest-initiatives";
import { mergeCommunityLatestInitiatives } from "./merge-community-latest-initiatives";
import {
  BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG,
  BOOTSTRAP_COUNTRY_SLUGS,
  getBootstrapCountryProjections,
  isBootstrapCountrySlug,
} from "./bootstrap/countries";
import {
  BOOTSTRAP_REGION_PROJECTIONS_BY_SLUG,
  BOOTSTRAP_REGION_SLUGS,
  getBootstrapRegionProjections,
  isBootstrapRegionSlug,
} from "./bootstrap/regions";
import { WORLD_PARTICIPATION_PIPELINE_PUBLIC_PROJECTION } from "./bootstrap/world-pipeline";
import { WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION } from "./bootstrap/world-latest-initiatives";
import { WORLD_PARTICIPATION_PUBLIC_STATISTICS_PROJECTION } from "./bootstrap/world-statistics";

function getCommunityProjections(slug: string): CommunityExperiencePublicProjections | null {
  if (!isBootstrapCommunitySlug(slug)) {
    return null;
  }

  return BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG[slug] ?? null;
}

function getCountryProjections(countrySlug: string): CountryExperiencePublicProjections | null {
  return getBootstrapCountryProjections(countrySlug);
}

function getRegionProjections(regionSlug: string): RegionExperiencePublicProjections | null {
  return getBootstrapRegionProjections(regionSlug);
}

export class BootstrapPublicProjectionProvider implements PublicProjectionProvider {
  readonly mode = "bootstrap" as const;

  async getParticipationStatistics(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPublicStatisticsProjection | null> {
    switch (scopeRef.scope) {
      case "world":
        return WORLD_PARTICIPATION_PUBLIC_STATISTICS_PROJECTION;
      case "country": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCountryProjections(scopeRef.scopeKey)?.statistics ?? null;
      }
      case "region": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getRegionProjections(scopeRef.scopeKey)?.statistics ?? null;
      }
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.statistics ?? null;
      }
      default:
        return null;
    }
  }

  async getParticipationPipeline(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPipelinePublicProjection | null> {
    switch (scopeRef.scope) {
      case "world":
        return WORLD_PARTICIPATION_PIPELINE_PUBLIC_PROJECTION;
      case "country": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCountryProjections(scopeRef.scopeKey)?.pipeline ?? null;
      }
      case "region": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getRegionProjections(scopeRef.scopeKey)?.pipeline ?? null;
      }
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.pipeline ?? null;
      }
      default:
        return null;
    }
  }

  async getLatestInitiatives(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<LatestInitiativesPublicProjection | null> {
    switch (scopeRef.scope) {
      case "world":
        return WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION;
      case "country": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCountryProjections(scopeRef.scopeKey)?.latestInitiatives ?? null;
      }
      case "region": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getRegionProjections(scopeRef.scopeKey)?.latestInitiatives ?? null;
      }
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.latestInitiatives ?? null;
      }
      default:
        return null;
    }
  }

  async getCommunityExperienceProjections(
    slug: string,
  ): Promise<CommunityExperiencePublicProjections | null> {
    const bootstrapProjections = getCommunityProjections(slug);

    if (!bootstrapProjections) {
      return null;
    }

    const liveLatestInitiatives = await fetchCommunityLatestInitiativesProjection(slug);

    return mergeCommunityLatestInitiatives(bootstrapProjections, liveLatestInitiatives);
  }

  async getCommunityCatalog(): Promise<CommunityCatalogPublicProjection> {
    return BOOTSTRAP_COMMUNITY_CATALOG;
  }

  async getCountryExperienceProjections(
    countrySlug: string,
  ): Promise<CountryExperiencePublicProjections | null> {
    if (!isBootstrapCountrySlug(countrySlug)) {
      return null;
    }

    return BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG[countrySlug] ?? null;
  }

  async getRegionExperienceProjections(
    regionSlug: string,
  ): Promise<RegionExperiencePublicProjections | null> {
    if (!isBootstrapRegionSlug(regionSlug)) {
      return null;
    }

    return BOOTSTRAP_REGION_PROJECTIONS_BY_SLUG[regionSlug] ?? null;
  }

  async getKnownCommunitySlugs(): Promise<readonly string[]> {
    return BOOTSTRAP_COMMUNITY_SLUGS;
  }

  async getKnownCountrySlugs(): Promise<readonly string[]> {
    return BOOTSTRAP_COUNTRY_SLUGS;
  }

  async getKnownRegionSlugs(): Promise<readonly string[]> {
    return BOOTSTRAP_REGION_SLUGS;
  }
}

export const bootstrapPublicProjectionProvider = new BootstrapPublicProjectionProvider();
