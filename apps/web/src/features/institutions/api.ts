import type { CivicSearchResult } from "@hu/types";

import { fetchPublicSearch } from "../global-search/api";

export async function fetchLatestPublicInitiatives(limit = 3): Promise<CivicSearchResult[]> {
  const response = await fetchPublicSearch({
    entityType: "initiative",
    limit,
    offset: 0,
    view: "flat",
  });

  return response.results.filter((result) => result.entityType === "initiative").slice(0, limit);
}
