"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import {
  WorkspaceEmptyState,
  WorkspacePublicLink,
  WorkspaceRecordItem,
  WorkspaceRecordList,
  WorkspaceSectionShell,
  WorkspaceStatusBadge,
} from "../../initiative-workspace-ux";
import { listPublicInitiativeCollectiveDecisions } from "../../initiative-collective-decision/api";

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
    <WorkspaceSectionShell
      purpose="Collective decision results are public transparency records. They create opportunity for voluntary implementation — not automatic execution."
      loading={loading ? "Loading decision results..." : null}
      error={error}
      links={
        <WorkspacePublicLink
          href={`/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`}
          label="View Public Page"
        />
      }
      emptyState={
        !loading && !error && closedDecisions.length === 0 ? (
          <WorkspaceEmptyState
            title="No collective decision results are published yet"
            explanation="Closed collective decision results appear here after a decision session completes voting."
            nextStep="Continue in Decision Session and Collective Decision to reach a closed result."
          />
        ) : null
      }
    >
      {closedDecisions.length > 0 ? (
        <WorkspaceRecordList>
          {closedDecisions.map((decision) => (
            <WorkspaceRecordItem
              key={decision.decisionId}
              title={
                <Link
                  href={`/collective-decisions/public/${encodeURIComponent(decision.decisionId)}`}
                >
                  {decision.question}
                </Link>
              }
              meta={
                <>
                  <WorkspaceStatusBadge status={decision.status} /> · Outcome:{" "}
                  {formatOutcome(decision.outcome?.outcome)} · Support{" "}
                  {decision.statistics.supportCount} · Do Not Support{" "}
                  {decision.statistics.doNotSupportCount}
                </>
              }
              body={decision.outcomeSummary}
            />
          ))}
        </WorkspaceRecordList>
      ) : null}
    </WorkspaceSectionShell>
  );
}
