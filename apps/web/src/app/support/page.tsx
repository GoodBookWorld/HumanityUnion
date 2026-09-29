import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { SupportPageContent } from "../../features/support/components/SupportPageContent";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

/**
 * Support SEO from WEB_UI supportPublic title/subtitle.
 * Locale-free canonical only — /support is outside the multilingual SEO perimeter.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("supportPublic");
  const siteName = { siteName: brand.siteName };
  return buildPublicPageMetadataForRequest({
    title: t("title", siteName),
    description: t("subtitle"),
    canonicalPath: "/support",
    localeFreeCanonicalPath: "/support",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
    titleBrandSuffix: "",
  });
}

export default function SupportPage() {
  return (
    <main className="hu-page-container hu-page-container--sectioned">
      <SupportPageContent />
    </main>
  );
}
