"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Card } from "../../../design-system";
import { AllNominationsModal } from "../../civic-nomination/components/AllNominationsModal";
import { CreateNominationButton } from "../../civic-nomination/components/CreateNominationButton";
import { CREATE_INITIATIVE_PLACEHOLDER } from "../constants";
import type { InstitutionRecord, InstitutionStatusBadge } from "../content";
import { isNominatableInstitution } from "../content";
import { InstitutionIllustration } from "./InstitutionIllustration";

interface InstitutionCardProps {
  institution: InstitutionRecord;
  layout?: "standard" | "featured";
}

function statusMessageKey(status: InstitutionStatusBadge): string {
  switch (status) {
    case "Concept":
      return "status.concept";
    case "Future Institution":
      return "status.futureInstitution";
    case "Under Development":
      return "status.underDevelopment";
  }
}

function getShortDescription(purpose: string): string {
  const sentence = purpose.match(/^[^.!?]+[.!?]/)?.[0];
  return sentence?.trim() ?? purpose;
}

function InstitutionStatusBadge({ institution }: { institution: InstitutionRecord }) {
  const t = useTranslations("institutionsPublic");

  return (
    <span
      className={`institutions-status-badge institutions-status-badge--${institution.status.replace(/\s+/g, "-").toLowerCase()}`}
    >
      {t(statusMessageKey(institution.status))}
    </span>
  );
}

function InstitutionCardDetails({
  institution,
  nominatable,
  onOpenNominations,
}: {
  institution: InstitutionRecord;
  nominatable: boolean;
  onOpenNominations: () => void;
}) {
  const t = useTranslations("institutionsPublic");
  const purpose = t(`records.${institution.id}.purpose`);
  const role = t(`records.${institution.id}.role`);
  const knowledgeTitle = t(`records.${institution.id}.knowledgeTitle`);
  const noteKey = `records.${institution.id}.nonNominationNote`;
  const nonNominationNote = t.has(noteKey) ? t(noteKey) : null;

  return (
    <>
      <div className="institutions-card__field">
        <h4>{t("card.purpose")}</h4>
        <p>{purpose}</p>
      </div>

      <div className="institutions-card__field">
        <h4>{t("card.role")}</h4>
        <p>{role}</p>
      </div>

      {nonNominationNote ? (
        <p className="institutions-card__nomination-note" role="note">
          {nonNominationNote}
        </p>
      ) : null}

      <div className="institutions-card__footer">
        <div className="institutions-card__actions">
          <Button href={institution.learnMoreHref} variant="secondary">
            {t("card.learnMore")}
          </Button>
          {nominatable && institution.nominationRole ? (
            <>
              <CreateNominationButton role={institution.nominationRole} />
              <Button type="button" variant="secondary" onClick={onOpenNominations}>
                {t("card.allNominations")}
              </Button>
            </>
          ) : !institution.nonNominationNote ? (
            <Button href={CREATE_INITIATIVE_PLACEHOLDER} variant="primary">
              {t("card.createInitiative")}
            </Button>
          ) : null}
        </div>

        <div className="institutions-card__knowledge">
          <p className="institutions-card__knowledge-label">{t("card.relatedKnowledge")}</p>
          <Link
            href={`/knowledge/${institution.knowledgeSlug}`}
            className="institutions-card__knowledge-link"
          >
            {t("card.readKnowledge", { title: knowledgeTitle })}
          </Link>
        </div>
      </div>
    </>
  );
}

export function InstitutionCard({ institution, layout = "standard" }: InstitutionCardProps) {
  const t = useTranslations("institutionsPublic");
  const [modalOpen, setModalOpen] = useState(false);
  const nominatable = isNominatableInstitution(institution);
  const name = t(`records.${institution.id}.name`);
  const purpose = t(`records.${institution.id}.purpose`);
  const shortDescription = getShortDescription(purpose);

  if (layout === "featured") {
    return (
      <article
        id={`institution-${institution.id}`}
        tabIndex={-1}
        className="institutions-card-wrapper institutions-card-wrapper--featured"
      >
        <div className="institutions-featured-card__layout">
          <Card className="institutions-card institutions-featured-card__media-card">
            <InstitutionIllustration illustrationId={institution.illustrationId} title={name} />
          </Card>

          <div className="institutions-card__body institutions-featured-card__intro">
            <InstitutionStatusBadge institution={institution} />
            <h3 className="institutions-card__title">{name}</h3>
            <p className="institutions-card__description">{shortDescription}</p>
          </div>
        </div>

        <div className="institutions-featured-card__details">
          <div className="institutions-card__body">
            <InstitutionCardDetails
              institution={institution}
              nominatable={nominatable}
              onOpenNominations={() => setModalOpen(true)}
            />
          </div>
        </div>

        {nominatable && institution.nominationRole ? (
          <AllNominationsModal
            defaultRole={institution.nominationRole}
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        ) : null}
      </article>
    );
  }

  return (
    <article
      id={`institution-${institution.id}`}
      tabIndex={-1}
      className="institutions-card-wrapper"
    >
      <Card className="institutions-card">
        <InstitutionIllustration illustrationId={institution.illustrationId} title={name} />

        <div className="institutions-card__body">
          <InstitutionStatusBadge institution={institution} />
          <h3 className="institutions-card__title">{name}</h3>
          <p className="institutions-card__description">{shortDescription}</p>
          <InstitutionCardDetails
            institution={institution}
            nominatable={nominatable}
            onOpenNominations={() => setModalOpen(true)}
          />
        </div>
      </Card>

      {nominatable && institution.nominationRole ? (
        <AllNominationsModal
          defaultRole={institution.nominationRole}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </article>
  );
}
