"use client";

import { useCallback, useEffect, useState } from "react";

import type { PublicInitiativeImplementationCommitmentListItem } from "@hu/types";

import { ConfirmDialog } from "../../../design-system";
import { fetchAuthSession } from "../../auth/auth-api";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { listPublicInitiativeImplementationCommitments } from "../../initiative-implementation-commitment/api";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  initiateImplementationCommitmentTransfer,
  reproposeInitiativeImplementationCommitment,
  takeInitiativeImplementationCommitment,
} from "../api";

import "./initiative-implementation-commitment-stage-workspace.css";

type CommitmentViewState =
  | "available"
  | "awaiting_you"
  | "awaiting_response"
  | "accepted"
  | "transfer_pending"
  | "completed"
  | "withdrawn"
  | "declined"
  | "legacy";

function resolveCommitmentViewState(
  commitment: PublicInitiativeImplementationCommitmentListItem,
  viewerParticipantId: string | null,
): CommitmentViewState {
  if (commitment.status === "completed") {
    return "completed";
  }

  if (commitment.status === "withdrawn") {
    return "withdrawn";
  }

  switch (commitment.proposalStatus) {
    case "unassigned":
      return "available";
    case "proposed":
      return viewerParticipantId &&
        commitment.responsibleParticipantId === viewerParticipantId
        ? "awaiting_you"
        : "awaiting_response";
    case "accepted":
      return commitment.pendingProposedParticipantId ? "transfer_pending" : "accepted";
    case "declined":
      return "declined";
    default:
      return "legacy";
  }
}

function formatStatusLabel(state: CommitmentViewState): string {
  switch (state) {
    case "available":
      return "Available";
    case "awaiting_you":
      return "Awaiting your response";
    case "awaiting_response":
      return "Awaiting response";
    case "accepted":
      return "Accepted";
    case "transfer_pending":
      return "Transfer pending";
    case "completed":
      return "Completed";
    case "withdrawn":
      return "Withdrawn";
    case "declined":
      return "Declined";
    case "legacy":
      return "";
  }
}

type AuthorActionMode = "repropose" | "transfer" | null;

interface InitiativeImplementationCommitmentPublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
  /** Pack 19A.5 — Author may re-propose / transfer when steward. */
  readonly viewerIsSteward?: boolean;
}

/**
 * Initiative Lifecycle — Part I / Pack 19A.3–19A.5.
 * State-driven compact Responsibility UX — not a permanent button row.
 */
export function InitiativeImplementationCommitmentPublicResult({
  initiativeId,
  isPreview = false,
  viewerIsSteward = false,
}: InitiativeImplementationCommitmentPublicResultProps) {
  const authStatus = useClientAuthStatus();
  const [viewerParticipantId, setViewerParticipantId] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<
    readonly PublicInitiativeImplementationCommitmentListItem[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCommitmentId, setPendingCommitmentId] = useState<string | null>(null);
  const [confirmCommitmentId, setConfirmCommitmentId] = useState<string | null>(null);
  const [isTaking, setIsTaking] = useState(false);
  const [takeError, setTakeError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authorActionMode, setAuthorActionMode] = useState<AuthorActionMode>(null);
  const [authorActionCommitmentId, setAuthorActionCommitmentId] = useState<string | null>(null);
  const [nextParticipantId, setNextParticipantId] = useState("");
  const [isAuthorSubmitting, setIsAuthorSubmitting] = useState(false);
  const [authorError, setAuthorError] = useState<string | null>(null);

  const loadCommitments = useCallback(async () => {
    const result = await listPublicInitiativeImplementationCommitments(initiativeId);
    setCommitments(result.commitments);
  }, [initiativeId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await loadCommitments();
        if (!cancelled) {
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Published Implementation Commitments could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCommitments]);

  useEffect(() => {
    let cancelled = false;

    if (authStatus !== "authenticated") {
      setViewerParticipantId(null);
      return;
    }

    void (async () => {
      try {
        const session = await fetchAuthSession();
        if (!cancelled) {
          setViewerParticipantId(session.user?.memberId ?? null);
        }
      } catch {
        if (!cancelled) {
          setViewerParticipantId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  function closeAuthorAction() {
    if (isAuthorSubmitting) {
      return;
    }

    setAuthorActionMode(null);
    setAuthorActionCommitmentId(null);
    setNextParticipantId("");
    setAuthorError(null);
  }

  async function handleConfirmTake() {
    if (!confirmCommitmentId) {
      return;
    }

    setIsTaking(true);
    setTakeError(null);
    setPendingCommitmentId(confirmCommitmentId);

    try {
      await takeInitiativeImplementationCommitment(confirmCommitmentId);
      await loadCommitments();
      setSuccessMessage("Commitment accepted. You are now responsible for this action.");
      setConfirmCommitmentId(null);
    } catch (err) {
      setTakeError(err instanceof Error ? err.message : "Take Commitment failed.");
    } finally {
      setIsTaking(false);
      setPendingCommitmentId(null);
    }
  }

  async function handleConfirmAuthorAction() {
    if (!authorActionMode || !authorActionCommitmentId) {
      return;
    }

    const trimmed = nextParticipantId.trim();

    if (!trimmed) {
      setAuthorError("Enter a Participant ID.");
      return;
    }

    setIsAuthorSubmitting(true);
    setAuthorError(null);

    try {
      if (authorActionMode === "repropose") {
        await reproposeInitiativeImplementationCommitment(authorActionCommitmentId, trimmed);
        setSuccessMessage("Proposed another Participant. They will receive an Accept/Decline notification.");
      } else {
        await initiateImplementationCommitmentTransfer(authorActionCommitmentId, trimmed);
        setSuccessMessage(
          "Transfer proposed. The current responsible Participant stays responsible until the replacement Accepts.",
        );
      }

      await loadCommitments();
      setAuthorActionMode(null);
      setAuthorActionCommitmentId(null);
      setNextParticipantId("");
    } catch (err) {
      setAuthorError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setIsAuthorSubmitting(false);
    }
  }

  if (error) {
    return <p className="iic-source-panel__empty">{error}</p>;
  }

  if (!commitments) {
    return <p className="iic-source-panel__empty">Loading published Implementation Commitments…</p>;
  }

  if (commitments.length === 0) {
    return <p className="iic-source-panel__empty">No Implementation Commitments published yet.</p>;
  }

  const confirmCommitment = commitments.find(
    (commitment) => commitment.commitmentId === confirmCommitmentId,
  );
  const authorActionCommitment = commitments.find(
    (commitment) => commitment.commitmentId === authorActionCommitmentId,
  );
  const showAuthorControls = !isPreview && viewerIsSteward && authStatus === "authenticated";

  return (
    <article className="iic-public" aria-label="Published Implementation Commitments">
      {isPreview ? (
        <p className="iic-public__meta">Author Preview of published Implementation Commitments</p>
      ) : null}
      <section className="iic-public__section">
        <h3>Implementation Commitments</h3>
        <p className="iic-public__meta">{commitments.length} Commitment(s) published</p>
      </section>

      {successMessage ? (
        <p className="iic-public__success" role="status">
          {successMessage}
        </p>
      ) : null}
      {takeError ? <p className="iic-public__error">{takeError}</p> : null}

      {commitments.map((commitment) => {
        const viewState = resolveCommitmentViewState(commitment, viewerParticipantId);
        const statusLabel = formatStatusLabel(viewState);
        const showTake =
          !isPreview &&
          authStatus === "authenticated" &&
          viewState === "available" &&
          commitment.status === "published";
        const showResponsible =
          viewState === "accepted" ||
          viewState === "transfer_pending" ||
          viewState === "completed" ||
          viewState === "withdrawn" ||
          (viewState === "legacy" && Boolean(commitment.authorDisplayName));
        const showRepropose = showAuthorControls && viewState === "declined";
        const showTransfer = showAuthorControls && viewState === "accepted";

        return (
          <div className="iic-public__commitment" key={commitment.commitmentId}>
            <h3>{commitment.approvedAction ?? commitment.title}</h3>
            <p>{commitment.summary}</p>
            {showResponsible && commitment.authorDisplayName !== "Unassigned" ? (
              <p className="iic-public__meta">
                Responsible: {commitment.authorDisplayName}
                {commitment.priority ? ` · Priority ${commitment.priority}` : ""}
              </p>
            ) : commitment.priority ? (
              <p className="iic-public__meta">Priority {commitment.priority}</p>
            ) : null}
            {statusLabel ? (
              <span className="iic-public__commitment-status">{statusLabel}</span>
            ) : null}
            {showTake ? (
              <div className="iic-public__take-action">
                <WorkspaceButton
                  variant="primary"
                  aria-label={`Take Commitment for ${commitment.approvedAction ?? commitment.title}`}
                  disabled={pendingCommitmentId === commitment.commitmentId}
                  onClick={() => {
                    setTakeError(null);
                    setConfirmCommitmentId(commitment.commitmentId);
                  }}
                >
                  Take Commitment
                </WorkspaceButton>
              </div>
            ) : null}
            {showRepropose ? (
              <div className="iic-public__take-action">
                <WorkspaceButton
                  variant="secondary"
                  aria-label={`Propose another Participant for ${commitment.approvedAction ?? commitment.title}`}
                  onClick={() => {
                    setAuthorError(null);
                    setNextParticipantId("");
                    setAuthorActionMode("repropose");
                    setAuthorActionCommitmentId(commitment.commitmentId);
                  }}
                >
                  Propose Another Participant
                </WorkspaceButton>
              </div>
            ) : null}
            {showTransfer ? (
              <div className="iic-public__take-action">
                <WorkspaceButton
                  variant="secondary"
                  aria-label={`Transfer responsibility for ${commitment.approvedAction ?? commitment.title}`}
                  onClick={() => {
                    setAuthorError(null);
                    setNextParticipantId("");
                    setAuthorActionMode("transfer");
                    setAuthorActionCommitmentId(commitment.commitmentId);
                  }}
                >
                  Transfer Responsibility
                </WorkspaceButton>
              </div>
            ) : null}
          </div>
        );
      })}

      <ConfirmDialog
        isOpen={confirmCommitmentId !== null}
        title="Take responsibility?"
        description={
          confirmCommitment ? (
            <>
              <p>Take responsibility for this implementation commitment?</p>
              <p>
                <strong>{confirmCommitment.approvedAction ?? confirmCommitment.title}</strong>
              </p>
            </>
          ) : (
            "Take responsibility for this implementation commitment?"
          )
        }
        confirmLabel="Take Commitment"
        cancelLabel="Cancel"
        destructive={false}
        isConfirming={isTaking}
        onCancel={() => {
          if (!isTaking) {
            setConfirmCommitmentId(null);
          }
        }}
        onConfirm={() => void handleConfirmTake()}
      />

      <ConfirmDialog
        isOpen={authorActionMode !== null}
        title={
          authorActionMode === "transfer"
            ? "Transfer responsibility?"
            : "Propose another Participant?"
        }
        description={
          <>
            {authorActionCommitment ? (
              <p>
                <strong>
                  {authorActionCommitment.approvedAction ?? authorActionCommitment.title}
                </strong>
              </p>
            ) : null}
            <p>
              {authorActionMode === "transfer"
                ? "This reassigns responsibility. The current responsible Participant stays responsible until the replacement Accepts."
                : "The previous Decline remains in history. The new Participant receives a normal Accept/Decline proposal."}
            </p>
            <label className="iic-public__participant-field">
              Participant ID
              <input
                type="text"
                value={nextParticipantId}
                onChange={(event) => setNextParticipantId(event.target.value)}
                autoComplete="off"
                disabled={isAuthorSubmitting}
              />
            </label>
            {authorError ? <p className="iic-public__error">{authorError}</p> : null}
          </>
        }
        confirmLabel={authorActionMode === "transfer" ? "Propose Transfer" : "Propose"}
        cancelLabel="Cancel"
        destructive={false}
        isConfirming={isAuthorSubmitting}
        onCancel={closeAuthorAction}
        onConfirm={() => void handleConfirmAuthorAction()}
      />
    </article>
  );
}
