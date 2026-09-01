"use client";

import Link from "next/link";

import type { CivicArchiveLifecycleRecord } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { CivicArchiveCardTranslatedText } from "./CivicArchiveCardTranslatedText";

function formatDate(value: string | undefined): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatLocation(record: CivicArchiveLifecycleRecord): string {
  return [record.community, record.region, record.country].filter(Boolean).join(" · ");
}

interface PublicArchiveInitiativeCardProps {
  record: CivicArchiveLifecycleRecord;
}

export function PublicArchiveInitiativeCard({ record }: PublicArchiveInitiativeCardProps) {
  const archiveHref = `/civic-archive/${encodeURIComponent(record.initiativeId)}`;

  return (
    <article className="civic-archive-record-card">
      <Link className="civic-archive-record-card__link" href={archiveHref}>
        <div className="civic-archive-record-card__media">
          <InitiativeImage title={record.title} imageUrl={record.imageUrl} />
        </div>
        <div className="civic-archive-record-card__body">
          <span className="civic-archive-record-card__badge">{record.outcomeStatusLabel}</span>
          <CivicArchiveCardTranslatedText
            archiveRecordId={record.archiveRecordId}
            title={record.title}
            summary={record.summary || record.finalOutcomeSummary}
            titleClassName="civic-archive-record-card__title"
            summaryClassName="civic-archive-record-card__summary"
          />
          <p className="civic-archive-record-card__meta">
            {record.activityArea} · {formatLocation(record)}
          </p>
          <p className="civic-archive-record-card__meta">
            Archived {formatDate(record.archivedAt)}
            {record.completedAt ? ` · Completed ${formatDate(record.completedAt)}` : null}
          </p>
          <span className="civic-archive-record-card__action">View Archive Record →</span>
        </div>
      </Link>
    </article>
  );
}

export function PublicArchiveInitiativeCardSkeleton() {
  return (
    <article
      className="civic-archive-record-card civic-archive-record-card--loading"
      aria-hidden="true"
    >
      <div className="civic-archive-record-card__media-skeleton" />
      <div className="civic-archive-record-card__body">
        <span className="civic-archive-record-card__title-skeleton" />
        <span className="civic-archive-record-card__summary-skeleton" />
        <span className="civic-archive-record-card__meta-skeleton" />
      </div>
    </article>
  );
}
