/**
 * Pack 17C/17G — public Platform Social Accounts client.
 * Canonical Admin-owned destinations only (no credentials).
 * Kept outside `administration/` so Footer and Publishing can share it cleanly.
 */
import type { PlatformSocialAccountPublicListResponse } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchPublicPlatformSocialAccounts(): Promise<
  PlatformSocialAccountPublicListResponse
> {
  return apiRequest<PlatformSocialAccountPublicListResponse>(
    "/api/v1/platform/social-accounts",
  );
}
