import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { GlobalSearchPageContent } from "../../features/global-search/components/GlobalSearchPageContent";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { resolveLocalizedPublicMetadataCopy } from "../../lib/seo/resolve-localized-public-metadata-copy";

/**
 * Pack 02I — Search chrome metadata from UI catalog; path-based canonical only.
 * Pack 08I.2 — title brand suffix + siteName interpolation from Brand Localization.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("search");
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const localized = resolveLocalizedPublicMetadataCopy({
    title: "Search",
    description: `Search public civic records on ${brand.seoSiteName}.`,
    translatedTitle: t("meta.title"),
    translatedDescription: t("meta.description", { siteName: brand.seoSiteName }),
  });

  return buildPublicPageMetadata({
    title: localized.title,
    description: localized.description,
    canonicalPath: "/search",
    socialTitle: localized.title,
    socialDescription: localized.description,
    openGraphType: "website",
    titleBrandSuffix: brand.seoTitleSuffix,
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

export default async function SearchPage() {
  const t = await getTranslations("search");

  return (
    <Suspense fallback={<main className="global-search-page">{t("loading")}</main>}>
      <GlobalSearchPageContent />
    </Suspense>
  );
}
