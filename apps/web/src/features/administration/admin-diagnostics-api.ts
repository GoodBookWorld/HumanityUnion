import { apiRequest } from "../../lib/api-client";
import { listAdminInitiatives } from "./admin-initiative-directory-api";
import type { ApiHealthPayload, ApiReadyPayload } from "./admin-diagnostics-model";

/** Authenticated Admin detailed health — never the public redacted /health surface. */
const ADMIN_DIAGNOSTICS_HEALTH_PATH = "/api/v1/admin/diagnostics/health";
const READY_PATH = "/api/v1/health/ready";

/** Read-only paths used by Diagnostics Refresh — never mutate. */
export const DIAGNOSTICS_READ_ONLY_PATHS = [
  ADMIN_DIAGNOSTICS_HEALTH_PATH,
  READY_PATH,
  "/api/v1/admin/initiatives",
] as const;

export async function fetchApiHealth(): Promise<ApiHealthPayload> {
  return apiRequest<ApiHealthPayload>(ADMIN_DIAGNOSTICS_HEALTH_PATH);
}

export async function fetchApiReady(): Promise<ApiReadyPayload> {
  return apiRequest<ApiReadyPayload>(READY_PATH);
}

export interface InitiativeIntegrityWarningSample {
  readonly initiativeId: string;
  readonly title: string;
}

export interface InitiativeIntegrityWarningSummary {
  readonly warningCount: number;
  readonly samples: readonly InitiativeIntegrityWarningSample[];
}

/**
 * Count Initiative integrity warnings from the Admin directory.
 * Reuses existing integrityStatus — does not recompute integrity.
 * Samples help Admin identify responsible Initiatives without mutating data.
 */
export async function countAdminInitiativeIntegrityWarnings(): Promise<InitiativeIntegrityWarningSummary> {
  const listing = await listAdminInitiatives({
    limit: 100,
    offset: 0,
    sort: "updatedAt",
    order: "desc",
  });

  const warned = listing.initiatives.filter((row) => row.integrityStatus === "warning");
  return {
    warningCount: warned.length,
    samples: warned.slice(0, 8).map((row) => ({
      initiativeId: row.initiativeId,
      title: row.title?.trim() || row.initiativeId,
    })),
  };
}
