import { fetchKnowledgeListing } from "../../../../features/knowledge-center/api";
import type { SitemapPathEntry } from "../types";

export async function listKnowledgeArticleSitemapEntries(): Promise<SitemapPathEntry[]> {
  const listing = await fetchKnowledgeListing();
  const entries: SitemapPathEntry[] = [];

  for (const category of listing.categories) {
    for (const article of category.articles) {
      const slug = article.slug?.trim();
      if (!slug) {
        continue;
      }
      entries.push({
        path: `/knowledge/${encodeURIComponent(slug)}`,
        lastModified: article.updatedAt,
      });
    }
  }

  return entries;
}
