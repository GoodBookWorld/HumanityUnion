import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { GlobalSearchPageContent } from "../../features/global-search/components/GlobalSearchPageContent";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { resolveLocalizedPublicMetadataCopy } from "../../lib/seo/resolve-localized-public-metadata-copy";

/**
 * Pack 02I — Search chrome metadata from UI catalog; path-based canonical only.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("search");
  const localized = resolveLocalizedPublicMetadataCopy({
    title: "Search",
    description: "Search public civic records on Humanity Union.",
    translatedTitle: t("meta.title"),
    translatedDescription: t("meta.description"),
  });

  return buildPublicPageMetadata({
    title: localized.title,
    description: localized.description,
    canonicalPath: "/search",
    socialTitle: localized.title,
    socialDescription: localized.description,
    openGraphType: "website",
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
