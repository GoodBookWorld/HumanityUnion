"use client";

import type { Petition } from "@hu/types";
import { useMemo, useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";

import { signPetition } from "../api";
import {
  BOOTSTRAP_PARTICIPANT_ID,
  findParticipantSignature,
  formatPetitionDate,
} from "../petition-utils";

interface SignatureSectionProps {
  petition: Petition;
  onPetitionUpdated: (petition: Petition) => void;
  onSignatureRecorded: () => void;
}

export function SignatureSection({
  petition,
  onPetitionUpdated,
  onSignatureRecorded,
}: SignatureSectionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const participantSignature = useMemo(
    () => findParticipantSignature(petition, BOOTSTRAP_PARTICIPANT_ID),
    [petition],
  );

  async function handleSign() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await signPetition(petition.petitionId, BOOTSTRAP_PARTICIPANT_ID);
      onPetitionUpdated(updated);
      onSignatureRecorded();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setErrorMessage(detail);
    } finally {
      setSubmitting(false);
    }
  }

  if (participantSignature) {
    return (
      <div className="signature-section signature-section--signed">
        <p className="signature-section__status">Signature Recorded</p>
        <ProfileField label="Signed At" value={formatPetitionDate(participantSignature.signedAt)} />
        <p className="signature-section__note">
          Your endorsement is recorded and cannot be changed here.
        </p>
      </div>
    );
  }

  if (petition.status !== "Open") {
    const unavailableMessage =
      petition.status === "Draft" || petition.status === "Ready"
        ? "This Petition is still being prepared. Endorsement is not available yet."
        : petition.status === "Published"
          ? "This Petition is published but not yet open for signatures."
          : "This Petition is no longer open for signatures.";

    const nextChangeMessage =
      petition.status === "Published"
        ? "Signing will become available when the Petition opens."
        : petition.status === "Draft" || petition.status === "Ready"
          ? "Signing will become available after publication and opening."
          : null;

    return (
      <div className="signature-section signature-section--inactive">
        <p className="signature-section__inactive">{unavailableMessage}</p>
        {nextChangeMessage ? <p className="signature-section__next">{nextChangeMessage}</p> : null}
      </div>
    );
  }

  return (
    <div className="signature-section">
      <p className="signature-section__prompt">
        Signing records your endorsement of the approved direction. It does not assign
        implementation responsibility to you.
      </p>
      <button
        type="button"
        className="signature-section__button"
        disabled={submitting}
        onClick={() => void handleSign()}
      >
        {submitting ? "Recording signature..." : "Sign this Petition"}
      </button>
      {errorMessage ? <p className="signature-section__error">{errorMessage}</p> : null}
    </div>
  );
}
