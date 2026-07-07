"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import {
  WORKSPACE_DEFERRED_STEWARD_TITLE,
  WORKSPACE_DEFERRED_TOOLTIP_API,
} from "../../initiative-workspace-ux/constants";
import {
  WorkspaceDeferredActions,
  WorkspaceEmptyState,
  WorkspaceRecordItem,
  WorkspaceRecordList,
  WorkspaceSectionShell,
  WorkspaceStatusBadge,
} from "../../initiative-workspace-ux";
import { BOOTSTRAP_PARTICIPANT_ID } from "../../petition/petition-utils";
import { listPublicInitiativePublicImpacts } from "../../initiative-public-impact/api";

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
    <WorkspaceSectionShell
      purpose="Public impact documents observable societal outcomes after completed implementation tracking. Humanity Union documents change — it does not claim ownership of change."
      loading={loading ? "Loading public impact records..." : null}
      error={error}
      deferredActions={
        <>
          <WorkspaceDeferredActions
            note="Impact authoring and evidence expansion are available in the domain layer. Workspace REST routes are not connected yet."
            actions={AUTHOR_DEFERRED_ACTIONS}
            tooltip={WORKSPACE_DEFERRED_TOOLTIP_API}
          />
          {isSteward(initiative) ? (
            <WorkspaceDeferredActions
              title={WORKSPACE_DEFERRED_STEWARD_TITLE}
              note="Verification confirms evidence is publicly available or independently confirmed. It does not mean Humanity Union guarantees correctness."
              actions={STEWARD_DEFERRED_ACTIONS}
              tooltip={WORKSPACE_DEFERRED_TOOLTIP_API}
            />
          ) : null}
        </>
      }
      emptyState={
        !loading && !error && impacts.length === 0 ? (
          <WorkspaceEmptyState
            title="No public impact has been published yet"
            explanation="Public impact records document observed outcomes after implementation tracking is complete."
            nextStep="Publish implementation tracking evidence, then prepare a public impact record when outcomes are ready."
          />
        ) : null
      }
    >
      {impacts.length > 0 ? (
        <WorkspaceRecordList>
          {impacts.map((impact) => (
            <WorkspaceRecordItem
              key={impact.impactId}
              title={
                <Link href={`/public-impact/${encodeURIComponent(impact.impactId)}`}>
                  {impact.title}
                </Link>
              }
              meta={
                <>
                  <WorkspaceStatusBadge status={impact.status} /> · {impact.affectedCommunity} ·{" "}
                  {impact.authorDisplayName} · {impact.evidenceCount} evidence item
                  {impact.evidenceCount === 1 ? "" : "s"}
                </>
              }
              body={impact.observedImpact}
            />
          ))}
        </WorkspaceRecordList>
      ) : null}
    </WorkspaceSectionShell>
  );
}
