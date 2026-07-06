"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import { listPublicInitiativeCollectiveDecisions } from "../../initiative-collective-decision/api";

import "./execution-pipeline-workspace.css";

interface DecisionResultWorkspaceProps {
  initiative: Initiative;
}

function formatOutcome(outcome: string | null | undefined): string {
  if (!outcome) {
    return "Pending";
  }

  return outcome.replace(/_/g, " ");
}

export function DecisionResultWorkspace({ initiative }: DecisionResultWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<
    Awaited<ReturnType<typeof listPublicInitiativeCollectiveDecisions>>["decisions"]
  >([]);

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listPublicInitiativeCollectiveDecisions(initiative.initiativeId);
      setDecisions(response.decisions);
    } catch {
      setDecisions([]);
      setError("Public collective decision results are not available for this initiative yet.");
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadDecisions();
  }, [loadDecisions]);

  const closedDecisions = decisions.filter((decision) => decision.status === "closed");

  return (
    <div className="execution-pipeline-workspace">
      <p className="execution-pipeline-workspace__pipeline">
        Execution pipeline: Decision Result → Implementation Commitment → Implementation Tracking →
        Public Impact
      </p>
      <p className="execution-pipeline-workspace__note">
        Collective decision results are public transparency records. They create opportunity for
        voluntary implementation — not automatic execution.
      </p>

      {loading ? (
        <p className="execution-pipeline-workspace__empty">Loading decision results...</p>
      ) : null}

      {error ? <p className="execution-pipeline-workspace__empty">{error}</p> : null}

      {!loading && !error && closedDecisions.length === 0 ? (
        <p className="execution-pipeline-workspace__empty">
          No closed collective decision results are published for this initiative yet.
        </p>
      ) : null}

      {closedDecisions.length > 0 ? (
        <ul className="execution-pipeline-workspace__list">
          {closedDecisions.map((decision) => (
            <li key={decision.decisionId} className="execution-pipeline-workspace__item">
              <Link
                href={`/collective-decisions/public/${encodeURIComponent(decision.decisionId)}`}
              >
                {decision.question}
              </Link>
              <p className="execution-pipeline-workspace__meta">
                {decision.status} · Outcome: {formatOutcome(decision.outcome?.outcome)} · Support{" "}
                {decision.statistics.supportCount} · Do Not Support{" "}
                {decision.statistics.doNotSupportCount}
              </p>
              <p className="execution-pipeline-workspace__meta">{decision.outcomeSummary}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        className="execution-pipeline-workspace__public-link"
        href={`/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`}
      >
        View public initiative page
      </Link>
    </div>
  );
}
