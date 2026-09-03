"use client";

import { useTranslations } from "next-intl";

import type { ParticipationPublicStatisticsProjection } from "@hu/types";

import { ExperienceBlockShell, ParticipationStatisticsEvidence } from "../../public-experience";

interface RegionalStatisticsSectionProps {
  projection: ParticipationPublicStatisticsProjection;
  regionName: string;
}

export function RegionalStatisticsSection({
  projection,
  regionName,
}: RegionalStatisticsSectionProps) {
  const t = useTranslations("publicStatistics.region");

  return (
    <ExperienceBlockShell
      id="regional-statistics"
      title={t("title")}
      architecturalName={t("architecturalName")}
      stage={t("stage")}
      contextIntroduction={t("contextIntroduction", { regionName })}
      visitorConclusion={t("visitorConclusion")}
    >
      <ParticipationStatisticsEvidence projection={projection} />
      <p className="regional-statistics__public-note" role="note">
        {t("publicNote")}
      </p>
    </ExperienceBlockShell>
  );
}
