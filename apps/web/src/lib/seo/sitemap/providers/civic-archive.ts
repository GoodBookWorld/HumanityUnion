import { listPublicCivicArchiveIndex } from "../../../../features/public-civic-archive/api";
import type { SitemapPathEntry } from "../types";

export async function listCivicArchiveSitemapEntries(): Promise<SitemapPathEntry[]> {
  const index = await listPublicCivicArchiveIndex({});
  const entries: SitemapPathEntry[] = [];

  for (const record of index.records) {
    const initiativeId = record.initiativeId?.trim();
    if (!initiativeId) {
      continue;
    }
    entries.push({
      path: `/civic-archive/${encodeURIComponent(initiativeId)}`,
      lastModified: record.archivedAt,
    });
  }

  return entries;
}
