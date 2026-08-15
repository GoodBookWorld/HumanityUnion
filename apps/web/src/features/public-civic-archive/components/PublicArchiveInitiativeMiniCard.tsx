"use client";

import Link from "next/link";
import { useState } from "react";

import type { CivicArchiveLifecycleRecord } from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";

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
  const archiveHref = `/civic-archive/${encodeURIComponent(record.initiativeId)}`;

  return (
    <Link
      href={archiveHref}
      className="civic-archive-mini-card"
      aria-label={`View archive record: ${record.title}`}
    >
      <div className="civic-archive-mini-card__media">
        <MiniCardImage title={record.title} imageUrl={record.imageUrl} />
      </div>
      <div className="civic-archive-mini-card__body">
        <span className="civic-archive-mini-card__badge">{record.outcomeStatusLabel}</span>
        <h3 className="civic-archive-mini-card__title">{record.title}</h3>
        <p className="civic-archive-mini-card__summary">{record.finalOutcomeSummary}</p>
        <p className="civic-archive-mini-card__meta">
          {record.activityArea} · {formatLocation(record)}
        </p>
        <p className="civic-archive-mini-card__meta">
          Archived {formatDate(record.archivedAt)}
          {record.completedAt ? ` · Completed ${formatDate(record.completedAt)}` : null}
        </p>
        <span className="civic-archive-mini-card__action">View Archive Record →</span>
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
        <span className="civic-archive-mini-card__meta-skeleton" />
      </div>
    </article>
  );
}
