import { getRegionByIsoCode } from "@hu/geography";

import { resolvePublicProjectionProvider } from "../../../../features/public-projection-engine/resolve-public-projection-provider";
import { apiRequest } from "../../../api-client";
import type { SitemapPathEntry } from "../types";

interface PublicSitemapRegionsResponse {
  entries: Array<{
    countryCode: string;
    regionCode: string;
    updatedAt: string;
  }>;
}

/**
 * REGION-500B.3 — canonical /region/{ISO code} pages with public regional
 * initiatives, from one API inventory request (same eligibility as the region
 * page). Bootstrap projections are demonstration data and are never listed.
 */
export async function listRegionSitemapEntries(): Promise<SitemapPathEntry[]> {
  if (resolvePublicProjectionProvider().mode !== "api") {
    return [];
  }

  const data = await apiRequest<PublicSitemapRegionsResponse>("/api/v1/public/sitemap/regions");
  const entries: SitemapPathEntry[] = [];

  for (const entry of data.entries) {
    const region = getRegionByIsoCode(entry.regionCode ?? "");
    if (!region || region.code !== entry.regionCode) {
      continue;
    }
    entries.push({
      path: `/region/${encodeURIComponent(region.code)}`,
      lastModified: entry.updatedAt,
    });
  }

  return entries;
}
