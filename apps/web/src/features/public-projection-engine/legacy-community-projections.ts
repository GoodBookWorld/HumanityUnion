import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
} from "@hu/types";

import { publicProjectionEngine } from "./public-projection-engine";

export async function getCommunityCatalogPublicProjection(): Promise<CommunityCatalogPublicProjection> {
  return publicProjectionEngine.getCommunityCatalog();
}

export async function getCommunityExperiencePublicProjections(
  slug: string,
): Promise<CommunityExperiencePublicProjections | null> {
  return publicProjectionEngine.getCommunityExperienceProjections(slug);
}
