"use client";

import type { DecisionSession, DecisionSessionEligibility, Initiative } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { BOOTSTRAP_PARTICIPANT_ID } from "../../petition/petition-utils";
import {
  WorkspaceEmptyState,
  WorkspaceMetricsRow,
  WorkspaceSectionShell,
  WorkspaceStatusBadge,
  WorkspaceStatusCard,
} from "../../initiative-workspace-ux";
import {
  archiveDecisionSession,
  closeDecisionSession,
  createDecisionSessionDraft,
  getDecisionSessionEligibility,
  listMyDecisionSessionsForInitiative,
  publishDecisionSession,
  saveDecisionSessionDraft,
} from "../api";

import "./decision-session-workspace.css";

interface DecisionSessionWorkspaceProps {
  initiative: Initiative;
}

interface SessionFormState {
  title: string;
  purpose: string;
  decisionQuestion: string;
  opensAt: string;
  closesAt: string;
}

function isSteward(initiative: Initiative): boolean {
  return initiative.stewardId === BOOTSTRAP_PARTICIPANT_ID;
}

function toDateTimeLocalValue(isoDate: string): string {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

function buildEmptyForm(): SessionFormState {
  const opensAt = new Date();
  opensAt.setDate(opensAt.getDate() + 7);
  const closesAt = new Date(opensAt);
  closesAt.setDate(closesAt.getDate() + 14);

  return {
    title: "",
    purpose: "",
    decisionQuestion: "",
    opensAt: toDateTimeLocalValue(opensAt.toISOString()),
    closesAt: toDateTimeLocalValue(closesAt.toISOString()),
  };
}

function buildFormFromSession(session: DecisionSession): SessionFormState {
  return {
    title: session.title,
    purpose: session.purpose,
    decisionQuestion: session.decisionQuestion,
    opensAt: toDateTimeLocalValue(session.opensAt),
    closesAt: toDateTimeLocalValue(session.closesAt),
  };
}

export function DecisionSessionWorkspace({ initiative }: DecisionSessionWorkspaceProps) {
  const [eligibility, setEligibility] = useState<DecisionSessionEligibility | null>(null);
  const [sessions, setSessions] = useState<DecisionSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionFormState>(buildEmptyForm);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSession = sessions.find((session) => session.sessionId === selectedId) ?? null;

  const loadWorkspace = useCallback(async () => {
    if (!isSteward(initiative)) {
      setEligibility(null);
      setSessions([]);
      return;
    }

    setLoading(true);

    try {
      const [eligibilityResult, sessionList] = await Promise.all([
        getDecisionSessionEligibility(initiative.initiativeId),
        listMyDecisionSessionsForInitiative(initiative.initiativeId),
      ]);

      setEligibility(eligibilityResult);
      setSessions(sessionList);

      const draft = sessionList.find((session) => session.status === "draft");

      if (draft) {
        setSelectedId(draft.sessionId);
        setForm(buildFormFromSession(draft));
      } else {
        setSelectedId(null);
        setForm(buildEmptyForm());
      }
    } catch {
      setEligibility(null);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [initiative]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleCreateDraft() {
    setCreating(true);
    setMessage(null);

    try {
      const created = await createDecisionSessionDraft({
        initiativeId: initiative.initiativeId,
        title: form.title,
        purpose: form.purpose,
        decisionQuestion: form.decisionQuestion,
        opensAt: fromDateTimeLocalValue(form.opensAt),
        closesAt: fromDateTimeLocalValue(form.closesAt),
      });

      setSessions((current) => [...current, created]);
      setSelectedId(created.sessionId);
      setForm(buildFormFromSession(created));
      setMessage("Decision session draft created.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Create failed: ${detail}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedSession || selectedSession.status !== "draft") {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const updated = await saveDecisionSessionDraft(selectedSession.sessionId, {
        title: form.title,
        purpose: form.purpose,
        decisionQuestion: form.decisionQuestion,
        opensAt: fromDateTimeLocalValue(form.opensAt),
        closesAt: fromDateTimeLocalValue(form.closesAt),
      });

      setSessions((current) =>
        current.map((session) => (session.sessionId === updated.sessionId ? updated : session)),
      );
      setMessage("Decision session draft saved.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Save failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!selectedSession || selectedSession.status !== "draft") {
      return;
    }

    setPublishing(true);
    setMessage(null);

    try {
      const updated = await publishDecisionSession(selectedSession.sessionId);

      setSessions((current) =>
        current.map((session) => (session.sessionId === updated.sessionId ? updated : session)),
      );
      setMessage("Decision session published. Decision package references captured.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Publish failed: ${detail}`);
    } finally {
      setPublishing(false);
    }
  }

  async function handleClose() {
    if (!selectedSession || selectedSession.status !== "published") {
      return;
    }

    setClosing(true);
    setMessage(null);

    try {
      const updated = await closeDecisionSession(selectedSession.sessionId);

      setSessions((current) =>
        current.map((session) => (session.sessionId === updated.sessionId ? updated : session)),
      );
      setMessage("Decision session closed.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Close failed: ${detail}`);
    } finally {
      setClosing(false);
    }
  }

  async function handleArchive() {
    if (!selectedSession || selectedSession.status === "archived") {
      return;
    }

    setArchiving(true);
    setMessage(null);

    try {
      const updated = await archiveDecisionSession(selectedSession.sessionId);

      setSessions((current) =>
        current.map((session) => (session.sessionId === updated.sessionId ? updated : session)),
      );
      setMessage("Decision session archived.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Archive failed: ${detail}`);
    } finally {
      setArchiving(false);
    }
  }

  function handleSelectSession(session: DecisionSession) {
    setSelectedId(session.sessionId);
    setForm(buildFormFromSession(session));
    setMessage(null);
  }

  if (!isSteward(initiative)) {
    return null;
  }

  return (
    <WorkspaceSectionShell
      purpose="Prepare a structured decision session after collective intelligence work is complete. This stage does not collect votes; it packages evidence for an informed public decision."
      loading={loading ? "Loading decision sessions..." : null}
      metrics={
        eligibility ? (
          <WorkspaceMetricsRow>
            <WorkspaceStatusCard
              label="Eligibility"
              value={eligibility.eligible ? "Eligible" : "Not eligible"}
            />
            <WorkspaceStatusCard label="Sessions" value={sessions.length} />
          </WorkspaceMetricsRow>
        ) : null
      }
      emptyState={
        !loading && sessions.length === 0 && eligibility?.eligible ? (
          <WorkspaceEmptyState
            title="No decision session has been created yet"
            explanation="Decision sessions package civic evidence before collective voting begins."
            nextStep="Create a draft decision session when initiative revision and analysis are ready."
          />
        ) : null
      }
    >
      {eligibility && !eligibility.eligible ? (
        <div className="workspace-helper-note">
          <p>Initiative is not yet eligible for a decision session:</p>
          <ul>
            {eligibility.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <ul className="decision-session-workspace__sessions">
          {sessions.map((session) => (
            <li key={session.sessionId}>
              <button
                type="button"
                className={
                  selectedId === session.sessionId
                    ? "decision-session-workspace__session-button decision-session-workspace__session-button--active"
                    : "decision-session-workspace__session-button"
                }
                onClick={() => handleSelectSession(session)}
              >
                {session.title || "Untitled session"} ·{" "}
                <WorkspaceStatusBadge status={session.status} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="decision-session-workspace">
        <div className="decision-session-workspace__form">
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              disabled={selectedSession !== null && selectedSession.status !== "draft"}
            />
          </label>
          <label>
            Purpose
            <textarea
              value={form.purpose}
              onChange={(event) =>
                setForm((current) => ({ ...current, purpose: event.target.value }))
              }
              disabled={selectedSession !== null && selectedSession.status !== "draft"}
            />
          </label>
          <label>
            Decision question
            <textarea
              value={form.decisionQuestion}
              onChange={(event) =>
                setForm((current) => ({ ...current, decisionQuestion: event.target.value }))
              }
              disabled={selectedSession !== null && selectedSession.status !== "draft"}
            />
          </label>
          <label>
            Opens
            <input
              type="datetime-local"
              value={form.opensAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, opensAt: event.target.value }))
              }
              disabled={selectedSession !== null && selectedSession.status !== "draft"}
            />
          </label>
          <label>
            Closes
            <input
              type="datetime-local"
              value={form.closesAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, closesAt: event.target.value }))
              }
              disabled={selectedSession !== null && selectedSession.status !== "draft"}
            />
          </label>
        </div>

        <div className="decision-session-workspace__actions">
          {!selectedSession ? (
            <button
              type="button"
              onClick={() => void handleCreateDraft()}
              disabled={creating || !eligibility?.eligible}
            >
              {creating ? "Creating..." : "Create Draft"}
            </button>
          ) : null}

          {selectedSession?.status === "draft" ? (
            <>
              <button type="button" onClick={() => void handleSaveDraft()} disabled={saving}>
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button type="button" onClick={() => void handlePublish()} disabled={publishing}>
                {publishing ? "Publishing..." : "Publish"}
              </button>
            </>
          ) : null}

          {selectedSession?.status === "published" ? (
            <button type="button" onClick={() => void handleClose()} disabled={closing}>
              {closing ? "Closing..." : "Close Session"}
            </button>
          ) : null}

          {selectedSession && selectedSession.status !== "archived" ? (
            <button type="button" onClick={() => void handleArchive()} disabled={archiving}>
              {archiving ? "Archiving..." : "Archive"}
            </button>
          ) : null}
        </div>

        {selectedSession?.packageReferences ? (
          <div className="decision-session-workspace__package">
            <p>Decision package references:</p>
            <ul>
              <li>{selectedSession.packageReferences.revisionIds.length} revisions</li>
              <li>{selectedSession.packageReferences.analysisIds.length} analyses</li>
              <li>{selectedSession.packageReferences.proposalIds.length} proposals</li>
            </ul>
          </div>
        ) : null}

        {message ? <p className="decision-session-workspace__message">{message}</p> : null}
      </div>
    </WorkspaceSectionShell>
  );
}
