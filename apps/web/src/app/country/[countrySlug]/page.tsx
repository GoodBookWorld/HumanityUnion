import { notFound } from "next/navigation";

import { CountryExperiencePage } from "../../../features/country-experience/components/CountryExperiencePage";
import {
  getKnownCountrySlugs,
  loadCountryExperiencePageData,
} from "../../../features/public-projection-engine";

import "../../../features/public-experience/public-experience.css";
import "../../../features/country-experience/country-experience.css";

interface CountryPageProps {
  params: Promise<{ countrySlug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getKnownCountrySlugs();
  return slugs.map((countrySlug) => ({ countrySlug }));
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { countrySlug } = await params;
  const pageData = await loadCountryExperiencePageData(countrySlug);

  if (!pageData) {
    notFound();
  }

  return <CountryExperiencePage projections={pageData.projections} />;
}
