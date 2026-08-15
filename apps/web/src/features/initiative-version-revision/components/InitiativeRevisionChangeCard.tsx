"use client";

import { useState } from "react";

import type { InitiativeRevisionChange, InitiativeRevisionDraft } from "@hu/types";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  applyInitiativeRevisionChange,
  removeInitiativeRevisionChange,
  saveInitiativeRevisionChange,
} from "../api";

interface InitiativeRevisionChangeCardProps {
  readonly initiativeId: string;
  readonly change: InitiativeRevisionChange;
  readonly onChanged: (draft: InitiativeRevisionDraft) => void;
}

/**
 * Initiative Lifecycle — Part E, Section 5/7/8 (Canonical Traceability /
 * Before-After / Author-originated Changes).
 *
 * One structured, fully-traceable change: Before -> After -> Origin ->
 * Related Proposal IDs -> Author explanation, exactly Section 7's required
 * chain, with no hidden edits. The Author may edit the `after` text and
 * `explanation` inline, discard the change entirely (Remove), or Apply it
 * into the draft's real `title`/`description` field — never automatic.
 */
export function InitiativeRevisionChangeCard({
  initiativeId,
  change,
  onChanged,
}: InitiativeRevisionChangeCardProps) {
  const [editing, setEditing] = useState(false);
  const [after, setAfter] = useState(change.after);
  const [explanation, setExplanation] = useState(change.explanation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);

    try {
      const updated = await saveInitiativeRevisionChange(initiativeId, change.changeId, {
        after,
        explanation,
      });
      onChanged(updated);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "This change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);

    try {
      const updated = await removeInitiativeRevisionChange(initiativeId, change.changeId);
      onChanged(updated);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "This change could not be removed.");
      setBusy(false);
    }
  }

  async function handleApply() {
    setBusy(true);
    setError(null);

    try {
      const updated = await applyInitiativeRevisionChange(initiativeId, change.changeId);
      onChanged(updated);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "This change could not be applied.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="irv-change-card">
      <div className="irv-change-card__header">
        <h4>{change.sectionLabel}</h4>
        <span className="irv-change-card__origin" data-origin={change.origin}>
          {change.origin === "proposal" ? "From Proposal" : "Author-originated"}
        </span>
      </div>

      <div className="irv-change-card__before-after">
        <div className="irv-change-card__field">
          <label>Before</label>
          <p>{change.before || "(empty)"}</p>
        </div>
        <div className="irv-change-card__field">
          <label>After</label>
          {editing ? (
            <textarea
              value={after}
              onChange={(event) => setAfter(event.target.value)}
              rows={4}
            />
          ) : (
            <p>{change.after || "(empty)"}</p>
          )}
        </div>
      </div>

      <div className="irv-change-card__field">
        <label>Author explanation</label>
        {editing ? (
          <textarea
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            rows={2}
          />
        ) : (
          <p>{change.explanation}</p>
        )}
      </div>

      <div className="irv-change-card__meta">
        {change.origin === "proposal" ? (
          <span>Proposal reference(s): {change.proposalIds.join(", ") || "none"}</span>
        ) : (
          <span>Reason: {change.authorOriginatedReason}</span>
        )}
        <span>Updated {new Date(change.updatedAt).toLocaleString()}</span>
      </div>

      <div className="irv-change-card__actions">
        {editing ? (
          <>
            <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleSave()}>
              Save Change
            </WorkspaceButton>
            <WorkspaceButton
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setAfter(change.after);
                setExplanation(change.explanation);
                setEditing(false);
              }}
            >
              Cancel
            </WorkspaceButton>
          </>
        ) : (
          <>
            <WorkspaceButton variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </WorkspaceButton>
            {change.section === "title" || change.section === "description" ? (
              <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleApply()}>
                Apply to Draft
              </WorkspaceButton>
            ) : null}
            <WorkspaceButton variant="danger" disabled={busy} onClick={() => void handleRemove()}>
              Remove
            </WorkspaceButton>
          </>
        )}
      </div>

      {error ? (
        <p className="irv-editor__message" data-tone="error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
