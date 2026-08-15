"use client";

import { useState } from "react";

import type { InitiativeRevisionDraft, InitiativeRevisionDraftContext } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import { INITIATIVE_COMMUNITY_OPTIONS } from "../../initiatives/api";
import {
  generateInitiativeRevisionChanges,
  publishInitiativeRevision,
  saveInitiativeRevisionDraft,
} from "../api";
import { InitiativeRevisionAddChangeForm } from "./InitiativeRevisionAddChangeForm";
import { InitiativeRevisionChangeCard } from "./InitiativeRevisionChangeCard";

interface InitiativeRevisionEditorProps {
  readonly initiativeId: string;
  readonly context: InitiativeRevisionDraftContext;
  readonly draft: InitiativeRevisionDraft;
  readonly onDraftUpdated: (draft: InitiativeRevisionDraft) => void;
  readonly onPublished: () => void;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part E, Section 6 (Revision Workspace).
 *
 * The Author's editable working Revision draft: Generate (Intelligent
 * Revision Builder), the structured Before/After Change list (Section 7),
 * Author-originated Change form (Section 8), free-text title/description/
 * revision-summary fields carried over from the pre-Part-E workspace, and
 * Save Draft / Preview / Publish actions.
 */
export function InitiativeRevisionEditor({
  initiativeId,
  context,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
}: InitiativeRevisionEditorProps) {
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [communitySlug, setCommunitySlug] = useState(draft.metadata.communitySlug);
  const [activityArea, setActivityArea] = useState(draft.metadata.activityArea);
  const [revisionSummary, setRevisionSummary] = useState(draft.revisionSummary);
  const [appliedProposalIds, setAppliedProposalIds] = useState<string[]>(draft.appliedProposalIds);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();
  const isBusy = generatePhase.isBusy || savePhase.isBusy || publishPhase.isBusy;

  function toggleProposal(proposalId: string) {
    setAppliedProposalIds((current) =>
      current.includes(proposalId) ? current.filter((id) => id !== proposalId) : [...current, proposalId],
    );
  }

  async function handleGenerate() {
    setMessage(null);

    try {
      const updated = await generatePhase.runSave(() => generateInitiativeRevisionChanges(initiativeId));
      onDraftUpdated(updated);
      setMessage({ tone: "success", text: "Draft enriched with suggested changes from included Proposals." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Generate failed: ${detail}` });
    }
  }

  async function handleSave() {
    setMessage(null);

    try {
      const updated = await savePhase.runSave(() =>
        saveInitiativeRevisionDraft(initiativeId, {
          title,
          description,
          communitySlug,
          activityArea,
          revisionSummary,
          appliedProposalIds,
          skippedProposalIds: context.eligibleProposals
            .map((proposal) => proposal.proposalId)
            .filter((proposalId) => !appliedProposalIds.includes(proposalId)),
        }),
      );
      onDraftUpdated(updated);
      setMessage({ tone: "success", text: "Revision draft saved." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Save failed: ${detail}` });
    }
  }

  async function handlePublish() {
    if (
      !window.confirm(
        "Publishing creates a new Initiative version, notifies every Active Ally, and unlocks the Petition stage. Continue?",
      )
    ) {
      return;
    }

    setMessage(null);

    try {
      await handleSave();
      await publishPhase.runSave(() => publishInitiativeRevision(initiativeId));
      setMessage({ tone: "success", text: "Revision published. Active Allies have been notified." });
      onPublished();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Publish failed: ${detail}` });
    }
  }

  return (
    <div className="irv-editor" aria-labelledby="irv-editor-title">
      <div className="irv-editor__header">
        <h3 id="irv-editor-title">Revision Draft — current version {context.currentVersion || 1}</h3>
      </div>

      <div className="irv-editor__header-actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {resolveSaveButtonLabel(generatePhase.phase, "Generate Suggested Changes")}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>
          Preview
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleSave()}>
          {resolveSaveButtonLabel(savePhase.phase, "Save Draft")}
        </WorkspaceButton>
        <WorkspaceButton variant="primary" disabled={isBusy} onClick={() => void handlePublish()}>
          {resolveSaveButtonLabel(publishPhase.phase, "Publish Revision")}
        </WorkspaceButton>
      </div>

      {message ? (
        <p className="irv-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="irv-editor__section">
        <h4>Accepted and partially accepted proposals (legacy free-text)</h4>
        {context.eligibleProposals.length === 0 ? (
          <p className="irv-source-panel__empty">No implementable proposals are available.</p>
        ) : (
          <div className="irv-editor__proposal-list">
            {context.eligibleProposals.map((proposal) => (
              <label key={proposal.proposalId} className="irv-editor__proposal">
                <input
                  type="checkbox"
                  checked={appliedProposalIds.includes(proposal.proposalId)}
                  onChange={() => toggleProposal(proposal.proposalId)}
                />
                <span className="irv-editor__proposal-body">
                  <strong>{proposal.targetSection}</strong>
                  <span className="irv-editor__proposal-meta">
                    {proposal.status.replace("_", " ")} · {proposal.proposedChange}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="irv-editor__section">
        <h4>Initiative fields</h4>
        <div className="irv-editor__field">
          <label htmlFor="irv-title">Title</label>
          <input id="irv-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="irv-editor__field">
          <label htmlFor="irv-description">Description</label>
          <textarea
            id="irv-description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="irv-editor__field">
          <label htmlFor="irv-community">Community</label>
          <select
            id="irv-community"
            value={communitySlug}
            onChange={(event) => setCommunitySlug(event.target.value)}
          >
            {INITIATIVE_COMMUNITY_OPTIONS.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="irv-editor__field">
          <label htmlFor="irv-activity">Activity area</label>
          <input
            id="irv-activity"
            value={activityArea}
            onChange={(event) => setActivityArea(event.target.value)}
          />
        </div>
        <div className="irv-editor__field">
          <label htmlFor="irv-summary">Change Summary — what changed in this revision?</label>
          <textarea
            id="irv-summary"
            rows={3}
            value={revisionSummary}
            onChange={(event) => setRevisionSummary(event.target.value)}
          />
        </div>
      </div>

      <div className="irv-editor__section">
        <h4>Structured Changes (Before / After)</h4>
        {draft.changes.length > 0 ? (
          <div className="irv-change-list">
            {draft.changes.map((change) => (
              <InitiativeRevisionChangeCard
                key={change.changeId}
                initiativeId={initiativeId}
                change={change}
                onChanged={onDraftUpdated}
              />
            ))}
          </div>
        ) : (
          <p className="irv-source-panel__empty">
            No structured changes yet. Use Generate to build suggestions from included Proposals, or add an
            Author-originated change below.
          </p>
        )}

        <InitiativeRevisionAddChangeForm
          initiativeId={initiativeId}
          currentTitle={title}
          currentDescription={description}
          onChanged={onDraftUpdated}
        />
      </div>
    </div>
  );
}
