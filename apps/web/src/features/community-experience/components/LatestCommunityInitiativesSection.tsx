"use client";

import { useTranslations } from "next-intl";

import type { LatestInitiativesPublicProjection } from "@hu/types";

import { ExperienceBlockShell, LatestInitiativesEvidence } from "../../public-experience";

interface LatestCommunityInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
  communityName: string;
}

export function LatestCommunityInitiativesSection({
  projection,
  communityName,
}: LatestCommunityInitiativesSectionProps) {
  const t = useTranslations("publicGeo.community.initiatives");

  return (
    <ExperienceBlockShell
      id="latest-community-initiatives"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { communityName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <LatestInitiativesEvidence projection={projection} emptyMessage={t("emptyMessage")} />
    </ExperienceBlockShell>
  );
}
