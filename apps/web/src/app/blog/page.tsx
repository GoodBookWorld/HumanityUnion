import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { BlogIndexPageContent } from "../../features/blog/components/BlogIndexPageContent";
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

async function BlogIndexSuspenseFallback() {
  const t = await getTranslations("blogPublic");
  return (
    <main className="blog-page hu-page-container">
      <p className="blog-page__status">{t("loadingPublications")}</p>
    </main>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogIndexSuspenseFallback />}>
      <BlogIndexPageContent />
    </Suspense>
  );
}
