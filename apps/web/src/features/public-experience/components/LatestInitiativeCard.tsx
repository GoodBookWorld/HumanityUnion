"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { LatestInitiativeCardProjection } from "@hu/types";

interface LatestInitiativeCardProps {
  initiative: LatestInitiativeCardProjection;
}

function isActivePublicRoute(
  initiative: LatestInitiativeCardProjection,
): initiative is LatestInitiativeCardProjection & {
  publicInitiativeHref: string;
} {
  return (
    initiative.publicRouteStatus === "active" &&
    typeof initiative.publicInitiativeHref === "string" &&
    initiative.publicInitiativeHref.length > 0
  );
}

export function LatestInitiativeCard({ initiative }: LatestInitiativeCardProps) {
  const t = useTranslations("publicGeo.shared");
  const hasActivePublicRoute = isActivePublicRoute(initiative);

  return (
    <article
      className={`latest-initiative-card${
        hasActivePublicRoute ? "" : " latest-initiative-card--unavailable"
      }`}
      aria-labelledby={`initiative-${initiative.initiativeId}-title`}
    >
      <header className="latest-initiative-card__header">
        <h3
          className="latest-initiative-card__title"
          id={`initiative-${initiative.initiativeId}-title`}
        >
          {hasActivePublicRoute ? (
            <Link href={initiative.publicInitiativeHref}>{initiative.title}</Link>
          ) : (
            initiative.title
          )}
        </h3>
      </header>

      <p className="latest-initiative-card__summary">{initiative.summary}</p>

      {!hasActivePublicRoute ? (
        <p className="latest-initiative-card__unavailable" role="note">
          {initiative.publicUnavailableNotice ?? t("initiativeCard.unavailableNotice")}
        </p>
      ) : null}

      <dl className="latest-initiative-card__meta">
        <div className="latest-initiative-card__meta-item">
          <dt>{t("initiativeCard.geographicScope")}</dt>
          <dd>{initiative.geographicScope}</dd>
        </div>
        <div className="latest-initiative-card__meta-item">
          <dt>{t("initiativeCard.participationStage")}</dt>
          <dd>{initiative.participationStage}</dd>
        </div>
        <div className="latest-initiative-card__meta-item">
          <dt>{t("initiativeCard.publicStatus")}</dt>
          <dd>{initiative.publicStatus}</dd>
        </div>
        {!hasActivePublicRoute ? (
          <div className="latest-initiative-card__meta-item">
            <dt>{t("initiativeCard.publicRecord")}</dt>
            <dd>{t("initiativeCard.notYetAvailable")}</dd>
          </div>
        ) : null}
      </dl>

      {hasActivePublicRoute ? (
        <p className="latest-initiative-card__primary-link">
          <Link href={initiative.publicInitiativeHref}>
            {t("initiativeCard.viewPublicInitiative", { title: initiative.title })}
          </Link>
        </p>
      ) : (
        <p className="latest-initiative-card__primary-link latest-initiative-card__primary-link--placeholder">
          <span aria-disabled="true">{t("initiativeCard.viewPublicInitiativeComingSoon")}</span>
        </p>
      )}

      {initiative.relatedPublicLinks.length > 0 ? (
        <nav
          className="latest-initiative-card__related"
          aria-label={t("initiativeCard.relatedAria", { title: initiative.title })}
        >
          <p className="latest-initiative-card__related-label">
            {t("initiativeCard.relatedLabel")}
          </p>
          <ul className="latest-initiative-card__related-list">
            {initiative.relatedPublicLinks.map((link) => (
              <li key={link.href}>
                {link.routeStatus === "active" ? (
                  <Link href={link.href}>{link.label}</Link>
                ) : (
                  <span
                    className="latest-initiative-card__related-placeholder"
                    aria-disabled="true"
                    title={t("comingSoonTitle", { label: link.label })}
                  >
                    {link.label}
                    <span className="latest-initiative-card__related-note">
                      {" "}
                      {t("comingSoon")}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
