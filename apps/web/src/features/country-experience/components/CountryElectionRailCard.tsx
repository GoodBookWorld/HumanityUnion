"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { INITIATIVE_PLP_ENTITY_TYPE, type WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE } from "../../public-initiative-mini-card/PublicInitiativeMiniCard";
import { resolveInitiativeCardBadgeLabel } from "../../public-initiative-mini-card/resolve-initiative-card-semantic-labels";
import {
  MediaSemanticNode,
  type MediaSemanticResult,
} from "../../language/media-plp/media-semantic-contract";
import { resolvePublicChoiceElectionVotingStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { resolveCountryInitiativeRailMeta } from "../resolve-country-initiative-rail-meta";

interface CountryElectionRailCardProps {
  initiative: WorldInitiativeCardProjection;
  plpPresentation?: {
    readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
    readonly presentation: { readonly title?: unknown; readonly summary?: unknown };
    readonly reasonCode?: string;
  };
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Pack 09F2 / 08I.6 / RESET 05 — Public Choice election preview for Country rails.
 * Same Initiative PLP adapter as civic Initiative cards (no separate translation root).
 */
export function CountryElectionRailCard({
  initiative,
  plpPresentation,
}: CountryElectionRailCardProps) {
  const t = useTranslations("publicGeo.shared");
  const tExperience = useTranslations("initiativeExperience");
  const locale = useLocale();

  const titleLocalized =
    plpPresentation?.mode === "PUBLISHED_LOCALIZED"
      ? readString(plpPresentation.presentation.title, initiative.title)
      : initiative.title;
  const titleResult: MediaSemanticResult =
    plpPresentation?.mode === "PUBLISHED_LOCALIZED"
      ? "PUBLISHED_LOCALIZED"
      : "CANONICAL_FALLBACK";
  const titleFallbackReason =
    titleResult === "CANONICAL_FALLBACK"
      ? plpPresentation?.reasonCode ?? "NO_PUBLISHED_SNAPSHOT"
      : undefined;

  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  const blocked = initiative.administrativelyBlocked === true;
  const statusLabel = initiative.electionVotingStatus
    ? resolvePublicChoiceElectionVotingStatusDisplayLabel(
        initiative.electionVotingStatus,
        tExperience,
      )
    : resolveInitiativeCardBadgeLabel({
        publicStatus: initiative.publicStatus,
        currentStageLabel: initiative.currentStageLabel,
        messagesOrT: tExperience,
      });
  const meta = resolveCountryInitiativeRailMeta({
    initiative,
    locale,
    tExperience,
  });

  return (
    <Link
      href={href}
      className="country-initiative-rail-card country-election-rail-card"
      aria-label={t("openElectionAria", { title: titleLocalized })}
      data-hu-localization-domain="initiative"
      data-hu-plp-entity-type={INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE}
      data-hu-plp-entity-id={initiative.initiativeId}
      data-hu-plp-adapter="initiative_lifecycle"
      data-hu-lifecycle-profile="public_choice"
    >
      <div className="country-initiative-rail-card__media">
        {initiative.imageUrl || initiative.coverMedia ? (
          <InitiativeImage
            title={titleLocalized}
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
        <MediaSemanticNode
          as="h3"
          className="country-initiative-rail-card__title"
          owner="PLP_ENTITY"
          result={titleResult}
          entityType={INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE}
          entityId={initiative.initiativeId}
          semanticPath="title"
          fallbackReason={titleFallbackReason}
        >
          {titleLocalized}
        </MediaSemanticNode>
        <p className="country-initiative-rail-card__meta">
          <MediaSemanticNode
            as="span"
            owner={meta.geographyOwner}
            result={meta.geographyResult}
            entityType={INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE}
            entityId={initiative.initiativeId}
            semanticPath="geographyLabel"
          >
            {meta.geographyLabel}
          </MediaSemanticNode>
        </p>
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
