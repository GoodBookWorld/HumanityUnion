"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeImprovementProposalsCollection, InitiativeStructuredProposal } from "@hu/types";

import {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  applyLifecycleAiSuggestionsToFields,
  getLifecycleAiStageApplyContract,
  setLifecycleAiDraftExcerpt,
  type LifecycleAiApplySuggestionsDetail,
} from "../../lifecycle-ai-assistant";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { resolvePresentationStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceStatusBadge } from "../../initiative-workspace-ux";
import {
  addManualInitiativeStructuredProposal,
  completeImprovementProposalsWithVersionCommit,
  generateImprovementProposalsDraft,
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

interface ProposalApplyForm {
  title: string;
  summary: string;
  description: string;
  reason: string;
  expectedImprovement: string;
  supportingSources: string;
  relatedDiscussionReferences: string;
}

const EMPTY_MANUAL_FORM: ManualProposalFormState = {
  title: "",
  summary: "",
  description: "",
  reason: "",
  expectedImprovement: "",
};

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function toProposalApplyForm(proposal: InitiativeStructuredProposal): ProposalApplyForm {
  return {
    title: proposal.title,
    summary: proposal.summary,
    description: proposal.description,
    reason: proposal.reason,
    expectedImprovement: proposal.expectedImprovement,
    supportingSources: proposal.supportingSources,
    relatedDiscussionReferences: proposal.relatedDiscussionReferences,
  };
}

function findEditableProposal(
  proposals: readonly InitiativeStructuredProposal[],
): InitiativeStructuredProposal | undefined {
  return proposals.find((proposal) => proposal.status === "draft" || proposal.status === "ready");
}

interface InitiativeImprovementProposalsEditorProps {
  readonly initiativeId: string;
  readonly collection: InitiativeImprovementProposalsCollection;
  readonly onUpdated: (collection: InitiativeImprovementProposalsCollection) => void;
  readonly onTogglePreview: () => void;
  readonly onNavigate?: (stageId: string, hash: string) => void;
  readonly onCompleted?: () => void;
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
  onNavigate,
  onCompleted,
}: InitiativeImprovementProposalsEditorProps) {
  const t = useTranslations("initiativeExperience");
  const actions = useAuthorActionLabels();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<ManualProposalFormState>(EMPTY_MANUAL_FORM);
  const generatePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();
  const addPhase = useSaveButtonPhase();

  const isDraft = collection.status === "draft";
  const readyCount = collection.proposals.filter((proposal) => proposal.status === "ready").length;
  const treatedCount = collection.proposals.filter(
    (proposal) =>
      proposal.status === "included_in_revision" ||
      proposal.status === "keep_for_later" ||
      proposal.status === "not_applicable",
  ).length;
  const isBusy = generatePhase.isBusy || publishPhase.isBusy || addPhase.isBusy;
  const canComplete =
    collection.proposals.length === 0 || readyCount > 0 || treatedCount > 0;

  useEffect(() => {
    const firstProposal = collection.proposals[0];
    if (!firstProposal) {
      setLifecycleAiDraftExcerpt("proposal", "");
      return;
    }

    const form = toProposalApplyForm(firstProposal);
    const excerpt = Object.entries(form)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    setLifecycleAiDraftExcerpt("proposal", excerpt);
  }, [collection.proposals]);

  useEffect(() => {
    if (!isDraft) {
      return;
    }

    const contract = getLifecycleAiStageApplyContract("proposal");
    if (!contract) {
      return;
    }

    function handleApplySuggestions(event: Event) {
      const custom = event as CustomEvent<LifecycleAiApplySuggestionsDetail>;
      const detail = custom.detail;

      if (!detail || detail.initiativeId !== initiativeId || detail.stageId !== "proposal") {
        return;
      }

      const target = findEditableProposal(collection.proposals);
      if (!target) {
        return;
      }

      const current = toProposalApplyForm(target);
      const knownKeys = contract!.knownKeys.filter(
        (key): key is keyof ProposalApplyForm => key in current,
      );
      if (knownKeys.length === 0) {
        return;
      }

      const fallbackKey = (
        contract!.fallbackKey in current ? contract!.fallbackKey : knownKeys[0]!
      ) as keyof ProposalApplyForm;

      const result = applyLifecycleAiSuggestionsToFields({
        current,
        suggestions: detail.suggestions,
        knownKeys,
        fallbackKey,
        forbiddenKeys: contract!.forbiddenKeys,
      });

      if (!result.applied) {
        return;
      }

      const updatedProposal: InitiativeStructuredProposal = {
        ...target,
        ...result.next,
        updatedAt: new Date().toISOString(),
      };

      onUpdated({
        ...collection,
        proposals: collection.proposals.map((proposal) =>
          proposal.proposalId === updatedProposal.proposalId ? updatedProposal : proposal,
        ),
      });
      setMessage({
        tone: "success",
        text: t("author.proposal.messages.aiApplied"),
      });
    }

    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    return () => {
      window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    };
  }, [collection, initiativeId, isDraft, onUpdated, t]);

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
      setMessage({ tone: "success", text: t("author.proposal.messages.draftEnriched") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.proposal.messages.generateFailed", {
          detail: detailFromError(error, t("author.proposal.messages.unknownError")),
        }),
      });
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
      setMessage({ tone: "success", text: t("author.proposal.messages.proposalAdded") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.proposal.messages.addFailed", {
          detail: detailFromError(error, t("author.proposal.messages.unknownError")),
        }),
      });
    }
  }

  async function handlePublish() {
    if (
      !window.confirm(t("author.proposal.confirm.publishAndContinue"))
    ) {
      return;
    }

    setMessage(null);

    try {
      const result = await publishPhase.runSave(() =>
        completeImprovementProposalsWithVersionCommit(initiativeId),
      );
      onUpdated(result.collection);
      setMessage({
        tone: "success",
        text: t("author.proposal.messages.completed"),
      });
      onCompleted?.();
      onNavigate?.("petition", "petition");
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.proposal.messages.publishFailed", {
          detail: detailFromError(error, t("author.proposal.messages.unknownError")),
        }),
      });
    }
  }

  return (
    <div className="iip-editor" aria-labelledby="iip-editor-title">
      <div className="iip-editor__header">
        <h3 id="iip-editor-title">{t("author.proposal.heading")}</h3>
        <WorkspaceStatusBadge
          status={collection.status}
          label={resolvePresentationStatusDisplayLabel(collection.status, t)}
        />
      </div>

      {!isDraft ? (
        <p>{t("author.proposal.readonlyPublished")}</p>
      ) : null}

      <div className="iip-editor__header-actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {actions.saveLabel(generatePhase.phase, t("author.proposal.generateDraft"))}
        </WorkspaceButton>
        {isDraft ? (
          <WorkspaceButton
            variant="secondary"
            disabled={isBusy}
            onClick={() => setShowManualForm((current) => !current)}
          >
            {showManualForm
              ? t("author.proposal.cancel")
              : t("author.proposal.addManualProposal")}
          </WorkspaceButton>
        ) : null}
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>{actions.preview}</WorkspaceButton>
        {isDraft ? (
          <WorkspaceButton
            variant="primary"
            disabled={isBusy || !canComplete}
            onClick={() => void handlePublish()}
          >
            {resolveSaveButtonLabel(
              publishPhase.phase,
              t("author.proposal.publishAndContinue"),
              actions.phaseLabels,
            )}
          </WorkspaceButton>
        ) : null}
      </div>

      {showManualForm ? (
        <form
          className="iip-proposal-card"
          aria-label={t("author.proposal.manualFormAria")}
          onSubmit={(event) => {
            event.preventDefault();
            void handleAddManualProposal();
          }}
        >
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-title">{t("author.proposal.fields.title")}</label>
            <input
              id="iip-manual-title"
              required
              value={manualForm.title}
              onChange={(event) => setManualForm((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-summary">{t("author.proposal.fields.summary")}</label>
            <textarea
              id="iip-manual-summary"
              required
              value={manualForm.summary}
              onChange={(event) => setManualForm((current) => ({ ...current, summary: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-description">{t("author.proposal.fields.description")}</label>
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
            <label htmlFor="iip-manual-reason">{t("author.proposal.fields.reason")}</label>
            <textarea
              id="iip-manual-reason"
              required
              value={manualForm.reason}
              onChange={(event) => setManualForm((current) => ({ ...current, reason: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor="iip-manual-expected">
              {t("author.proposal.fields.expectedImprovement")}
            </label>
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
              {resolveSaveButtonLabel(
                addPhase.phase,
                t("author.proposal.addProposal"),
                actions.phaseLabels,
              )}
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
        <p className="iip-editor__empty">{t("author.proposal.emptyList")}</p>
      )}
    </div>
  );
}
