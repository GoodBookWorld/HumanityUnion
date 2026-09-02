"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { CivicArchiveLifecycleRecord } from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";
import { resolveCivicArchiveOutcomeStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { CivicArchiveCardTranslatedText } from "./CivicArchiveCardTranslatedText";

export const PUBLIC_ARCHIVE_INITIATIVE_MINI_CARD_FALLBACK_IMAGE =
  "/images/initiatives/initiative-default.webp";

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

function MiniCardImage({ title, imageUrl }: { title: string; imageUrl?: string | null }) {
  const resolvedImageUrl = resolveMediaUrl(imageUrl);
  const [useFallback, setUseFallback] = useState(!resolvedImageUrl);
  const src = useFallback ? PUBLIC_ARCHIVE_INITIATIVE_MINI_CARD_FALLBACK_IMAGE : resolvedImageUrl;

  return (
    <img
      src={src}
      alt={useFallback ? "" : title}
      aria-hidden={useFallback ? true : undefined}
      width={320}
      height={180}
      loading="lazy"
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
    />
  );
}

interface PublicArchiveInitiativeMiniCardProps {
  record: CivicArchiveLifecycleRecord;
}

export function PublicArchiveInitiativeMiniCard({ record }: PublicArchiveInitiativeMiniCardProps) {
  const t = useTranslations("initiativeExperience");
  const archiveHref = `/civic-archive/${encodeURIComponent(record.initiativeId)}`;
  const outcomeLabel = resolveCivicArchiveOutcomeStatusDisplayLabel(
    record.outcomeStatus,
    t,
    record.outcomeStatusLabel,
  );

  return (
    <Link
      href={archiveHref}
      className="civic-archive-mini-card"
      aria-label={t("civicArchivePublic.card.viewRecordAria", { title: record.title })}
    >
      <div className="civic-archive-mini-card__media">
        <MiniCardImage title={record.title} imageUrl={record.imageUrl} />
      </div>
      <div className="civic-archive-mini-card__body">
        <span className="civic-archive-mini-card__badge">{outcomeLabel}</span>
        <CivicArchiveCardTranslatedText
          archiveRecordId={record.archiveRecordId}
          title={record.title}
          summary={record.summary || record.finalOutcomeSummary}
          titleClassName="civic-archive-mini-card__title"
          summaryClassName="civic-archive-mini-card__summary"
        />
        <p className="civic-archive-mini-card__meta">
          {record.activityArea} · {formatLocation(record)}
        </p>
        <p className="civic-archive-mini-card__meta">
          {t("civicArchivePublic.card.archived", { date: formatDate(record.archivedAt) })}
          {record.completedAt
            ? ` · ${t("civicArchivePublic.card.completed", { date: formatDate(record.completedAt) })}`
            : null}
        </p>
        <span className="civic-archive-mini-card__action">
          {t("civicArchivePublic.card.viewRecord")}
        </span>
      </div>
    </Link>
  );
}

export function PublicArchiveInitiativeMiniCardSkeleton() {
  return (
    <article
      className="civic-archive-mini-card civic-archive-mini-card--loading"
      aria-hidden="true"
    >
      <div className="civic-archive-mini-card__media-skeleton" />
      <div className="civic-archive-mini-card__body">
        <span className="civic-archive-mini-card__title-skeleton" />
        <span className="civic-archive-mini-card__summary-skeleton" />
      </div>
    </article>
  );
}
