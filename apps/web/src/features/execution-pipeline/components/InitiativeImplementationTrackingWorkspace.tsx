"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import { listPublicInitiativeImplementationTrackings } from "../../initiative-implementation-tracking/api";

import "./execution-pipeline-workspace.css";

interface InitiativeImplementationTrackingWorkspaceProps {
  initiative: Initiative;
}

const DEFERRED_ACTIONS = [
  "Create tracking draft",
  "Activate tracking",
  "Add execution update",
  "Complete tracking",
  "Archive tracking",
];

export function InitiativeImplementationTrackingWorkspace({
  initiative,
}: InitiativeImplementationTrackingWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackings, setTrackings] = useState<
    Awaited<ReturnType<typeof listPublicInitiativeImplementationTrackings>>["trackings"]
  >([]);

  const loadTrackings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listPublicInitiativeImplementationTrackings(initiative.initiativeId);
      setTrackings(response.trackings);
    } catch {
      setTrackings([]);
      setError("Public implementation tracking records are not available for this initiative yet.");
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadTrackings();
  }, [loadTrackings]);

  return (
    <div className="execution-pipeline-workspace">
      <p className="execution-pipeline-workspace__note">
        Implementation tracking is a transparent public execution journal. It follows a published
        implementation commitment and records evidence-driven progress — not project management.
      </p>

      <div className="execution-pipeline-workspace__deferred">
        <p className="execution-pipeline-workspace__deferred-title">Author actions (coming soon)</p>
        <p className="execution-pipeline-workspace__note">
          Tracking lifecycle commands exist in the backend service layer. Workspace REST routes are
          deferred, so journal updates cannot be submitted from here yet.
        </p>
        <div className="execution-pipeline-workspace__deferred-actions">
          {DEFERRED_ACTIONS.map((action) => (
            <button key={action} type="button" disabled title="Coming soon — workspace API pending">
              {action}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="execution-pipeline-workspace__empty">Loading implementation tracking...</p>
      ) : null}

      {error ? <p className="execution-pipeline-workspace__empty">{error}</p> : null}

      {!loading && !error && trackings.length === 0 ? (
        <p className="execution-pipeline-workspace__empty">
          No public implementation tracking records yet.
        </p>
      ) : null}

      {trackings.length > 0 ? (
        <ul className="execution-pipeline-workspace__list">
          {trackings.map((tracking) => (
            <li key={tracking.trackingId} className="execution-pipeline-workspace__item">
              <Link
                href={`/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`}
              >
                {tracking.summary}
              </Link>
              <p className="execution-pipeline-workspace__meta">
                {tracking.status} · {tracking.currentStage} · {tracking.authorDisplayName} ·{" "}
                {tracking.updateCount} update{tracking.updateCount === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
