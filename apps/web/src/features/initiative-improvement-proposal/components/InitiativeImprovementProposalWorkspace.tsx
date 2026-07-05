"use client";

import type { InitiativeCollaborativeAnalysis, InitiativeImprovementProposal } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { createImprovementProposalDraft, listMyImprovementProposalsForAnalysis } from "../api";

import { InitiativeImprovementProposalEditor } from "./InitiativeImprovementProposalEditor";

import "./initiative-improvement-proposal-workspace.css";

interface InitiativeImprovementProposalWorkspaceProps {
  analysis: InitiativeCollaborativeAnalysis;
}

export function InitiativeImprovementProposalWorkspace({
  analysis,
}: InitiativeImprovementProposalWorkspaceProps) {
  const [proposals, setProposals] = useState<InitiativeImprovementProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    setLoading(true);

    try {
      const items = await listMyImprovementProposalsForAnalysis(analysis.analysisId);
      setProposals(items);
      setSelectedId((current) => {
        if (current && items.some((item) => item.proposalId === current)) {
          return current;
        }

        return items[0]?.proposalId ?? null;
      });
    } catch {
      setProposals([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [analysis.analysisId]);

  useEffect(() => {
    if (analysis.status === "published") {
      void loadProposals();
    } else {
      setProposals([]);
      setSelectedId(null);
    }
  }, [analysis, loadProposals]);

  const selectedProposal = proposals.find((proposal) => proposal.proposalId === selectedId) ?? null;

  async function handleCreateDraft() {
    setCreating(true);
    setMessage(null);

    try {
      const created = await createImprovementProposalDraft({
        analysisId: analysis.analysisId,
        targetSection: "Initiative description",
        currentIssue: "Issue pending.",
        proposedChange: "Proposed change pending.",
        rationale: "Rationale pending.",
        expectedImprovement: "Expected improvement pending.",
        references: "References pending.",
      });

      setProposals((current) => [created, ...current]);
      setSelectedId(created.proposalId);
      setMessage("Proposal draft created.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Create failed: ${detail}`);
    } finally {
      setCreating(false);
    }
  }

  function handleUpdated(proposal: InitiativeImprovementProposal) {
    setProposals((current) =>
      current.map((item) => (item.proposalId === proposal.proposalId ? proposal : item)),
    );
  }

  if (analysis.status !== "published") {
    return (
      <p className="initiative-improvement-proposal-workspace__note">
        Improvement proposals can be created from published analyses only.
      </p>
    );
  }

  return (
    <div className="initiative-improvement-proposal-workspace">
      <h4 className="initiative-improvement-proposal-workspace__heading">Improvement Proposals</h4>
      <p className="initiative-improvement-proposal-workspace__note">
        Proposals suggest changes. The initiative steward decides whether to accept them.
      </p>

      <button
        type="button"
        className="initiative-improvement-proposal-workspace__create"
        disabled={creating}
        onClick={() => void handleCreateDraft()}
      >
        {creating ? "Creating..." : "Create Proposal Draft"}
      </button>

      {loading ? (
        <p className="initiative-improvement-proposal-workspace__empty">Loading proposals...</p>
      ) : null}

      {!loading && proposals.length === 0 ? (
        <p className="initiative-improvement-proposal-workspace__empty">
          No improvement proposals for this analysis yet.
        </p>
      ) : null}

      {proposals.length > 0 ? (
        <div className="initiative-improvement-proposal-workspace__list">
          {proposals.map((proposal) => (
            <div
              key={proposal.proposalId}
              className="initiative-improvement-proposal-workspace__item"
            >
              <strong>{proposal.targetSection}</strong>
              <span>Status: {proposal.status}</span>
              <button
                type="button"
                data-selected={selectedId === proposal.proposalId ? "true" : "false"}
                onClick={() => setSelectedId(proposal.proposalId)}
              >
                {selectedId === proposal.proposalId ? "Selected" : "Open"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {selectedProposal ? (
        <InitiativeImprovementProposalEditor
          proposal={selectedProposal}
          onUpdated={handleUpdated}
        />
      ) : null}

      {message ? (
        <p className="initiative-improvement-proposal-workspace__note">{message}</p>
      ) : null}
    </div>
  );
}
