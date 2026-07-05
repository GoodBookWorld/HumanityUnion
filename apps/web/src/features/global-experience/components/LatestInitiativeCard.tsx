import Link from "next/link";

import type { LatestInitiativeCardProjection } from "@hu/types";

interface LatestInitiativeCardProps {
  initiative: LatestInitiativeCardProjection;
}

export function LatestInitiativeCard({ initiative }: LatestInitiativeCardProps) {
  return (
    <article
      className="latest-initiative-card"
      aria-labelledby={`initiative-${initiative.initiativeId}-title`}
    >
      <header className="latest-initiative-card__header">
        <h3
          className="latest-initiative-card__title"
          id={`initiative-${initiative.initiativeId}-title`}
        >
          <Link href={initiative.publicInitiativeHref}>{initiative.title}</Link>
        </h3>
      </header>

      <p className="latest-initiative-card__summary">{initiative.summary}</p>

      <dl className="latest-initiative-card__meta">
        <div className="latest-initiative-card__meta-item">
          <dt>Geographic scope</dt>
          <dd>{initiative.geographicScope}</dd>
        </div>
        <div className="latest-initiative-card__meta-item">
          <dt>Participation stage</dt>
          <dd>{initiative.participationStage}</dd>
        </div>
        <div className="latest-initiative-card__meta-item">
          <dt>Public status</dt>
          <dd>{initiative.publicStatus}</dd>
        </div>
      </dl>

      <p className="latest-initiative-card__primary-link">
        <Link href={initiative.publicInitiativeHref}>
          View public initiative: {initiative.title}
        </Link>
      </p>

      {initiative.relatedPublicLinks.length > 0 ? (
        <nav
          className="latest-initiative-card__related"
          aria-label={`Related public records for ${initiative.title}`}
        >
          <p className="latest-initiative-card__related-label">Related public links</p>
          <ul className="latest-initiative-card__related-list">
            {initiative.relatedPublicLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
