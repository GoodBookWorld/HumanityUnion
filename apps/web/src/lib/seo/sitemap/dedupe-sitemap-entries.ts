import { normalizeCanonicalPath } from "../public-site-url";
import type { SitemapPathEntry } from "./types";

/**
 * Keep the first occurrence of each normalized path.
 */
export function dedupeSitemapPathEntries(
  entries: readonly SitemapPathEntry[],
): SitemapPathEntry[] {
  const seen = new Set<string>();
  const result: SitemapPathEntry[] = [];

  for (const entry of entries) {
    const path = normalizeCanonicalPath(entry.path);
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    result.push({
      path,
      ...(entry.lastModified !== undefined ? { lastModified: entry.lastModified } : {}),
    });
  }

  return result;
}
