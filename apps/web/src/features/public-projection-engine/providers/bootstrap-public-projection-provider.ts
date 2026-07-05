import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
  CountryExperiencePublicProjections,
  LatestInitiativesPublicProjection,
  ParticipationPipelinePublicProjection,
  ParticipationPublicStatisticsProjection,
} from "@hu/types";

import type { PublicProjectionProvider } from "../provider";
import type { PublicProjectionScopeRef } from "../types";
import {
  BOOTSTRAP_COMMUNITY_CATALOG,
  BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG,
  isBootstrapCommunitySlug,
} from "./bootstrap/communities";
import {
  BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG,
  getBootstrapCountryProjections,
  isBootstrapCountrySlug,
} from "./bootstrap/countries";
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
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.statistics ?? null;
      }
      case "region":
        return null;
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
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.pipeline ?? null;
      }
      case "region":
        return null;
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
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.latestInitiatives ?? null;
      }
      case "region":
        return null;
      default:
        return null;
    }
  }

  async getCommunityExperienceProjections(
    slug: string,
  ): Promise<CommunityExperiencePublicProjections | null> {
    return getCommunityProjections(slug);
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
}

export const bootstrapPublicProjectionProvider = new BootstrapPublicProjectionProvider();
