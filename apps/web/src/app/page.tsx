import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { resolveBrandForMetadata } from "../features/brand-localization/resolve-brand-for-metadata";
import { GlobalExperiencePage } from "../features/global-experience/components/GlobalExperiencePage";
import { buildPublicPageMetadataForRequest } from "../lib/seo/build-public-page-metadata-for-request";
import { HUMANITY_UNION_LOGO_PATH } from "../lib/seo/structured-data";

import "../features/public-experience/public-experience.css";
import "../features/global-experience/global-experience.css";
import "../features/public-home-v2/public-home-v2.css";

/**
 * SEO Pack 08 / Pack 02I / Step 07C.3 — Home public metadata.
 * Title/description: Admin Brand Localization only (not seo.home catalog).
 * Canonical/hreflang: request-aware (locale-free or SEO-prefixed self-canonical).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);

  return buildPublicPageMetadataForRequest({
    title: brand.seoSiteName,
    description: brand.defaultMetaDescription,
    canonicalPath: "/",
    localeFreeCanonicalPath: "/",
    socialTitle: brand.openGraphBrandName,
    socialDescription: brand.defaultMetaDescription,
    imageUrl: HUMANITY_UNION_LOGO_PATH,
    imageAlt: brand.openGraphBrandName,
    openGraphType: "website",
    openGraphSiteName: brand.openGraphBrandName,
    titleBrandSuffix: "",
  });
}

export default function HomePage() {
  return <GlobalExperiencePage />;
}
