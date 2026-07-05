import { notFound } from "next/navigation";

import { RegionExperiencePage } from "../../../features/region-experience/components/RegionExperiencePage";
import {
  BOOTSTRAP_REGION_SLUGS,
  loadRegionExperiencePageData,
} from "../../../features/public-projection-engine";

import "../../../features/public-experience/public-experience.css";
import "../../../features/region-experience/region-experience.css";

interface RegionPageProps {
  params: Promise<{ regionSlug: string }>;
}

export function generateStaticParams() {
  return BOOTSTRAP_REGION_SLUGS.map((regionSlug) => ({ regionSlug }));
}

export default async function RegionPage({ params }: RegionPageProps) {
  const { regionSlug } = await params;
  const pageData = await loadRegionExperiencePageData(regionSlug);

  if (!pageData) {
    notFound();
  }

  return <RegionExperiencePage projections={pageData.projections} />;
}
