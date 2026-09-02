"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeImprovementProposalsCollectionStatus,
  InitiativeStructuredProposal,
  InitiativeStructuredProposalStatus,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { resolveProposalCurationDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceStatusBadge } from "../../initiative-workspace-ux";
import {
  saveInitiativeStructuredProposal,
  setInitiativeStructuredProposalStatus,
  type SaveInitiativeStructuredProposalInput,
} from "../api";

interface ProposalFormState {
  title: string;
  summary: string;
  description: string;
  reason: string;
  expectedImprovement: string;
  supportingSources: string;
  relatedDiscussionReferences: string;
}

function buildFormState(proposal: InitiativeStructuredProposal): ProposalFormState {
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

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

const PRE_PUBLICATION_STATUS_OPTIONS: readonly InitiativeStructuredProposalStatus[] = [
  "draft",
  "ready",
  "included_in_revision",
  "keep_for_later",
  "not_applicable",
];
const POST_PUBLICATION_STATUS_OPTIONS: readonly InitiativeStructuredProposalStatus[] = [
  "included_in_revision",
  "keep_for_later",
  "not_applicable",
];

interface InitiativeStructuredProposalCardProps {
  readonly collectionId: string;
  readonly collectionStatus: InitiativeImprovementProposalsCollectionStatus;
  readonly proposal: InitiativeStructuredProposal;
  readonly onUpdated: (proposal: InitiativeStructuredProposal) => void;
}

/**
 * Initiative Lifecycle — Part D, Section 6 (Proposal Editor).
 *
 * One editable card per `InitiativeStructuredProposal`. Content fields
 * (Title/Summary/Description/Reason/Expected Improvement/Supporting
 * Sources/Related Discussion References) are only editable while the
 * parent collection is still `"draft"` — once published, the server
 * rejects content edits (`assertDraftStatus`), so this card switches to a
 * read-only body and exposes ONLY the three Author-decision curation
 * statuses (Part 7: "the last three are Author decisions").
 */
export function InitiativeStructuredProposalCard({
  collectionId,
  collectionStatus,
  proposal,
  onUpdated,
}: InitiativeStructuredProposalCardProps) {
  const t = useTranslations("initiativeExperience");
  const actions = useAuthorActionLabels();
  const [form, setForm] = useState<ProposalFormState>(() => buildFormState(proposal));
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const savePhase = useSaveButtonPhase();
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    setForm(buildFormState(proposal));
  }, [proposal]);

  const isDraftCollection = collectionStatus === "draft";
  const statusOptions = isDraftCollection
    ? PRE_PUBLICATION_STATUS_OPTIONS
    : POST_PUBLICATION_STATUS_OPTIONS;
  const canChangeStatus =
    isDraftCollection ||
    proposal.status === "published" ||
    proposal.status === "ready" ||
    POST_PUBLICATION_STATUS_OPTIONS.includes(proposal.status);

  async function handleSave() {
    setMessage(null);

    const input: SaveInitiativeStructuredProposalInput = { ...form };

    try {
      const updated = await savePhase.runSave(() =>
        saveInitiativeStructuredProposal(collectionId, proposal.proposalId, input),
      );
      const savedProposal = updated.proposals.find((entry) => entry.proposalId === proposal.proposalId);

      if (savedProposal) {
        onUpdated(savedProposal);
      }

      setMessage({ tone: "success", text: t("author.proposal.messages.proposalSaved") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.proposal.messages.saveFailed", {
          detail: detailFromError(error, t("author.proposal.messages.unknownError")),
        }),
      });
    }
  }

  async function handleStatusChange(nextStatus: InitiativeStructuredProposalStatus) {
    setStatusBusy(true);
    setMessage(null);

    try {
      const updated = await setInitiativeStructuredProposalStatus(collectionId, proposal.proposalId, nextStatus);
      const savedProposal = updated.proposals.find((entry) => entry.proposalId === proposal.proposalId);

      if (savedProposal) {
        onUpdated(savedProposal);
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.proposal.messages.statusFailed", {
          detail: detailFromError(error, t("author.proposal.messages.unknownError")),
        }),
      });
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <article className="iip-proposal-card" aria-labelledby={`iip-proposal-title-${proposal.proposalId}`}>
      <div className="iip-proposal-card__header">
        <h4 id={`iip-proposal-title-${proposal.proposalId}`}>
          {form.title || t("author.proposal.untitledProposal")}
        </h4>
        <WorkspaceStatusBadge
          status={proposal.status}
          label={resolveProposalCurationDisplayLabel(proposal.status, t)}
        />
      </div>

      {proposal.originalAuthorDisplayNames.length > 0 ? (
        <p className="iip-proposal-card__meta">
          {t("author.proposal.originalAuthors", {
            names: proposal.originalAuthorDisplayNames.join(", "),
          })}
        </p>
      ) : (
        <p className="iip-proposal-card__meta">{t("author.proposal.authorOriginatedMeta")}</p>
      )}

      {isDraftCollection ? (
        <>
          <div className="iip-proposal-card__field">
            <label htmlFor={`iip-title-${proposal.proposalId}`}>
              {t("author.proposal.fields.title")}
            </label>
            <input
              id={`iip-title-${proposal.proposalId}`}
              value={form.title}
              disabled={savePhase.isBusy}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor={`iip-summary-${proposal.proposalId}`}>
              {t("author.proposal.fields.summary")}
            </label>
            <textarea
              id={`iip-summary-${proposal.proposalId}`}
              value={form.summary}
              disabled={savePhase.isBusy}
              onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor={`iip-description-${proposal.proposalId}`}>
              {t("author.proposal.fields.description")}
            </label>
            <textarea
              id={`iip-description-${proposal.proposalId}`}
              value={form.description}
              disabled={savePhase.isBusy}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor={`iip-reason-${proposal.proposalId}`}>
              {t("author.proposal.fields.reason")}
            </label>
            <textarea
              id={`iip-reason-${proposal.proposalId}`}
              value={form.reason}
              disabled={savePhase.isBusy}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor={`iip-expected-${proposal.proposalId}`}>
              {t("author.proposal.fields.expectedImprovement")}
            </label>
            <textarea
              id={`iip-expected-${proposal.proposalId}`}
              value={form.expectedImprovement}
              disabled={savePhase.isBusy}
              onChange={(event) =>
                setForm((current) => ({ ...current, expectedImprovement: event.target.value }))
              }
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor={`iip-sources-${proposal.proposalId}`}>
              {t("author.proposal.fields.supportingSources")}
            </label>
            <textarea
              id={`iip-sources-${proposal.proposalId}`}
              value={form.supportingSources}
              disabled={savePhase.isBusy}
              onChange={(event) =>
                setForm((current) => ({ ...current, supportingSources: event.target.value }))
              }
            />
          </div>
          <div className="iip-proposal-card__field">
            <label htmlFor={`iip-references-${proposal.proposalId}`}>
              {t("author.proposal.fields.relatedDiscussionReferences")}
            </label>
            <textarea
              id={`iip-references-${proposal.proposalId}`}
              value={form.relatedDiscussionReferences}
              disabled={savePhase.isBusy}
              onChange={(event) =>
                setForm((current) => ({ ...current, relatedDiscussionReferences: event.target.value }))
              }
            />
          </div>
        </>
      ) : (
        <>
          <div className="iip-proposal-card__field">
            <label>{t("author.proposal.fields.summary")}</label>
            <p>{form.summary}</p>
          </div>
          <div className="iip-proposal-card__field">
            <label>{t("author.proposal.fields.description")}</label>
            <p>{form.description}</p>
          </div>
        </>
      )}

      <div className="iip-proposal-card__actions">
        {isDraftCollection ? (
          <WorkspaceButton variant="secondary" disabled={savePhase.isBusy} onClick={() => void handleSave()}>
            {resolveSaveButtonLabel(
              savePhase.phase,
              t("author.proposal.saveProposal"),
              actions.phaseLabels,
            )}
          </WorkspaceButton>
        ) : null}

        {canChangeStatus ? (
          <label className="iip-proposal-card__field">
            <span>{t("author.proposal.statusLabel")}</span>
            <select
              value={statusOptions.includes(proposal.status) ? proposal.status : statusOptions[0]}
              disabled={statusBusy}
              onChange={(event) =>
                void handleStatusChange(event.target.value as InitiativeStructuredProposalStatus)
              }
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {resolveProposalCurationDisplayLabel(option, t)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {message ? (
        <p className="iip-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}
    </article>
  );
}
