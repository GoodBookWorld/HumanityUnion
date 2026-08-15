"use client";

import { useState } from "react";

import type { InitiativeRevisionChangeSection, InitiativeRevisionDraft } from "@hu/types";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import { addAuthorOriginatedRevisionChange } from "../api";

const SECTION_OPTIONS: Array<{ value: InitiativeRevisionChangeSection; label: string }> = [
  { value: "title", label: "Title" },
  { value: "description", label: "Description" },
  { value: "custom", label: "Custom" },
];

/**
 * Initiative Lifecycle — Part E, Section 8 (Author-originated Changes).
 *
 * The Author may introduce improvements not coming from any Proposal —
 * they must be explicitly marked "Author-originated" with a `reason`
 * (mandatory) and an `explanation`, so they participate in full
 * traceability exactly like Proposal-based changes (Section 5).
 */
export function InitiativeRevisionAddChangeForm({
  initiativeId,
  currentTitle,
  currentDescription,
  onChanged,
}: {
  readonly initiativeId: string;
  readonly currentTitle: string;
  readonly currentDescription: string;
  readonly onChanged: (draft: InitiativeRevisionDraft) => void;
}) {
  const [section, setSection] = useState<InitiativeRevisionChangeSection>("description");
  const [after, setAfter] = useState("");
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolveBefore(): string {
    if (section === "title") {
      return currentTitle;
    }

    if (section === "description") {
      return currentDescription;
    }

    return "";
  }

  async function handleAdd() {
    if (!after.trim() || !reason.trim() || !explanation.trim()) {
      setError("After text, reason, and explanation are required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const updated = await addAuthorOriginatedRevisionChange(initiativeId, {
        section,
        before: resolveBefore(),
        after,
        reason,
        explanation,
      });
      onChanged(updated);
      setAfter("");
      setReason("");
      setExplanation("");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "This change could not be added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="irv-add-change">
      <h4>Add Author-originated Change</h4>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-section">Section</label>
        <select
          id="irv-add-change-section"
          value={section}
          onChange={(event) => setSection(event.target.value as InitiativeRevisionChangeSection)}
        >
          {SECTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-after">Proposed text (After)</label>
        <textarea
          id="irv-add-change-after"
          value={after}
          onChange={(event) => setAfter(event.target.value)}
          rows={3}
        />
      </div>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-reason">Reason (why this change is needed)</label>
        <input
          id="irv-add-change-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-explanation">Explanation (what changed)</label>
        <textarea
          id="irv-add-change-explanation"
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          rows={2}
        />
      </div>
      <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleAdd()}>
        {busy ? "Adding..." : "Add Change"}
      </WorkspaceButton>
      {error ? (
        <p className="irv-editor__message" data-tone="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
