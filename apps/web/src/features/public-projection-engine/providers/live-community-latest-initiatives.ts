import type { LatestInitiativesPublicProjection } from "@hu/types";

import { apiRequest } from "../../../lib/api-client";

export async function fetchCommunityLatestInitiativesProjection(
  communitySlug: string,
): Promise<LatestInitiativesPublicProjection | null> {
  try {
    return await apiRequest<LatestInitiativesPublicProjection>(
      `/api/v1/public/projections/communities/${encodeURIComponent(communitySlug)}/latest-initiatives`,
    );
  } catch {
    return null;
  }
}
