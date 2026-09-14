"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeImplementationTracking } from "@hu/types";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import { listMyActiveInitiativeImplementationTrackings, updateInitiativeImplementationTrackingProgress } from "../api";

import "./initiative-implementation-tracking-stage-workspace.css";

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values: readonly string[] | null | undefined): string {
  return (values ?? []).join("\n");
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

interface ProgressFormState {
  progress: string;
  currentStatus: string;
  notes: string;
  evidenceReferences: string;
  obstacles: string;
}

function toFormState(tracking: InitiativeImplementationTracking): ProgressFormState {
  return {
    progress: String(tracking.progress ?? 0),
    currentStatus: tracking.currentStage,
    notes: tracking.notes ?? "",
    evidenceReferences: listToLines(tracking.evidenceReferences),
    obstacles: listToLines(tracking.obstacles),
  };
}

/**
 * Initiative Lifecycle — Part J, Section 6/15. The one place a
 * responsible Participant's own continuous progress update happens —
 * never on the Public Result (guests must never see or trigger it) and
 * never performed on their behalf by the Initiative's Author.
 */
export function InitiativeImplementationTrackingProgressInbox({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [trackings, setTrackings] = useState<InitiativeImplementationTracking[]>([]);
  const [forms, setForms] = useState<Record<string, ProgressFormState>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pendingTrackingId, setPendingTrackingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const result = await listMyActiveInitiativeImplementationTrackings();
      const relevant = result.filter((tracking) => tracking.initiativeId === initiativeId);
      setTrackings(relevant);
      setForms((current) => {
        const next: Record<string, ProgressFormState> = {};
        for (const tracking of relevant) {
          next[tracking.trackingId] = current[tracking.trackingId] ?? toFormState(tracking);
        }
        return next;
      });
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  function updateForm(tracking: InitiativeImplementationTracking, patch: Partial<ProgressFormState>) {
    setForms((current) => ({
      ...current,
      [tracking.trackingId]: { ...(current[tracking.trackingId] ?? toFormState(tracking)), ...patch },
    }));
  }

  async function handleSubmit(trackingId: string) {
    const form = forms[trackingId];
    if (!form) {
      return;
    }

    setError(null);
    setPendingTrackingId(trackingId);
    try {
      const progress = Number(form.progress);
      await updateInitiativeImplementationTrackingProgress(trackingId, {
        progress: Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : undefined,
        currentStatus: form.currentStatus,
        notes: form.notes,
        evidenceReferences: linesToList(form.evidenceReferences),
        obstacles: linesToList(form.obstacles),
      });
      await loadMine();
    } catch (err) {
      setError(
        t("author.tracking.messages.progressUpdateFailed", {
          detail: detailFromError(err, t("author.tracking.messages.unknownError")),
        }),
      );
    } finally {
      setPendingTrackingId(null);
    }
  }

  if (loading) {
    return <p className="lsw-sidebar__loading">{t("author.tracking.inbox.loading")}</p>;
  }

  if (loadFailed) {
    return <p className="lsw-sidebar__error">{t("author.tracking.inbox.loadFailed")}</p>;
  }

  if (trackings.length === 0) {
    return (
      <p className="lsw-sidebar__placeholder">{t("author.tracking.inbox.empty")}</p>
    );
  }

  return (
    <div className="iit-progress-inbox">
      {error ? <p className="lsw-sidebar__error">{error}</p> : null}
      {trackings.map((tracking) => {
        const form = forms[tracking.trackingId] ?? toFormState(tracking);

        return (
          <div className="iit-progress-inbox__item" key={tracking.trackingId}>
            <strong>{tracking.approvedAction ?? tracking.summary}</strong>
            <div className="iit-editor__field">
              <label htmlFor={`iit-inbox-status-${tracking.trackingId}`}>
                {t("author.tracking.inbox.currentStatus")}
              </label>
              <input
                id={`iit-inbox-status-${tracking.trackingId}`}
                value={form.currentStatus}
                onChange={(event) => updateForm(tracking, { currentStatus: event.target.value })}
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-inbox-progress-${tracking.trackingId}`}>
                {t("author.tracking.inbox.progress")}
              </label>
              <input
                id={`iit-inbox-progress-${tracking.trackingId}`}
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(event) => updateForm(tracking, { progress: event.target.value })}
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-inbox-notes-${tracking.trackingId}`}>
                {t("author.tracking.inbox.notes")}
              </label>
              <textarea
                id={`iit-inbox-notes-${tracking.trackingId}`}
                rows={2}
                value={form.notes}
                onChange={(event) => updateForm(tracking, { notes: event.target.value })}
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-inbox-obstacles-${tracking.trackingId}`}>
                {t("author.tracking.inbox.obstacles")}
              </label>
              <textarea
                id={`iit-inbox-obstacles-${tracking.trackingId}`}
                rows={2}
                value={form.obstacles}
                onChange={(event) => updateForm(tracking, { obstacles: event.target.value })}
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-inbox-evidence-${tracking.trackingId}`}>
                {t("author.tracking.inbox.evidence")}
              </label>
              <textarea
                id={`iit-inbox-evidence-${tracking.trackingId}`}
                rows={2}
                value={form.evidenceReferences}
                onChange={(event) =>
                  updateForm(tracking, { evidenceReferences: event.target.value })
                }
              />
            </div>
            <div className="iit-progress-inbox__actions">
              <WorkspaceButton
                variant="primary"
                onClick={() => void handleSubmit(tracking.trackingId)}
                disabled={pendingTrackingId === tracking.trackingId}
              >
                {t("author.tracking.inbox.saveProgress")}
              </WorkspaceButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
