import type { PublicParticipationProfile } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getPublicParticipationProfile(
  uniqueName: string,
): Promise<PublicParticipationProfile> {
  return apiRequest<PublicParticipationProfile>(
    `/api/v1/participation/public/${encodeURIComponent(uniqueName)}`,
  );
}
