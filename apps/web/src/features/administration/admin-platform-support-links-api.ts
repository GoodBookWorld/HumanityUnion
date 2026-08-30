import { apiRequest } from "../../lib/api-client";
import type {
  PlatformSupportLink,
  PlatformSupportLinkId,
  PlatformSupportLinkListResponse,
} from "@hu/types";

const ADMIN_SUPPORT_LINKS_PATH = "/api/v1/admin/platform/support-links";

export async function fetchAdminPlatformSupportLinks(): Promise<PlatformSupportLinkListResponse> {
  return apiRequest<PlatformSupportLinkListResponse>(ADMIN_SUPPORT_LINKS_PATH);
}

export async function saveAdminPlatformSupportLink(input: {
  linkId: PlatformSupportLinkId;
  url: string;
}): Promise<PlatformSupportLink> {
  return apiRequest<PlatformSupportLink>(`${ADMIN_SUPPORT_LINKS_PATH}/${input.linkId}`, {
    method: "PUT",
    body: JSON.stringify({ url: input.url, enabled: true }),
  });
}

export async function clearAdminPlatformSupportLink(
  linkId: PlatformSupportLinkId,
): Promise<PlatformSupportLink> {
  return apiRequest<PlatformSupportLink>(`${ADMIN_SUPPORT_LINKS_PATH}/${linkId}`, {
    method: "PUT",
    body: JSON.stringify({ clear: true }),
  });
}
