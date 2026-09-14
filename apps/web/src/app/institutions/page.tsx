import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { InstitutionsPageContent } from "../../features/institutions/components/InstitutionsPageContent";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

/**
 * Step 07F.2 — Institutions SEO from WEB_UI institutionsPublic chrome.
 * Canonical/hreflang via shared request-aware builder.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("institutionsPublic");
  return buildPublicPageMetadataForRequest({
    title: t("headline"),
    description: t("subheadline"),
    canonicalPath: "/institutions",
    localeFreeCanonicalPath: "/institutions",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

export default function InstitutionsPage() {
  return <InstitutionsPageContent />;
}
