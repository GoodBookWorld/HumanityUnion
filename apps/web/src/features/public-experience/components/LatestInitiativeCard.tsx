import Link from "next/link";

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
          {initiative.publicUnavailableNotice ??
            "Public initiative record not yet available — demonstration card only."}
        </p>
      ) : null}

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
        {!hasActivePublicRoute ? (
          <div className="latest-initiative-card__meta-item">
            <dt>Public record</dt>
            <dd>Not yet available</dd>
          </div>
        ) : null}
      </dl>

      {hasActivePublicRoute ? (
        <p className="latest-initiative-card__primary-link">
          <Link href={initiative.publicInitiativeHref}>
            View public initiative: {initiative.title}
          </Link>
        </p>
      ) : (
        <p className="latest-initiative-card__primary-link latest-initiative-card__primary-link--placeholder">
          <span aria-disabled="true">View public initiative (coming soon)</span>
        </p>
      )}

      {initiative.relatedPublicLinks.length > 0 ? (
        <nav
          className="latest-initiative-card__related"
          aria-label={`Related public records for ${initiative.title}`}
        >
          <p className="latest-initiative-card__related-label">Related public links</p>
          <ul className="latest-initiative-card__related-list">
            {initiative.relatedPublicLinks.map((link) => (
              <li key={link.href}>
                {link.routeStatus === "active" ? (
                  <Link href={link.href}>{link.label}</Link>
                ) : (
                  <span
                    className="latest-initiative-card__related-placeholder"
                    aria-disabled="true"
                    title={`${link.label} — coming soon`}
                  >
                    {link.label}
                    <span className="latest-initiative-card__related-note"> (coming soon)</span>
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
