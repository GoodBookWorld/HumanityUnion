"use client";

import Link from "next/link";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE } from "../../public-initiative-mini-card/PublicInitiativeMiniCard";

interface CountryInitiativeRailCardProps {
  initiative: WorldInitiativeCardProjection;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CountryInitiativeRailCard({ initiative }: CountryInitiativeRailCardProps) {
  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;

  return (
    <Link
      href={href}
      className="country-initiative-rail-card"
      aria-label={`Open initiative: ${initiative.title}`}
    >
      <div className="country-initiative-rail-card__media">
        {initiative.imageUrl || initiative.coverMedia ? (
          <InitiativeImage
            title={initiative.title}
            imageUrl={initiative.imageUrl}
            coverMedia={initiative.coverMedia}
          />
        ) : (
          <img
            src={PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE}
            alt=""
            aria-hidden="true"
            width={320}
            height={180}
            loading="lazy"
          />
        )}
      </div>
      <div className="country-initiative-rail-card__body">
        <h3 className="country-initiative-rail-card__title">{initiative.title}</h3>
        {initiative.summary ? (
          <p className="country-initiative-rail-card__summary">{initiative.summary}</p>
        ) : null}
        <p className="country-initiative-rail-card__meta">
          {initiative.activityArea} · {initiative.geographyLabel}
        </p>
        <div className="country-initiative-rail-card__footer">
          <span className="country-initiative-rail-card__status">
            {initiative.currentStageLabel ?? initiative.publicStatus}
          </span>
          <span>Updated {formatDate(initiative.publishedAt)}</span>
          {initiative.supportSummary ? (
            <span>
              {initiative.supportSummary.likes} participant
              {initiative.supportSummary.likes === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <span className="country-initiative-rail-card__cta" aria-hidden="true">
          View Initiative →
        </span>
      </div>
    </Link>
  );
}
