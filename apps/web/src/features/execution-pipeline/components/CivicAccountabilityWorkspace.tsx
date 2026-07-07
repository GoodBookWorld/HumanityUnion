"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { CivicAccountabilityEventType, Initiative } from "@hu/types";

import {
  addCivicAccountabilityEvent,
  archiveCivicAccountability,
  closeCivicAccountability,
  listMyCivicAccountabilities,
} from "../../civic-accountability/api";

import "./execution-pipeline-workspace.css";

const EVENT_TYPES: CivicAccountabilityEventType[] = [
  "follow_up_sent",
  "response_received",
  "institution_action_reported",
  "no_response_observed",
  "public_statement_recorded",
  "meeting_recorded",
  "document_received",
  "implementation_started",
  "implementation_delayed",
  "implementation_completed",
  "correction_added",
  "other",
];

interface CivicAccountabilityWorkspaceProps {
  initiative: Initiative;
}

export function CivicAccountabilityWorkspace({ initiative }: CivicAccountabilityWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof listMyCivicAccountabilities>>>(
    [],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<CivicAccountabilityEventType>(
    "institution_action_reported",
  );
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const initiativeRecords = records.filter(
    (record) => record.initiativeId === initiative.initiativeId,
  );
  const activeRecord = initiativeRecords.find((record) => record.accountabilityId === activeId);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const mine = await listMyCivicAccountabilities();
      const filtered = mine.filter((record) => record.initiativeId === initiative.initiativeId);
      setRecords(mine);
      setActiveId(filtered[0]?.accountabilityId ?? null);
    } catch {
      setRecords([]);
      setActiveId(null);
      setError("Civic accountability records are not available for this initiative yet.");
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleAddEvent = async () => {
    if (!activeId) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await addCivicAccountabilityEvent(activeId, {
        eventType,
        title,
        summary,
        evidenceReference: evidenceReference || undefined,
        occurredAt: occurredAt || new Date().toISOString(),
      });
      setRecords((current) =>
        current.map((record) =>
          record.accountabilityId === activeId ? result.accountability : record,
        ),
      );
      setTitle("");
      setSummary("");
      setEvidenceReference("");
      setOccurredAt("");
    } catch {
      setError("Unable to record accountability event.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (accountabilityId: string) => {
    try {
      const closed = await closeCivicAccountability(accountabilityId);
      setRecords((current) =>
        current.map((record) => (record.accountabilityId === accountabilityId ? closed : record)),
      );
    } catch {
      setError("Unable to close civic accountability.");
    }
  };

  const handleArchive = async (accountabilityId: string) => {
    try {
      const archived = await archiveCivicAccountability(accountabilityId);
      setRecords((current) =>
        current.map((record) => (record.accountabilityId === accountabilityId ? archived : record)),
      );
    } catch {
      setError("Unable to archive civic accountability.");
    }
  };

  return (
    <div className="execution-pipeline-workspace">
      <p className="execution-pipeline-workspace__note">
        Civic Accountability records what happened after institutions received and/or responded to a
        Civic Action Package. Humanity Union records facts — it does not score institutions or
        assign blame.
      </p>
      <p className="execution-pipeline-workspace__note">
        Accountability timelines start automatically after civic delivery or a published official
        response.
      </p>

      {loading ? (
        <p className="execution-pipeline-workspace__empty">Loading civic accountability...</p>
      ) : null}

      {error ? <p className="execution-pipeline-workspace__empty">{error}</p> : null}

      {initiativeRecords.length === 0 && !loading ? (
        <p className="execution-pipeline-workspace__empty">
          No civic accountability timelines yet. Send a civic delivery or publish an official
          response first.
        </p>
      ) : null}

      {initiativeRecords.length > 0 ? (
        <>
          <label>
            Accountability record
            <select value={activeId ?? ""} onChange={(event) => setActiveId(event.target.value)}>
              {initiativeRecords.map((record) => (
                <option key={record.accountabilityId} value={record.accountabilityId}>
                  {record.capId} · {record.status}
                </option>
              ))}
            </select>
          </label>

          {activeRecord?.status === "active" ? (
            <>
              <h3>Add accountability event</h3>
              <label>
                Event type
                <select
                  value={eventType}
                  onChange={(event) =>
                    setEventType(event.target.value as CivicAccountabilityEventType)
                  }
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <input
                placeholder="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <textarea
                placeholder="Summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
              <input
                placeholder="Evidence reference (optional)"
                value={evidenceReference}
                onChange={(event) => setEvidenceReference(event.target.value)}
              />
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
              <button type="button" disabled={submitting} onClick={() => void handleAddEvent()}>
                {submitting ? "Recording..." : "Record event"}
              </button>
            </>
          ) : (
            <p className="execution-pipeline-workspace__meta">
              This accountability timeline is read-only ({activeRecord?.status}).
            </p>
          )}

          <ul className="execution-pipeline-workspace__list">
            {initiativeRecords.map((record) => (
              <li key={record.accountabilityId} className="execution-pipeline-workspace__item">
                <strong>{record.capId}</strong>
                <p className="execution-pipeline-workspace__meta">{record.status}</p>
                <div className="execution-pipeline-workspace__deferred-actions">
                  {record.status === "active" ? (
                    <button type="button" onClick={() => void handleClose(record.accountabilityId)}>
                      Close
                    </button>
                  ) : null}
                  {record.status === "active" || record.status === "closed" ? (
                    <button
                      type="button"
                      onClick={() => void handleArchive(record.accountabilityId)}
                    >
                      Archive
                    </button>
                  ) : null}
                  <Link
                    href={`/civic-accountability/public/${encodeURIComponent(record.accountabilityId)}`}
                  >
                    View public timeline
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
