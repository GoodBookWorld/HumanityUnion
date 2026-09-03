"use client";

import { useTranslations } from "next-intl";

import type { ParticipationPipelinePublicProjection } from "@hu/types";

import { ExperienceBlockShell, ParticipationPipelineEvidence } from "../../public-experience";

interface CommunityParticipationPipelineSectionProps {
  projection: ParticipationPipelinePublicProjection;
  communityName: string;
}

export function CommunityParticipationPipelineSection({
  projection,
  communityName,
}: CommunityParticipationPipelineSectionProps) {
  const t = useTranslations("publicGeo.community.pipeline");

  return (
    <ExperienceBlockShell
      id="community-participation-pipeline"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { communityName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
