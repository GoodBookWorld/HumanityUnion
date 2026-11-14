"use client";

import type { PublicPetitionRecord } from "@hu/types";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { ClientAuthStatus } from "../../auth/use-client-auth-status";
import { signPetitionAsCurrentParticipant, withdrawPetitionSignature } from "../api";
import { signatureActionErrorKey, signatureNotOpenKey } from "../petition-status-i18n";
import {
  isSignatureWithdrawalAvailable,
  resolveSignatureSectionState,
  type ViewerSignatureStatus,
} from "../petition-utils";

interface SignatureSectionProps {
  petition: PublicPetitionRecord;
  authStatus: ClientAuthStatus;
  viewerSignature: ViewerSignatureStatus;
  onPetitionUpdated: (petition: PublicPetitionRecord) => void;
  onViewerSignatureChange: (status: ViewerSignatureStatus) => void;
  /** Asks the server again after a failed action (e.g. a signature recorded elsewhere). */
  onSignatureStatusStale: () => void;
}

export function SignatureSection({
  petition,
  authStatus,
  viewerSignature,
  onPetitionUpdated,
  onViewerSignatureChange,
  onSignatureStatusStale,
}: SignatureSectionProps) {
  const t = useTranslations("initiativeExperience");
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const state = resolveSignatureSectionState({
    authStatus,
    viewerSignature,
    justSigned,
    petitionStatus: petition.status,
  });

  async function handleSign() {
    setSubmitting(true);
    setErrorKey(null);

    try {
      const updated = await signPetitionAsCurrentParticipant(petition.petitionId, "Community");
      onPetitionUpdated(updated);
      setJustSigned(true);
      onViewerSignatureChange("signed");
    } catch (error) {
      setErrorKey(signatureActionErrorKey(error, "sign"));
      onSignatureStatusStale();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    setSubmitting(true);
    setErrorKey(null);

    try {
      const updated = await withdrawPetitionSignature(petition.petitionId);
      onPetitionUpdated(updated);
      setJustSigned(false);
      onViewerSignatureChange("unsigned");
    } catch (error) {
      setErrorKey(signatureActionErrorKey(error, "withdraw"));
      onSignatureStatusStale();
    } finally {
      setSubmitting(false);
    }
  }

  const errorNote = errorKey ? (
    <p className="signature-section__error" role="alert">
      {t(errorKey)}
    </p>
  ) : null;

  if (state === "checking") {
    return (
      <div className="signature-section" aria-busy="true">
        <p className="signature-section__prompt">{t("petitionSignature.checking")}</p>
      </div>
    );
  }

  if (state === "just_signed" || state === "already_signed") {
    const canWithdraw = isSignatureWithdrawalAvailable(petition);

    return (
      <div className="signature-section signature-section--signed">
        <p className="signature-section__status">
          {state === "just_signed"
            ? t("petitionSignature.justSignedTitle")
            : t("petitionSignature.alreadySignedTitle")}
        </p>
        <p className="signature-section__note">
          {state === "just_signed"
            ? t("petitionSignature.justSignedNote")
            : t("petitionSignature.signedStatus")}
        </p>
        {canWithdraw ? (
          <button
            type="button"
            className="signature-section__button"
            disabled={submitting}
            onClick={() => void handleWithdraw()}
          >
            {submitting ? t("petitionSignature.withdrawing") : t("petitionSignature.withdraw")}
          </button>
        ) : (
          <p className="signature-section__note">{t("petitionSignature.lockedNote")}</p>
        )}
        {errorNote}
      </div>
    );
  }

  if (state === "not_open") {
    const unavailableKey = signatureNotOpenKey(petition.status);

    const nextChangeKey =
      petition.status === "Published"
        ? "petitionSignature.nextChangePublished"
        : petition.status === "Draft" || petition.status === "Ready"
          ? "petitionSignature.nextChangePreparing"
          : null;

    return (
      <div className="signature-section signature-section--inactive">
        <p className="signature-section__inactive">{t(unavailableKey)}</p>
        {nextChangeKey ? <p className="signature-section__next">{t(nextChangeKey)}</p> : null}
      </div>
    );
  }

  if (state === "sign_in") {
    return (
      <div className="signature-section">
        <p className="signature-section__prompt">{t("petitionSignature.signInGuidance")}</p>
      </div>
    );
  }

  return (
    <div className="signature-section">
      <p className="signature-section__prompt">{t("petitionSignature.endorsementPrompt")}</p>
      {state === "status_unavailable" ? (
        <p className="signature-section__note">{t("petitionSignature.statusUnavailable")}</p>
      ) : null}
      <button
        type="button"
        className="signature-section__button"
        disabled={submitting}
        onClick={() => void handleSign()}
      >
        {submitting ? t("petitionSignature.recording") : t("petitionSignature.sign")}
      </button>
      {errorNote}
    </div>
  );
}
