/**
 * SEO Pack 02 — static public/indexable surfaces that exist in App Router.
 * Intentionally excludes auth, workspace, admin, transactional, and owner routes.
 */
export const STATIC_PUBLIC_SITEMAP_PATHS = [
  "/",
  "/blog",
  "/initiatives",
  "/institutions",
  "/knowledge",
  "/knowledge/media",
  "/media",
  "/civic-archive",
  "/civic-activity",
  "/membership",
  "/contact",
  "/privacy",
  "/terms",
  "/support",
  "/search",
] as const;

export function listStaticPublicSitemapEntries() {
  return STATIC_PUBLIC_SITEMAP_PATHS.map((path) => ({ path }));
}
