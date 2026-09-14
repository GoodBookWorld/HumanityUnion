"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeRevisionChangeSection, InitiativeRevisionDraft } from "@hu/types";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import { addAuthorOriginatedRevisionChange } from "../api";

const SECTION_OPTIONS: InitiativeRevisionChangeSection[] = ["title", "description", "custom"];

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

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
  const t = useTranslations("initiativeExperience");
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
      setError(t("author.revision.change.validationRequired"));
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
      setError(detailFromError(addError, t("author.revision.change.addFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="irv-add-change">
      <h4>{t("author.revision.change.addTitle")}</h4>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-section">{t("author.revision.fields.section")}</label>
        <select
          id="irv-add-change-section"
          value={section}
          onChange={(event) => setSection(event.target.value as InitiativeRevisionChangeSection)}
        >
          {SECTION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`author.revision.sectionOptions.${option}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-after">{t("author.revision.fields.proposedAfter")}</label>
        <textarea
          id="irv-add-change-after"
          value={after}
          onChange={(event) => setAfter(event.target.value)}
          rows={3}
        />
      </div>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-reason">{t("author.revision.fields.reason")}</label>
        <input
          id="irv-add-change-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <div className="irv-editor__field">
        <label htmlFor="irv-add-change-explanation">{t("author.revision.fields.explanation")}</label>
        <textarea
          id="irv-add-change-explanation"
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          rows={2}
        />
      </div>
      <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleAdd()}>
        {busy ? t("author.revision.change.adding") : t("author.revision.change.addChange")}
      </WorkspaceButton>
      {error ? (
        <p className="irv-editor__message" data-tone="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
