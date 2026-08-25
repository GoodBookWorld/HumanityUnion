import type { Metadata } from "next";

import { GlobalExperiencePage } from "../features/global-experience/components/GlobalExperiencePage";
import { buildPublicPageMetadata } from "../lib/seo/build-public-page-metadata";
import { HUMANITY_UNION_LOGO_PATH } from "../lib/seo/structured-data";

import "../features/public-experience/public-experience.css";
import "../features/global-experience/global-experience.css";
import "../features/public-home-v2/public-home-v2.css";

const HOME_TITLE = "Humanity Union";
const HOME_DESCRIPTION = "World Solidarity civic technology platform";

/**
 * SEO Pack 08 — Home public metadata via shared Pack 01 builder.
 * Absolute canonical / OG resolve through NEXT_PUBLIC_SITE_URL only.
 */
export function generateMetadata(): Metadata {
  return buildPublicPageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    canonicalPath: "/",
    socialTitle: HOME_TITLE,
    socialDescription: HOME_DESCRIPTION,
    imageUrl: HUMANITY_UNION_LOGO_PATH,
    imageAlt: "Humanity Union",
    openGraphType: "website",
    titleBrandSuffix: "",
  });
}

export default function HomePage() {
  return <GlobalExperiencePage />;
}
