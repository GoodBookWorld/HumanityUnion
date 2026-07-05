import { notFound } from "next/navigation";

import { CountryExperiencePage } from "../../../features/country-experience/components/CountryExperiencePage";
import {
  BOOTSTRAP_COUNTRY_SLUGS,
  loadCountryExperiencePageData,
} from "../../../features/public-projection-engine";

import "../../../features/global-experience/global-experience.css";
import "../../../features/country-experience/country-experience.css";

interface CountryPageProps {
  params: Promise<{ countrySlug: string }>;
}

export function generateStaticParams() {
  return BOOTSTRAP_COUNTRY_SLUGS.map((countrySlug) => ({ countrySlug }));
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { countrySlug } = await params;
  const pageData = await loadCountryExperiencePageData(countrySlug);

  if (!pageData) {
    notFound();
  }

  return <CountryExperiencePage projections={pageData.projections} />;
}
