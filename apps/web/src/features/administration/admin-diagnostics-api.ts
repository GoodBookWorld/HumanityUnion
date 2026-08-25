import { apiRequest } from "../../lib/api-client";
import { listAdminInitiatives } from "./admin-initiative-directory-api";
import type { ApiHealthPayload, ApiReadyPayload } from "./admin-diagnostics-model";

const HEALTH_PATH = "/api/v1/health";
const READY_PATH = "/api/v1/health/ready";

/** Read-only paths used by Diagnostics Refresh — never mutate. */
export const DIAGNOSTICS_READ_ONLY_PATHS = [
  HEALTH_PATH,
  READY_PATH,
  "/api/v1/admin/initiatives",
] as const;

export async function fetchApiHealth(): Promise<ApiHealthPayload> {
  return apiRequest<ApiHealthPayload>(HEALTH_PATH);
}

export async function fetchApiReady(): Promise<ApiReadyPayload> {
  return apiRequest<ApiReadyPayload>(READY_PATH);
}

/**
 * Count Initiative integrity warnings from the Admin directory.
 * Reuses existing integrityStatus — does not recompute integrity.
 */
export async function countAdminInitiativeIntegrityWarnings(): Promise<number> {
  const listing = await listAdminInitiatives({
    limit: 100,
    offset: 0,
    sort: "updatedAt",
    order: "desc",
  });

  return listing.initiatives.filter((row) => row.integrityStatus === "warning").length;
}
