import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
} from "@hu/types";

import {
  BOOTSTRAP_COMMUNITY_CATALOG,
  BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG,
  isBootstrapCommunitySlug,
} from "./bootstrap-communities";

export async function getCommunityCatalogPublicProjection(): Promise<CommunityCatalogPublicProjection> {
  return BOOTSTRAP_COMMUNITY_CATALOG;
}

export async function getCommunityExperiencePublicProjections(
  slug: string,
): Promise<CommunityExperiencePublicProjections | null> {
  if (!isBootstrapCommunitySlug(slug)) {
    return null;
  }

  return BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG[slug] ?? null;
}
