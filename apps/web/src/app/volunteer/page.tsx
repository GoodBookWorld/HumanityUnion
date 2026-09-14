import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { VolunteerPageContent } from "../../features/volunteer/components/VolunteerPageContent";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

/**
 * Step 07F.2 — Volunteer SEO from WEB_UI volunteerPublic chrome.
 * Canonical/hreflang via shared request-aware builder.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("volunteerPublic");
  return buildPublicPageMetadataForRequest({
    title: t("title"),
    description: t("lead"),
    canonicalPath: "/volunteer",
    localeFreeCanonicalPath: "/volunteer",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

export default function VolunteerPage() {
  return (
    <main className="hu-page-container hu-page-container--sectioned">
      <VolunteerPageContent />
    </main>
  );
}
