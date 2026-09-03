"use client";

import { useTranslations } from "next-intl";

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

  return (
    <ExperienceBlockShell
      id="latest-regional-initiatives"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { regionName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <LatestInitiativesEvidence projection={projection} emptyMessage={t("empty")} />
    </ExperienceBlockShell>
  );
}
