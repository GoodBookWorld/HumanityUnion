"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeRevisionDraft, InitiativeRevisionDraftContext } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { resolveProposalCurationDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
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
  /**
   * When true, this editor is hosted inside Improvement Proposals Author stage.
   * Commit creates the progress version but does not complete the proposal stage.
   */
  readonly embeddedInProposals?: boolean;
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
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
  embeddedInProposals = false,
}: InitiativeRevisionEditorProps) {
  const t = useTranslations("initiativeExperience");
  const actions = useAuthorActionLabels();
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
      setMessage({ tone: "success", text: t("author.revision.messages.draftEnriched") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.revision.messages.generateFailed", {
          detail: detailFromError(error, t("author.revision.messages.unknownError")),
        }),
      });
    }
  }

  async function handleSave(): Promise<boolean> {
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
      setMessage({ tone: "success", text: t("author.revision.messages.draftSaved") });
      return true;
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.revision.messages.saveFailed", {
          detail: detailFromError(error, t("author.revision.messages.unknownError")),
        }),
      });
      return false;
    }
  }

  function unresolvedPublishRequirements(): string[] {
    const missing: string[] = [];
    if (!title.trim()) missing.push(t("author.revision.requiredFieldNames.title"));
    if (!description.trim()) missing.push(t("author.revision.requiredFieldNames.description"));
    if (!activityArea.trim()) missing.push(t("author.revision.requiredFieldNames.activityArea"));
    if (!revisionSummary.trim()) missing.push(t("author.revision.requiredFieldNames.revisionSummary"));
    return missing;
  }

  async function handlePublish() {
    const missing = unresolvedPublishRequirements();
    if (missing.length > 0) {
      setMessage({
        tone: "error",
        text: t("author.revision.commitBlocked", { fields: missing.join("; ") }),
      });
      return;
    }

    const confirmMessage = embeddedInProposals
      ? t("author.revision.confirm.commitEmbedded")
      : t("author.revision.confirm.publishStandalone");

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setMessage(null);

    try {
      const saved = await handleSave();
      if (!saved) {
        return;
      }

      await publishPhase.runSave(() => publishInitiativeRevision(initiativeId));
      setMessage({
        tone: "success",
        text: embeddedInProposals
          ? t("author.revision.messages.committedEmbedded")
          : t("author.revision.messages.publishedStandalone"),
      });
      onPublished();
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.revision.messages.commitFailed", {
          detail: detailFromError(error, t("author.revision.messages.unknownError")),
        }),
      });
    }
  }

  return (
    <div className="irv-editor" aria-labelledby="irv-editor-title">
      <div className="irv-editor__header">
        <h3 id="irv-editor-title">
          {embeddedInProposals
            ? t("author.revision.embeddedEditorTitle", { version: context.currentVersion || 1 })
            : t("author.revision.editorTitle", { version: context.currentVersion || 1 })}
        </h3>
      </div>

      <div className="irv-editor__header-actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {resolveSaveButtonLabel(
            generatePhase.phase,
            t("author.revision.generateSuggestedChanges"),
            actions.phaseLabels,
          )}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>{actions.preview}</WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton
          variant="primary"
          disabled={isBusy || unresolvedPublishRequirements().length > 0}
          onClick={() => void handlePublish()}
        >
          {resolveSaveButtonLabel(
            publishPhase.phase,
            embeddedInProposals
              ? t("author.revision.commitVersion")
              : t("author.revision.publishRevision"),
            actions.phaseLabels,
          )}
        </WorkspaceButton>
      </div>

      {unresolvedPublishRequirements().length > 0 ? (
        <p className="irv-editor__message" data-tone="error" role="status">
          {t("author.revision.requiredBeforeCommit", {
            fields: unresolvedPublishRequirements().join("; "),
          })}
        </p>
      ) : null}

      {message ? (
        <p className="irv-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="irv-editor__section">
        <h4>{t("author.revision.acceptedProposalsTitle")}</h4>
        {context.eligibleProposals.length === 0 ? (
          <p className="irv-source-panel__empty">{t("author.revision.noImplementableProposals")}</p>
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
                    {resolveProposalCurationDisplayLabel(proposal.status, t)} · {proposal.proposedChange}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="irv-editor__section">
        <h4>{t("author.revision.initiativeFieldsTitle")}</h4>
        <div className="irv-editor__field">
          <label htmlFor="irv-title">{t("author.revision.fields.title")}</label>
          <input id="irv-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="irv-editor__field">
          <label htmlFor="irv-description">{t("author.revision.fields.description")}</label>
          <textarea
            id="irv-description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="irv-editor__field">
          <label htmlFor="irv-community">{t("author.revision.fields.community")}</label>
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
          <label htmlFor="irv-activity">{t("author.revision.fields.activityArea")}</label>
          <input
            id="irv-activity"
            value={activityArea}
            onChange={(event) => setActivityArea(event.target.value)}
          />
        </div>
        <div className="irv-editor__field">
          <label htmlFor="irv-summary">
            {t("author.revision.fields.revisionSummary")}
          </label>
          <textarea
            id="irv-summary"
            rows={3}
            value={revisionSummary}
            required
            aria-required="true"
            onChange={(event) => setRevisionSummary(event.target.value)}
          />
        </div>
      </div>

      <div className="irv-editor__section">
        <h4>{t("author.revision.structuredChangesTitle")}</h4>
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
            {t("author.revision.noStructuredChanges")}
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
