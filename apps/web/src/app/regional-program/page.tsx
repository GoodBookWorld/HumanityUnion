import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { RegionalProgramPageContent } from "../../features/regional-program/components/RegionalProgramPageContent";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

export const dynamic = "force-dynamic";

/**
 * Regional Development Program SEO from WEB_UI regionalProgramPublic chrome.
 * Canonical/hreflang via shared request-aware builder (volunteer-like perimeter).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("regionalProgramPublic");
  const siteName = { siteName: brand.siteName };
  return buildPublicPageMetadataForRequest({
    title: t("title", siteName),
    description: t("subtitle"),
    canonicalPath: "/regional-program",
    localeFreeCanonicalPath: "/regional-program",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

export default function RegionalProgramPage() {
  return (
    <main className="hu-page-container hu-page-container--sectioned">
      <RegionalProgramPageContent />
    </main>
  );
}
