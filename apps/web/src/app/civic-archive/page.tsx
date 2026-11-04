import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { CivicArchiveFiltersLoading } from "../../features/public-civic-archive/components/CivicArchiveFiltersLoading";
import { CivicArchivePageChrome } from "../../features/public-civic-archive/components/CivicArchivePageChrome";
import { CivicArchiveSearchExperience } from "../../features/public-civic-archive/components/CivicArchiveSearchExperience";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

import "./civic-archive-page.css";

/**
 * Civic Archive index SEO from the page's own WEB_UI chrome (pageTitle already
 * carries the brand, so no suffix). Admin overrides exist only per archive record.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("initiativeExperience.civicArchivePublic");
  return buildPublicPageMetadataForRequest({
    title: t("pageTitle"),
    description: t("pageIntro"),
    canonicalPath: "/civic-archive",
    localeFreeCanonicalPath: "/civic-archive",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
    titleBrandSuffix: "",
  });
}

export default function CivicArchiveIndexPage() {
  return (
    <main className="civic-archive-page">
      <CivicArchivePageChrome />

      <Suspense fallback={<CivicArchiveFiltersLoading />}>
        <CivicArchiveSearchExperience />
      </Suspense>
    </main>
  );
}
