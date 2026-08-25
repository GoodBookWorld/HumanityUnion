import { apiRequest } from "../../../api-client";
import type { SitemapPathEntry } from "../types";

interface PublicSitemapInitiativesResponse {
  entries: Array<{
    initiativeId: string;
    updatedAt: string;
  }>;
}

/**
 * Public projected Initiatives via Pack 02 inventory API
 * (same eligibility as public Initiative pages).
 */
export async function listInitiativeSitemapEntries(): Promise<SitemapPathEntry[]> {
  const data = await apiRequest<PublicSitemapInitiativesResponse>(
    "/api/v1/public/sitemap/initiatives",
  );

  const entries: SitemapPathEntry[] = [];

  for (const entry of data.entries) {
    const initiativeId = entry.initiativeId?.trim();
    if (!initiativeId) {
      continue;
    }
    entries.push({
      path: `/initiatives/public/${encodeURIComponent(initiativeId)}`,
      lastModified: entry.updatedAt,
    });
  }

  return entries;
}
