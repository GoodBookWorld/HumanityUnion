import type { CivicSearchResult, WorldInitiativeCardProjection } from "@hu/types";

import { fetchPublicSearch } from "../global-search/api";
import { fetchWorldInitiativesProjection } from "../initiatives/world-initiatives-api";

export const HOME_LATEST_INITIATIVES_SLOT_COUNT = 18;

export async function fetchHomeLatestInitiatives(
  limit = HOME_LATEST_INITIATIVES_SLOT_COUNT,
): Promise<WorldInitiativeCardProjection[]> {
  const projection = await fetchWorldInitiativesProjection(limit);
  return projection.initiatives.slice(0, limit);
}

export async function fetchLatestPublicImpactRecords(limit = 10): Promise<CivicSearchResult[]> {
  const response = await fetchPublicSearch({
    entityType: "public_impact",
    limit,
    offset: 0,
    view: "flat",
  });

  return response.results.filter((result) => result.entityType === "public_impact").slice(0, limit);
}
