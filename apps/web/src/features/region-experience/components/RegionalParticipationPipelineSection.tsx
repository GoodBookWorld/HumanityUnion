"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import type { ParticipationPipelinePublicProjection } from "@hu/types";

import { ExperienceBlockShell, ParticipationPipelineEvidence } from "../../public-experience";

interface RegionalParticipationPipelineSectionProps {
  projection: ParticipationPipelinePublicProjection;
  regionName: string;
}

export function RegionalParticipationPipelineSection({
  projection,
  regionName,
}: RegionalParticipationPipelineSectionProps) {
  const t = useTranslations("publicGeo.region.pipeline");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="regional-participation-pipeline"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { regionName, ...siteName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
