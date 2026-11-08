"use client";

import type { Petition } from "@hu/types";
import { useState } from "react";

import type { ClientAuthStatus } from "../../auth/use-client-auth-status";
import { signPetitionAsCurrentParticipant, withdrawPetitionSignature } from "../api";
import {
  isSignatureWithdrawalAvailable,
  resolveSignatureSectionState,
  type ViewerSignatureStatus,
} from "../petition-utils";

interface SignatureSectionProps {
  petition: Petition;
  authStatus: ClientAuthStatus;
  viewerSignature: ViewerSignatureStatus;
  registrationGatewayMessage: string | null;
  onPetitionUpdated: (petition: Petition) => void;
  onViewerSignatureChange: (status: ViewerSignatureStatus) => void;
  /** Asks the server again after a failed action (e.g. a signature recorded elsewhere). */
  onSignatureStatusStale: () => void;
}

export function SignatureSection({
  petition,
  authStatus,
  viewerSignature,
  registrationGatewayMessage,
  onPetitionUpdated,
  onViewerSignatureChange,
  onSignatureStatusStale,
}: SignatureSectionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const state = resolveSignatureSectionState({
    authStatus,
    viewerSignature,
    justSigned,
    petitionStatus: petition.status,
  });

  async function handleSign() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await signPetitionAsCurrentParticipant(petition.petitionId, "Community");
      onPetitionUpdated(updated);
      setJustSigned(true);
      onViewerSignatureChange("signed");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      onSignatureStatusStale();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await withdrawPetitionSignature(petition.petitionId);
      onPetitionUpdated(updated);
      setJustSigned(false);
      onViewerSignatureChange("unsigned");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      onSignatureStatusStale();
    } finally {
      setSubmitting(false);
    }
  }

  const errorNote = errorMessage ? (
    <p className="signature-section__error">{errorMessage}</p>
  ) : null;

  if (state === "checking") {
    return (
      <div className="signature-section" aria-busy="true">
        <p className="signature-section__prompt">Checking your signature status...</p>
      </div>
    );
  }

  if (state === "just_signed" || state === "already_signed") {
    const canWithdraw = isSignatureWithdrawalAvailable(petition);

    return (
      <div className="signature-section signature-section--signed">
        <p className="signature-section__status">
          {state === "just_signed" ? "Signature Recorded" : "Already Signed"}
        </p>
        <p className="signature-section__note">
          {state === "just_signed"
            ? "Your endorsement of this Petition has been recorded."
            : "You have already signed this Petition."}
        </p>
        {canWithdraw ? (
          <button
            type="button"
            className="signature-section__button"
            disabled={submitting}
            onClick={() => void handleWithdraw()}
          >
            {submitting ? "Withdrawing signature..." : "Withdraw signature"}
          </button>
        ) : (
          <p className="signature-section__note">
            Your endorsement is recorded and cannot be changed here.
          </p>
        )}
        {errorNote}
      </div>
    );
  }

  if (state === "not_open") {
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

  if (state === "sign_in") {
    return (
      <div className="signature-section">
        <p className="signature-section__prompt">
          {registrationGatewayMessage ?? "Sign in to sign this Petition."}
        </p>
      </div>
    );
  }

  return (
    <div className="signature-section">
      <p className="signature-section__prompt">
        Signing records your endorsement of the approved direction. It does not assign
        implementation responsibility to you.
      </p>
      {state === "status_unavailable" ? (
        <p className="signature-section__note">Your signature status could not be confirmed.</p>
      ) : null}
      <button
        type="button"
        className="signature-section__button"
        disabled={submitting}
        onClick={() => void handleSign()}
      >
        {submitting ? "Recording signature..." : "Sign this Petition"}
      </button>
      {errorNote}
    </div>
  );
}
