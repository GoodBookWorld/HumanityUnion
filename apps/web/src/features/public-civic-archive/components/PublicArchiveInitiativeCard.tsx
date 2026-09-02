"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CivicArchiveLifecycleRecord } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { resolveCivicArchiveOutcomeStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
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
  const t = useTranslations("initiativeExperience");
  const archiveHref = `/civic-archive/${encodeURIComponent(record.initiativeId)}`;
  const outcomeLabel = resolveCivicArchiveOutcomeStatusDisplayLabel(
    record.outcomeStatus,
    t,
    record.outcomeStatusLabel,
  );

  return (
    <article className="civic-archive-record-card">
      <Link className="civic-archive-record-card__link" href={archiveHref}>
        <div className="civic-archive-record-card__media">
          <InitiativeImage title={record.title} imageUrl={record.imageUrl} />
        </div>
        <div className="civic-archive-record-card__body">
          <span className="civic-archive-record-card__badge">{outcomeLabel}</span>
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
            {t("civicArchivePublic.card.archived", { date: formatDate(record.archivedAt) })}
            {record.completedAt
              ? ` · ${t("civicArchivePublic.card.completed", { date: formatDate(record.completedAt) })}`
              : null}
          </p>
          <span className="civic-archive-record-card__action">
            {t("civicArchivePublic.card.viewRecord")}
          </span>
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
