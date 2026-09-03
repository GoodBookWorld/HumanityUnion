"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

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
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="latest-community-initiatives"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { communityName, ...siteName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <LatestInitiativesEvidence projection={projection} emptyMessage={t("emptyMessage")} />
    </ExperienceBlockShell>
  );
}
