import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { SupportPageContent } from "../../features/support/components/SupportPageContent";
import { applyPageSeoOverrideToMetadataInput } from "../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";
import { fetchPublicSeoPageOverride } from "../../lib/seo/fetch-public-seo-page-override";

/**
 * Support SEO from WEB_UI supportPublic title/subtitle.
 * Locale-free canonical only — /support is outside the multilingual SEO perimeter.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("supportPublic");
  const siteName = { siteName: brand.siteName };
  const override = await fetchPublicSeoPageOverride({
    family: "support",
    entityKey: "support",
  });
  return buildPublicPageMetadataForRequest({
    ...applyPageSeoOverrideToMetadataInput(
      {
        title: t("title", siteName),
        description: t("subtitle"),
        canonicalPath: "/support",
        openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
        titleBrandSuffix: "",
      },
      override?.fields,
    ),
    localeFreeCanonicalPath: "/support",
  });
}

export default function SupportPage() {
  return (
    <main className="hu-page-container hu-page-container--sectioned">
      <SupportPageContent />
    </main>
  );
}
