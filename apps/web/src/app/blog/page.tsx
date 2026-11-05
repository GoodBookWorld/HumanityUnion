import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  BLOG_PAGE_SIZE,
  fetchPublicBlogCategories,
  fetchPublicBlogPosts,
} from "../../features/blog/api";
import { parseBlogPageParam } from "../../features/blog/blog-url";
import {
  BlogIndexPageContent,
  type BlogIndexInitialData,
} from "../../features/blog/components/BlogIndexPageContent";
import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

/**
 * Step 07F.2 — Blog index SEO from WEB_UI blogPublic chrome (not detail CT).
 * Canonical/hreflang: request-aware shared builder (Step 07C).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("blogPublic");
  const siteName = { siteName: brand.siteName };
  return buildPublicPageMetadataForRequest({
    title: t("pageTitle"),
    description: t("pageSubtitle", siteName),
    canonicalPath: "/blog",
    localeFreeCanonicalPath: "/blog",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

interface BlogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * SEO-BING-06 — server data only for the unfiltered first page (`/blog`).
 * Search, category and pagination views keep loading in the browser.
 */
async function loadDefaultBlogIndexData(): Promise<BlogIndexInitialData | null> {
  const [categories, listing] = await Promise.all([
    fetchPublicBlogCategories().catch(() => null),
    fetchPublicBlogPosts({ page: 1, pageSize: BLOG_PAGE_SIZE, includeDiscovery: true }).catch(
      () => null,
    ),
  ]);
  return categories && listing ? { categories, listing } : null;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const isDefaultView =
    (firstParam(params.q) ?? "") === "" &&
    (firstParam(params.category) ?? "all") === "all" &&
    parseBlogPageParam(firstParam(params.page)) === 1;
  const initialData = isDefaultView ? await loadDefaultBlogIndexData() : null;

  return <BlogIndexPageContent initialData={initialData} />;
}
