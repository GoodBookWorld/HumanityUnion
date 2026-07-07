"use client";

import type { Initiative, InitiativeImprovementProposal } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { BOOTSTRAP_PARTICIPANT_ID } from "../../petition/petition-utils";
import { decideImprovementProposal, listSubmittedImprovementProposalsForSteward } from "../api";
import {
  WorkspaceEmptyState,
  WorkspaceMetricsRow,
  WorkspaceSectionShell,
  WorkspaceStatusCard,
} from "../../initiative-workspace-ux";

import "./initiative-improvement-proposal-steward-panel.css";

interface InitiativeImprovementProposalStewardPanelProps {
  initiative: Initiative;
}

function isSteward(initiative: Initiative): boolean {
  return initiative.stewardId === BOOTSTRAP_PARTICIPANT_ID;
}

export function InitiativeImprovementProposalStewardPanel({
  initiative,
}: InitiativeImprovementProposalStewardPanelProps) {
  const [proposals, setProposals] = useState<InitiativeImprovementProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    if (!isSteward(initiative)) {
      setProposals([]);
      return;
    }

    setLoading(true);

    try {
      const items = await listSubmittedImprovementProposalsForSteward(initiative.initiativeId);
      setProposals(items);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [initiative]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  async function handleDecide(
    proposalId: string,
    decision: "accepted" | "partially_accepted" | "declined",
  ) {
    const decisionNote = notes[proposalId]?.trim();

    if (!decisionNote) {
      setMessage("Decision note is required.");
      return;
    }

    setDecidingId(proposalId);
    setMessage(null);

    try {
      await decideImprovementProposal(proposalId, { decision, decisionNote });
      setProposals((current) => current.filter((proposal) => proposal.proposalId !== proposalId));
      setMessage(`Proposal ${decision.replace("_", " ")}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Decision failed: ${detail}`);
    } finally {
      setDecidingId(null);
    }
  }

  if (!isSteward(initiative)) {
    return null;
  }

  return (
    <WorkspaceSectionShell
      purpose="As initiative steward, record your decision on submitted improvement proposals. Accepting a proposal records your decision only; it does not edit the initiative."
      loading={loading ? "Loading improvement proposals..." : null}
      metrics={
        <WorkspaceMetricsRow>
          <WorkspaceStatusCard label="Awaiting decision" value={proposals.length} />
        </WorkspaceMetricsRow>
      }
      emptyState={
        !loading && proposals.length === 0 ? (
          <WorkspaceEmptyState
            title="No improvement proposals are awaiting decision"
            explanation="Submitted proposals appear here for steward review."
            nextStep="Continue collaborative analysis and submit proposals for review."
          />
        ) : null
      }
    >
      <div className="initiative-improvement-proposal-steward-panel">
        {proposals.map((proposal) => (
          <div
            key={proposal.proposalId}
            className="initiative-improvement-proposal-steward-panel__item"
          >
            <strong>{proposal.targetSection}</strong>
            <p>{proposal.proposedChange}</p>
            <p>{proposal.rationale}</p>

            <div className="initiative-improvement-proposal-steward-panel__field">
              <label htmlFor={`decision-note-${proposal.proposalId}`}>Decision note</label>
              <textarea
                id={`decision-note-${proposal.proposalId}`}
                value={notes[proposal.proposalId] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [proposal.proposalId]: event.target.value,
                  }))
                }
              />
            </div>

            <div className="initiative-improvement-proposal-steward-panel__actions">
              <button
                type="button"
                disabled={decidingId === proposal.proposalId}
                onClick={() => void handleDecide(proposal.proposalId, "accepted")}
              >
                Accept
              </button>
              <button
                type="button"
                data-variant="secondary"
                disabled={decidingId === proposal.proposalId}
                onClick={() => void handleDecide(proposal.proposalId, "partially_accepted")}
              >
                Partially Accept
              </button>
              <button
                type="button"
                data-variant="secondary"
                disabled={decidingId === proposal.proposalId}
                onClick={() => void handleDecide(proposal.proposalId, "declined")}
              >
                Decline
              </button>
            </div>
          </div>
        ))}

        {message ? (
          <p className="initiative-improvement-proposal-steward-panel__note">{message}</p>
        ) : null}
      </div>
    </WorkspaceSectionShell>
  );
}
