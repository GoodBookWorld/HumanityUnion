"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { PetitionState } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { signPetitionAsCurrentParticipant, withdrawPetitionSignature } from "../../petition/api";
import { signatureActionErrorKey, signatureNotOpenKey } from "../../petition/petition-status-i18n";

import "./initiative-petition-stage-workspace.css";

interface InitiativePetitionSignatureWidgetProps {
  readonly petitionId: string;
  readonly petitionStatus: PetitionState;
  readonly viewerHasSigned: boolean;
  readonly signingAvailable: boolean;
  readonly onSignatureChange: (viewerHasSigned: boolean) => void;
}

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures /
 * Petition Reactions).
 *
 * Sign / Withdraw — one signature per Participant. Mirrors the Part D/E
 * reaction-widget identity pattern exactly
 * (`InitiativeRevisionReactionWidget`): gates on `useClientAuthStatus()`
 * only, never reads or sends its own participant id — the server resolves
 * the real signed-in actor from the request itself. Visitors (not signed
 * in) use the separate, anonymous Visitor Signal instead (recorded
 * automatically when this stage's public result is viewed — see
 * `InitiativePetitionPublicResult`), never a duplicate signature.
 *
 * Guidance and failures are WEB_UI messages chosen from the Petition status
 * and the HTTP status; the API's English prose is never shown.
 */
export function InitiativePetitionSignatureWidget({
  petitionId,
  petitionStatus,
  viewerHasSigned,
  signingAvailable,
  onSignatureChange,
}: InitiativePetitionSignatureWidgetProps) {
  const t = useTranslations("initiativeExperience");
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSign() {
    if (authStatus !== "authenticated" || busy) {
      return;
    }

    setBusy(true);
    setErrorKey(null);

    try {
      await signPetitionAsCurrentParticipant(petitionId);
      onSignatureChange(true);
    } catch (submissionError) {
      setErrorKey(signatureActionErrorKey(submissionError, "sign"));
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    if (authStatus !== "authenticated" || busy) {
      return;
    }

    setBusy(true);
    setErrorKey(null);

    try {
      await withdrawPetitionSignature(petitionId);
      onSignatureChange(false);
    } catch (submissionError) {
      setErrorKey(signatureActionErrorKey(submissionError, "withdraw"));
    } finally {
      setBusy(false);
    }
  }

  const errorNote = errorKey ? (
    <p className="ipl-signature__error" role="alert">
      {t(errorKey)}
    </p>
  ) : null;

  if (!signingAvailable) {
    return (
      <div className="ipl-signature" aria-label={t("petitionSignature.aria")}>
        <p className="ipl-signature__prompt">{t(signatureNotOpenKey(petitionStatus))}</p>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return (
      <div className="ipl-signature" aria-label={t("petitionSignature.aria")}>
        <p className="ipl-signature__prompt">{t("petitionSignature.signInGuidance")}</p>
      </div>
    );
  }

  if (viewerHasSigned) {
    return (
      <div className="ipl-signature" aria-label={t("petitionSignature.aria")}>
        <p className="ipl-signature__status">{t("petitionSignature.signedStatus")}</p>
        <div className="ipl-signature__actions">
          <button
            type="button"
            className="workspace-button workspace-button--secondary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void handleWithdraw()}
          >
            {busy ? t("petitionSignature.withdrawing") : t("petitionSignature.withdraw")}
          </button>
        </div>
        {errorNote}
      </div>
    );
  }

  return (
    <div className="ipl-signature" aria-label={t("petitionSignature.aria")}>
      <p className="ipl-signature__prompt">{t("petitionSignature.disclaimer")}</p>
      <div className="ipl-signature__actions">
        <button
          type="button"
          className="workspace-button workspace-button--primary"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void handleSign()}
        >
          {busy ? t("petitionSignature.recording") : t("petitionSignature.sign")}
        </button>
      </div>
      {errorNote}
    </div>
  );
}
