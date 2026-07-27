import type { WorldInitiativesPublicProjection } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchWorldInitiativesProjection(
  limit = 18,
): Promise<WorldInitiativesPublicProjection> {
  const params = new URLSearchParams({ limit: String(limit) });

  return apiRequest<WorldInitiativesPublicProjection>(
    `/api/v1/public/projections/world-initiatives?${params.toString()}`,
  );
}
