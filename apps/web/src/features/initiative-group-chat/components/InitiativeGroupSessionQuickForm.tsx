"use client";

import { useId, useMemo, useState } from "react";

import type { InitiativeCollaborationSessionInput } from "@hu/types";

import { ApiRequestError } from "../../../lib/api-client";
import { createInitiativeCollaborationSession } from "../../initiative-collaboration-sessions/api";

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

interface InitiativeGroupSessionQuickFormProps {
  initiativeId: string;
  onScheduled: () => void;
}

/**
 * Communication UX Pack 03.9 Part 6/9 — a compact "Schedule Collaboration
 * Session" form for the Initiative Group Chat sidebar. This is deliberately
 * a *second, smaller* form, not an extraction of the existing
 * `InitiativeCollaborationSessionsPanel` editor — but it calls the exact
 * same `createInitiativeCollaborationSession` service/validation as that
 * panel (Part 9: "reuse the existing Collaboration Sessions service and
 * validation. Do not create a parallel invitation entity."). The full panel
 * (list, detail, attendance, edit, cancel) remains the single place to
 * browse and manage Sessions, reached via the central Sessions tab.
 */
export function InitiativeGroupSessionQuickForm({ initiativeId, onScheduled }: InitiativeGroupSessionQuickFormProps) {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(30);
  const [externalMeetingLink, setExternalMeetingLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezoneOptions = useMemo(() => resolveTimezoneOptions(), []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: InitiativeCollaborationSessionInput = {
      title,
      meetingDate,
      meetingTime,
      timezone,
      estimatedDurationMinutes,
      externalMeetingLink: externalMeetingLink.trim() ? externalMeetingLink : undefined,
    };

    try {
      await createInitiativeCollaborationSession(initiativeId, input);
      setTitle("");
      setMeetingDate("");
      setMeetingTime("");
      setEstimatedDurationMinutes(30);
      setExternalMeetingLink("");
      onScheduled();
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Unable to schedule this Session. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="igc-session-form" aria-label="Schedule a Collaboration Session">
      <h3 className="igc-session-form__title">Schedule a Session</h3>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="igc-session-form__field">
          <label htmlFor={`${formId}-title`}>Title</label>
          <input
            id={`${formId}-title`}
            type="text"
            className="hu-form-control"
            value={title}
            maxLength={140}
            required
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="igc-session-form__field">
          <label htmlFor={`${formId}-date`}>Date</label>
          <input
            id={`${formId}-date`}
            type="date"
            className="hu-form-control"
            value={meetingDate}
            required
            onChange={(event) => setMeetingDate(event.target.value)}
          />
        </div>

        <div className="igc-session-form__field">
          <label htmlFor={`${formId}-time`}>Time</label>
          <input
            id={`${formId}-time`}
            type="time"
            className="hu-form-control"
            value={meetingTime}
            required
            onChange={(event) => setMeetingTime(event.target.value)}
          />
        </div>

        <div className="igc-session-form__field">
          <label htmlFor={`${formId}-timezone`}>Timezone</label>
          <select
            id={`${formId}-timezone`}
            className="hu-form-control"
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

        <div className="igc-session-form__field">
          <label htmlFor={`${formId}-duration`}>Duration (minutes)</label>
          <input
            id={`${formId}-duration`}
            type="number"
            className="hu-form-control"
            min={5}
            max={480}
            step={5}
            value={estimatedDurationMinutes}
            required
            onChange={(event) => setEstimatedDurationMinutes(Number(event.target.value))}
          />
        </div>

        <div className="igc-session-form__field">
          <label htmlFor={`${formId}-link`}>Meeting link (optional)</label>
          <input
            id={`${formId}-link`}
            type="url"
            className="hu-form-control"
            placeholder="https://meet.google.com/..."
            value={externalMeetingLink}
            onChange={(event) => setExternalMeetingLink(event.target.value)}
          />
        </div>

        {error ? (
          <p className="igc-session-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="hu-button hu-button--primary igc-session-form__submit" disabled={submitting}>
          {submitting ? "Scheduling…" : "Schedule Session"}
        </button>
      </form>
    </section>
  );
}
