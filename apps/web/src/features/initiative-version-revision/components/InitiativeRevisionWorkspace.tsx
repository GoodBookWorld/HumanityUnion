"use client";

import type { Initiative, InitiativeRevisionDraftContext } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { INITIATIVE_COMMUNITY_OPTIONS } from "../../initiatives/api";
import { BOOTSTRAP_PARTICIPANT_ID } from "../../petition/petition-utils";
import {
  createInitiativeRevisionDraft,
  getInitiativeRevisionWorkspace,
  publishInitiativeRevision,
  saveInitiativeRevisionDraft,
} from "../api";

import "./initiative-revision-workspace.css";

interface InitiativeRevisionWorkspaceProps {
  initiative: Initiative;
  onInitiativeUpdated: (initiative: Initiative) => void;
}

interface RevisionFormState {
  title: string;
  description: string;
  communitySlug: string;
  activityArea: string;
  revisionSummary: string;
}

function isSteward(initiative: Initiative): boolean {
  return initiative.stewardId === BOOTSTRAP_PARTICIPANT_ID;
}

function buildFormState(context: InitiativeRevisionDraftContext): RevisionFormState {
  const source = context.draft ?? context.currentInitiative;

  return {
    title: source.title,
    description: source.description,
    communitySlug: source.metadata.communitySlug,
    activityArea: source.metadata.activityArea,
    revisionSummary: context.draft?.revisionSummary ?? "",
  };
}

export function InitiativeRevisionWorkspace({
  initiative,
  onInitiativeUpdated,
}: InitiativeRevisionWorkspaceProps) {
  const [context, setContext] = useState<InitiativeRevisionDraftContext | null>(null);
  const [form, setForm] = useState<RevisionFormState | null>(null);
  const [appliedProposalIds, setAppliedProposalIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);

    try {
      const workspace = await getInitiativeRevisionWorkspace(initiative.initiativeId);
      setContext(workspace);
      setForm(buildFormState(workspace));
      setAppliedProposalIds(workspace.draft?.appliedProposalIds ?? []);
    } catch {
      setContext(null);
      setForm(null);
      setAppliedProposalIds([]);
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    if (isSteward(initiative)) {
      void loadWorkspace();
    }
  }, [initiative, loadWorkspace]);

  function toggleProposal(proposalId: string) {
    setAppliedProposalIds((current) =>
      current.includes(proposalId)
        ? current.filter((id) => id !== proposalId)
        : [...current, proposalId],
    );
  }

  async function handleCreateDraft() {
    setCreating(true);
    setMessage(null);

    try {
      await createInitiativeRevisionDraft(initiative.initiativeId);
      await loadWorkspace();
      setMessage("Revision draft created.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Create failed: ${detail}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveDraft() {
    if (!form) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await saveInitiativeRevisionDraft(initiative.initiativeId, {
        ...form,
        appliedProposalIds,
        skippedProposalIds: (context?.eligibleProposals ?? [])
          .map((proposal) => proposal.proposalId)
          .filter((proposalId) => !appliedProposalIds.includes(proposalId)),
      });
      await loadWorkspace();
      setMessage("Revision draft saved.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Save failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage(null);

    try {
      if (form) {
        await saveInitiativeRevisionDraft(initiative.initiativeId, {
          ...form,
          appliedProposalIds,
          skippedProposalIds: (context?.eligibleProposals ?? [])
            .map((proposal) => proposal.proposalId)
            .filter((proposalId) => !appliedProposalIds.includes(proposalId)),
        });
      }

      const result = await publishInitiativeRevision(initiative.initiativeId);
      onInitiativeUpdated(result.initiative);
      await loadWorkspace();
      setMessage(`Revision ${result.revision.version} published.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Publish failed: ${detail}`);
    } finally {
      setPublishing(false);
    }
  }

  if (!isSteward(initiative)) {
    return null;
  }

  if (initiative.lifecyclePhase !== "published" && initiative.lifecyclePhase !== "projected") {
    return (
      <p className="initiative-revision-workspace__note">
        Initiative revisions are available after the initiative is published.
      </p>
    );
  }

  if (loading || !context || !form) {
    return <p className="initiative-revision-workspace__empty">Loading revision workspace...</p>;
  }

  return (
    <div className="initiative-revision-workspace">
      <p className="initiative-revision-workspace__note">
        Current version: {context.currentVersion || 1}. Apply, skip, or modify proposals manually
        before publishing. The system never edits the initiative automatically.
      </p>

      {!context.draft ? (
        <button
          type="button"
          className="initiative-revision-workspace__actions button"
          disabled={creating}
          onClick={() => void handleCreateDraft()}
        >
          {creating ? "Creating..." : "Start Revision Draft"}
        </button>
      ) : null}

      <div className="initiative-revision-workspace__section">
        <h4>Accepted and partially accepted proposals</h4>
        {context.eligibleProposals.length === 0 ? (
          <p className="initiative-revision-workspace__empty">
            No implementable proposals are available.
          </p>
        ) : (
          context.eligibleProposals.map((proposal) => (
            <label key={proposal.proposalId} className="initiative-revision-workspace__proposal">
              <input
                type="checkbox"
                checked={appliedProposalIds.includes(proposal.proposalId)}
                disabled={!context.draft}
                onChange={() => toggleProposal(proposal.proposalId)}
              />
              <strong>{proposal.targetSection}</strong>
              <span>{proposal.status.replace("_", " ")}</span>
              <span>{proposal.proposedChange}</span>
            </label>
          ))
        )}
      </div>

      {context.draft ? (
        <>
          <div className="initiative-revision-workspace__section">
            <h4>Revision draft</h4>
            <div className="initiative-revision-workspace__field">
              <label htmlFor="revision-title">Title</label>
              <input
                id="revision-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="initiative-revision-workspace__field">
              <label htmlFor="revision-description">Description</label>
              <textarea
                id="revision-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="initiative-revision-workspace__field">
              <label htmlFor="revision-community">Community</label>
              <select
                id="revision-community"
                value={form.communitySlug}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, communitySlug: event.target.value } : current,
                  )
                }
              >
                {INITIATIVE_COMMUNITY_OPTIONS.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="initiative-revision-workspace__field">
              <label htmlFor="revision-activity">Activity area</label>
              <input
                id="revision-activity"
                value={form.activityArea}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, activityArea: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="initiative-revision-workspace__field">
              <label htmlFor="revision-summary">What changed in this revision?</label>
              <textarea
                id="revision-summary"
                value={form.revisionSummary}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, revisionSummary: event.target.value } : current,
                  )
                }
              />
            </div>
          </div>

          <div className="initiative-revision-workspace__actions">
            <button type="button" disabled={saving} onClick={() => void handleSaveDraft()}>
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" disabled={publishing} onClick={() => void handlePublish()}>
              {publishing ? "Publishing..." : "Publish Revision"}
            </button>
          </div>
        </>
      ) : null}

      {message ? <p className="initiative-revision-workspace__note">{message}</p> : null}
    </div>
  );
}
