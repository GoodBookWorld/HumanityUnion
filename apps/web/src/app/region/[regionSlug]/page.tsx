import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getLocalizedCountryDisplayName } from "@hu/geography";

import { RegionExperiencePage } from "../../../features/region-experience/components/RegionExperiencePage";
import { withLocalizedCountryName } from "../../../features/region-experience/region-projection-labels";
import {
  regionHref,
  resolveRegionRoute,
} from "../../../features/region-experience/resolve-region-route";
import {
  getKnownRegionSlugs,
  loadRegionExperiencePageData,
} from "../../../features/public-projection-engine";

import "../../../features/public-experience/public-experience.css";
import "../../../features/region-experience/region-experience.css";

// The root layout reads the language cookie. When generateStaticParams returns no
// slugs (API provider), Next would otherwise register this route as static and
// fail every request with "Page changed from static to dynamic".
export const dynamic = "force-dynamic";

interface RegionPageProps {
  params: Promise<{ regionSlug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getKnownRegionSlugs();
  return slugs.map((regionSlug) => ({ regionSlug }));
}

export default async function RegionPage({ params }: RegionPageProps) {
  const { regionSlug } = await params;
  const route = resolveRegionRoute(regionSlug);

  if (route.kind === "redirect") {
    redirect(regionHref(route.regionCode));
  }

  if (route.kind === "not-found") {
    notFound();
  }

  const pageData = await loadRegionExperiencePageData(route.regionCode);

  if (!pageData) {
    notFound();
  }

  const { projections } = pageData;
  const localizedProjections =
    projections.identity.source === "projection"
      ? withLocalizedCountryName(
          projections,
          getLocalizedCountryDisplayName(
            route.countryCode,
            await getLocale(),
            projections.identity.countryLabel,
          ),
        )
      : projections;

  return <RegionExperiencePage projections={localizedProjections} />;
}
