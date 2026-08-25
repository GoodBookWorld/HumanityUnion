"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import type { InitiativeImplementationCommitmentProposalStatus } from "@hu/types";

import { ConfirmDialog } from "../../../design-system";
import { getPublicInitiativeImplementationCommitment } from "../../initiative-implementation-commitment/api";
import {
  acceptInitiativeImplementationCommitment,
  declineInitiativeImplementationCommitment,
} from "../../initiative-implementation-commitment-lifecycle/api";

export type ProposalActionResolution = "accepted" | "declined" | "pending" | "unavailable";

interface ImplementationCommitmentProposalActionsProps {
  /** Canonical Commitment id — never Action text or Initiative title. */
  readonly commitmentId: string;
  readonly relatedUrl?: string | null;
  readonly viewerParticipantId: string | null;
  readonly onResolved?: (resolution: "accepted" | "declined") => void;
}

/**
 * Pack 19A.4 / 19A.5 — notification/reminder surface only.
 * Invokes canonical Accept/Decline APIs; does not re-implement authorization.
 * Transfer invitees act while proposalStatus remains accepted and
 * pendingProposedParticipantId matches the viewer.
 */
export function ImplementationCommitmentProposalActions({
  commitmentId,
  relatedUrl,
  viewerParticipantId,
  onResolved,
}: ImplementationCommitmentProposalActionsProps) {
  const [resolution, setResolution] = useState<ProposalActionResolution>("pending");
  const [proposalStatus, setProposalStatus] = useState<
    InitiativeImplementationCommitmentProposalStatus | null | undefined
  >(undefined);
  const [isTransferInvite, setIsTransferInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<"accept" | "decline" | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reconcile = useCallback(async () => {
    const projection = await getPublicInitiativeImplementationCommitment(commitmentId);

    if (!projection) {
      setResolution("unavailable");
      setProposalStatus(null);
      setIsTransferInvite(false);
      return;
    }

    setProposalStatus(projection.proposalStatus);

    if (projection.status === "completed" || projection.status === "withdrawn") {
      setResolution(projection.status === "completed" ? "accepted" : "unavailable");
      setIsTransferInvite(false);
      return;
    }

    const transferInvite =
      Boolean(viewerParticipantId) &&
      projection.proposalStatus === "accepted" &&
      projection.pendingProposedParticipantId === viewerParticipantId;

    setIsTransferInvite(transferInvite);

    if (transferInvite) {
      setResolution("pending");
      return;
    }

    if (
      projection.proposalStatus === "proposed" &&
      viewerParticipantId &&
      projection.responsibleParticipantId === viewerParticipantId
    ) {
      setResolution("pending");
      return;
    }

    if (projection.proposalStatus === "accepted") {
      setResolution("accepted");
      return;
    }

    if (projection.proposalStatus === "declined") {
      setResolution("declined");
      return;
    }

    setResolution("unavailable");
  }, [commitmentId, viewerParticipantId]);

  useEffect(() => {
    void reconcile().catch(() => {
      setResolution("unavailable");
    });
  }, [reconcile]);

  async function runTransition(mode: "accept" | "decline") {
    setBusy(true);
    setError(null);
    const transferMode = isTransferInvite;

    try {
      if (mode === "accept") {
        await acceptInitiativeImplementationCommitment(commitmentId);
        setSuccessMessage(
          transferMode
            ? "Transfer accepted. You are now responsible for this action."
            : "Commitment accepted. You are now responsible for this action.",
        );
        onResolved?.("accepted");
      } else {
        await declineInitiativeImplementationCommitment(commitmentId);
        setSuccessMessage(
          transferMode
            ? "Transfer declined. The current responsible Participant remains responsible."
            : "Commitment declined.",
        );
        onResolved?.("declined");
      }

      setConfirmMode(null);
      await reconcile();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      await reconcile().catch(() => undefined);
      setConfirmMode(null);
    } finally {
      setBusy(false);
    }
  }

  if (proposalStatus === undefined) {
    return <p className="notifications-page__meta">Checking proposal status…</p>;
  }

  if (resolution === "accepted") {
    return (
      <div className="notifications-page__proposal-actions">
        <span className="notifications-page__proposal-resolved" role="status">
          Accepted
        </span>
        {successMessage ? <span className="notifications-page__proposal-success">{successMessage}</span> : null}
        {relatedUrl ? (
          <Link className="notifications-page__link" href={relatedUrl}>
            View related civic record
          </Link>
        ) : null}
      </div>
    );
  }

  if (resolution === "declined") {
    return (
      <div className="notifications-page__proposal-actions">
        <span className="notifications-page__proposal-resolved" role="status">
          Declined
        </span>
        {successMessage ? <span className="notifications-page__proposal-success">{successMessage}</span> : null}
        {relatedUrl ? (
          <Link className="notifications-page__link" href={relatedUrl}>
            View related civic record
          </Link>
        ) : null}
      </div>
    );
  }

  if (resolution !== "pending") {
    return (
      <div className="notifications-page__proposal-actions">
        {successMessage ? (
          <span className="notifications-page__proposal-success" role="status">
            {successMessage}
          </span>
        ) : null}
        {relatedUrl ? (
          <Link className="notifications-page__link" href={relatedUrl}>
            View related civic record
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="notifications-page__proposal-actions">
      {error ? <p className="notifications-page__proposal-error">{error}</p> : null}
      {isTransferInvite ? (
        <p className="notifications-page__meta">
          Responsibility transfer proposed — Accept to become the responsible Participant.
        </p>
      ) : null}
      <button
        type="button"
        className="notifications-page__button notifications-page__button--primary"
        disabled={busy}
        onClick={() => setConfirmMode("accept")}
      >
        Accept
      </button>
      <button
        type="button"
        className="notifications-page__button"
        disabled={busy}
        onClick={() => setConfirmMode("decline")}
      >
        Decline
      </button>
      {relatedUrl ? (
        <Link className="notifications-page__link" href={relatedUrl}>
          View related civic record
        </Link>
      ) : null}

      <ConfirmDialog
        isOpen={confirmMode === "accept"}
        title={isTransferInvite ? "Accept transfer?" : "Accept responsibility?"}
        description={
          isTransferInvite
            ? "Accepting means you take responsibility for this Implementation Commitment Action from the current responsible Participant."
            : "Accepting means you take responsibility for this Implementation Commitment Action."
        }
        confirmLabel="Accept"
        cancelLabel="Cancel"
        destructive={false}
        isConfirming={busy}
        onCancel={() => {
          if (!busy) setConfirmMode(null);
        }}
        onConfirm={() => void runTransition("accept")}
      />
      <ConfirmDialog
        isOpen={confirmMode === "decline"}
        title={isTransferInvite ? "Decline this transfer?" : "Decline this proposal?"}
        description={
          isTransferInvite
            ? "Declining keeps the current responsible Participant in place."
            : "Declining rejects this proposed responsibility. The Author may propose someone else later."
        }
        confirmLabel="Decline"
        cancelLabel="Cancel"
        destructive
        isConfirming={busy}
        onCancel={() => {
          if (!busy) setConfirmMode(null);
        }}
        onConfirm={() => void runTransition("decline")}
      />
    </div>
  );
}
