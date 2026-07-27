"use client";

import Link from "next/link";

import { Button } from "../../../design-system";
import { WPC_ACCORDION_SECTIONS } from "../constants";
import { WPC_INSTITUTION } from "../content";
import { InstitutionIllustration } from "./InstitutionIllustration";

export function WpcFeaturedCard() {
  if (!WPC_INSTITUTION) {
    return null;
  }

  return (
    <section
      className="institutions-wpc-featured institutions-section institutions-section--white"
      aria-labelledby="institutions-wpc-title"
      id="institution-wpc"
    >
      <div className="institutions-section__inner">
        <div className="institutions-wpc-featured__layout">
          <div className="institutions-wpc-featured__media">
            <InstitutionIllustration
              illustrationId={WPC_INSTITUTION.illustrationId}
              title={WPC_INSTITUTION.name}
              variant="hero"
              decorative
            />
          </div>

          <div className="institutions-wpc-featured__body institutions-wpc-featured__intro">
            <span className="institutions-status-badge institutions-status-badge--future-institution">
              {WPC_INSTITUTION.status}
            </span>

            <h2 id="institutions-wpc-title">{WPC_INSTITUTION.name}</h2>

            <p className="institutions-wpc-featured__description">{WPC_INSTITUTION.purpose}</p>
          </div>
        </div>

        <div
          className="institutions-wpc-accordion"
          role="region"
          aria-label="World Protection Corps operational domains"
        >
          {WPC_ACCORDION_SECTIONS.map((section) => (
            <details key={section.id} className="institutions-wpc-accordion__item">
              <summary className="institutions-wpc-accordion__summary">{section.title}</summary>
              <div className="institutions-wpc-accordion__body">
                <p>{section.body}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="institutions-wpc-featured__details">
          <p className="institutions-wpc-featured__role">{WPC_INSTITUTION.role}</p>

          <div className="institutions-card__actions">
            <Button href={WPC_INSTITUTION.learnMoreHref} variant="secondary">
              Learn More
            </Button>
          </div>

          {WPC_INSTITUTION.nonNominationNote ? (
            <p className="institutions-card__nomination-note" role="note">
              {WPC_INSTITUTION.nonNominationNote}
            </p>
          ) : null}

          <div className="institutions-card__knowledge">
            <p className="institutions-card__knowledge-label">Related Knowledge</p>
            <Link
              href={`/knowledge/${WPC_INSTITUTION.knowledgeSlug}`}
              className="institutions-card__knowledge-link"
            >
              {WPC_INSTITUTION.knowledgeTitle} → Read
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
