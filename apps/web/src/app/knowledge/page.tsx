import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { KnowledgeCenterPageContent } from "../../features/knowledge-center/components/KnowledgeCenterPageContent";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

/**
 * Step 07F.2 — Knowledge index SEO from WEB_UI knowledgePublic chrome.
 * Not knowledge-detail content. Canonical/hreflang via shared request-aware builder.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("knowledgePublic");
  const siteName = { siteName: brand.siteName };
  return buildPublicPageMetadataForRequest({
    title: t("pageTitle"),
    description: t("pageIntro", siteName),
    canonicalPath: "/knowledge",
    localeFreeCanonicalPath: "/knowledge",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

export default function KnowledgePage() {
  return <KnowledgeCenterPageContent />;
}
