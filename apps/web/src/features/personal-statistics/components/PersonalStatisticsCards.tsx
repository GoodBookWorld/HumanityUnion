"use client";

import type { ParticipantStatistics } from "@hu/types";
import { useTranslations } from "next-intl";

import {
  PERSONAL_STATISTICS_CARDS,
  type PersonalStatisticsCardConfig,
} from "../personal-statistics-cards.config";
import { resolveWorkspaceStatsLabel } from "../../workspace-home/workspace-home-i18n";

import "../personal-statistics.css";

export { PERSONAL_STATISTICS_CARDS, type PersonalStatisticsCardConfig };

interface PersonalStatisticsCardsProps {
  statistics: ParticipantStatistics | null;
  loading?: boolean;
}

function StatisticSkeletonCard({ label }: { label: string }) {
  return (
    <li
      className="personal-statistics__card personal-statistics__card--loading"
      aria-hidden="true"
    >
      <span className="personal-statistics__icon-skeleton" />
      <span className="personal-statistics__value-skeleton" />
      <p className="personal-statistics__label">{label}</p>
    </li>
  );
}

export function PersonalStatisticsCards({
  statistics,
  loading = false,
}: PersonalStatisticsCardsProps) {
  const t = useTranslations("workspace");

  if (loading || !statistics) {
    return (
      <ul className="personal-statistics__grid" aria-hidden="true">
        {PERSONAL_STATISTICS_CARDS.map((card) => (
          <StatisticSkeletonCard
            key={card.key}
            label={resolveWorkspaceStatsLabel(t, card.key)}
          />
        ))}
      </ul>
    );
  }

  return (
    <ul className="personal-statistics__grid">
      {PERSONAL_STATISTICS_CARDS.map((card) => (
        <li key={card.key} className="personal-statistics__card">
          <img
            className="personal-statistics__icon"
            src={card.iconSrc}
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
          />
          <p className="personal-statistics__value">{statistics[card.key]}</p>
          <p className="personal-statistics__label">
            {resolveWorkspaceStatsLabel(t, card.key)}
          </p>
        </li>
      ))}
    </ul>
  );
}
