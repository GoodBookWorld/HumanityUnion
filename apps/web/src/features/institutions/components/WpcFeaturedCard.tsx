"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";
import { WPC_ACCORDION_SECTIONS } from "../constants";
import { WPC_INSTITUTION } from "../content";
import { InstitutionIllustration } from "./InstitutionIllustration";

export function WpcFeaturedCard() {
  const t = useTranslations("institutionsPublic");

  if (!WPC_INSTITUTION) {
    return null;
  }

  const recordId = WPC_INSTITUTION.id;
  const name = t(`records.${recordId}.name`);
  const purpose = t(`records.${recordId}.purpose`);
  const role = t(`records.${recordId}.role`);
  const knowledgeTitle = t(`records.${recordId}.knowledgeTitle`);
  const noteKey = `records.${recordId}.nonNominationNote`;
  const nonNominationNote = t.has(noteKey) ? t(noteKey) : null;

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
              title={name}
              variant="hero"
              decorative
            />
          </div>

          <div className="institutions-wpc-featured__body institutions-wpc-featured__intro">
            <span className="institutions-status-badge institutions-status-badge--future-institution">
              {t("status.futureInstitution")}
            </span>

            <h2 id="institutions-wpc-title">{name}</h2>

            <p className="institutions-wpc-featured__description">{purpose}</p>
          </div>
        </div>

        <div
          className="institutions-wpc-accordion"
          role="region"
          aria-label={t("wpc.accordionAria")}
        >
          {WPC_ACCORDION_SECTIONS.map((section) => (
            <details key={section.id} className="institutions-wpc-accordion__item">
              <summary className="institutions-wpc-accordion__summary">
                {t(`wpc.sections.${section.id}.title`)}
              </summary>
              <div className="institutions-wpc-accordion__body">
                <p>{t(`wpc.sections.${section.id}.body`)}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="institutions-wpc-featured__details">
          <p className="institutions-wpc-featured__role">{role}</p>

          <div className="institutions-card__actions">
            <Button href={WPC_INSTITUTION.learnMoreHref} variant="secondary">
              {t("card.learnMore")}
            </Button>
          </div>

          {nonNominationNote ? (
            <p className="institutions-card__nomination-note" role="note">
              {nonNominationNote}
            </p>
          ) : null}

          <div className="institutions-card__knowledge">
            <p className="institutions-card__knowledge-label">{t("card.relatedKnowledge")}</p>
            <Link
              href={`/knowledge/${WPC_INSTITUTION.knowledgeSlug}`}
              className="institutions-card__knowledge-link"
            >
              {t("card.readKnowledge", { title: knowledgeTitle })}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
