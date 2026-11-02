import { notFound } from "next/navigation";

import { RegionExperiencePage } from "../../../features/region-experience/components/RegionExperiencePage";
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
  const pageData = await loadRegionExperiencePageData(regionSlug);

  if (!pageData) {
    notFound();
  }

  return <RegionExperiencePage projections={pageData.projections} />;
}
