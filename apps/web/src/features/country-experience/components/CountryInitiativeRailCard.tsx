"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import {
  formatInitiativeExperienceDate,
  resolveActivityAreaDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import {
  PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE,
} from "../../public-initiative-mini-card/PublicInitiativeMiniCard";
import { resolveInitiativeCardPresentation } from "../../public-initiative-mini-card/resolve-initiative-card-presentation";
import { resolveInitiativeCardBadgeLabel } from "../../public-initiative-mini-card/resolve-initiative-card-semantic-labels";

interface CountryInitiativeRailCardProps {
  initiative: WorldInitiativeCardProjection;
}

export function CountryInitiativeRailCard({ initiative }: CountryInitiativeRailCardProps) {
  const t = useTranslations("publicGeo.shared");
  const tExperience = useTranslations("initiativeExperience");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const [displayTitle, setDisplayTitle] = useState(initiative.title);
  const [displaySummary, setDisplaySummary] = useState(initiative.summary);

  useEffect(() => {
    setDisplayTitle(initiative.title);
    setDisplaySummary(initiative.summary);
  }, [initiative.initiativeId, initiative.title, initiative.summary]);

  useEffect(() => {
    if (!readingContext.ready) {
      return;
    }
    let cancelled = false;
    void resolveInitiativeCardPresentation({
      initiativeId: initiative.initiativeId,
      canonical: {
        title: initiative.title,
        summary: initiative.summary,
      },
      readingContext,
    }).then((presentation) => {
      if (!cancelled) {
        setDisplayTitle(presentation.title);
        setDisplaySummary(presentation.summary);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    initiative.initiativeId,
    initiative.title,
    initiative.summary,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  const updatedDate = formatInitiativeExperienceDate(locale, initiative.publishedAt, {
    month: "short",
  });
  const activityAreaLabel = resolveActivityAreaDisplayLabel(initiative.activityArea, tExperience);
  const statusLabel = resolveInitiativeCardBadgeLabel({
    publicStatus: initiative.publicStatus,
    currentStageLabel: initiative.currentStageLabel,
    messagesOrT: tExperience,
  });

  return (
    <Link
      href={href}
      className="country-initiative-rail-card"
      aria-label={t("openInitiativeAria", { title: displayTitle })}
    >
      <div className="country-initiative-rail-card__media">
        {initiative.imageUrl || initiative.coverMedia ? (
          <InitiativeImage
            title={displayTitle}
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
        <h3 className="country-initiative-rail-card__title">{displayTitle}</h3>
        {displaySummary ? (
          <p className="country-initiative-rail-card__summary">{displaySummary}</p>
        ) : null}
        {statusLabel ? (
          <div className="country-initiative-rail-card__badge-row">
            <WorkspaceStatusBadge
              status={initiative.publicStatus || "neutral"}
              variant="neutral"
              label={statusLabel}
            />
          </div>
        ) : null}
        <p className="country-initiative-rail-card__meta">
          {activityAreaLabel} · {initiative.geographyLabel}
        </p>
        <div className="country-initiative-rail-card__footer">
          <span>{t("updated", { date: updatedDate })}</span>
          {initiative.supportSummary ? (
            <span>{t("participantsCount", { count: initiative.supportSummary.likes })}</span>
          ) : null}
        </div>
        <span className="country-initiative-rail-card__cta" aria-hidden="true">
          {t("viewInitiative")}
        </span>
      </div>
    </Link>
  );
}
