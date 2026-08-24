import type {
  PlatformSocialAccount,
  PlatformSocialAccountListResponse,
  PlatformSocialNetworkId,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

/** Pack 17G — re-export public client so Admin panel can load the same catalog helpers. */
export { fetchPublicPlatformSocialAccounts } from "../platform-social-accounts/platform-social-accounts-public-api";

export async function fetchAdminPlatformSocialAccounts(): Promise<PlatformSocialAccountListResponse> {
  return apiRequest<PlatformSocialAccountListResponse>(
    "/api/v1/admin/platform/social-accounts",
  );
}

export async function saveAdminPlatformSocialAccount(input: {
  networkId: PlatformSocialNetworkId;
  url: string;
}): Promise<PlatformSocialAccount> {
  return apiRequest<PlatformSocialAccount>(
    `/api/v1/admin/platform/social-accounts/${encodeURIComponent(input.networkId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.url }),
    },
  );
}

export async function clearAdminPlatformSocialAccount(
  networkId: PlatformSocialNetworkId,
): Promise<PlatformSocialAccount> {
  return apiRequest<PlatformSocialAccount>(
    `/api/v1/admin/platform/social-accounts/${encodeURIComponent(networkId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    },
  );
}
