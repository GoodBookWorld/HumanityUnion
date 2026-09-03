"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { ExperienceBlockShell } from "../../public-experience";
import { RegionalInteractiveMapEvidence } from "./RegionalInteractiveMapEvidence";

interface RegionalInteractiveMapSectionProps {
  regionName: string;
}

export function RegionalInteractiveMapSection({ regionName }: RegionalInteractiveMapSectionProps) {
  const t = useTranslations("publicGeo.region.map");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="regional-interactive-map"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", siteName)}
    >
      <RegionalInteractiveMapEvidence regionName={regionName} />
    </ExperienceBlockShell>
  );
}
