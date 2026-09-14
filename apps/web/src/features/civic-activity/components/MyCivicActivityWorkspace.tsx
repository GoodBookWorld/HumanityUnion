"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";
import type {
  ActiveActivityGroup,
  CivicActivityGroup,
  CivicActivityGroupNoteKey,
  CivicTimelineEntry,
  CivicTimelineEventType,
} from "../types";

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
  const { metrics } = group;
  const note = resolveGroupNote(group.noteKey, t);

  return (
    <article className="civic-activity-card">
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
      {note ? <p className="civic-activity-card__note">{note}</p> : null}
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
              ? formatInitiativeDate(metrics.latestActivityDate)
              : t("metrics.noActivityYet")}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function TimelineItem({ entry }: { entry: CivicTimelineEntry }) {
  const t = useTranslations("civicActivity");

  return (
    <li className="civic-activity-workspace__timeline-item">
      <p className="civic-activity-workspace__timeline-date">
        {formatInitiativeDate(entry.occurredAt)}
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
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <>
      <p className="civic-activity-workspace__intro">{t("intro", siteName)}</p>
      <p className="civic-activity-workspace__status">
        {t("statusLoaded", { date: formatInitiativeDate(loadedAt) })}
      </p>
    </>
  );
}

interface CivicActivitySummaryCardsProps {
  groups: CivicActivityGroup[];
}

export function CivicActivitySummaryCards({ groups }: CivicActivitySummaryCardsProps) {
  return (
    <div className="civic-activity-workspace__cards">
      {groups.map((group) => (
        <ActivityGroupCard key={group.id} group={group} />
      ))}
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
