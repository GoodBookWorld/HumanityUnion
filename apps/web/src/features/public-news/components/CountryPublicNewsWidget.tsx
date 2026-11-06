"use client";

import { useTranslations } from "next-intl";

import { PublicNewsSection } from "./PublicNewsSection";

interface CountryPublicNewsWidgetProps {
  countryCode: string;
  countryName: string;
}

/** Country News: providers are the country's configured NEWS_SOURCE resources. */
export function CountryPublicNewsWidget({
  countryCode,
  countryName,
}: CountryPublicNewsWidgetProps) {
  const t = useTranslations("publicNews.country");

  return (
    <PublicNewsSection
      variant="country"
      countryCode={countryCode}
      countryName={countryName}
      showToolbar={false}
      sectionId={`country-news-${countryCode.toLowerCase()}`}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      description={t("description", { countryName })}
      className="public-news-discovery--country"
    />
  );
}
