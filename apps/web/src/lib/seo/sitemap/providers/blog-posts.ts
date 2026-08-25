import { fetchPublicBlogPosts } from "../../../../features/blog/api";
import type { SitemapPathEntry } from "../types";

const BLOG_SITEMAP_PAGE_SIZE = 100;

/**
 * Published public Blog posts only (API enforces publication rules).
 */
export async function listBlogPostSitemapEntries(): Promise<SitemapPathEntry[]> {
  const entries: SitemapPathEntry[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const listing = await fetchPublicBlogPosts({
      page,
      pageSize: BLOG_SITEMAP_PAGE_SIZE,
      includeDiscovery: false,
    });

    totalPages =
      listing.totalPages ??
      Math.max(
        1,
        Math.ceil((listing.total || 0) / (listing.pageSize || BLOG_SITEMAP_PAGE_SIZE)) || 1,
      );

    for (const item of listing.items) {
      const slug = item.slug?.trim();
      if (!slug) {
        continue;
      }
      entries.push({
        path: `/blog/${encodeURIComponent(slug)}`,
        lastModified: item.publishedAt,
      });
    }

    if (listing.items.length === 0) {
      break;
    }

    page += 1;
  } while (page <= totalPages && page <= 50);

  return entries;
}
