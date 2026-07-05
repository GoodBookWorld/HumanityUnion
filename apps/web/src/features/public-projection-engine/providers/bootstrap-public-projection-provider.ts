import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
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
import { WORLD_PARTICIPATION_PIPELINE_PUBLIC_PROJECTION } from "./bootstrap/world-pipeline";
import { WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION } from "./bootstrap/world-latest-initiatives";
import { WORLD_PARTICIPATION_PUBLIC_STATISTICS_PROJECTION } from "./bootstrap/world-statistics";

function getCommunityProjections(slug: string): CommunityExperiencePublicProjections | null {
  if (!isBootstrapCommunitySlug(slug)) {
    return null;
  }

  return BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG[slug] ?? null;
}

export class BootstrapPublicProjectionProvider implements PublicProjectionProvider {
  readonly mode = "bootstrap" as const;

  async getParticipationStatistics(
    scopeRef: PublicProjectionScopeRef,
  ): Promise<ParticipationPublicStatisticsProjection | null> {
    switch (scopeRef.scope) {
      case "world":
        return WORLD_PARTICIPATION_PUBLIC_STATISTICS_PROJECTION;
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.statistics ?? null;
      }
      case "country":
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
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.pipeline ?? null;
      }
      case "country":
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
      case "community": {
        if (!scopeRef.scopeKey) {
          return null;
        }

        return getCommunityProjections(scopeRef.scopeKey)?.latestInitiatives ?? null;
      }
      case "country":
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
}

export const bootstrapPublicProjectionProvider = new BootstrapPublicProjectionProvider();
