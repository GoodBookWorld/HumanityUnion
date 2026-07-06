"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import { BOOTSTRAP_PARTICIPANT_ID } from "../../petition/petition-utils";
import { listPublicInitiativePublicImpacts } from "../../initiative-public-impact/api";

import "./execution-pipeline-workspace.css";

interface InitiativePublicImpactWorkspaceProps {
  initiative: Initiative;
}

const AUTHOR_DEFERRED_ACTIONS = [
  "Create impact draft",
  "Edit draft",
  "Add evidence",
  "Publish impact",
  "Archive impact",
];

const STEWARD_DEFERRED_ACTIONS = ["Verify published impact"];

function isSteward(initiative: Initiative): boolean {
  return initiative.stewardId === BOOTSTRAP_PARTICIPANT_ID;
}

export function InitiativePublicImpactWorkspace({
  initiative,
}: InitiativePublicImpactWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impacts, setImpacts] = useState<
    Awaited<ReturnType<typeof listPublicInitiativePublicImpacts>>["impacts"]
  >([]);

  const loadImpacts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listPublicInitiativePublicImpacts(initiative.initiativeId);
      setImpacts(response.impacts);
    } catch {
      setImpacts([]);
      setError("Public impact records are not available for this initiative yet.");
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadImpacts();
  }, [loadImpacts]);

  return (
    <div className="execution-pipeline-workspace">
      <p className="execution-pipeline-workspace__note">
        Public impact documents observable societal outcomes after completed implementation
        tracking. Humanity Union documents change — it does not claim ownership of change.
      </p>

      <div className="execution-pipeline-workspace__deferred">
        <p className="execution-pipeline-workspace__deferred-title">Author actions (coming soon)</p>
        <p className="execution-pipeline-workspace__note">
          Impact authoring and evidence expansion are available in the domain layer. Workspace REST
          routes are not connected yet.
        </p>
        <div className="execution-pipeline-workspace__deferred-actions">
          {AUTHOR_DEFERRED_ACTIONS.map((action) => (
            <button key={action} type="button" disabled title="Coming soon — workspace API pending">
              {action}
            </button>
          ))}
        </div>
      </div>

      {isSteward(initiative) ? (
        <div className="execution-pipeline-workspace__deferred">
          <p className="execution-pipeline-workspace__deferred-title">
            Steward verification (coming soon)
          </p>
          <p className="execution-pipeline-workspace__note">
            Verification confirms evidence is publicly available or independently confirmed. It does
            not mean Humanity Union guarantees correctness.
          </p>
          <div className="execution-pipeline-workspace__deferred-actions">
            {STEWARD_DEFERRED_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                disabled
                title="Coming soon — steward workspace API pending"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="execution-pipeline-workspace__empty">Loading public impact records...</p>
      ) : null}

      {error ? <p className="execution-pipeline-workspace__empty">{error}</p> : null}

      {!loading && !error && impacts.length === 0 ? (
        <p className="execution-pipeline-workspace__empty">No public impact records yet.</p>
      ) : null}

      {impacts.length > 0 ? (
        <ul className="execution-pipeline-workspace__list">
          {impacts.map((impact) => (
            <li key={impact.impactId} className="execution-pipeline-workspace__item">
              <Link href={`/public-impact/${encodeURIComponent(impact.impactId)}`}>
                {impact.title}
              </Link>
              <p className="execution-pipeline-workspace__meta">
                {impact.status} · {impact.affectedCommunity} · {impact.authorDisplayName} ·{" "}
                {impact.evidenceCount} evidence item{impact.evidenceCount === 1 ? "" : "s"}
              </p>
              <p className="execution-pipeline-workspace__meta">{impact.observedImpact}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
