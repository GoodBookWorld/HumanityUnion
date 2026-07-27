"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Card } from "../../../design-system";
import { AllNominationsModal } from "../../civic-nomination/components/AllNominationsModal";
import { CreateNominationButton } from "../../civic-nomination/components/CreateNominationButton";
import { CREATE_INITIATIVE_PLACEHOLDER } from "../constants";
import type { InstitutionRecord } from "../content";
import { isNominatableInstitution } from "../content";
import { InstitutionIllustration } from "./InstitutionIllustration";

interface InstitutionCardProps {
  institution: InstitutionRecord;
  layout?: "standard" | "featured";
}

function getShortDescription(purpose: string): string {
  const sentence = purpose.match(/^[^.!?]+[.!?]/)?.[0];
  return sentence?.trim() ?? purpose;
}

function InstitutionStatusBadge({ institution }: { institution: InstitutionRecord }) {
  return (
    <span
      className={`institutions-status-badge institutions-status-badge--${institution.status.replace(/\s+/g, "-").toLowerCase()}`}
    >
      {institution.status}
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
  return (
    <>
      <div className="institutions-card__field">
        <h4>Purpose</h4>
        <p>{institution.purpose}</p>
      </div>

      <div className="institutions-card__field">
        <h4>Role</h4>
        <p>{institution.role}</p>
      </div>

      {institution.nonNominationNote ? (
        <p className="institutions-card__nomination-note" role="note">
          {institution.nonNominationNote}
        </p>
      ) : null}

      <div className="institutions-card__footer">
        <div className="institutions-card__actions">
          <Button href={institution.learnMoreHref} variant="secondary">
            Learn More
          </Button>
          {nominatable && institution.nominationRole ? (
            <>
              <CreateNominationButton role={institution.nominationRole} />
              <Button type="button" variant="secondary" onClick={onOpenNominations}>
                All Nominations
              </Button>
            </>
          ) : !institution.nonNominationNote ? (
            <Button href={CREATE_INITIATIVE_PLACEHOLDER} variant="primary">
              Create Initiative
            </Button>
          ) : null}
        </div>

        <div className="institutions-card__knowledge">
          <p className="institutions-card__knowledge-label">Related Knowledge</p>
          <Link
            href={`/knowledge/${institution.knowledgeSlug}`}
            className="institutions-card__knowledge-link"
          >
            {institution.knowledgeTitle} → Read
          </Link>
        </div>
      </div>
    </>
  );
}

export function InstitutionCard({ institution, layout = "standard" }: InstitutionCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const nominatable = isNominatableInstitution(institution);
  const shortDescription = getShortDescription(institution.purpose);

  if (layout === "featured") {
    return (
      <article
        id={`institution-${institution.id}`}
        tabIndex={-1}
        className="institutions-card-wrapper institutions-card-wrapper--featured"
      >
        <div className="institutions-featured-card__layout">
          <Card className="institutions-card institutions-featured-card__media-card">
            <InstitutionIllustration
              illustrationId={institution.illustrationId}
              title={institution.name}
            />
          </Card>

          <div className="institutions-card__body institutions-featured-card__intro">
            <InstitutionStatusBadge institution={institution} />
            <h3 className="institutions-card__title">{institution.name}</h3>
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
        <InstitutionIllustration
          illustrationId={institution.illustrationId}
          title={institution.name}
        />

        <div className="institutions-card__body">
          <InstitutionStatusBadge institution={institution} />
          <h3 className="institutions-card__title">{institution.name}</h3>
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
