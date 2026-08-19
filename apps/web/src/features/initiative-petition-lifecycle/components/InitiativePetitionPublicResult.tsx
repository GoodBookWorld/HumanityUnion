"use client";

import { useEffect, useState } from "react";

import type { PublicPetitionProjection } from "@hu/types";

import { PublicTranslatedFields } from "../../language";
import { getPublicPetition, recordPetitionVisitorSignal } from "../../petition/api";
import {
  buildPublicPetitionSharePayload,
  CivicShareButton,
} from "../../civic-share";
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
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

/**
 * Initiative Lifecycle — Part F, Section 5/7/8/9 (Public Petition /
 * Representative Signatures / Traceability).
 *
 * Renders inside the shared shell's `InitiativeLifecyclePublicResultPanel`
 * boundary as its `publicResultSlot` — that boundary already renders the
 * stage title, Publication Date, and Version generically; this adds
 * published Petition content: Public Summary, Request Statement, Expected
 * Outcome, Supporting Context, Key Arguments, permanent Traceability
 * (Revision/Analysis/Proposal references — Section 9), the three
 * independent Participant/Member/Visitor counters with the mandatory
 * civic-participation disclaimer (Section 7), and Sign Petition / Withdraw
 * Signature (Section 8). Visitors never see a draft — only the Published
 * Petition, exactly as returned by the public projection.
 */
export function InitiativePetitionPublicResult({
  petitionId,
  isPreview = false,
}: InitiativePetitionPublicResultProps) {
  const [projection, setProjection] = useState<PublicPetitionProjection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

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
    return <p className="lsw-result__placeholder">This Petition could not be loaded.</p>;
  }

  if (!projection) {
    return <p className="lsw-result__placeholder">Loading Petition…</p>;
  }

  const { petitionIdentity, petitionSubject, traceability, supportBreakdown, participationTransparencyNote } =
    projection;
  const publishedAtLabel = formatDate(projection.petitionSummary.publishedAt);

  return (
    <div className="ipl-public-result" translate="yes">
      <PublicTranslatedFields
        sourceKind="petition"
        sourceRecordId={petitionId}
        fieldOrder={[
          "title",
          "summary",
          "requestStatement",
          "expectedOutcome",
          "supportingContext",
          "keyArguments",
        ]}
        fieldLabels={{
          title: "Petition Title",
          summary: "Public Summary",
          requestStatement: "Request Statement",
          expectedOutcome: "Expected Outcome",
          supportingContext: "Supporting Context",
          keyArguments: "Key Arguments",
        }}
        fallbackFields={{
          title: petitionIdentity.title,
          summary: petitionSubject.summary || "No summary provided.",
          requestStatement: petitionSubject.requestStatement ?? "",
          expectedOutcome: petitionSubject.expectedOutcome ?? "",
          supportingContext: petitionSubject.supportingContext ?? "",
          keyArguments: (petitionSubject.keyArguments ?? []).join("\n"),
        }}
      />

      {traceability ? (
        <div className="ipl-public-result__field">
          <h4>Traceability</h4>
          <div className="ipl-traceability">
            <span>
              Supporting Revision: Version {traceability.revisionVersion} ({traceability.revisionId})
            </span>
            {traceability.analysisId ? (
              <span>
                Supporting Analysis: {traceability.analysisId}
                {traceability.analysisVersion !== null ? ` (Version ${traceability.analysisVersion})` : ""}
              </span>
            ) : null}
            <span>
              Supporting Proposals:{" "}
              {traceability.proposalIds.length > 0 ? traceability.proposalIds.join(", ") : "none"}
            </span>
          </div>
        </div>
      ) : null}

      {publishedAtLabel ? <p className="ipl-public-result__empty">Published {publishedAtLabel}</p> : null}

      <section className="ipl-support" aria-label="Representative signatures">
        <div className="ipl-support__header">
          <p className="ipl-support__title">Representative Signatures</p>
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
            ariaLabel={`Share petition: ${petitionIdentity.title}`}
          />
        </div>
        <div className="ipl-support__counters" role="list" aria-label="Petition support counters">
          <div className="ipl-support__counter" role="listitem">
            <span className="ipl-support__counter-value">{supportBreakdown.participantSignatures}</span>
            <span className="ipl-support__counter-label">Participants</span>
          </div>
          <div className="ipl-support__counter" role="listitem">
            <span className="ipl-support__counter-value">{supportBreakdown.memberSignatures}</span>
            <span className="ipl-support__counter-label">Members</span>
          </div>
          <div className="ipl-support__counter" role="listitem">
            <span className="ipl-support__counter-value">{supportBreakdown.visitorSignals}</span>
            <span className="ipl-support__counter-label">Visitors</span>
          </div>
        </div>
        <p className="ipl-support__note">{participationTransparencyNote}</p>

        {isPreview ? (
          <p className="ipl-support__note">
            The Signature widget is disabled while previewing — signing becomes available to visitors once
            this Petition is published and open.
          </p>
        ) : (
          <InitiativePetitionSignatureWidget
            petitionId={petitionIdentity.petitionId}
            viewerHasSigned={projection.viewerHasSigned}
            signingAvailable={projection.participationEntryGuidance.signingAvailable}
            participationEntryGuidance={projection.participationEntryGuidance}
            onSignatureChange={(viewerHasSigned) =>
              setProjection((current) => (current ? { ...current, viewerHasSigned } : current))
            }
          />
        )}
      </section>
    </div>
  );
}
