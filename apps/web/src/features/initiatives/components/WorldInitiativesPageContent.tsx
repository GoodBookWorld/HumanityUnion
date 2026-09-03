"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import {
  buildPublicInitiativeSharePayload,
  CivicShareButton,
} from "../../civic-share";
import { Button } from "../../../design-system/components/Button";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { resolveInitiativeCardPresentation } from "../../public-initiative-mini-card/resolve-initiative-card-presentation";
import {
  resolveActivityAreaDisplayLabel,
  resolveInitiativeStatusDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import { formatStableCalendarDate } from "../initiative-lifecycle-labels";
import { InitiativeImage } from "./InitiativeImage";

import "./world-initiatives-page.css";

interface WorldInitiativesPageContentProps {
  projection: WorldInitiativeCardProjection[];
}

function WorldInitiativeCard({ initiative }: { initiative: WorldInitiativeCardProjection }) {
  const tMini = useTranslations("publicInitiativeMiniCard");
  const tExperience = useTranslations("initiativeExperience");
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

  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  const activityAreaLabel = resolveActivityAreaDisplayLabel(initiative.activityArea, tExperience);
  const statusLabel = resolveInitiativeStatusDisplayLabel(initiative.publicStatus, tExperience);

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
            optionalText: displaySummary,
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
          <dl className="world-initiative-card__meta">
            <div>
              <dt>{tExperience("hero.activityArea")}</dt>
              <dd>{activityAreaLabel}</dd>
            </div>
            <div>
              <dt>{tExperience("hero.status")}</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>{tExperience("overview.startDate")}</dt>
              <dd>{formatStableCalendarDate(initiative.startDate)}</dd>
            </div>
            <div>
              <dt>{tExperience("overview.completionDate")}</dt>
              <dd>{formatStableCalendarDate(initiative.completionDate)}</dd>
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
