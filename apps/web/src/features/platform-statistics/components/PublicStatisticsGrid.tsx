"use client";

import { useState } from "react";

import type { PublicStatisticCardConfig } from "../public-statistics-config";

import "../platform-statistics.css";

interface PublicStatisticsGridProps {
  cards: ReadonlyArray<PublicStatisticCardConfig>;
  loading: boolean;
  allUnavailable?: boolean;
  unavailableMessage?: string;
  loadingMessage?: string;
  aboutMetricLabel?: string;
  unavailableValueLabel?: string;
  formatUnavailableAriaLabel?: (label: string) => string;
  resolveValue: (key: string) => number | null;
  formatValue: (key: string, value: number) => string;
  showDescriptions?: boolean;
}

function StatisticSkeletonCard() {
  return (
    <li className="platform-statistics__card platform-statistics__card--loading" aria-hidden="true">
      <span className="platform-statistics__icon-skeleton" />
      <span className="platform-statistics__value-skeleton" />
      <span className="platform-statistics__label-skeleton" />
    </li>
  );
}

export function PublicStatisticsGrid({
  cards,
  loading,
  allUnavailable = false,
  unavailableMessage = "Statistics are temporarily unavailable.",
  loadingMessage = "Loading statistics...",
  aboutMetricLabel = "About this metric",
  unavailableValueLabel = "Unavailable",
  formatUnavailableAriaLabel,
  resolveValue,
  formatValue,
  showDescriptions = false,
}: PublicStatisticsGridProps) {
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  if (loading) {
    return (
      <>
        <p className="platform-statistics__status platform-statistics__status--loading">
          {loadingMessage}
        </p>
        <ul className="platform-statistics__grid" aria-hidden="true">
          {cards.map((card) => (
            <StatisticSkeletonCard key={card.key} />
          ))}
        </ul>
      </>
    );
  }

  if (allUnavailable) {
    return (
      <p className="platform-statistics__status platform-statistics__status--error" role="status">
        {unavailableMessage}
      </p>
    );
  }

  return (
    <ul className="platform-statistics__grid">
      {cards.map((card) => {
        const value = resolveValue(card.key);
        const unavailable = value === null;
        const valueAriaLabel = unavailable
          ? (formatUnavailableAriaLabel?.(card.label) ?? `${card.label}: unavailable`)
          : `${card.label}: ${value}`;

        return (
          <li key={card.key} className="platform-statistics__card">
            <img
              className="platform-statistics__icon"
              src={card.iconSrc}
              alt=""
              aria-hidden="true"
              width={64}
              height={64}
            />
            <p className="platform-statistics__value" aria-label={valueAriaLabel}>
              {unavailable ? unavailableValueLabel : formatValue(card.key, value)}
            </p>
            <p className="platform-statistics__label">{card.label}</p>
            {showDescriptions ? (
              <>
                <button
                  type="button"
                  className="platform-statistics__info-trigger"
                  aria-describedby={`stat-desc-${card.key}`}
                  aria-expanded={expandedMetric === card.key}
                  onClick={() =>
                    setExpandedMetric((current) => (current === card.key ? null : card.key))
                  }
                >
                  {aboutMetricLabel}
                </button>
                <p className="platform-statistics__description" id={`stat-desc-${card.key}`}>
                  {card.description}
                </p>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
