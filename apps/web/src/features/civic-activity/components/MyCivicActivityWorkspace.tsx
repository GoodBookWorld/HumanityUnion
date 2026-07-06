"use client";

import Link from "next/link";

import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";
import type { ActiveActivityGroup, CivicActivityGroup, CivicTimelineEntry } from "../types";

import "./civic-activity-workspace.css";

function formatMetricValue(value: number | undefined): string {
  if (value === undefined) {
    return "—";
  }

  return String(value);
}

function formatLatestDate(value: string | null): string {
  if (!value) {
    return "No activity yet";
  }

  return formatInitiativeDate(value);
}

function ActivityGroupCard({ group }: { group: CivicActivityGroup }) {
  if (group.kind === "deferred") {
    return (
      <article className="civic-activity-card civic-activity-card--deferred">
        <h3 className="civic-activity-card__title">{group.title}</h3>
        <p className="civic-activity-card__deferred">{group.reason}</p>
        <dl className="civic-activity-card__metrics">
          <div>
            <dt>Total</dt>
            <dd>Not available yet</dd>
          </div>
          <div>
            <dt>Latest activity</dt>
            <dd>Not available yet</dd>
          </div>
        </dl>
      </article>
    );
  }

  return <ActiveActivityGroupCard group={group} />;
}

function ActiveActivityGroupCard({ group }: { group: ActiveActivityGroup }) {
  const { metrics } = group;

  return (
    <article className="civic-activity-card">
      <h3 className="civic-activity-card__title">{group.title}</h3>
      {group.note ? <p className="civic-activity-card__note">{group.note}</p> : null}
      <dl className="civic-activity-card__metrics">
        <div>
          <dt>Total</dt>
          <dd>{metrics.total}</dd>
        </div>
        {metrics.draft !== undefined ? (
          <div>
            <dt>Drafts</dt>
            <dd>{metrics.draft}</dd>
          </div>
        ) : null}
        {metrics.published !== undefined ? (
          <div>
            <dt>Published</dt>
            <dd>{metrics.published}</dd>
          </div>
        ) : null}
        {metrics.submitted !== undefined ? (
          <div>
            <dt>Submitted</dt>
            <dd>{metrics.submitted}</dd>
          </div>
        ) : null}
        {metrics.active !== undefined ? (
          <div>
            <dt>Active</dt>
            <dd>{metrics.active}</dd>
          </div>
        ) : null}
        {metrics.votesCast !== undefined ? (
          <div>
            <dt>Votes cast</dt>
            <dd>{metrics.votesCast}</dd>
          </div>
        ) : null}
        {metrics.completed !== undefined ? (
          <div>
            <dt>Completed</dt>
            <dd>{metrics.completed}</dd>
          </div>
        ) : null}
        {metrics.verified !== undefined ? (
          <div>
            <dt>Verified</dt>
            <dd>{formatMetricValue(metrics.verified)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Latest activity</dt>
          <dd>{formatLatestDate(metrics.latestActivityDate)}</dd>
        </div>
      </dl>
    </article>
  );
}

function TimelineItem({ entry }: { entry: CivicTimelineEntry }) {
  return (
    <li className="civic-activity-workspace__timeline-item">
      <p className="civic-activity-workspace__timeline-date">
        {formatInitiativeDate(entry.occurredAt)}
      </p>
      <p className="civic-activity-workspace__timeline-label">{entry.label}</p>
      <p className="civic-activity-workspace__timeline-detail">{entry.detail}</p>
      {entry.href ? (
        <Link className="civic-activity-workspace__timeline-link" href={entry.href}>
          View record
        </Link>
      ) : null}
    </li>
  );
}

interface CivicActivityIntroProps {
  loadedAt: string;
}

export function CivicActivityIntro({ loadedAt }: CivicActivityIntroProps) {
  return (
    <>
      <p className="civic-activity-workspace__intro">
        Your private civic work dashboard. This shows your own contributions across the Humanity
        Union lifecycle — not popularity, followers, or social ranking.
      </p>
      <p className="civic-activity-workspace__status">
        Last loaded {formatInitiativeDate(loadedAt)}. Counts reflect your authenticated workspace
        data only.
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
  if (timeline.length === 0) {
    return (
      <p className="civic-activity-workspace__empty">
        No civic activity timeline entries yet. As you create initiatives, publish analyses, submit
        proposals, or participate in decisions, your recent actions will appear here.
      </p>
    );
  }

  return (
    <ul className="civic-activity-workspace__timeline">
      {timeline.map((entry) => (
        <TimelineItem key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}
