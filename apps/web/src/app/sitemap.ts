import type { MetadataRoute } from "next";

import { buildPublicSitemap } from "../lib/seo/sitemap/build-public-sitemap";

/** Evaluate at request time so platform mode + NEXT_PUBLIC_SITE_URL are runtime-accurate. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildPublicSitemap();
}
