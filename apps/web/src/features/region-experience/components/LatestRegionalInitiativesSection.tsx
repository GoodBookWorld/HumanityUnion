"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import type { LatestInitiativesPublicProjection } from "@hu/types";

import { ExperienceBlockShell, LatestInitiativesEvidence } from "../../public-experience";

interface LatestRegionalInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
  regionName: string;
}

export function LatestRegionalInitiativesSection({
  projection,
  regionName,
}: LatestRegionalInitiativesSectionProps) {
  const t = useTranslations("publicGeo.region.initiatives");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="latest-regional-initiatives"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { regionName, ...siteName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <LatestInitiativesEvidence projection={projection} emptyMessage={t("empty")} />
    </ExperienceBlockShell>
  );
}
