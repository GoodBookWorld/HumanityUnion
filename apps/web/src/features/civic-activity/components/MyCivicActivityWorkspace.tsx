"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";
import type {
  ActiveActivityGroup,
  CivicActivityGroup,
  CivicActivityGroupNoteKey,
  CivicActivityOverTime,
  CivicTimelineEntry,
  CivicTimelineEventType,
} from "../types";
import {
  ActivityOverTimeChart,
  DecisionGroupedBars,
  StatusStackedBar,
  type StatusSegment,
  useStatusLabels,
} from "./civic-activity-charts";

import "./civic-activity-workspace.css";

/** Icons keyed by stable group.id — never by translated display titles. */
export const ACTIVITY_SUMMARY_ICONS: Record<string, string> = {
  initiatives: "/icons/workspace/initiatives.svg",
  analyses: "/icons/workspace/analyses.svg",
  proposals: "/icons/workspace/proposals.svg",
  "decision-participation": "/icons/workspace/participation.svg",
  "implementation-commitments": "/icons/workspace/commitments.svg",
  "implementation-tracking": "/icons/workspace/tracking.svg",
  "public-impact": "/icons/workspace/impact.svg",
  "activity-over-time": "/icons/workspace/tracking.svg",
};

const GROUP_TITLE_KEYS = {
  initiatives: "groups.initiatives",
  analyses: "groups.analyses",
  proposals: "groups.proposals",
  "decision-participation": "groups.decision-participation",
  "implementation-commitments": "groups.implementation-commitments",
  "implementation-tracking": "groups.implementation-tracking",
  "public-impact": "groups.public-impact",
} as const;

function formatMetricValue(value: number | undefined): string {
  if (value === undefined) {
    return "—";
  }

  return String(value);
}

function resolveGroupTitle(
  groupId: string,
  t: ReturnType<typeof useTranslations<"civicActivity">>,
): string {
  const key = GROUP_TITLE_KEYS[groupId as keyof typeof GROUP_TITLE_KEYS];
  return key ? t(key) : groupId;
}

function resolveGroupNote(
  noteKey: CivicActivityGroupNoteKey | undefined,
  t: ReturnType<typeof useTranslations<"civicActivity">>,
): string | null {
  if (!noteKey) {
    return null;
  }
  if (noteKey === "decisionVotesLinked") {
    return t("notes.decisionVotesLinked");
  }
  return t("notes.decisionVotesLinkedPendingApi");
}

const TIMELINE_EVENT_KEYS = {
  initiative_created: "timeline.events.initiative_created",
  initiative_published: "timeline.events.initiative_published",
  analysis_published: "timeline.events.analysis_published",
  proposal_submitted: "timeline.events.proposal_submitted",
  proposal_accepted: "timeline.events.proposal_accepted",
  proposal_partially_accepted: "timeline.events.proposal_partially_accepted",
  proposal_declined: "timeline.events.proposal_declined",
  vote_cast: "timeline.events.vote_cast",
  vote_updated: "timeline.events.vote_updated",
  decision_session_published: "timeline.events.decision_session_published",
  commitment_published: "timeline.events.commitment_published",
  implementation_tracking_activated: "timeline.events.implementation_tracking_activated",
  implementation_update_added: "timeline.events.implementation_update_added",
  implementation_tracking_completed: "timeline.events.implementation_tracking_completed",
  public_impact_published: "timeline.events.public_impact_published",
  public_impact_verified: "timeline.events.public_impact_verified",
} as const satisfies Record<CivicTimelineEventType, string>;

function resolveTimelineLabel(
  type: CivicTimelineEventType,
  t: ReturnType<typeof useTranslations<"civicActivity">>,
): string {
  return t(TIMELINE_EVENT_KEYS[type]);
}

function buildStatusChart(group: ActiveActivityGroup, labels: ReturnType<typeof useStatusLabels>) {
  const { metrics } = group;
  const title = group.id;

  if (group.id === "decision-participation") {
    const sessionSegments: StatusSegment[] = [
      { key: "draft", label: labels.draft, value: metrics.draft ?? 0, tone: "muted" },
      { key: "published", label: labels.published, value: metrics.published ?? 0, tone: "primary" },
      { key: "completed", label: labels.completed, value: metrics.completed ?? 0, tone: "secondary" },
    ];
    return {
      kind: "decision" as const,
      sessionSegments,
      votesCast: metrics.votesCast ?? 0,
      chartAria: `${title}: ${sessionSegments.map((s) => `${s.label} ${s.value}`).join(", ")}, ${labels.votesCast} ${metrics.votesCast ?? 0}`,
    };
  }

  const segments: StatusSegment[] = [];
  if (metrics.draft !== undefined) {
    segments.push({ key: "draft", label: labels.draft, value: metrics.draft, tone: "muted" });
  }
  if (metrics.published !== undefined) {
    segments.push({
      key: "published",
      label: labels.published,
      value: metrics.published,
      tone: "primary",
    });
  }
  if (metrics.submitted !== undefined) {
    segments.push({
      key: "submitted",
      label: labels.submitted,
      value: metrics.submitted,
      tone: "primary",
    });
  }
  if (metrics.active !== undefined && group.id === "implementation-tracking") {
    segments.push({ key: "active", label: labels.active, value: metrics.active, tone: "primary" });
  }
  if (metrics.verified !== undefined) {
    segments.push({
      key: "verified",
      label: labels.verified,
      value: metrics.verified,
      tone: "verified",
    });
  }
  if (metrics.completed !== undefined) {
    segments.push({
      key: "completed",
      label: labels.completed,
      value: metrics.completed,
      tone: "secondary",
    });
  }

  return {
    kind: "stacked" as const,
    segments,
    proposed: group.id === "implementation-commitments" ? (metrics.proposed ?? 0) : undefined,
    chartAria: `${title}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`,
  };
}

function ActivityGroupCard({ group }: { group: CivicActivityGroup }) {
  const t = useTranslations("civicActivity");
  const title = resolveGroupTitle(group.id, t);
  const iconSrc = ACTIVITY_SUMMARY_ICONS[group.id];

  if (group.kind === "deferred") {
    return (
      <article className="civic-activity-card civic-activity-card--deferred">
        <h3 className="civic-activity-card__title">
          {iconSrc ? (
            <img
              className="civic-activity-card__icon"
              src={iconSrc}
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
            />
          ) : null}
          <span>{title}</span>
        </h3>
        <p className="civic-activity-card__deferred">
          {group.reasonKey === "decisionVotesLinkedPendingApi"
            ? t("notes.decisionVotesLinkedPendingApi")
            : group.reasonKey === "decisionVotesLinked"
              ? t("notes.decisionVotesLinked")
              : group.reasonKey}
        </p>
        <dl className="civic-activity-card__metrics">
          <div>
            <dt>{t("metrics.total")}</dt>
            <dd>{t("metrics.notAvailableYet")}</dd>
          </div>
          <div>
            <dt>{t("metrics.latestActivity")}</dt>
            <dd>{t("metrics.notAvailableYet")}</dd>
          </div>
        </dl>
      </article>
    );
  }

  return <ActiveActivityGroupCard group={group} title={title} iconSrc={iconSrc} />;
}

function CardDisclosure({
  expanded,
  onToggle,
  controlsId,
}: {
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
}) {
  const t = useTranslations("civicActivity");
  return (
    <button
      type="button"
      className="civic-activity-card__disclosure"
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      {expanded ? t("charts.hideDetails") : t("charts.showDetails")}
    </button>
  );
}

function ActiveActivityGroupCard({
  group,
  title,
  iconSrc,
}: {
  group: ActiveActivityGroup;
  title: string;
  iconSrc: string | undefined;
}) {
  const t = useTranslations("civicActivity");
  const locale = useLocale();
  const labels = useStatusLabels();
  const { metrics } = group;
  const note = resolveGroupNote(group.noteKey, t);
  const chart = buildStatusChart(group, labels);
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className="civic-activity-card"
      data-expanded={expanded ? "true" : "false"}
    >
      <h3 className="civic-activity-card__title">
        {iconSrc ? (
          <img
            className="civic-activity-card__icon"
            src={iconSrc}
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
          />
        ) : null}
        <span>{title}</span>
      </h3>

      <div className="civic-activity-card__primary">
        <p className="civic-activity-card__total">
          <span className="civic-activity-card__total-label">{t("metrics.total")}</span>
          <span className="civic-activity-card__total-value">{metrics.total}</span>
        </p>
        {chart.kind === "decision" ? (
          <DecisionGroupedBars
            sessionSegments={chart.sessionSegments}
            votesCast={chart.votesCast}
            votesLabel={labels.votesCast}
            ariaLabel={t("charts.statusBreakdownAria", { title, detail: chart.chartAria })}
          />
        ) : (
          <StatusStackedBar
            segments={chart.segments}
            ariaLabel={t("charts.statusBreakdownAria", { title, detail: chart.chartAria })}
          />
        )}
        {chart.kind === "stacked" && chart.proposed !== undefined ? (
          <p className="civic-activity-card__proposed-caption">
            {t("charts.proposedInvitations", { count: chart.proposed })}
          </p>
        ) : null}
      </div>

      {note ? <p className="civic-activity-card__note civic-activity-card__note--desktop">{note}</p> : null}

      <CardDisclosure
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        controlsId={detailsId}
      />

      <div id={detailsId} className="civic-activity-card__details">
        {note ? <p className="civic-activity-card__note civic-activity-card__note--mobile">{note}</p> : null}
        <dl className="civic-activity-card__metrics">
          <div>
            <dt>{t("metrics.total")}</dt>
            <dd>{metrics.total}</dd>
          </div>
          {metrics.draft !== undefined ? (
            <div>
              <dt>{t("metrics.drafts")}</dt>
              <dd>{metrics.draft}</dd>
            </div>
          ) : null}
          {metrics.published !== undefined ? (
            <div>
              <dt>{t("metrics.published")}</dt>
              <dd>{metrics.published}</dd>
            </div>
          ) : null}
          {metrics.submitted !== undefined ? (
            <div>
              <dt>{t("metrics.submitted")}</dt>
              <dd>{metrics.submitted}</dd>
            </div>
          ) : null}
          {metrics.active !== undefined ? (
            <div>
              <dt>{t("metrics.active")}</dt>
              <dd>{metrics.active}</dd>
            </div>
          ) : null}
          {metrics.votesCast !== undefined ? (
            <div>
              <dt>{t("metrics.votesCast")}</dt>
              <dd>{metrics.votesCast}</dd>
            </div>
          ) : null}
          {metrics.proposed !== undefined ? (
            <div>
              <dt>{t("metrics.proposed")}</dt>
              <dd>{metrics.proposed}</dd>
            </div>
          ) : null}
          {metrics.completed !== undefined ? (
            <div>
              <dt>{t("metrics.completed")}</dt>
              <dd>{metrics.completed}</dd>
            </div>
          ) : null}
          {metrics.verified !== undefined ? (
            <div>
              <dt>{t("metrics.verified")}</dt>
              <dd>{formatMetricValue(metrics.verified)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t("metrics.latestActivity")}</dt>
            <dd>
              {metrics.latestActivityDate
                ? formatInitiativeDate(metrics.latestActivityDate, locale)
                : t("metrics.noActivityYet")}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function ActivityOverTimeCard({ series }: { series: CivicActivityOverTime }) {
  const t = useTranslations("civicActivity");
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const iconSrc = ACTIVITY_SUMMARY_ICONS["activity-over-time"];
  const ariaDetail =
    series.actionsInPeriod === 0
      ? t("charts.overTimeEmpty")
      : t("charts.overTimeAria", {
          actions: series.actionsInPeriod,
          days: series.activeCivicDays,
          window: series.windowDays,
        });

  return (
    <article
      className="civic-activity-card civic-activity-card--over-time"
      data-expanded={expanded ? "true" : "false"}
    >
      <h3 className="civic-activity-card__title">
        {iconSrc ? (
          <img
            className="civic-activity-card__icon"
            src={iconSrc}
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
          />
        ) : null}
        <span>{t("groups.activity-over-time")}</span>
      </h3>

      <div className="civic-activity-card__primary">
        <p className="civic-activity-card__total">
          <span className="civic-activity-card__total-label">{t("charts.civicActions")}</span>
          <span className="civic-activity-card__total-value">{series.actionsInPeriod}</span>
        </p>
        <p className="civic-activity-card__window-caption">
          {t("charts.lastNDays", { count: series.windowDays })}
        </p>
        <ActivityOverTimeChart series={series} ariaLabel={ariaDetail} />
      </div>

      <CardDisclosure
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        controlsId={detailsId}
      />

      <div id={detailsId} className="civic-activity-card__details">
        <dl className="civic-activity-card__metrics">
          <div>
            <dt>{t("charts.civicActions")}</dt>
            <dd>{series.actionsInPeriod}</dd>
          </div>
          <div>
            <dt>{t("charts.activeCivicDays")}</dt>
            <dd>{series.activeCivicDays}</dd>
          </div>
          <div>
            <dt>{t("charts.windowLabel")}</dt>
            <dd>{t("charts.lastNDays", { count: series.windowDays })}</dd>
          </div>
        </dl>
        {series.actionsInPeriod === 0 ? (
          <p className="civic-activity-card__empty-note">{t("charts.overTimeEmpty")}</p>
        ) : null}
      </div>
    </article>
  );
}

function TimelineItem({ entry }: { entry: CivicTimelineEntry }) {
  const t = useTranslations("civicActivity");
  const locale = useLocale();

  return (
    <li className="civic-activity-workspace__timeline-item">
      <p className="civic-activity-workspace__timeline-date">
        {formatInitiativeDate(entry.occurredAt, locale)}
      </p>
      <p className="civic-activity-workspace__timeline-label">
        {resolveTimelineLabel(entry.type, t)}
      </p>
      <p className="civic-activity-workspace__timeline-detail">{entry.detail}</p>
      {entry.href ? (
        <Link className="civic-activity-workspace__timeline-link" href={entry.href}>
          {t("timeline.viewRecord")}
        </Link>
      ) : null}
    </li>
  );
}

interface CivicActivityIntroProps {
  loadedAt: string;
}

export function CivicActivityIntro({ loadedAt }: CivicActivityIntroProps) {
  const t = useTranslations("civicActivity");
  const locale = useLocale();
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <>
      <p className="civic-activity-workspace__intro">{t("intro", siteName)}</p>
      <p className="civic-activity-workspace__status">
        {t("statusLoaded", { date: formatInitiativeDate(loadedAt, locale) })}
      </p>
    </>
  );
}

interface CivicActivitySummaryCardsProps {
  groups: CivicActivityGroup[];
  activityOverTime: CivicActivityOverTime;
}

export function CivicActivitySummaryCards({
  groups,
  activityOverTime,
}: CivicActivitySummaryCardsProps) {
  return (
    <div className="civic-activity-workspace__cards">
      {groups.map((group) => (
        <ActivityGroupCard key={group.id} group={group} />
      ))}
      <ActivityOverTimeCard series={activityOverTime} />
    </div>
  );
}

interface CivicActivityTimelineProps {
  timeline: CivicTimelineEntry[];
}

export function CivicActivityTimeline({ timeline }: CivicActivityTimelineProps) {
  const t = useTranslations("civicActivity");

  if (timeline.length === 0) {
    return <p className="civic-activity-workspace__empty">{t("timeline.empty")}</p>;
  }

  return (
    <ul className="civic-activity-workspace__timeline">
      {timeline.map((entry) => (
        <TimelineItem key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}
