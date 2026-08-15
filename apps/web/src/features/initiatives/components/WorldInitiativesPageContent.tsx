import Link from "next/link";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { formatStableCalendarDate } from "../initiative-lifecycle-labels";
import { InitiativeImage } from "./InitiativeImage";

import "./world-initiatives-page.css";

interface WorldInitiativesPageContentProps {
  projection: WorldInitiativeCardProjection[];
}

function WorldInitiativeCard({ initiative }: { initiative: WorldInitiativeCardProjection }) {
  return (
    <article className="world-initiative-card">
      <div className="world-initiative-card__media">
        <InitiativeImage
          title={initiative.title}
          imageUrl={initiative.imageUrl}
          coverMedia={initiative.coverMedia}
          className="world-initiative-card__image"
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
            <dt>Start date</dt>
            <dd>{formatStableCalendarDate(initiative.startDate)}</dd>
          </div>
          <div>
            <dt>Completion date</dt>
            <dd>{formatStableCalendarDate(initiative.completionDate)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{initiative.publicStatus}</dd>
          </div>
        </dl>
        <Link className="world-initiative-card__link" href={initiative.publicInitiativeHref}>
          View Initiative →
        </Link>
      </div>
    </article>
  );
}

export function WorldInitiativesPageContent({ projection }: WorldInitiativesPageContentProps) {
  return (
    <section className="world-initiatives-page">
      <header className="world-initiatives-page__header">
        <h1 className="world-initiatives-page__title">World Initiatives</h1>
        <p className="world-initiatives-page__intro">
          Explore the latest world-scope initiatives published through the platform.
        </p>
        <p className="world-initiatives-page__secondary">
          More initiatives and country, regional, or community results can be found through Search.
        </p>
        <Button href="/search" variant="secondary">
          Search All Initiatives →
        </Button>
      </header>

      {projection.length === 0 ? (
        <p className="world-initiatives-page__empty" role="status">
          No world initiatives have been published yet.
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
