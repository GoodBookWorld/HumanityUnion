"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import {
  buildPublicInitiativeSharePayload,
  CivicShareButton,
} from "../civic-share";
import { InitiativeImage } from "../initiatives/components/InitiativeImage";
import { usePublicContentReadingContext } from "../language/use-public-content-reading-context";
import {
  formatInitiativeExperienceDate,
  resolveActivityAreaDisplayLabel,
  resolveInitiativeStatusDisplayLabel,
  resolveLifecycleStageDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n";

import { resolveInitiativeCardPresentation } from "./resolve-initiative-card-presentation";

import "./public-initiative-mini-card.css";

export const PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE =
  "/images/initiatives/initiative-default.webp";

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
  const t = useTranslations("publicInitiativeMiniCard");
  const tExperience = useTranslations("initiativeExperience");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const [displayTitle, setDisplayTitle] = useState(initiative.title);
  const [displaySummary, setDisplaySummary] = useState(initiative.summary);

  useEffect(() => {
    setDisplayTitle(initiative.title);
    setDisplaySummary(initiative.summary);

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
      if (cancelled) {
        return;
      }
      setDisplayTitle(presentation.title);
      setDisplaySummary(presentation.summary);
    });

    return () => {
      cancelled = true;
    };
  }, [
    initiative.initiativeId,
    initiative.summary,
    initiative.title,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  const href = resolvePublicInitiativeHref(initiative);
  const activityAreaLabel = resolveActivityAreaDisplayLabel(initiative.activityArea, tExperience);
  const stageLabel = initiative.currentStageLabel
    ? resolveLifecycleStageDisplayLabel(
        initiative.currentStageLabel,
        tExperience,
        initiative.currentStageLabel,
      )
    : resolveInitiativeStatusDisplayLabel(initiative.publicStatus, tExperience);
  const updatedDate = formatInitiativeExperienceDate(locale, initiative.publishedAt, {
    month: "short",
  });

  return (
    <article className="public-initiative-mini-card">
      <div className="public-initiative-mini-card__share">
        <CivicShareButton
          compact
          stopPropagation
          payload={buildPublicInitiativeSharePayload({
            initiativeId: initiative.initiativeId,
            title: displayTitle,
            image: initiative.imageUrl,
            optionalText: displaySummary,
          })}
          ariaLabel={t("shareAria", { title: displayTitle })}
        />
      </div>
      <Link
        href={href}
        className="public-initiative-mini-card__link"
        aria-label={t("viewAria", { title: displayTitle })}
      >
        <div className="public-initiative-mini-card__media" aria-hidden="true">
          <MiniCardImage title={displayTitle} imageUrl={initiative.imageUrl} />
        </div>
        <div className="public-initiative-mini-card__body">
          <h3 className="public-initiative-mini-card__title">{displayTitle}</h3>
          <p className="public-initiative-mini-card__summary">{displaySummary}</p>
          <p className="public-initiative-mini-card__meta">
            {activityAreaLabel} · {initiative.geographyLabel}
          </p>
          <div className="public-initiative-mini-card__footer">
            <span className="public-initiative-mini-card__status">{stageLabel}</span>
            <span className="public-initiative-mini-card__date">
              {t("updated", { date: updatedDate })}
            </span>
            {initiative.supportSummary ? (
              <span className="public-initiative-mini-card__support">
                {t("likesDislikes", {
                  likes: initiative.supportSummary.likes,
                  dislikes: initiative.supportSummary.dislikes,
                })}
              </span>
            ) : null}
          </div>
          <span className="public-initiative-mini-card__cta" aria-hidden="true">
            {t("viewInitiative")}
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
  const t = useTranslations("publicInitiativeMiniCard");

  return (
    <article
      className="public-initiative-mini-card public-initiative-mini-card--placeholder"
      aria-label={t("placeholder.ariaLabel", { slotNumber })}
    >
      <div className="public-initiative-mini-card__media" aria-hidden="true" />
      <div className="public-initiative-mini-card__body">
        <h3 className="public-initiative-mini-card__title">{t("placeholder.title")}</h3>
        <p className="public-initiative-mini-card__summary">{t("placeholder.summary")}</p>
        <p className="public-initiative-mini-card__meta">{t("placeholder.meta")}</p>
      </div>
    </article>
  );
}
