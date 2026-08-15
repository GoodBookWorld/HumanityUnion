"use client";

import { useEffect, useState } from "react";

import type { PublicInitiativeImplementationCommitmentListItem } from "@hu/types";

import { listPublicInitiativeImplementationCommitments } from "../../initiative-implementation-commitment/api";

import "./initiative-implementation-commitment-stage-workspace.css";

function formatProposalStatus(
  status: PublicInitiativeImplementationCommitmentListItem["proposalStatus"],
): string {
  switch (status) {
    case "unassigned":
      return "Unassigned";
    case "proposed":
      return "Proposed";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    default:
      return "";
  }
}

interface InitiativeImplementationCommitmentPublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part I, Section 6. Read-only for every viewer —
 * a proposed Participant's own Accept/Decline choice happens in their
 * own working sidebar's Proposal Inbox, never here.
 */
export function InitiativeImplementationCommitmentPublicResult({
  initiativeId,
  isPreview = false,
}: InitiativeImplementationCommitmentPublicResultProps) {
  const [commitments, setCommitments] = useState<
    readonly PublicInitiativeImplementationCommitmentListItem[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listPublicInitiativeImplementationCommitments(initiativeId);
        if (!cancelled) {
          setCommitments(result.commitments);
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
  }, [initiativeId]);

  if (error) {
    return <p className="iic-source-panel__empty">{error}</p>;
  }

  if (!commitments) {
    return <p className="iic-source-panel__empty">Loading published Implementation Commitments…</p>;
  }

  if (commitments.length === 0) {
    return <p className="iic-source-panel__empty">No Implementation Commitments published yet.</p>;
  }

  return (
    <article className="iic-public" aria-label="Published Implementation Commitments">
      {isPreview ? (
        <p className="iic-public__meta">Author Preview of published Implementation Commitments</p>
      ) : null}
      <section className="iic-public__section">
        <h3>Implementation Commitments</h3>
        <p className="iic-public__meta">{commitments.length} Commitment(s) published</p>
      </section>

      {commitments.map((commitment) => (
        <div className="iic-public__commitment" key={commitment.commitmentId}>
          <h3>{commitment.approvedAction ?? commitment.title}</h3>
          <p>{commitment.summary}</p>
          <p className="iic-public__meta">
            {commitment.authorDisplayName}
            {commitment.priority ? ` · Priority ${commitment.priority}` : ""}
          </p>
          {commitment.proposalStatus ? (
            <span className="iic-public__commitment-status">
              {formatProposalStatus(commitment.proposalStatus)}
            </span>
          ) : null}
        </div>
      ))}
    </article>
  );
}
