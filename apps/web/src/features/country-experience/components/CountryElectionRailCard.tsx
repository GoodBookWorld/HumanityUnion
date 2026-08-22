"use client";

import Link from "next/link";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE } from "../../public-initiative-mini-card/PublicInitiativeMiniCard";

interface CountryElectionRailCardProps {
  initiative: WorldInitiativeCardProjection;
}

/**
 * Pack 09F2 — Public Choice election preview for Country discovery rails.
 * Reuses Initiative mini-card layout with election presentation fields.
 */
export function CountryElectionRailCard({ initiative }: CountryElectionRailCardProps) {
  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  const blocked = initiative.administrativelyBlocked === true;
  const statusLabel =
    initiative.electionVotingStatusLabel ??
    initiative.currentStageLabel ??
    initiative.publicStatus;

  return (
    <Link
      href={href}
      className="country-initiative-rail-card country-election-rail-card"
      aria-label={`Open election: ${initiative.title}`}
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
        <p className="country-initiative-rail-card__meta">{initiative.geographyLabel}</p>
        <div className="country-initiative-rail-card__footer">
          <span className="country-initiative-rail-card__status">{statusLabel}</span>
          {typeof initiative.candidateCount === "number" ? (
            <span>
              {initiative.candidateCount} candidate
              {initiative.candidateCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {blocked ? <span role="status">Unavailable — administratively blocked</span> : null}
        </div>
        <span className="country-initiative-rail-card__cta" aria-hidden="true">
          {blocked ? "View details →" : "View Election →"}
        </span>
      </div>
    </Link>
  );
}
