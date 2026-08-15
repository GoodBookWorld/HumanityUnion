"use client";

import { useState } from "react";

import type { InitiativeImprovementProposalsCollection, InitiativeStructuredProposal } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceStatusBadge } from "../../initiative-workspace-ux";
import {
  addManualInitiativeStructuredProposal,
  generateImprovementProposalsDraft,
  publishImprovementProposalsCollection,
  type CreateManualInitiativeStructuredProposalInput,
} from "../api";
import { InitiativeStructuredProposalCard } from "./InitiativeStructuredProposalCard";

interface ManualProposalFormState {
  title: string;
  summary: string;
  description: string;
  reason: string;
  expectedImprovement: string;
}

const EMPTY_MANUAL_FORM: ManualProposalFormState = {
  title: "",
  summary: "",
  description: "",
  reason: "",
  expectedImprovement: "",
};

interface InitiativeImprovementProposalsEditorProps {
  readonly initiativeId: string;
  readonly collection: InitiativeImprovementProposalsCollection;
  readonly onUpdated: (collection: InitiativeImprovementProposalsCollection) => void;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part D, Section 5/6 (Author Workspace / Proposal
 * Editor).
 *
 * The Author's editable list of `InitiativeStructuredProposal` records
 * inside one collection. Unlike Collaborative Analysis's single-document
 * form, Section 6 explicitly produces MANY structured proposals per
 * publication, so this renders one `InitiativeStructuredProposalCard` per
 * proposal plus collection-level actions: Generate (enrich with newly
 * detected groups), Add Manual Proposal (Author-originated, no Discussion
 * source), Preview, and Publish (bulk-publishes every `"ready"` proposal).
 */
export function InitiativeImprovementProposalsEditor({
  initiativeId,
  collection,
  onUpdated,
  onTogglePreview,
}: InitiativeImprovementProposalsEditorProps) {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<ManualProposalFormState>(EMPTY_MANUAL_FORM);
  const generatePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();
  const addPhase = useSaveButtonPhase();

  const isDraft = collection.status === "draft";
  const readyCount = collection.proposals.filter((proposal) => proposal.status === "ready").length;
  const isBusy = generatePhase.isBusy || publishPhase.isBusy || addPhase.isBusy;

  function handleProposalUpdated(updatedProposal: InitiativeStructuredProposal) {
    onUpdated({
      ...collection,
      proposals: collection.proposals.map((proposal) =>
        proposal.proposalId === updatedProposal.proposalId ? updatedProposal : proposal,
      ),
    });
  }

  async function handleGenerate() {
    setMessage(null);

    try {
      const updated = await generatePhase.runSave(() => generateImprovementProposalsDraft(initiativeId));
      onUpdated(updated);
      setMessage({ tone: "success", text: "Draft enriched with any newly detected proposal groups." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Generate failed: ${detail}` });
    }
  }

  async function handleAddManualProposal() {
    setMessage(null);

    const input: CreateManualInitiativeStructuredProposalInput = { ...manualForm };

    try {
      const updated = await addPhase.runSave(() =>
        addManualInitiativeStructuredProposal(collection.collectionId, input),
      );
      onUpdated(updated);
      setManualForm(EMPTY_MANUAL_FORM);
      setShowManualForm(false);
      setMessage({ tone: "success", text: "Proposal added." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Add proposal failed: ${detail}` });
    }
  }

  async function handlePublish() {
    if (
      !window.confirm(
        `Publishing makes every "Ready" proposal (${readyCount}) visible to the public and notifies every Active Ally. Continue?`,
      )
    ) {
      return;
    }

    setMessage(null);

    try {
      const updated = await publishPhase.runSave(() =>
        publishImprovementProposalsCollection(collection.collectionId),
      );
      onUpdated(updated);
      setMessage({ tone: "success", text: "Improvement Proposals published. Active Allies have been notified." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Publish failed: ${detail}` });
    }
  }

  return (
    <div className="iip-editor" aria-labelledby="iip-editor-title">
      <div className="iip-editor__header">
        <h3 id="iip-editor-title">Improvement Proposals</h3>
        <WorkspaceStatusBadge status={collection.status} />
      </div>

      {!isDraft ? (
        <p>
          This collection has been published and can no longer be edited. Generate a new draft to prepare an
          updated round of proposals.
        </p>
      ) : null}

      <div className="iip-editor__header-actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {resolveSaveButtonLabel(generatePhase.phase, "Generate Draft")}
        </WorkspaceButton>
        {isDraft ? (
          <WorkspaceButton
            variant="secondary"
            disabled={isBusy}
            onClick={() => setShowManualForm((current) => !current)}
          >
            {showManualForm ? "Cancel" : "Add Manual Proposal"}
          </WorkspaceButton>
        ) : null}
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>
          Preview
        </WorkspaceButton>
        {isDraft ? (
          <WorkspaceButton
            variant="primary"
            disabled={isBusy || readyCount === 0}
            onClick={() => void handlePublish()}
          >
            {resolveSaveButtonLabel(publishPhase.phase, `Publish (${readyCount} Ready)`)}
          </WorkspaceButton>
        ) : null}
      </div>

      {showManualForm ? (
        <form
          className="iip-proposal-card"
          aria-label="Add manual proposal"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAddManualProposal();
          }}
        >
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-title">Title</label>
            <input
              id="iip-manual-title"
              required
              value={manualForm.title}
              onChange={(event) => setManualForm((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-summary">Summary</label>
            <textarea
              id="iip-manual-summary"
              required
              value={manualForm.summary}
              onChange={(event) => setManualForm((current) => ({ ...current, summary: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-description">Description</label>
            <textarea
              id="iip-manual-description"
              required
              value={manualForm.description}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-reason">Reason</label>
            <textarea
              id="iip-manual-reason"
              required
              value={manualForm.reason}
              onChange={(event) => setManualForm((current) => ({ ...current, reason: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-expected">Expected Improvement</label>
            <textarea
              id="iip-manual-expected"
              required
              value={manualForm.expectedImprovement}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, expectedImprovement: event.target.value }))
              }
            />
          </div>
          <div className="iip-proposal-card__actions">
            <WorkspaceButton type="submit" variant="primary" disabled={addPhase.isBusy}>
              {resolveSaveButtonLabel(addPhase.phase, "Add Proposal")}
            </WorkspaceButton>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="iip-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      {collection.proposals.length > 0 ? (
        <div className="iip-proposal-list">
          {collection.proposals.map((proposal) => (
            <InitiativeStructuredProposalCard
              key={proposal.proposalId}
              collectionId={collection.collectionId}
              collectionStatus={collection.status}
              proposal={proposal}
              onUpdated={handleProposalUpdated}
            />
          ))}
        </div>
      ) : (
        <p className="iip-editor__empty">
          No proposals yet. Use Generate Draft to build proposals from Discussion, or Add Manual Proposal.
        </p>
      )}
    </div>
  );
}
