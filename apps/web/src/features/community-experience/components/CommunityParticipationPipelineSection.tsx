"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

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
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="community-participation-pipeline"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { communityName, ...siteName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
