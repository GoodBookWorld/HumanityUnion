"use client";

import { useState } from "react";

import type { PublicParticipationEntryGuidance } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { signPetitionAsCurrentParticipant, withdrawPetitionSignature } from "../../petition/api";

import "./initiative-petition-stage-workspace.css";

interface InitiativePetitionSignatureWidgetProps {
  readonly petitionId: string;
  readonly viewerHasSigned: boolean;
  readonly signingAvailable: boolean;
  readonly participationEntryGuidance: PublicParticipationEntryGuidance;
  readonly onSignatureChange: (viewerHasSigned: boolean) => void;
}

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures /
 * Petition Reactions).
 *
 * "Sign Petition" and "Withdraw Signature" — one signature per Participant.
 * Mirrors the Part D/E reaction-widget identity pattern exactly
 * (`InitiativeRevisionReactionWidget`): gates on `useClientAuthStatus()`
 * only, never reads or sends its own participant id — the server resolves
 * the real signed-in actor from the request itself. Visitors (not signed
 * in) use the separate, anonymous Visitor Signal instead (recorded
 * automatically when this stage's public result is viewed — see
 * `InitiativePetitionPublicResult`), never a duplicate signature.
 */
export function InitiativePetitionSignatureWidget({
  petitionId,
  viewerHasSigned,
  signingAvailable,
  participationEntryGuidance,
  onSignatureChange,
}: InitiativePetitionSignatureWidgetProps) {
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSign() {
    if (authStatus !== "authenticated" || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await signPetitionAsCurrentParticipant(petitionId);
      onSignatureChange(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not record signature.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    if (authStatus !== "authenticated" || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await withdrawPetitionSignature(petitionId);
      onSignatureChange(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Could not withdraw signature.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!signingAvailable) {
    return (
      <div className="ipl-signature">
        <p className="ipl-signature__prompt">{participationEntryGuidance.registrationGatewayMessage}</p>
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return (
      <div className="ipl-signature">
        <p className="ipl-signature__prompt">{participationEntryGuidance.registrationGatewayMessage}</p>
      </div>
    );
  }

  if (viewerHasSigned) {
    return (
      <div className="ipl-signature">
        <p className="ipl-signature__status">You have signed this Petition.</p>
        <div className="ipl-signature__actions">
          <button
            type="button"
            className="workspace-button workspace-button--secondary"
            disabled={busy}
            onClick={() => void handleWithdraw()}
          >
            {busy ? "Withdrawing…" : "Withdraw Signature"}
          </button>
        </div>
        {error ? <p className="ipl-signature__error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="ipl-signature">
      <p className="ipl-signature__prompt">
        Signing records your civic participation in support of this Petition. It is not a legally binding
        petition and does not assign implementation responsibility to you.
      </p>
      <div className="ipl-signature__actions">
        <button
          type="button"
          className="workspace-button workspace-button--primary"
          disabled={busy}
          onClick={() => void handleSign()}
        >
          {busy ? "Recording…" : "Sign this Petition"}
        </button>
      </div>
      {error ? <p className="ipl-signature__error">{error}</p> : null}
    </div>
  );
}
