"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import {
  buildPublicInitiativeSharePayload,
  CivicShareButton,
} from "../../civic-share";
import { Button } from "../../../design-system/components/Button";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { useInitiativeCardTitlePresentation } from "../../public-initiative-experience/use-initiative-public-presentation";
import { resolveInitiativeCardBadgeLabel } from "../../public-initiative-mini-card/resolve-initiative-card-semantic-labels";
import {
  formatInitiativeExperienceDate,
  resolveActivityAreaDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import { InitiativeImage } from "./InitiativeImage";

import "./world-initiatives-page.css";

interface WorldInitiativesPageContentProps {
  projection: WorldInitiativeCardProjection[];
}

function WorldInitiativeCard({ initiative }: { initiative: WorldInitiativeCardProjection }) {
  const tMini = useTranslations("publicInitiativeMiniCard");
  const tExperience = useTranslations("initiativeExperience");
  const locale = useLocale();
  const displayTitle = useInitiativeCardTitlePresentation({
    initiativeId: initiative.initiativeId,
    canonicalTitle: initiative.title,
    canonicalSummary: initiative.summary,
  });

  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  const activityAreaLabel = resolveActivityAreaDisplayLabel(initiative.activityArea, tExperience);
  const statusLabel = resolveInitiativeCardBadgeLabel({
    publicStatus: initiative.publicStatus,
    currentStageLabel: initiative.currentStageLabel,
    messagesOrT: tExperience,
  });

  return (
    <article className="world-initiative-card">
      <div className="world-initiative-card__share">
        <CivicShareButton
          compact
          stopPropagation
          payload={buildPublicInitiativeSharePayload({
            initiativeId: initiative.initiativeId,
            title: displayTitle,
            image: initiative.imageUrl,
          })}
          ariaLabel={tMini("shareAria", { title: displayTitle })}
        />
      </div>
      <Link
        href={href}
        className="world-initiative-card__link"
        aria-label={tMini("viewAria", { title: displayTitle })}
      >
        <div className="world-initiative-card__media" aria-hidden="true">
          <InitiativeImage
            title={displayTitle}
            imageUrl={initiative.imageUrl}
            coverMedia={initiative.coverMedia}
            className="world-initiative-card__image"
            decorative
          />
        </div>
        <div className="world-initiative-card__body">
          <h2 className="world-initiative-card__title">{displayTitle}</h2>
          {statusLabel ? (
            <div className="world-initiative-card__badge-row">
              <WorkspaceStatusBadge
                status={initiative.publicStatus || "neutral"}
                variant="neutral"
                label={statusLabel}
              />
            </div>
          ) : null}
          <dl className="world-initiative-card__meta">
            <div>
              <dt className="world-initiative-card__meta-label">
                {tExperience("hero.activityArea")}
              </dt>
              <dd className="world-initiative-card__meta-value">{activityAreaLabel}</dd>
            </div>
            <div>
              <dt className="world-initiative-card__meta-label">
                {tExperience("overview.startDate")}
              </dt>
              <dd className="world-initiative-card__meta-value">
                {initiative.startDate
                  ? formatInitiativeExperienceDate(locale, initiative.startDate, {
                      month: "short",
                    })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="world-initiative-card__meta-label">
                {tExperience("overview.completionDate")}
              </dt>
              <dd className="world-initiative-card__meta-value">
                {initiative.completionDate
                  ? formatInitiativeExperienceDate(locale, initiative.completionDate, {
                      month: "short",
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
          <span className="world-initiative-card__cta" aria-hidden="true">
            {tMini("viewInitiative")}
          </span>
        </div>
      </Link>
    </article>
  );
}

export function WorldInitiativesPageContent({ projection }: WorldInitiativesPageContentProps) {
  const t = useTranslations("worldInitiativesPublic");

  return (
    <section className="world-initiatives-page">
      <header className="world-initiatives-page__header">
        <h1 className="world-initiatives-page__title">{t("pageTitle")}</h1>
        <p className="world-initiatives-page__intro">{t("pageIntro")}</p>
        <p className="world-initiatives-page__secondary">{t("pageSecondary")}</p>
        <Button href="/search" variant="secondary">
          {t("searchCta")}
        </Button>
      </header>

      {projection.length === 0 ? (
        <p className="world-initiatives-page__empty" role="status">
          {t("empty")}
        </p>
      ) : (
        <ul className="world-initiatives-page__grid">
          {projection.map((initiative) => (
            <li key={initiative.initiativeId}>
              <WorldInitiativeCard initiative={initiative} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
