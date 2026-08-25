import { apiRequest } from "../../../api-client";
import type { SitemapPathEntry } from "../types";

interface PublicSitemapParticipantProfilesResponse {
  entries: Array<{
    publicName: string;
    updatedAt?: string;
  }>;
}

/**
 * SEO Pack 11 — public Participant Profiles via Pack 02 sitemap inventory API.
 * Eligibility matches guest-readable `/member/{uniqueName}` metadata (active + public).
 */
export async function listParticipantProfileSitemapEntries(): Promise<SitemapPathEntry[]> {
  const data = await apiRequest<PublicSitemapParticipantProfilesResponse>(
    "/api/v1/public/sitemap/participant-profiles",
  );

  const entries: SitemapPathEntry[] = [];
  const seen = new Set<string>();

  for (const entry of data.entries) {
    const publicName = entry.publicName?.trim();
    if (!publicName || seen.has(publicName)) {
      continue;
    }
    seen.add(publicName);
    entries.push({
      path: `/member/${encodeURIComponent(publicName)}`,
      ...(entry.updatedAt ? { lastModified: entry.updatedAt } : {}),
    });
  }

  return entries;
}
