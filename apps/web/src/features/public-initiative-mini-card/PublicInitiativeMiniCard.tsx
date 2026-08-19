"use client";

import Link from "next/link";

import type { WorldInitiativeCardProjection } from "@hu/types";

import {
  buildPublicInitiativeSharePayload,
  CivicShareButton,
} from "../civic-share";
import { InitiativeImage } from "../initiatives/components/InitiativeImage";

import "./public-initiative-mini-card.css";

export const PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE =
  "/images/initiatives/initiative-default.webp";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildAccessibleName(initiative: WorldInitiativeCardProjection): string {
  return `View initiative: ${initiative.title}`;
}

export function resolvePublicInitiativeHref(initiative: WorldInitiativeCardProjection): string {
  return (
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`
  );
}

/**
 * Share Fix 01 — Share lives outside the navigation Link so the civic
 * popover never competes with card navigation or nested-interactive quirks.
 */
export function PublicInitiativeMiniCard({
  initiative,
}: {
  initiative: WorldInitiativeCardProjection;
}) {
  const href = resolvePublicInitiativeHref(initiative);

  return (
    <article className="public-initiative-mini-card">
      <div className="public-initiative-mini-card__share">
        <CivicShareButton
          compact
          stopPropagation
          payload={buildPublicInitiativeSharePayload({
            initiativeId: initiative.initiativeId,
            title: initiative.title,
            image: initiative.imageUrl,
            optionalText: initiative.summary,
          })}
          ariaLabel={`Share initiative: ${initiative.title}`}
        />
      </div>
      <Link
        href={href}
        className="public-initiative-mini-card__link"
        aria-label={buildAccessibleName(initiative)}
      >
        <div className="public-initiative-mini-card__media" aria-hidden="true">
          <MiniCardImage title={initiative.title} imageUrl={initiative.imageUrl} />
        </div>
        <div className="public-initiative-mini-card__body">
          <h3 className="public-initiative-mini-card__title">{initiative.title}</h3>
          <p className="public-initiative-mini-card__summary">{initiative.summary}</p>
          <p className="public-initiative-mini-card__meta">
            {initiative.activityArea} · {initiative.geographyLabel}
          </p>
          <div className="public-initiative-mini-card__footer">
            <span className="public-initiative-mini-card__status">
              {initiative.currentStageLabel ?? initiative.publicStatus}
            </span>
            <span className="public-initiative-mini-card__date">
              Updated {formatDate(initiative.publishedAt)}
            </span>
            {initiative.supportSummary ? (
              <span className="public-initiative-mini-card__support">
                {initiative.supportSummary.likes} likes · {initiative.supportSummary.dislikes}{" "}
                dislikes
              </span>
            ) : null}
          </div>
          <span className="public-initiative-mini-card__cta" aria-hidden="true">
            View Initiative →
          </span>
        </div>
      </Link>
    </article>
  );
}

function MiniCardImage({ title, imageUrl }: { title: string; imageUrl?: string }) {
  if (imageUrl) {
    return <InitiativeImage title={title} imageUrl={imageUrl} decorative />;
  }

  return (
    <img
      src={PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE}
      alt=""
      aria-hidden="true"
      width={320}
      height={180}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE;
      }}
    />
  );
}

export function PublicInitiativeMiniCardPlaceholder({ slotNumber }: { slotNumber: number }) {
  return (
    <article
      className="public-initiative-mini-card public-initiative-mini-card--placeholder"
      aria-label={`Initiative slot awaiting publication ${slotNumber}`}
    >
      <div className="public-initiative-mini-card__media" aria-hidden="true" />
      <div className="public-initiative-mini-card__body">
        <h3 className="public-initiative-mini-card__title">Initiative slot awaiting publication</h3>
        <p className="public-initiative-mini-card__summary">
          A future public initiative will appear here when published.
        </p>
        <p className="public-initiative-mini-card__meta">
          Capacity reserved for upcoming civic work
        </p>
      </div>
    </article>
  );
}
