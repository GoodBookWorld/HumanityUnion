"use client";

import { useTranslations } from "next-intl";

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

  return (
    <ExperienceBlockShell
      id="regional-participation-pipeline"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { regionName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
