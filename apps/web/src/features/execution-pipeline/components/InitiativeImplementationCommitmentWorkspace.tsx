"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import { listPublicInitiativeImplementationCommitments } from "../../initiative-implementation-commitment/api";

import "./execution-pipeline-workspace.css";

interface InitiativeImplementationCommitmentWorkspaceProps {
  initiative: Initiative;
}

const DEFERRED_ACTIONS = [
  "Create commitment draft",
  "Edit draft",
  "Publish commitment",
  "Withdraw commitment",
  "Complete commitment",
];

export function InitiativeImplementationCommitmentWorkspace({
  initiative,
}: InitiativeImplementationCommitmentWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<
    Awaited<ReturnType<typeof listPublicInitiativeImplementationCommitments>>["commitments"]
  >([]);

  const loadCommitments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listPublicInitiativeImplementationCommitments(initiative.initiativeId);
      setCommitments(response.commitments);
    } catch {
      setCommitments([]);
      setError("Public implementation commitments are not available for this initiative yet.");
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadCommitments();
  }, [loadCommitments]);

  return (
    <div className="execution-pipeline-workspace">
      <p className="execution-pipeline-workspace__note">
        Implementation commitments are voluntary public accountability statements after a closed
        collective decision. Multiple organizations may commit independently.
      </p>

      <div className="execution-pipeline-workspace__deferred">
        <p className="execution-pipeline-workspace__deferred-title">Author actions (coming soon)</p>
        <p className="execution-pipeline-workspace__note">
          Commitment authoring is implemented in the domain layer. Workspace REST routes are not
          connected yet, so create/edit/publish controls stay disabled here.
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
        <p className="execution-pipeline-workspace__empty">Loading implementation commitments...</p>
      ) : null}

      {error ? <p className="execution-pipeline-workspace__empty">{error}</p> : null}

      {!loading && !error && commitments.length === 0 ? (
        <p className="execution-pipeline-workspace__empty">
          No published implementation commitments yet.
        </p>
      ) : null}

      {commitments.length > 0 ? (
        <ul className="execution-pipeline-workspace__list">
          {commitments.map((commitment) => (
            <li key={commitment.commitmentId} className="execution-pipeline-workspace__item">
              <Link
                href={`/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`}
              >
                {commitment.title}
              </Link>
              <p className="execution-pipeline-workspace__meta">
                {commitment.status}
                {commitment.organization ? ` · ${commitment.organization}` : ""} ·{" "}
                {commitment.authorDisplayName}
              </p>
              <p className="execution-pipeline-workspace__meta">{commitment.summary}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
