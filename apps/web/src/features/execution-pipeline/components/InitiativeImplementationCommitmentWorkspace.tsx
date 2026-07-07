"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import { WORKSPACE_DEFERRED_TOOLTIP_API } from "../../initiative-workspace-ux/constants";
import {
  WorkspaceDeferredActions,
  WorkspaceEmptyState,
  WorkspaceRecordItem,
  WorkspaceRecordList,
  WorkspaceSectionShell,
  WorkspaceStatusBadge,
} from "../../initiative-workspace-ux";
import { listPublicInitiativeImplementationCommitments } from "../../initiative-implementation-commitment/api";

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
    <WorkspaceSectionShell
      purpose="Implementation commitments are voluntary public accountability statements after a closed collective decision. Multiple organizations may commit independently."
      loading={loading ? "Loading implementation commitments..." : null}
      error={error}
      deferredActions={
        <WorkspaceDeferredActions
          note="Commitment authoring is implemented in the domain layer. Workspace REST routes are not connected yet."
          actions={DEFERRED_ACTIONS}
          tooltip={WORKSPACE_DEFERRED_TOOLTIP_API}
        />
      }
      emptyState={
        !loading && !error && commitments.length === 0 ? (
          <WorkspaceEmptyState
            title="No implementation commitment has been published yet"
            explanation="Organizations publish voluntary commitments after a closed collective decision."
            nextStep="Review the decision result, then prepare a commitment when an organization is ready to participate."
          />
        ) : null
      }
    >
      {commitments.length > 0 ? (
        <WorkspaceRecordList>
          {commitments.map((commitment) => (
            <WorkspaceRecordItem
              key={commitment.commitmentId}
              title={
                <Link
                  href={`/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`}
                >
                  {commitment.title}
                </Link>
              }
              meta={
                <>
                  <WorkspaceStatusBadge status={commitment.status} />
                  {commitment.organization ? ` · ${commitment.organization}` : ""} ·{" "}
                  {commitment.authorDisplayName}
                </>
              }
              body={commitment.summary}
            />
          ))}
        </WorkspaceRecordList>
      ) : null}
    </WorkspaceSectionShell>
  );
}
