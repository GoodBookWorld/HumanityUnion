import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { resolvePublicSeoLocaleDocumentForRequest } from "../../features/language/resolve-document-locale";
import { VolunteerPageContent } from "../../features/volunteer/components/VolunteerPageContent";
import {
  applyPageSeoOverrideToMetadataInput,
  selectCanonicalEnglishSeoOverrideForDocument,
} from "../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";
import { fetchPublicSeoPageOverride } from "../../lib/seo/fetch-public-seo-page-override";

/**
 * Request-time metadata. The canonical override read uses cache: no-store,
 * which cannot be statically prerendered. Localized documents skip that read.
 */
export const dynamic = "force-dynamic";

/**
 * Step 07F.2 — Volunteer SEO from WEB_UI volunteerPublic chrome.
 * Canonical/hreflang via shared request-aware builder.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("volunteerPublic");
  const document = await resolvePublicSeoLocaleDocumentForRequest();
  const stored = document.isLocalePrefixedDocument
    ? null
    : await fetchPublicSeoPageOverride({
        family: "volunteer",
        entityKey: "volunteer",
      }).catch(() => null);
  return buildPublicPageMetadataForRequest({
    ...applyPageSeoOverrideToMetadataInput(
      {
        title: t("title"),
        description: t("lead"),
        canonicalPath: "/volunteer",
        openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
      },
      selectCanonicalEnglishSeoOverrideForDocument(
        document.isLocalePrefixedDocument === true,
        stored?.fields,
      ),
    ),
    localeFreeCanonicalPath: "/volunteer",
  });
}

export default function VolunteerPage() {
  return (
    <main className="hu-page-container hu-page-container--sectioned">
      <VolunteerPageContent />
    </main>
  );
}
