"use client";

import { useTranslations } from "next-intl";

import type { ParticipationPublicStatisticsProjection } from "@hu/types";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { ExperienceBlockShell, ParticipationStatisticsEvidence } from "../../public-experience";

interface CommunityStatisticsSectionProps {
  projection: ParticipationPublicStatisticsProjection;
  communityName: string;
}

export function CommunityStatisticsSection({
  projection,
  communityName,
}: CommunityStatisticsSectionProps) {
  const t = useTranslations("publicStatistics.community");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="community-statistics"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { communityName, ...siteName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <ParticipationStatisticsEvidence projection={projection} />
      <p className="community-statistics__public-note" role="note">
        {t("publicNote")}
      </p>
    </ExperienceBlockShell>
  );
}
