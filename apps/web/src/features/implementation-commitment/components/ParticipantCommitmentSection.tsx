"use client";

import type { ImplementationCommitment } from "@hu/types";
import { useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";

import { activateImplementationCommitment, submitImplementationCommitment } from "../api";
import {
  BOOTSTRAP_PARTICIPANT_ID,
  formatCommitmentDate,
  getActiveParticipantItem,
  getLifecycleSummary,
  participantHasActiveDeclaration,
} from "../commitment-utils";

interface ParticipantCommitmentSectionProps {
  commitment: ImplementationCommitment;
  onCommitmentUpdated: (commitment: ImplementationCommitment) => void;
}

export function ParticipantCommitmentSection({
  commitment,
  onCommitmentUpdated,
}: ParticipantCommitmentSectionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeItem = getActiveParticipantItem(commitment, BOOTSTRAP_PARTICIPANT_ID);
  const hasActive = participantHasActiveDeclaration(commitment, BOOTSTRAP_PARTICIPANT_ID);

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await submitImplementationCommitment(commitment.implementationCommitmentId);
      onCommitmentUpdated(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await activateImplementationCommitment(commitment.implementationCommitmentId);
      onCommitmentUpdated(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="commitment-participant-status">
      <ProfileField label="Aggregate Lifecycle" value={commitment.status} />
      <ProfileField label="Collection Meaning" value={getLifecycleSummary(commitment.status)} />
      <ProfileField label="Your Active Declaration" value={hasActive ? "Recorded" : "None"} />

      {activeItem ? (
        <>
          <ProfileField label="Contribution Type" value={activeItem.contributionType} />
          <ProfileField label="Capacity" value={activeItem.contributionCapacity} />
          <ProfileField label="Declared At" value={formatCommitmentDate(activeItem.declaredAt)} />
        </>
      ) : null}

      {commitment.status === "Draft" ? (
        <button
          type="button"
          className="commitment-lifecycle__button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "Submitting..." : "Submit Commitment"}
        </button>
      ) : null}

      {commitment.status === "Submitted" ? (
        <button
          type="button"
          className="commitment-lifecycle__button"
          disabled={submitting}
          onClick={() => void handleActivate()}
        >
          {submitting ? "Activating..." : "Activate Commitment"}
        </button>
      ) : null}

      {errorMessage ? <p className="commitment-section__error">{errorMessage}</p> : null}

      <p className="commitment-section__note">
        Participation is voluntary. The platform never declares preparedness on your behalf.
      </p>
    </div>
  );
}
