import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GlobalExperiencePage } from "../features/global-experience/components/GlobalExperiencePage";
import { buildPublicPageMetadata } from "../lib/seo/build-public-page-metadata";
import { resolveLocalizedPublicMetadataCopy } from "../lib/seo/resolve-localized-public-metadata-copy";
import { HUMANITY_UNION_LOGO_PATH } from "../lib/seo/structured-data";

import "../features/public-experience/public-experience.css";
import "../features/global-experience/global-experience.css";
import "../features/public-home-v2/public-home-v2.css";

/**
 * SEO Pack 08 / Pack 02I — Home public metadata via shared Pack 01 builder.
 * Absolute canonical / OG resolve through NEXT_PUBLIC_SITE_URL only.
 * Title/description may use next-intl UI chrome catalog; canonical stays `/`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.home");
  const localized = resolveLocalizedPublicMetadataCopy({
    title: "Humanity Union",
    description: "World Solidarity civic technology platform",
    translatedTitle: t("title"),
    translatedDescription: t("description"),
  });

  return buildPublicPageMetadata({
    title: localized.title,
    description: localized.description,
    canonicalPath: "/",
    socialTitle: localized.title,
    socialDescription: localized.description,
    imageUrl: HUMANITY_UNION_LOGO_PATH,
    imageAlt: "Humanity Union",
    openGraphType: "website",
    titleBrandSuffix: "",
  });
}

export default function HomePage() {
  return <GlobalExperiencePage />;
}
