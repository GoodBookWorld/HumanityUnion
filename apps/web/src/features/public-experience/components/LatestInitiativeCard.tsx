"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { LatestInitiativeCardProjection } from "@hu/types";

import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { useInitiativeCardTitlePresentation } from "../../public-initiative-experience/use-initiative-public-presentation";
import {
  resolveInitiativeCardBadgeLabel,
  resolveInitiativeCardStageLabel,
} from "../../public-initiative-mini-card/resolve-initiative-card-semantic-labels";

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
  const tExperience = useTranslations("initiativeExperience");
  const hasActivePublicRoute = isActivePublicRoute(initiative);
  const displayTitle = useInitiativeCardTitlePresentation({
    initiativeId: initiative.initiativeId,
    canonicalTitle: initiative.title,
    canonicalSummary: initiative.summary,
  });

  const statusLabel = resolveInitiativeCardBadgeLabel({
    publicStatus: initiative.publicStatus,
    messagesOrT: tExperience,
  });
  const stageLabel =
    resolveInitiativeCardStageLabel(initiative.participationStage, tExperience) ||
    initiative.participationStage;

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
            <Link href={initiative.publicInitiativeHref}>{displayTitle}</Link>
          ) : (
            displayTitle
          )}
        </h3>
      </header>

      {statusLabel ? (
        <div className="latest-initiative-card__badge-row">
          <WorkspaceStatusBadge
            status={initiative.publicStatus || "neutral"}
            variant="neutral"
            label={statusLabel}
          />
        </div>
      ) : null}

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
          <dd>{stageLabel}</dd>
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
            {t("initiativeCard.viewPublicInitiative", { title: displayTitle })}
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
          aria-label={t("initiativeCard.relatedAria", { title: displayTitle })}
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
