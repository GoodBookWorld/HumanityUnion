import { classifyPublicSeoLocalizedPageFamily } from "../seo/public-seo-localized-eligibility";
import { normalizeCanonicalPath } from "../seo/public-site-url";

/**
 * Counts translation resolves the production eligibility loader starts for
 * initiative detail and blog post paths. Chrome and catalog fetches are not
 * included. This does not call the loader.
 */
export function countSitemapEntityResolves(
  localeFreePaths: readonly string[],
  locales: readonly string[],
): number {
  const paths = new Set<string>();
  for (const raw of localeFreePaths) {
    const path = normalizeCanonicalPath(raw);
    if (!path) {
      continue;
    }
    const family = classifyPublicSeoLocalizedPageFamily(path);
    if (family === "initiative_detail" || family === "blog_post") {
      paths.add(path);
    }
  }

  const localeKeys = new Set<string>();
  for (const raw of locales) {
    const locale = raw.trim();
    if (locale) {
      localeKeys.add(locale);
    }
  }

  return paths.size * localeKeys.size;
}
