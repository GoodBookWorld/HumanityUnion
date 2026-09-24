"use client";

import { useTranslations } from "next-intl";

import type { CivicActivityOverTime } from "../types";
import { CIVIC_ACTIVITY_OVER_TIME_WINDOW_DAYS } from "../lib/civic-activity-over-time";

export interface StatusSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** CSS custom property / class tone token. */
  readonly tone: "muted" | "primary" | "secondary" | "accent" | "verified";
}

interface StatusStackedBarProps {
  readonly segments: readonly StatusSegment[];
  readonly ariaLabel: string;
}

/** Compact stacked horizontal status bar — decorative; metrics list is the text equivalent. */
export function StatusStackedBar({ segments, ariaLabel }: StatusStackedBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return (
      <div
        className="civic-activity-chart civic-activity-chart--stacked civic-activity-chart--empty"
        role="img"
        aria-label={ariaLabel}
      >
        <span className="civic-activity-chart__empty-track" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className="civic-activity-chart civic-activity-chart--stacked"
      role="img"
      aria-label={ariaLabel}
    >
      <div className="civic-activity-chart__stack" aria-hidden="true">
        {segments.map((segment) => {
          if (segment.value <= 0) {
            return null;
          }
          return (
            <span
              key={segment.key}
              className={`civic-activity-chart__segment civic-activity-chart__segment--${segment.tone}`}
              style={{ flex: `${segment.value} 1 0%` }}
              title={`${segment.label}: ${segment.value}`}
            />
          );
        })}
      </div>
    </div>
  );
}

interface DecisionGroupedBarsProps {
  readonly sessionSegments: readonly StatusSegment[];
  readonly votesCast: number;
  readonly votesLabel: string;
  readonly ariaLabel: string;
}

/** Grouped mini-bars: session statuses + distinct votesCast bar. */
export function DecisionGroupedBars({
  sessionSegments,
  votesCast,
  votesLabel,
  ariaLabel,
}: DecisionGroupedBarsProps) {
  const max = Math.max(votesCast, ...sessionSegments.map((segment) => segment.value), 1);

  return (
    <div
      className="civic-activity-chart civic-activity-chart--grouped"
      role="img"
      aria-label={ariaLabel}
    >
      <ul className="civic-activity-chart__grouped-list" aria-hidden="true">
        {sessionSegments.map((segment) => (
          <li key={segment.key} className="civic-activity-chart__grouped-row">
            <span className="civic-activity-chart__grouped-label">{segment.label}</span>
            <span className="civic-activity-chart__grouped-track">
              <span
                className={`civic-activity-chart__grouped-fill civic-activity-chart__segment--${segment.tone}`}
                style={{ width: `${Math.round((segment.value / max) * 100)}%` }}
              />
            </span>
            <span className="civic-activity-chart__grouped-value">{segment.value}</span>
          </li>
        ))}
        <li className="civic-activity-chart__grouped-row civic-activity-chart__grouped-row--votes">
          <span className="civic-activity-chart__grouped-label">{votesLabel}</span>
          <span className="civic-activity-chart__grouped-track">
            <span
              className="civic-activity-chart__grouped-fill civic-activity-chart__segment--accent"
              style={{ width: `${Math.round((votesCast / max) * 100)}%` }}
            />
          </span>
          <span className="civic-activity-chart__grouped-value">{votesCast}</span>
        </li>
      </ul>
    </div>
  );
}

interface ActivityOverTimeChartProps {
  readonly series: CivicActivityOverTime;
  readonly ariaLabel: string;
}

/**
 * Compact daily bar chart for the last N days.
 * SVG viewBox is responsive; chronological order is always oldest → newer.
 */
export function ActivityOverTimeChart({ series, ariaLabel }: ActivityOverTimeChartProps) {
  const width = 300;
  const height = 56;
  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const max = Math.max(1, ...series.days.map((day) => day.actionCount));
  const barGap = 1;
  const barWidth = Math.max(1, (innerW - barGap * (series.days.length - 1)) / series.days.length);

  return (
    <div className="civic-activity-chart civic-activity-chart--over-time">
      <svg
        className="civic-activity-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {series.days.map((day, index) => {
          const barH =
            day.actionCount <= 0 ? 2 : Math.max(3, (day.actionCount / max) * innerH);
          const x = padX + index * (barWidth + barGap);
          const y = padY + innerH - barH;
          return (
            <rect
              key={day.date}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={1}
              className={
                day.actionCount > 0
                  ? "civic-activity-chart__day-bar"
                  : "civic-activity-chart__day-bar civic-activity-chart__day-bar--empty"
              }
            />
          );
        })}
      </svg>
    </div>
  );
}

export function overTimeWindowDays(series: CivicActivityOverTime): number {
  return series.windowDays || CIVIC_ACTIVITY_OVER_TIME_WINDOW_DAYS;
}

export function useStatusLabels() {
  const t = useTranslations("civicActivity");
  return {
    draft: t("metrics.drafts"),
    published: t("metrics.published"),
    submitted: t("metrics.submitted"),
    active: t("metrics.active"),
    completed: t("metrics.completed"),
    verified: t("metrics.verified"),
    votesCast: t("metrics.votesCast"),
    proposed: t("metrics.proposed"),
  };
}
