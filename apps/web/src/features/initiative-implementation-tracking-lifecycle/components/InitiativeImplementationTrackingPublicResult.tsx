"use client";

import { useEffect, useState } from "react";

import type { PublicInitiativeImplementationTrackingListItem } from "@hu/types";

import { listPublicInitiativeImplementationTrackings } from "../../initiative-implementation-tracking/api";

import "./initiative-implementation-tracking-stage-workspace.css";

interface InitiativeImplementationTrackingPublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part J, Section 6/15. Read-only for every
 * viewer, including the Initiative's Author — a responsible
 * Participant's own progress update happens in their own working
 * sidebar's Progress Inbox, never here.
 */
export function InitiativeImplementationTrackingPublicResult({
  initiativeId,
  isPreview = false,
}: InitiativeImplementationTrackingPublicResultProps) {
  const [trackings, setTrackings] = useState<
    readonly PublicInitiativeImplementationTrackingListItem[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listPublicInitiativeImplementationTrackings(initiativeId);
        if (!cancelled) {
          setTrackings(result.trackings);
        }
      } catch {
        if (!cancelled) {
          setError("Published Implementation Tracking could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (error) {
    return <p className="iit-source-panel__empty">{error}</p>;
  }

  if (!trackings) {
    return <p className="iit-source-panel__empty">Loading published Implementation Tracking…</p>;
  }

  if (trackings.length === 0) {
    return <p className="iit-source-panel__empty">No Implementation Tracking published yet.</p>;
  }

  return (
    <article className="iit-public" aria-label="Published Implementation Tracking">
      {isPreview ? (
        <p className="iit-public__meta">Author Preview of published Implementation Tracking</p>
      ) : null}
      <section className="iit-public__section">
        <h3>Implementation Tracking</h3>
        <p className="iit-public__meta">{trackings.length} Tracking Record(s) published</p>
      </section>

      {trackings.map((tracking) => (
        <div className="iit-public__tracking" key={tracking.trackingId}>
          <h3>{tracking.approvedAction ?? tracking.summary}</h3>
          <p>{tracking.summary}</p>
          <p className="iit-public__meta">
            {tracking.authorDisplayName}
            {tracking.progress !== null ? ` · Progress ${tracking.progress}%` : ""}
          </p>
          <span className="iit-public__tracking-status">{tracking.currentStage}</span>
        </div>
      ))}
    </article>
  );
}
