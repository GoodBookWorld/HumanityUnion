"use client";

import { useTranslations } from "next-intl";

import type { TrustedMediaResource } from "@hu/types";

import { PublicNewsSection } from "./PublicNewsSection";

interface CountryPublicNewsWidgetProps {
  countryCode: string;
  countryName: string;
  regionName: string;
  recommendedMedia: TrustedMediaResource[];
}

export function CountryPublicNewsWidget({
  countryCode,
  countryName,
  regionName,
  recommendedMedia,
}: CountryPublicNewsWidgetProps) {
  const t = useTranslations("publicNews.country");

  return (
    <PublicNewsSection
      variant="country"
      countryCode={countryCode}
      countryName={countryName}
      regionName={regionName}
      recommendedMedia={recommendedMedia.map((resource) => ({
        id: resource.id,
        name: resource.name,
      }))}
      showToolbar={false}
      sectionId={`country-news-${countryCode.toLowerCase()}`}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      description={t("description", { countryName })}
      className="public-news-discovery--country"
    />
  );
}
