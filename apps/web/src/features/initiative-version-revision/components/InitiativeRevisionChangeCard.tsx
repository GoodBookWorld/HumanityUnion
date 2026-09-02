"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

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

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
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
  const locale = useLocale();
  const t = useTranslations("initiativeExperience");
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
      setError(detailFromError(saveError, t("author.revision.change.saveFailed")));
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
      setError(detailFromError(removeError, t("author.revision.change.removeFailed")));
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
      setError(detailFromError(applyError, t("author.revision.change.applyFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="irv-change-card">
      <div className="irv-change-card__header">
        <h4>{change.sectionLabel}</h4>
        <span className="irv-change-card__origin" data-origin={change.origin}>
          {change.origin === "proposal"
            ? t("author.revision.change.fromProposal")
            : t("author.revision.change.authorOriginated")}
        </span>
      </div>

      <div className="irv-change-card__before-after">
        <div className="irv-change-card__field">
          <label>{t("author.revision.fields.before")}</label>
          <p>{change.before || t("author.revision.change.emptyValue")}</p>
        </div>
        <div className="irv-change-card__field">
          <label>{t("author.revision.fields.after")}</label>
          {editing ? (
            <textarea
              value={after}
              onChange={(event) => setAfter(event.target.value)}
              rows={4}
            />
          ) : (
            <p>{change.after || t("author.revision.change.emptyValue")}</p>
          )}
        </div>
      </div>

      <div className="irv-change-card__field">
        <label>{t("author.revision.fields.authorExplanation")}</label>
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
          <span>
            {t("author.revision.change.proposalReferences", {
              ids: change.proposalIds.join(", ") || t("author.revision.change.proposalReferencesNone"),
            })}
          </span>
        ) : (
          <span>
            {t("author.revision.change.reasonMeta", {
              reason: change.authorOriginatedReason || "",
            })}
          </span>
        )}
        <span>
          {t("author.revision.change.updated", {
            date: new Date(change.updatedAt).toLocaleString(locale),
          })}
        </span>
      </div>

      <div className="irv-change-card__actions">
        {editing ? (
          <>
            <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleSave()}>
              {t("author.revision.change.saveChange")}
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
              {t("author.revision.change.cancel")}
            </WorkspaceButton>
          </>
        ) : (
          <>
            <WorkspaceButton variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
              {t("author.revision.change.edit")}
            </WorkspaceButton>
            {change.section === "title" || change.section === "description" ? (
              <WorkspaceButton variant="primary" disabled={busy} onClick={() => void handleApply()}>
                {t("author.revision.change.applyToDraft")}
              </WorkspaceButton>
            ) : null}
            <WorkspaceButton variant="danger" disabled={busy} onClick={() => void handleRemove()}>
              {t("author.revision.change.remove")}
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
