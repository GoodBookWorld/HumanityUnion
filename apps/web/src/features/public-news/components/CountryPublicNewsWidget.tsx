"use client";

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
      eyebrow="COUNTRY NEWS"
      heading="Latest Trusted News"
      description={`Recent verified reporting relevant to ${countryName}.`}
      className="public-news-discovery--country"
    />
  );
}
