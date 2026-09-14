import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { MembershipPageContent } from "../../features/membership/components/MembershipPageContent";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

/**
 * Step 07F.2 — Membership SEO from WEB_UI membershipPublic chrome.
 * Canonical/hreflang via shared request-aware builder.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("membershipPublic");
  const siteName = { siteName: brand.siteName };
  return buildPublicPageMetadataForRequest({
    title: t("pageTitle"),
    description: t("pageSubtitle", siteName),
    canonicalPath: "/membership",
    localeFreeCanonicalPath: "/membership",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

export default function MembershipPage() {
  return (
    <main className="humanity-workspace-page membership-route">
      <MembershipPageContent />
    </main>
  );
}
