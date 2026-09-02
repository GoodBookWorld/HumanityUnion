"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import {
  buildPublicInitiativeSharePayload,
  CivicShareButton,
} from "../../civic-share";
import { Button } from "../../../design-system/components/Button";
import { formatStableCalendarDate } from "../initiative-lifecycle-labels";
import { InitiativeImage } from "./InitiativeImage";

import "./world-initiatives-page.css";

interface WorldInitiativesPageContentProps {
  projection: WorldInitiativeCardProjection[];
}

function WorldInitiativeCard({ initiative }: { initiative: WorldInitiativeCardProjection }) {
  const href =
    initiative.publicInitiativeHref ||
    `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;

  return (
    <article className="world-initiative-card">
      <div className="world-initiative-card__share">
        <CivicShareButton
          compact
          stopPropagation
          payload={buildPublicInitiativeSharePayload({
            initiativeId: initiative.initiativeId,
            title: initiative.title,
            image: initiative.imageUrl,
            optionalText: initiative.summary,
          })}
          ariaLabel={`Share initiative: ${initiative.title}`}
        />
      </div>
      <Link
        href={href}
        className="world-initiative-card__link"
        aria-label={`View initiative: ${initiative.title}`}
      >
        <div className="world-initiative-card__media" aria-hidden="true">
          <InitiativeImage
            title={initiative.title}
            imageUrl={initiative.imageUrl}
            coverMedia={initiative.coverMedia}
            className="world-initiative-card__image"
            decorative
          />
        </div>
        <div className="world-initiative-card__body">
          <h2 className="world-initiative-card__title">{initiative.title}</h2>
          <dl className="world-initiative-card__meta">
            <div>
              <dt>Activity Area</dt>
              <dd>{initiative.activityArea}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{initiative.publicStatus}</dd>
            </div>
            <div>
              <dt>Start</dt>
              <dd>{formatStableCalendarDate(initiative.startDate)}</dd>
            </div>
            <div>
              <dt>Completion</dt>
              <dd>{formatStableCalendarDate(initiative.completionDate)}</dd>
            </div>
          </dl>
          <span className="world-initiative-card__cta" aria-hidden="true">
            View Initiative →
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
