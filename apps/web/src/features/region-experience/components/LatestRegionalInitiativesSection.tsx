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
      // The conclusion copy describes demonstration cards, which only bootstrap data has.
      visitorConclusion={projection.source === "bootstrap" ? t("visitorConclusion") : undefined}
    >
      <LatestInitiativesEvidence projection={projection} emptyMessage={t("emptyMessage")} />
    </ExperienceBlockShell>
  );
}
