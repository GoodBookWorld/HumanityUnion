"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  InitiativeCollaborationSessionAttendanceResponse,
  InitiativeCollaborationSessionInput,
  InitiativeCollaborationSessionListResult,
  InitiativeCollaborationSessionStatus,
  InitiativeCollaborationSessionView,
} from "../api";
import {
  cancelInitiativeCollaborationSession,
  createInitiativeCollaborationSession,
  listInitiativeCollaborationSessions,
  setInitiativeCollaborationSessionAttendance,
  updateInitiativeCollaborationSession,
} from "../api";
import { ApiRequestError } from "../../../lib/api-client";
import { SharedDocumentsPanel } from "../../shared-documents/components/SharedDocumentsPanel";

import "./initiative-collaboration-sessions.css";

const ATTENDANCE_OPTIONS: InitiativeCollaborationSessionAttendanceResponse[] = [
  "accepted",
  "maybe",
  "declined",
];

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function resolveTimezoneOptions(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      // fall through to the curated list below
    }
  }

  return COMMON_TIMEZONES;
}

type SessionsT = ReturnType<typeof useTranslations>;

/** Part 4/11 — a single readable line, formatted in the Session's own `timezone` (never the viewer's local zone, so every participant sees the same wall-clock time the Author scheduled). */
function formatSessionSchedule(session: InitiativeCollaborationSessionView, locale: string): string {
  const date = new Date(session.scheduledAtUtc);

  return new Intl.DateTimeFormat(locale, {
    timeZone: session.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatDuration(minutes: number, t: SessionsT): string {
  if (minutes < 60) {
    return t("collaboration.sessions.durationMin", { minutes });
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0
    ? t("collaboration.sessions.durationHr", { hours })
    : t("collaboration.sessions.durationHrMin", { hours, minutes: remainder });
}

function statusLabel(status: InitiativeCollaborationSessionStatus, t: SessionsT): string {
  switch (status) {
    case "upcoming":
      return t("collaboration.sessions.upcoming");
    case "completed":
      return t("collaboration.sessions.completed");
    case "cancelled":
      return t("collaboration.sessions.cancelled");
  }
}

function attendanceLabel(
  response: InitiativeCollaborationSessionAttendanceResponse,
  t: SessionsT,
): string {
  switch (response) {
    case "accepted":
      return t("collaboration.sessions.accept");
    case "maybe":
      return t("collaboration.sessions.maybe");
    case "declined":
      return t("collaboration.sessions.decline");
  }
}

/** Part 12/13 — never a bare colored dot; always paired with the status text. */
function SessionStatusBadge({ status }: { status: InitiativeCollaborationSessionStatus }) {
  const t = useTranslations("initiativeExperience");

  return (
    <span className={`ics-badge ics-badge--${status}`}>
      <span className="ics-badge__dot" aria-hidden="true" />
      {statusLabel(status, t)}
    </span>
  );
}

function AttendanceTotalsSummary({ session }: { session: InitiativeCollaborationSessionView }) {
  const t = useTranslations("initiativeExperience");
  const { accepted, maybe, declined, noResponse } = session.attendanceTotals;

  return (
    <p className="ics-attendance-summary">
      <span>{t("collaboration.sessions.acceptedCount", { count: accepted })}</span>
      <span>{t("collaboration.sessions.maybeCount", { count: maybe })}</span>
      <span>{t("collaboration.sessions.declinedCount", { count: declined })}</span>
      <span>{t("collaboration.sessions.noResponseCount", { count: noResponse })}</span>
    </p>
  );
}

function SessionListCard({
  session,
  isSelected,
  onSelect,
}: {
  session: InitiativeCollaborationSessionView;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  return (
    <li>
      <button
        type="button"
        className={`ics-session-card${isSelected ? " ics-session-card--selected" : ""}`}
        onClick={onSelect}
        aria-pressed={isSelected}
      >
        <span className="ics-session-card__title">{session.title}</span>
        <span className="ics-session-card__schedule">{formatSessionSchedule(session, locale)}</span>
        <span className="ics-session-card__meta">
          <SessionStatusBadge status={session.status} />
          <span className="ics-session-card__duration">
            {formatDuration(session.estimatedDurationMinutes, t)}
          </span>
        </span>
      </button>
    </li>
  );
}

interface SessionEditorFormProps {
  initial?: InitiativeCollaborationSessionView;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: InitiativeCollaborationSessionInput) => void;
  onCancel: () => void;
}

function SessionEditorForm({ initial, submitting, error, onSubmit, onCancel }: SessionEditorFormProps) {
  const t = useTranslations("initiativeExperience");
  const formId = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [agenda, setAgenda] = useState(initial?.agenda ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [meetingDate, setMeetingDate] = useState(initial?.meetingDate ?? "");
  const [meetingTime, setMeetingTime] = useState(initial?.meetingTime ?? "");
  const [timezone, setTimezone] = useState(
    initial?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(initial?.estimatedDurationMinutes ?? 30);
  const [externalMeetingLink, setExternalMeetingLink] = useState(initial?.externalMeetingLink ?? "");
  const timezoneOptions = useMemo(() => resolveTimezoneOptions(), []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      title,
      agenda: agenda.trim() ? agenda : undefined,
      description: description.trim() ? description : undefined,
      meetingDate,
      meetingTime,
      timezone,
      estimatedDurationMinutes,
      externalMeetingLink: externalMeetingLink.trim() ? externalMeetingLink : undefined,
    });
  }

  return (
    <form
      className="ics-editor"
      onSubmit={handleSubmit}
      aria-label={
        initial
          ? t("collaboration.sessions.editorEditAria")
          : t("collaboration.sessions.editorNewAria")
      }
    >
      <div className="ics-editor__field">
        <label htmlFor={`${formId}-title`}>{t("collaboration.sessions.title")}</label>
        <input
          id={`${formId}-title`}
          type="text"
          value={title}
          maxLength={140}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="ics-editor__grid">
        <div className="ics-editor__field">
          <label htmlFor={`${formId}-date`}>{t("collaboration.sessions.meetingDate")}</label>
          <input
            id={`${formId}-date`}
            type="date"
            value={meetingDate}
            required
            onChange={(event) => setMeetingDate(event.target.value)}
          />
        </div>
        <div className="ics-editor__field">
          <label htmlFor={`${formId}-time`}>{t("collaboration.sessions.meetingTime")}</label>
          <input
            id={`${formId}-time`}
            type="time"
            value={meetingTime}
            required
            onChange={(event) => setMeetingTime(event.target.value)}
          />
        </div>
        <div className="ics-editor__field">
          <label htmlFor={`${formId}-timezone`}>{t("collaboration.sessions.timezone")}</label>
          <select
            id={`${formId}-timezone`}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {!timezoneOptions.includes(timezone) ? <option value={timezone}>{timezone}</option> : null}
            {timezoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
        <div className="ics-editor__field">
          <label htmlFor={`${formId}-duration`}>{t("collaboration.sessions.durationMinutes")}</label>
          <input
            id={`${formId}-duration`}
            type="number"
            min={5}
            max={480}
            step={5}
            value={estimatedDurationMinutes}
            required
            onChange={(event) => setEstimatedDurationMinutes(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="ics-editor__field">
        <label htmlFor={`${formId}-agenda`}>{t("collaboration.sessions.agenda")}</label>
        <textarea
          id={`${formId}-agenda`}
          rows={2}
          maxLength={2000}
          value={agenda}
          onChange={(event) => setAgenda(event.target.value)}
        />
      </div>

      <div className="ics-editor__field">
        <label htmlFor={`${formId}-description`}>{t("collaboration.sessions.description")}</label>
        <textarea
          id={`${formId}-description`}
          rows={3}
          maxLength={4000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="ics-editor__field">
        <label htmlFor={`${formId}-link`}>{t("collaboration.sessions.externalLink")}</label>
        <input
          id={`${formId}-link`}
          type="url"
          placeholder={t("collaboration.sessions.linkPlaceholder")}
          value={externalMeetingLink}
          onChange={(event) => setExternalMeetingLink(event.target.value)}
        />
        <p className="ics-editor__hint">{t("collaboration.sessions.linkHint")}</p>
      </div>

      {error ? (
        <p className="ics-status ics-status--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ics-editor__actions">
        <button type="button" className="hu-button hu-button--secondary" onClick={onCancel} disabled={submitting}>
          {t("collaboration.sessions.cancel")}
        </button>
        <button type="submit" className="hu-button hu-button--primary" disabled={submitting}>
          {submitting
            ? t("collaboration.sessions.saving")
            : initial
              ? t("collaboration.sessions.saveChanges")
              : t("collaboration.sessions.scheduleSession")}
        </button>
      </div>
    </form>
  );
}

function SessionDetail({
  initiativeId,
  session,
  busy,
  actionError,
  onEdit,
  onCancelSession,
  onRespond,
}: {
  initiativeId: string;
  session: InitiativeCollaborationSessionView;
  busy: boolean;
  actionError: string | null;
  onEdit: () => void;
  onCancelSession: () => void;
  onRespond: (response: InitiativeCollaborationSessionAttendanceResponse) => void;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  return (
    <article
      className="ics-detail"
      aria-label={t("collaboration.sessions.detailAria", { title: session.title })}
    >
      <header className="ics-detail__header">
        <h4 className="ics-detail__title">{session.title}</h4>
        <SessionStatusBadge status={session.status} />
      </header>

      <p className="ics-detail__schedule">
        {formatSessionSchedule(session, locale)} · {formatDuration(session.estimatedDurationMinutes, t)}
      </p>

      {session.agenda ? (
        <div className="ics-detail__block">
          <h5>{t("collaboration.sessions.agenda")}</h5>
          <p>{session.agenda}</p>
        </div>
      ) : null}

      {session.description ? (
        <div className="ics-detail__block">
          <h5>{t("collaboration.sessions.description")}</h5>
          <p>{session.description}</p>
        </div>
      ) : null}

      {session.externalMeetingLink && session.status !== "cancelled" ? (
        <a
          className="hu-button hu-button--primary ics-detail__meeting-link"
          href={session.externalMeetingLink}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t("collaboration.sessions.openMeeting")}
        </a>
      ) : null}

      <SharedDocumentsPanel
        context={{ contextType: "collaboration_session", initiativeId, sessionId: session.sessionId }}
      />

      <div className="ics-detail__block">
        <h5>{t("collaboration.sessions.attendanceAria")}</h5>
        <AttendanceTotalsSummary session={session} />

        {session.canRespond && session.status !== "cancelled" ? (
          <div
            role="group"
            aria-label={t("collaboration.sessions.yourAttendanceAria")}
            className="ics-attendance-buttons"
          >
            {ATTENDANCE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`ics-attendance-button ics-attendance-button--${option}${
                  session.viewerResponse === option ? " is-selected" : ""
                }`}
                aria-pressed={session.viewerResponse === option}
                disabled={busy}
                onClick={() => onRespond(option)}
              >
                {session.viewerResponse === option ? "✓ " : ""}
                {attendanceLabel(option, t)}
              </button>
            ))}
          </div>
        ) : null}

        {session.attendanceRoster && session.attendanceRoster.length > 0 ? (
          <ul className="ics-roster">
            {session.attendanceRoster.map((entry) => (
              <li key={entry.participantId} className="ics-roster__row">
                <span className="ics-roster__name">{entry.displayName}</span>
                <span className={`ics-roster__response ics-roster__response--${entry.response ?? "none"}`}>
                  {entry.response
                    ? attendanceLabel(entry.response, t)
                    : t("collaboration.sessions.noResponse")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {actionError ? (
        <p className="ics-status ics-status--error" role="alert">
          {actionError}
        </p>
      ) : null}

      {session.canEdit && session.status !== "cancelled" ? (
        <div className="ics-detail__author-actions">
          <button type="button" className="hu-button hu-button--secondary" onClick={onEdit} disabled={busy}>
            {t("collaboration.sessions.editReschedule")}
          </button>
          <button type="button" className="ics-cancel-button" onClick={onCancelSession} disabled={busy}>
            {t("collaboration.sessions.cancelSession")}
          </button>
        </div>
      ) : null}
    </article>
  );
}

interface InitiativeCollaborationSessionsPanelProps {
  initiativeId: string;
}

type LoadState = "loading" | "ready" | "error";
type EditorState = "closed" | "create" | "edit";

/**
 * Communication UX Pack 03.6 — the Collaboration Sessions panel: Session
 * list (Upcoming first) → Selected session → Attendance, in that DOM
 * order on every breakpoint (Part 12 already mandates this order on
 * mobile; reusing it on Desktop/Tablet means no responsive reordering is
 * ever needed).
 */
export function InitiativeCollaborationSessionsPanel({ initiativeId }: InitiativeCollaborationSessionsPanelProps) {
  const t = useTranslations("initiativeExperience");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<InitiativeCollaborationSessionListResult | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>("closed");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const loaded = await listInitiativeCollaborationSessions(initiativeId);
      setResult(loaded);
      setLoadState("ready");
      setSelectedSessionId((current) => {
        if (current && loaded.sessions.some((session) => session.sessionId === current)) {
          return current;
        }

        return loaded.sessions[0]?.sessionId ?? null;
      });
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof ApiRequestError
          ? error.message
          : t("collaboration.sessions.loadFailed"),
      );
    }
  }, [initiativeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSession = result?.sessions.find((session) => session.sessionId === selectedSessionId) ?? null;

  async function handleCreateSubmit(input: InitiativeCollaborationSessionInput) {
    setBusy(true);
    setEditorError(null);

    try {
      const created = await createInitiativeCollaborationSession(initiativeId, input);
      setEditorState("closed");
      await load();
      setSelectedSessionId(created.sessionId);
    } catch (error) {
      setEditorError(
        error instanceof ApiRequestError
          ? error.message
          : t("collaboration.sessions.scheduleFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleEditSubmit(input: InitiativeCollaborationSessionInput) {
    if (!selectedSession) {
      return;
    }

    setBusy(true);
    setEditorError(null);

    try {
      await updateInitiativeCollaborationSession(initiativeId, selectedSession.sessionId, input);
      setEditorState("closed");
      await load();
    } catch (error) {
      setEditorError(
        error instanceof ApiRequestError
          ? error.message
          : t("collaboration.sessions.updateFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSession() {
    if (!selectedSession) {
      return;
    }

    setBusy(true);
    setActionError(null);

    try {
      await cancelInitiativeCollaborationSession(initiativeId, selectedSession.sessionId);
      await load();
    } catch (error) {
      setActionError(
        error instanceof ApiRequestError
          ? error.message
          : t("collaboration.sessions.cancelFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(response: InitiativeCollaborationSessionAttendanceResponse) {
    if (!selectedSession) {
      return;
    }

    setBusy(true);
    setActionError(null);

    try {
      await setInitiativeCollaborationSessionAttendance(initiativeId, selectedSession.sessionId, response);
      await load();
    } catch (error) {
      setActionError(
        error instanceof ApiRequestError
          ? error.message
          : t("collaboration.sessions.attendanceFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loadState === "loading" && !result) {
    return (
      <section className="ics-panel" aria-label={t("collaboration.sessions.aria")}>
        <p className="ics-status" role="status">
          {t("collaboration.sessions.loading")}
        </p>
      </section>
    );
  }

  if (loadState === "error" && !result) {
    return (
      <section className="ics-panel" aria-label={t("collaboration.sessions.aria")}>
        <p className="ics-status ics-status--error" role="alert">
          {errorMessage}
        </p>
      </section>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <section className="ics-panel" aria-label={t("collaboration.sessions.aria")}>
      <header className="ics-panel__header">
        <h3 className="ics-panel__title">{t("collaboration.sessions.aria")}</h3>
        {result.canCreate && editorState === "closed" ? (
          <button
            type="button"
            className="hu-button hu-button--primary ics-panel__new-button"
            onClick={() => setEditorState("create")}
          >
            {t("collaboration.sessions.newSession")}
          </button>
        ) : null}
      </header>

      {editorState === "create" ? (
        <SessionEditorForm
          submitting={busy}
          error={editorError}
          onSubmit={handleCreateSubmit}
          onCancel={() => {
            setEditorState("closed");
            setEditorError(null);
          }}
        />
      ) : null}

      {editorState === "edit" && selectedSession ? (
        <SessionEditorForm
          initial={selectedSession}
          submitting={busy}
          error={editorError}
          onSubmit={handleEditSubmit}
          onCancel={() => {
            setEditorState("closed");
            setEditorError(null);
          }}
        />
      ) : null}

      {editorState === "closed" ? (
        <>
          {result.sessions.length === 0 ? (
            <p className="ics-status">
              {t("collaboration.sessions.empty")}{" "}
              {result.canCreate
                ? t("collaboration.sessions.emptyHintCreate")
                : t("collaboration.sessions.emptyHintReadonly")}
            </p>
          ) : (
            <ul className="ics-session-list">
              {result.sessions.map((session) => (
                <SessionListCard
                  key={session.sessionId}
                  session={session}
                  isSelected={session.sessionId === selectedSessionId}
                  onSelect={() => setSelectedSessionId(session.sessionId)}
                />
              ))}
            </ul>
          )}

          {selectedSession ? (
            <SessionDetail
              initiativeId={initiativeId}
              session={selectedSession}
              busy={busy}
              actionError={actionError}
              onEdit={() => {
                setEditorError(null);
                setEditorState("edit");
              }}
              onCancelSession={() => void handleCancelSession()}
              onRespond={(response) => void handleRespond(response)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
