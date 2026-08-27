import type { AdminPlatformReadinessPublic } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchAdminPlatformReadiness(): Promise<AdminPlatformReadinessPublic> {
  return apiRequest<AdminPlatformReadinessPublic>("/api/v1/admin/platform/readiness");
}
