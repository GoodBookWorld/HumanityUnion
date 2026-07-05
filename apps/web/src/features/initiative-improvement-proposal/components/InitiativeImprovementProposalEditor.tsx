"use client";

import type { InitiativeImprovementProposal } from "@hu/types";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  archiveImprovementProposal,
  saveImprovementProposalDraft,
  submitImprovementProposal,
  type SaveInitiativeImprovementProposalDraftInput,
} from "../api";

import "./initiative-improvement-proposal-editor.css";

interface ProposalFormState {
  targetSection: string;
  currentIssue: string;
  proposedChange: string;
  rationale: string;
  expectedImprovement: string;
  references: string;
}

interface InitiativeImprovementProposalEditorProps {
  proposal: InitiativeImprovementProposal;
  onUpdated: (proposal: InitiativeImprovementProposal) => void;
}

function buildFormState(proposal: InitiativeImprovementProposal): ProposalFormState {
  return {
    targetSection: proposal.targetSection,
    currentIssue: proposal.currentIssue,
    proposedChange: proposal.proposedChange,
    rationale: proposal.rationale,
    expectedImprovement: proposal.expectedImprovement,
    references: proposal.references,
  };
}

export function InitiativeImprovementProposalEditor({
  proposal,
  onUpdated,
}: InitiativeImprovementProposalEditorProps) {
  const [form, setForm] = useState<ProposalFormState>(() => buildFormState(proposal));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(proposal));
    setMessage(null);
  }, [proposal]);

  const isDraft = proposal.status === "draft";
  const isSubmitted = proposal.status === "submitted";
  const isDecided =
    proposal.status === "accepted" ||
    proposal.status === "partially_accepted" ||
    proposal.status === "declined";
  const isArchived = proposal.status === "archived";

  async function handleSaveDraft() {
    setSaving(true);
    setMessage(null);

    const input: SaveInitiativeImprovementProposalDraftInput = { ...form };

    try {
      const updated = await saveImprovementProposalDraft(proposal.proposalId, input);
      onUpdated(updated);
      setMessage("Draft saved.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Save failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);

    try {
      await saveImprovementProposalDraft(proposal.proposalId, { ...form });
      const updated = await submitImprovementProposal(proposal.proposalId);
      onUpdated(updated);
      setMessage("Proposal submitted to initiative steward.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Submit failed: ${detail}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setMessage(null);

    try {
      const updated = await archiveImprovementProposal(proposal.proposalId);
      onUpdated(updated);
      setMessage("Proposal archived.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Archive failed: ${detail}`);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="initiative-improvement-proposal-editor">
      <p className="initiative-improvement-proposal-editor__status">Status: {proposal.status}</p>

      {isDecided && proposal.decisionNote ? (
        <p className="initiative-improvement-proposal-editor__status">
          Steward decision: {proposal.decisionNote}
        </p>
      ) : null}

      <div className="initiative-improvement-proposal-editor__field">
        <label htmlFor={`proposal-target-${proposal.proposalId}`}>Target section</label>
        <input
          id={`proposal-target-${proposal.proposalId}`}
          value={form.targetSection}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, targetSection: event.target.value }))
          }
        />
      </div>

      <div className="initiative-improvement-proposal-editor__field">
        <label htmlFor={`proposal-issue-${proposal.proposalId}`}>Current issue</label>
        <textarea
          id={`proposal-issue-${proposal.proposalId}`}
          value={form.currentIssue}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, currentIssue: event.target.value }))
          }
        />
      </div>

      <div className="initiative-improvement-proposal-editor__field">
        <label htmlFor={`proposal-change-${proposal.proposalId}`}>Proposed change</label>
        <textarea
          id={`proposal-change-${proposal.proposalId}`}
          value={form.proposedChange}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, proposedChange: event.target.value }))
          }
        />
      </div>

      <div className="initiative-improvement-proposal-editor__field">
        <label htmlFor={`proposal-rationale-${proposal.proposalId}`}>Rationale</label>
        <textarea
          id={`proposal-rationale-${proposal.proposalId}`}
          value={form.rationale}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, rationale: event.target.value }))
          }
        />
      </div>

      <div className="initiative-improvement-proposal-editor__field">
        <label htmlFor={`proposal-improvement-${proposal.proposalId}`}>Expected improvement</label>
        <textarea
          id={`proposal-improvement-${proposal.proposalId}`}
          value={form.expectedImprovement}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, expectedImprovement: event.target.value }))
          }
        />
      </div>

      <div className="initiative-improvement-proposal-editor__field">
        <label htmlFor={`proposal-references-${proposal.proposalId}`}>References</label>
        <textarea
          id={`proposal-references-${proposal.proposalId}`}
          value={form.references}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, references: event.target.value }))
          }
        />
      </div>

      <div className="initiative-improvement-proposal-editor__actions">
        {isDraft ? (
          <>
            <button type="button" disabled={saving} onClick={() => void handleSaveDraft()}>
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? "Submitting..." : "Submit Proposal"}
            </button>
            <button
              type="button"
              data-variant="secondary"
              disabled={archiving}
              onClick={() => void handleArchive()}
            >
              {archiving ? "Archiving..." : "Archive"}
            </button>
          </>
        ) : null}
        {isSubmitted ? (
          <button
            type="button"
            data-variant="secondary"
            disabled={archiving}
            onClick={() => void handleArchive()}
          >
            {archiving ? "Archiving..." : "Archive"}
          </button>
        ) : null}
        {!isDraft && !isSubmitted && !isArchived ? (
          <Link href={`/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`}>
            View public proposal
          </Link>
        ) : null}
      </div>

      {message ? (
        <p className="initiative-improvement-proposal-editor__message">{message}</p>
      ) : null}
    </div>
  );
}
