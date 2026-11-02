import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";
import { getLocalizedCountryDisplayName } from "@hu/geography";
import type { RegionExperiencePublicProjections } from "@hu/types";

import { resolveBrandForMetadata } from "../../../features/brand-localization/resolve-brand-for-metadata";
import { RegionExperiencePage } from "../../../features/region-experience/components/RegionExperiencePage";
import {
  isRegionProjectionIndexable,
  withLocalizedCountryName,
} from "../../../features/region-experience/region-projection-labels";
import {
  regionHref,
  resolveRegionRoute,
} from "../../../features/region-experience/resolve-region-route";
import {
  getKnownRegionSlugs,
  loadRegionExperiencePageData,
} from "../../../features/public-projection-engine";
import { shouldDisallowSearchIndexing } from "../../../lib/platform-indexing";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";

import "../../../features/public-experience/public-experience.css";
import "../../../features/region-experience/region-experience.css";

// The root layout reads the language cookie. When generateStaticParams returns no
// slugs (API provider), Next would otherwise register this route as static and
// fail every request with "Page changed from static to dynamic".
export const dynamic = "force-dynamic";

interface RegionPageProps {
  params: Promise<{ regionSlug: string }>;
}

/** One projection request per page render, shared by metadata and the page. */
const loadLocalizedRegionProjections = cache(
  async (
    regionCode: string,
    countryCode: string,
  ): Promise<RegionExperiencePublicProjections | null> => {
    const pageData = await loadRegionExperiencePageData(regionCode);

    if (!pageData) {
      return null;
    }

    const { projections } = pageData;

    if (projections.identity.source !== "projection") {
      return projections;
    }

    return withLocalizedCountryName(
      projections,
      getLocalizedCountryDisplayName(
        countryCode,
        await getLocale(),
        projections.identity.countryLabel,
      ),
    );
  },
);

export async function generateStaticParams() {
  const slugs = await getKnownRegionSlugs();
  return slugs.map((regionSlug) => ({ regionSlug }));
}

export async function generateMetadata({ params }: RegionPageProps): Promise<Metadata> {
  const { regionSlug } = await params;
  const route = resolveRegionRoute(regionSlug);

  if (route.kind !== "canonical") {
    return {};
  }

  const projections = await loadLocalizedRegionProjections(route.regionCode, route.countryCode);

  if (!projections) {
    return {};
  }

  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("publicGeo.region.identity");
  const { identity } = projections;
  const title = `${identity.name}, ${identity.countryLabel}`;
  const indexable = isRegionProjectionIndexable(projections);

  const metadata = buildPublicPageMetadata({
    title,
    description: t("contextIntroduction", { regionName: identity.name, siteName: brand.siteName }),
    canonicalPath: regionHref(route.regionCode),
    openGraphType: "website",
    socialTitle: title,
    indexable,
  });

  // Valid regions without public content stay reachable for crawlers but are not indexed.
  if (!indexable && identity.source === "projection" && !shouldDisallowSearchIndexing()) {
    return { ...metadata, robots: { index: false, follow: true } };
  }

  return metadata;
}

export default async function RegionPage({ params }: RegionPageProps) {
  const { regionSlug } = await params;
  const route = resolveRegionRoute(regionSlug);

  if (route.kind === "redirect") {
    permanentRedirect(regionHref(route.regionCode));
  }

  if (route.kind === "not-found") {
    notFound();
  }

  const projections = await loadLocalizedRegionProjections(route.regionCode, route.countryCode);

  if (!projections) {
    notFound();
  }

  return <RegionExperiencePage projections={projections} />;
}
