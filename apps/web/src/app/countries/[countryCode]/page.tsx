import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCountryByCode, normalizeCountryInput } from "@hu/geography";
import { getLocalizedCountryDisplayName } from "@hu/geography";

import { fetchCivicMediaCenter } from "../../../features/civic-media-center/api";
import { loadCivicMediaEditorialSeed } from "../../../features/civic-media-center/load-civic-media-editorial-seed";
import { resolveBrandForMetadata } from "../../../features/brand-localization/resolve-brand-for-metadata";
import { CountryExperienceDynamicPage } from "../../../features/country-experience/components/CountryExperienceDynamicPage";
import { resolveDocumentHtmlLocale } from "../../../features/language/resolve-document-locale";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";
import {
  applyPageSeoOverrideToMetadataInput,
} from "../../../lib/seo/apply-page-seo-override";
import { fetchPublicSeoPageOverride } from "../../../lib/seo/fetch-public-seo-page-override";
import { buildUnavailablePublicMetadata } from "../../../lib/seo/public-surface-copy";
import { JsonLdScript, buildWebPageJsonLd } from "../../../lib/seo/structured-data";

import "../../../features/country-experience/country-experience-dynamic.css";

interface CountriesPageProps {
  params: Promise<{ countryCode: string }>;
}

export async function generateMetadata({ params }: CountriesPageProps): Promise<Metadata> {
  const { countryCode: rawCode } = await params;
  const countryCode = normalizeCountryInput(rawCode);
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const siteName = { siteName: brand.siteName };
  const t = await getTranslations("publicGeo.country");

  if (!countryCode) {
    return buildUnavailablePublicMetadata(t("notFoundTitle", siteName));
  }

  const country = getCountryByCode(countryCode);
  if (!country) {
    return buildUnavailablePublicMetadata(t("notFoundTitle", siteName));
  }

  const countryDisplayName = getLocalizedCountryDisplayName(
    countryCode,
    locale,
    country.name,
  );

  const override = await fetchPublicSeoPageOverride({
    family: "country",
    entityKey: countryCode,
  });

  return buildPublicPageMetadata(
    applyPageSeoOverrideToMetadataInput(
      {
        title: countryDisplayName,
        description: t("metaDescription", { countryName: countryDisplayName, ...siteName }),
        canonicalPath: `/countries/${encodeURIComponent(countryCode)}`,
        openGraphType: "website",
        socialTitle: countryDisplayName,
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

  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("publicGeo.country");
  const tShared = await getTranslations("publicGeo.shared");
  const countryDisplayName = getLocalizedCountryDisplayName(
    countryCode,
    locale,
    country.name,
  );
  const description = t("metaDescription", {
    countryName: countryDisplayName,
    siteName: brand.siteName,
  });
  const canonicalPath = `/countries/${encodeURIComponent(countryCode)}`;
  // No /countries index route exists — breadcrumb is Home → {Country}.
  const structuredData = buildWebPageJsonLd({
    name: countryDisplayName,
    description,
    canonicalPath,
    breadcrumbs: [
      { name: tShared("home"), path: "/" },
      { name: countryDisplayName, path: canonicalPath },
    ],
  });

  // Pack 08K.3.3 — SSR seed shared civic_media trusted explanations (same identity as /media).
  let initialTrustedExplanationsById: Record<string, string> | undefined;
  try {
    const media = await fetchCivicMediaCenter();
    const documentLocale = await resolveDocumentHtmlLocale();
    const editorial = await loadCivicMediaEditorialSeed({
      media,
      language: documentLocale.locale,
    });
    initialTrustedExplanationsById = editorial.trustedExplanationsById;
  } catch {
    initialTrustedExplanationsById = undefined;
  }

  return (
    <>
      <JsonLdScript data={structuredData} />
      <CountryExperienceDynamicPage
        countryCode={countryCode}
        initialTrustedExplanationsById={initialTrustedExplanationsById}
      />
    </>
  );
}
