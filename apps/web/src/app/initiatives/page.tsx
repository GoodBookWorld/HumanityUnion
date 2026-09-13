import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { ApiUnavailableState } from "../../design-system";
import { WorldInitiativesPageContent } from "../../features/initiatives/components/WorldInitiativesPageContent";
import { fetchWorldInitiativesProjection } from "../../features/initiatives/world-initiatives-api";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

import "./initiatives-page.css";

/**
 * Step 07F.2 — Initiatives index SEO from WEB_UI worldInitiativesPublic chrome.
 * Not initiative-detail CT. Canonical/hreflang via shared request-aware builder.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("worldInitiativesPublic");
  return buildPublicPageMetadataForRequest({
    title: t("pageTitle"),
    description: t("pageIntro"),
    canonicalPath: "/initiatives",
    localeFreeCanonicalPath: "/initiatives",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

export default async function InitiativesPage() {
  const t = await getTranslations("worldInitiativesPublic");
  let projection = null;
  let unavailable = false;

  try {
    projection = await fetchWorldInitiativesProjection();
  } catch {
    unavailable = true;
  }

  if (unavailable || !projection) {
    return (
      <main className="initiatives-page humanity-workspace-page">
        <ApiUnavailableState
          title={t("unavailableTitle")}
          explanation={t("unavailableBody")}
          retryHref="/initiatives"
        />
      </main>
    );
  }

  return (
    <main className="initiatives-page humanity-workspace-page">
      <WorldInitiativesPageContent projection={projection.initiatives} />
    </main>
  );
}
