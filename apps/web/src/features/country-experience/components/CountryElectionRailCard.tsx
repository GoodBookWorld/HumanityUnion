"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE } from "../../public-initiative-mini-card/PublicInitiativeMiniCard";
import { resolveInitiativeCardBadgeLabel } from "../../public-initiative-mini-card/resolve-initiative-card-semantic-labels";

interface CountryElectionRailCardProps {
  initiative: WorldInitiativeCardProjection;
}

/**
 * Pack 09F2 / 08I.6 — Public Choice election preview for Country discovery rails.
 */
export function CountryElectionRailCard({ initiative }: CountryElectionRailCardProps) {
  const t = useTranslations("publicGeo.shared");
  const tExperience = useTranslations("initiativeExperience");
  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  const blocked = initiative.administrativelyBlocked === true;
  const statusLabel =
    initiative.electionVotingStatusLabel ||
    resolveInitiativeCardBadgeLabel({
      publicStatus: initiative.publicStatus,
      currentStageLabel: initiative.currentStageLabel,
      messagesOrT: tExperience,
    });

  return (
    <Link
      href={href}
      className="country-initiative-rail-card country-election-rail-card"
      aria-label={t("openElectionAria", { title: initiative.title })}
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
            <span>{t("candidatesCount", { count: initiative.candidateCount })}</span>
          ) : null}
          {blocked ? <span role="status">{t("blockedUnavailable")}</span> : null}
        </div>
        <span className="country-initiative-rail-card__cta" aria-hidden="true">
          {blocked ? t("viewDetails") : t("viewElection")}
        </span>
      </div>
    </Link>
  );
}
