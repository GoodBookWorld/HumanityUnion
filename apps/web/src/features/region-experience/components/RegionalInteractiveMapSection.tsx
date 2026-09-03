"use client";

import { useTranslations } from "next-intl";

import { ExperienceBlockShell } from "../../public-experience";
import { RegionalInteractiveMapEvidence } from "./RegionalInteractiveMapEvidence";

interface RegionalInteractiveMapSectionProps {
  regionName: string;
}

export function RegionalInteractiveMapSection({ regionName }: RegionalInteractiveMapSectionProps) {
  const t = useTranslations("publicGeo.region.map");

  return (
    <ExperienceBlockShell
      id="regional-interactive-map"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction")}
    >
      <RegionalInteractiveMapEvidence regionName={regionName} />
    </ExperienceBlockShell>
  );
}
