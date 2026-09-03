"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { PUBLIC_INITIATIVE_MINI_CARD_FALLBACK_IMAGE } from "../../public-initiative-mini-card/PublicInitiativeMiniCard";

interface CountryInitiativeRailCardProps {
  initiative: WorldInitiativeCardProjection;
}

export function CountryInitiativeRailCard({ initiative }: CountryInitiativeRailCardProps) {
  const t = useTranslations("publicGeo.shared");
  const locale = useLocale();
  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  const updatedDate = new Date(initiative.publishedAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={href}
      className="country-initiative-rail-card"
      aria-label={t("openInitiativeAria", { title: initiative.title })}
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
