"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative } from "@hu/types";

import { WORKSPACE_DEFERRED_TOOLTIP_API } from "../../initiative-workspace-ux/constants";
import {
  WorkspaceDeferredActions,
  WorkspaceEmptyState,
  WorkspaceHelperNote,
  WorkspaceRecordItem,
  WorkspaceRecordList,
  WorkspaceSectionShell,
  WorkspaceStatusBadge,
  WorkspaceTimeline,
  WorkspaceTimelineItem,
} from "../../initiative-workspace-ux";
import { listPublicInitiativeImplementationTrackings } from "../../initiative-implementation-tracking/api";
import { listPublicOfficialResponsesForInitiative } from "../../official-response/api";

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
  const [responses, setResponses] = useState<
    Awaited<ReturnType<typeof listPublicOfficialResponsesForInitiative>>["responses"]
  >([]);

  const loadTrackings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [trackingResponse, responseData] = await Promise.all([
        listPublicInitiativeImplementationTrackings(initiative.initiativeId),
        listPublicOfficialResponsesForInitiative(initiative.initiativeId),
      ]);
      setTrackings(trackingResponse.trackings);
      setResponses(responseData.responses);
    } catch {
      setTrackings([]);
      setResponses([]);
      setError("Public implementation tracking records are not available for this initiative yet.");
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadTrackings();
  }, [loadTrackings]);

  return (
    <WorkspaceSectionShell
      purpose="Implementation tracking is a transparent public execution journal. It follows a published implementation commitment and records evidence-driven progress — not project management."
      loading={loading ? "Loading implementation tracking..." : null}
      error={error}
      deferredActions={
        <WorkspaceDeferredActions
          note="Tracking lifecycle commands exist in the backend service layer. Workspace REST routes are deferred, so journal updates cannot be submitted from here yet."
          actions={DEFERRED_ACTIONS}
          tooltip={WORKSPACE_DEFERRED_TOOLTIP_API}
        />
      }
      emptyState={
        !loading && !error && trackings.length === 0 ? (
          <WorkspaceEmptyState
            title="No implementation tracking record has been published yet"
            explanation="Tracking journals document execution progress after a published implementation commitment."
            nextStep="Publish an implementation commitment, then activate tracking when execution begins."
          />
        ) : null
      }
    >
      {trackings.length > 0 ? (
        <WorkspaceRecordList>
          {trackings.map((tracking) => (
            <WorkspaceRecordItem
              key={tracking.trackingId}
              title={
                <Link
                  href={`/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`}
                >
                  {tracking.summary}
                </Link>
              }
              meta={
                <>
                  <WorkspaceStatusBadge status={tracking.status} /> · {tracking.currentStage} ·{" "}
                  {tracking.authorDisplayName} · {tracking.updateCount} update
                  {tracking.updateCount === 1 ? "" : "s"}
                </>
              }
            />
          ))}
        </WorkspaceRecordList>
      ) : null}

      {responses.length > 0 ? (
        <>
          <WorkspaceHelperNote>
            Related official responses recorded during tracking.
          </WorkspaceHelperNote>
          <WorkspaceTimeline>
            {responses.map((response) => (
              <WorkspaceTimelineItem
                key={response.responseId}
                title={
                  <Link href={`/public-responses/${encodeURIComponent(response.responseId)}`}>
                    {response.responseNumber} — {response.organizationName}
                  </Link>
                }
                meta={
                  <>
                    <WorkspaceStatusBadge status={response.verificationState} /> ·{" "}
                    {response.responseType.replace(/_/g, " ")}
                  </>
                }
                body={response.summary}
              />
            ))}
          </WorkspaceTimeline>
        </>
      ) : null}
    </WorkspaceSectionShell>
  );
}
