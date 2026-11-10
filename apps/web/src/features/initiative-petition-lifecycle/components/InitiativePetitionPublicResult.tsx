"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { PublicPetitionProjection } from "@hu/types";

import { PublicTranslatedFields } from "../../language";
import { getPublicPetition, recordPetitionVisitorSignal } from "../../petition/api";
import {
  buildPublicPetitionSharePayload,
  CivicShareButton,
} from "../../civic-share";
import {
  buildPetitionDocumentFallbackFields,
  PETITION_DOCUMENT_FIELD_LABEL_KEYS,
  petitionDocumentRecipients,
  petitionDocumentRevisionReference,
  petitionDocumentStatusKey,
} from "../petition-public-document";
import { createPetitionSignatureRefresher } from "../petition-signature-refresh";
import { InitiativePetitionSignatureWidget } from "./InitiativePetitionSignatureWidget";

import "./initiative-petition-stage-workspace.css";

interface InitiativePetitionPublicResultProps {
  readonly petitionId: string;
  /**
   * True in Public Preview — editing disabled, result shown exactly as
   * visitors will see it, except the Signature widget is replaced with a
   * read-only note (mirrors `InitiativeRevisionPublicResult`) so
   * previewing can never record a real signature or visitor signal.
   */
  readonly isPreview?: boolean;
  /** Called after a successful Sign / Withdraw, e.g. to refresh other Petition summaries on the page. */
  readonly onSignatureChange?: (petitionId: string, viewerHasSigned: boolean) => void;
}

function formatDate(value: string | null, locale: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

/**
 * HU-LC-05C.4C.3B — the published Petition as a civic document: title as
 * the single heading, publication date / status / recipients once in the
 * header, reader-facing section labels, one shared translation area, and a
 * plain-language source reference instead of internal traceability ids.
 */
export function InitiativePetitionPublicDocument({
  petitionId,
  projection,
}: {
  readonly petitionId: string;
  readonly projection: PublicPetitionProjection;
}) {
  const locale = useLocale();
  const t = useTranslations("initiativeExperience");
  const { petitionIdentity, petitionSubject } = projection;
  const publishedAtLabel = formatDate(projection.petitionSummary.publishedAt, locale);
  const statusKey = petitionDocumentStatusKey(petitionIdentity.lifecycleStatus);
  const recipients = petitionDocumentRecipients(petitionSubject);
  const revisionReference = petitionDocumentRevisionReference(projection.traceability);

  const header =
    publishedAtLabel || statusKey || recipients.length > 0 ? (
      <div className="ipl-document__header">
        {publishedAtLabel || statusKey ? (
          <p className="ipl-document__meta">
            {statusKey ? (
              <span className="ipl-document__status">
                {t(`author.petition.public.document.${statusKey}`)}
              </span>
            ) : null}
            {publishedAtLabel ? (
              <span>{t("author.petition.public.publishedAt", { date: publishedAtLabel })}</span>
            ) : null}
          </p>
        ) : null}
        {recipients.length > 0 ? (
          <dl className="ipl-document__recipients">
            <dt>{t("author.petition.public.document.recipients")}</dt>
            <dd>
              <ul>
                {recipients.map((recipient, index) => (
                  <li key={`${index}-${recipient}`}>{recipient}</li>
                ))}
              </ul>
            </dd>
          </dl>
        ) : null}
      </div>
    ) : null;

  return (
    <article className="ipl-document">
      <PublicTranslatedFields
        presentation="document"
        sourceKind="petition"
        sourceRecordId={petitionId}
        headingField="title"
        headerContent={header}
        fieldOrder={[
          "title",
          "summary",
          "requestStatement",
          "expectedOutcome",
          "supportingContext",
          "keyArguments",
        ]}
        fieldLabels={Object.fromEntries(
          Object.entries(PETITION_DOCUMENT_FIELD_LABEL_KEYS).map(([field, key]) => [
            field,
            t(`author.petition.public.document.${key}`),
          ]),
        )}
        fallbackFields={buildPetitionDocumentFallbackFields(petitionIdentity, petitionSubject)}
      />
      {revisionReference ? (
        <p className="ipl-document__reference">
          {revisionReference.key === "basedOnRevisionVersion"
            ? t("author.petition.public.document.basedOnRevisionVersion", {
                version: revisionReference.version,
              })
            : t("author.petition.public.document.basedOnRevision")}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Initiative Lifecycle — Part F, Section 5/7/8/9 (Public Petition /
 * Representative Signatures / Traceability).
 *
 * Renders inside the shared shell's `InitiativeLifecyclePublicResultPanel`
 * boundary as its `publicResultSlot`. The Petition stage uses the shell's
 * document presentation (HU-LC-05C.4C.3B), so the published Petition itself
 * (`InitiativePetitionPublicDocument`) owns the heading, publication date
 * and source reference. This adds the three independent
 * Participant/Member/Visitor counters with the mandatory
 * civic-participation disclaimer (Section 7), and Sign Petition / Withdraw
 * Signature (Section 8). Visitors never see a draft — only the Published
 * Petition, exactly as returned by the public projection.
 */
export function InitiativePetitionPublicResult({
  petitionId,
  isPreview = false,
  onSignatureChange,
}: InitiativePetitionPublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const [projection, setProjection] = useState<PublicPetitionProjection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Section 7 — after Sign / Withdraw, the counters are re-read from the server.
  const [signatureRefresher] = useState(() =>
    createPetitionSignatureRefresher(
      { fetchProjection: getPublicPetition, applyProjection: setProjection },
      petitionId,
    ),
  );

  useEffect(() => {
    signatureRefresher.showPetition(petitionId);
  }, [signatureRefresher, petitionId]);

  useEffect(() => {
    let cancelled = false;
    setProjection(null);
    setLoadFailed(false);

    getPublicPetition(petitionId)
      .then((result) => {
        if (!cancelled) {
          setProjection(result);
        }

        // Section 7 (Visitors) — a bare page view from an unregistered
        // visitor is itself the civic-interest signal being counted; never
        // recorded while merely Previewing (Author-only, not a real
        // visitor) to avoid inflating the count.
        if (!cancelled && !isPreview) {
          void recordPetitionVisitorSignal(petitionId).catch(() => {
            // Best-effort only — a failed visitor signal must never block
            // rendering the Petition itself.
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isPreview intentionally not re-triggering a refetch.
  }, [petitionId]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">{t("author.petition.public.loadFailed")}</p>;
  }

  if (!projection) {
    return <p className="lsw-result__placeholder">{t("author.petition.public.loading")}</p>;
  }

  const { petitionIdentity, petitionSubject, supportBreakdown } = projection;

  return (
    <div className="ipl-public-result" translate="yes">
      <InitiativePetitionPublicDocument petitionId={petitionId} projection={projection} />

      <section className="ipl-support" aria-label={t("author.petition.public.signaturesAria")}>
        <div className="ipl-support__header">
          <p className="ipl-support__title">{t("author.petition.public.signaturesTitle")}</p>
          <CivicShareButton
            payload={
              projection.shareReference.available
                ? buildPublicPetitionSharePayload({
                    initiativeId: petitionSubject.initiativeId,
                    petitionId: petitionIdentity.petitionId,
                    title: petitionIdentity.title,
                    shareUrl: projection.shareReference.url,
                    optionalText: petitionSubject.summary || undefined,
                  })
                : null
            }
            disabled={!projection.shareReference.available}
            disabledReason={projection.shareReference.sharingNote}
            ariaLabel={t("author.petition.public.shareAria", { title: petitionIdentity.title })}
          />
        </div>
        <div
          className="ipl-support__counters"
          role="list"
          aria-label={t("author.petition.public.supportCountersAria")}
        >
          <div className="ipl-support__counter" role="listitem">
            <span className="ipl-support__counter-value">{supportBreakdown.participantSignatures}</span>
            <span className="ipl-support__counter-label">{t("sidebar.support.participants")}</span>
          </div>
          <div className="ipl-support__counter" role="listitem">
            <span className="ipl-support__counter-value">{supportBreakdown.memberSignatures}</span>
            <span className="ipl-support__counter-label">{t("sidebar.support.members")}</span>
          </div>
          <div className="ipl-support__counter" role="listitem">
            <span className="ipl-support__counter-value">{supportBreakdown.visitorSignals}</span>
            <span className="ipl-support__counter-label">{t("sidebar.support.visitors")}</span>
          </div>
        </div>
        <p className="ipl-support__note">
          {t("author.petition.public.participationTransparencyNote")}
        </p>

        {isPreview ? (
          <p className="ipl-support__note">
            {t("author.petition.public.previewSignatureDisabled")}
          </p>
        ) : (
          <InitiativePetitionSignatureWidget
            petitionId={petitionIdentity.petitionId}
            viewerHasSigned={projection.viewerHasSigned}
            signingAvailable={projection.participationEntryGuidance.signingAvailable}
            participationEntryGuidance={projection.participationEntryGuidance}
            onSignatureChange={(viewerHasSigned) => {
              void signatureRefresher.afterSignatureChange(
                petitionIdentity.petitionId,
                viewerHasSigned,
              );
              onSignatureChange?.(petitionIdentity.petitionId, viewerHasSigned);
            }}
          />
        )}
      </section>
    </div>
  );
}
