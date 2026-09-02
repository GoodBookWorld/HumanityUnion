import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { resolveBrandForMetadata } from "../features/brand-localization/resolve-brand-for-metadata";
import { GlobalExperiencePage } from "../features/global-experience/components/GlobalExperiencePage";
import { buildPublicPageMetadata } from "../lib/seo/build-public-page-metadata";
import { HUMANITY_UNION_LOGO_PATH } from "../lib/seo/structured-data";

import "../features/public-experience/public-experience.css";
import "../features/global-experience/global-experience.css";
import "../features/public-home-v2/public-home-v2.css";

/**
 * SEO Pack 08 / Pack 02I — Home public metadata via shared Pack 01 builder.
 * Absolute canonical / OG resolve through NEXT_PUBLIC_SITE_URL only.
 * Canonical stays `/`.
 * Pack 08I.2 — home title/description come from Admin Brand Localization only
 * (not next-intl seo.home catalog override).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);

  return buildPublicPageMetadata({
    title: brand.seoSiteName,
    description: brand.defaultMetaDescription,
    canonicalPath: "/",
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
