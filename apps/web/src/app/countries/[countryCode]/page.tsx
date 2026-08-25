import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getCountryByCode, normalizeCountryInput } from "@hu/geography";

import { CountryExperienceDynamicPage } from "../../../features/country-experience/components/CountryExperienceDynamicPage";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";
import {
  applyPageSeoOverrideToMetadataInput,
} from "../../../lib/seo/apply-page-seo-override";
import { fetchPublicSeoPageOverride } from "../../../lib/seo/fetch-public-seo-page-override";
import {
  buildCountryPageDescription,
  buildUnavailablePublicMetadata,
} from "../../../lib/seo/public-surface-copy";
import { JsonLdScript, buildWebPageJsonLd } from "../../../lib/seo/structured-data";

import "../../../features/country-experience/country-experience-dynamic.css";

interface CountriesPageProps {
  params: Promise<{ countryCode: string }>;
}

export async function generateMetadata({ params }: CountriesPageProps): Promise<Metadata> {
  const { countryCode: rawCode } = await params;
  const countryCode = normalizeCountryInput(rawCode);

  if (!countryCode) {
    return buildUnavailablePublicMetadata("Country not found | Humanity Union");
  }

  const country = getCountryByCode(countryCode);
  if (!country) {
    return buildUnavailablePublicMetadata("Country not found | Humanity Union");
  }

  const override = await fetchPublicSeoPageOverride({
    family: "country",
    entityKey: countryCode,
  });

  return buildPublicPageMetadata(
    applyPageSeoOverrideToMetadataInput(
      {
        title: country.name,
        description: buildCountryPageDescription(country.name),
        canonicalPath: `/countries/${encodeURIComponent(countryCode)}`,
        openGraphType: "website",
        socialTitle: country.name,
      },
      override?.fields,
    ),
  );
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

  const country = getCountryByCode(countryCode);
  if (!country) {
    notFound();
  }

  const description = buildCountryPageDescription(country.name);
  const canonicalPath = `/countries/${encodeURIComponent(countryCode)}`;
  // No /countries index route exists — breadcrumb is Home → {Country}.
  const structuredData = buildWebPageJsonLd({
    name: country.name,
    description,
    canonicalPath,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: country.name, path: canonicalPath },
    ],
  });

  return (
    <>
      <JsonLdScript data={structuredData} />
      <CountryExperienceDynamicPage countryCode={countryCode} />
    </>
  );
}
