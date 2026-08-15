import type { ParticipantStatistics } from "@hu/types";

import {
  PERSONAL_STATISTICS_CARDS,
  type PersonalStatisticsCardConfig,
} from "../personal-statistics-cards.config";

import "../personal-statistics.css";

/**
 * Re-exported so existing importers of the card config keep working;
 * the config itself now lives in a CSS-free module (see
 * `personal-statistics-cards.config.ts`) so the Public Profile's
 * Privacy-filtered "Participation Statistics" cards (Profile UX Pack 03.2
 * Part 7) can reuse the exact same labels/icons from pure, testable
 * presentation logic without pulling in this component's `.css` import.
 */
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

/**
 * Profile UX Pack 02 Part 1/4/11 — the ONE shared "Personal Statistics"
 * component reused verbatim by Workspace (Part 1) and the Member Profile
 * page (Part 4). Visually mirrors the existing `platform-statistics__card`
 * language (border, radius, shadow, icon-over-value-over-label), scoped
 * under its own `personal-statistics__` class names since these numbers
 * are per-Participant, not platform-wide.
 */
export function PersonalStatisticsCards({
  statistics,
  loading = false,
}: PersonalStatisticsCardsProps) {
  if (loading || !statistics) {
    return (
      <ul className="personal-statistics__grid" aria-hidden="true">
        {PERSONAL_STATISTICS_CARDS.map((card) => (
          <StatisticSkeletonCard key={card.key} label={card.label} />
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
          <p className="personal-statistics__label">{card.label}</p>
        </li>
      ))}
    </ul>
  );
}
