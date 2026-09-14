"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeImplementationCommitment } from "@hu/types";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  acceptInitiativeImplementationCommitment,
  declineInitiativeImplementationCommitment,
  listMyProposedInitiativeImplementationCommitments,
} from "../api";

import "./initiative-implementation-commitment-stage-workspace.css";

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

/**
 * Initiative Lifecycle — Part I, Section 6. The one place a proposed
 * Participant's own voluntary Accept/Decline choice happens — never on
 * the Public Result (guests must never see or trigger it) and never
 * performed on their behalf by the Initiative's Author.
 */
export function InitiativeImplementationCommitmentProposalInbox({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [commitments, setCommitments] = useState<InitiativeImplementationCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pendingCommitmentId, setPendingCommitmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProposed = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const result = await listMyProposedInitiativeImplementationCommitments();
      setCommitments(result.filter((commitment) => commitment.initiativeId === initiativeId));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadProposed();
  }, [loadProposed]);

  async function handleAccept(commitmentId: string) {
    setError(null);
    setPendingCommitmentId(commitmentId);
    try {
      await acceptInitiativeImplementationCommitment(commitmentId);
      await loadProposed();
    } catch (err) {
      setError(
        t("author.commitment.inbox.acceptFailed", {
          detail: detailFromError(err, t("author.commitment.inbox.unknownError")),
        }),
      );
    } finally {
      setPendingCommitmentId(null);
    }
  }

  async function handleDecline(commitmentId: string) {
    setError(null);
    setPendingCommitmentId(commitmentId);
    try {
      await declineInitiativeImplementationCommitment(commitmentId);
      await loadProposed();
    } catch (err) {
      setError(
        t("author.commitment.inbox.declineFailed", {
          detail: detailFromError(err, t("author.commitment.inbox.unknownError")),
        }),
      );
    } finally {
      setPendingCommitmentId(null);
    }
  }

  if (loading) {
    return <p className="lsw-sidebar__loading">{t("author.commitment.inbox.loading")}</p>;
  }

  if (loadFailed) {
    return <p className="lsw-sidebar__error">{t("author.commitment.inbox.loadFailed")}</p>;
  }

  const proposed = commitments.filter((commitment) => commitment.proposalStatus === "proposed");
  const accepted = commitments.filter((commitment) => commitment.proposalStatus === "accepted");

  if (proposed.length === 0 && accepted.length === 0) {
    return <p className="lsw-sidebar__placeholder">{t("author.commitment.inbox.empty")}</p>;
  }

  return (
    <div className="iic-proposal-inbox">
      {error ? <p className="lsw-sidebar__error">{error}</p> : null}
      {proposed.map((commitment) => (
        <div className="iic-proposal-inbox__item" key={commitment.commitmentId}>
          <strong>{commitment.commitmentTitle}</strong>
          <p>{commitment.commitmentSummary}</p>
          <div className="iic-proposal-inbox__actions">
            <WorkspaceButton
              variant="primary"
              onClick={() => void handleAccept(commitment.commitmentId)}
              disabled={pendingCommitmentId === commitment.commitmentId}
            >
              {t("author.commitment.inbox.accept")}
            </WorkspaceButton>
            <WorkspaceButton
              variant="secondary"
              onClick={() => void handleDecline(commitment.commitmentId)}
              disabled={pendingCommitmentId === commitment.commitmentId}
            >
              {t("author.commitment.inbox.decline")}
            </WorkspaceButton>
          </div>
        </div>
      ))}
      {accepted.map((commitment) => (
        <div className="iic-proposal-inbox__item" key={commitment.commitmentId}>
          <strong>{commitment.commitmentTitle}</strong>
          <p className="iic-public__commitment-status">{t("author.commitment.inbox.accepted")}</p>
        </div>
      ))}
    </div>
  );
}
