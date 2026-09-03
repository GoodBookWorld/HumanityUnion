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
} from "../public-initiative-experience/initiative-experience-i18n";
import { WorkspaceStatusBadge } from "../initiative-workspace-ux/components/WorkspaceStatusBadge";

import { resolveInitiativeCardPresentation } from "./resolve-initiative-card-presentation";
import { resolveInitiativeCardBadgeLabel } from "./resolve-initiative-card-semantic-labels";

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
 * Pack 08I.11 — status badge via shared semantic labels (never stages.Proposal).
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

  useEffect(() => {
    setDisplayTitle(initiative.title);
  }, [initiative.initiativeId, initiative.title]);

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
      if (cancelled) {
        return;
      }
      setDisplayTitle(presentation.title);
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
  const statusLabel = resolveInitiativeCardBadgeLabel({
    publicStatus: initiative.publicStatus,
    currentStageLabel: initiative.currentStageLabel,
    messagesOrT: tExperience,
  });
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
          {statusLabel ? (
            <div className="public-initiative-mini-card__badge-row">
              <WorkspaceStatusBadge
                status={initiative.publicStatus || "neutral"}
                variant="neutral"
                label={statusLabel}
              />
            </div>
          ) : null}
          <dl className="public-initiative-mini-card__meta">
            <div className="public-initiative-mini-card__meta-field">
              <dt className="public-initiative-mini-card__meta-label">
                {tExperience("hero.activityArea")}
              </dt>
              <dd className="public-initiative-mini-card__meta-value">{activityAreaLabel}</dd>
            </div>
            {initiative.geographyLabel ? (
              <div className="public-initiative-mini-card__meta-field">
                <dt className="public-initiative-mini-card__meta-label">
                  {tExperience("hero.geography")}
                </dt>
                <dd className="public-initiative-mini-card__meta-value">
                  {initiative.geographyLabel}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="public-initiative-mini-card__footer">
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
        <p className="public-initiative-mini-card__meta">{t("placeholder.meta")}</p>
      </div>
    </article>
  );
}
