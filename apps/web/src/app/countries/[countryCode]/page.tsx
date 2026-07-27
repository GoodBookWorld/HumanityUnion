import { notFound, redirect } from "next/navigation";

import { normalizeCountryInput } from "../../../data/geography";
import { CountryExperienceDynamicPage } from "../../../features/country-experience/components/CountryExperienceDynamicPage";

import "../../../features/country-experience/country-experience-dynamic.css";

interface CountriesPageProps {
  params: Promise<{ countryCode: string }>;
}

export default async function CountriesPage({ params }: CountriesPageProps) {
  const { countryCode: rawCode } = await params;
  const countryCode = normalizeCountryInput(rawCode);

  if (!countryCode) {
    notFound();
  }

  if (rawCode !== countryCode) {
    redirect(`/countries/${countryCode}`);
  }

  return <CountryExperienceDynamicPage countryCode={countryCode} />;
}
