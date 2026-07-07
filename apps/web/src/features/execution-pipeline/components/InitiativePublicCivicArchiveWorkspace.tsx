"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Initiative, PublicCivicArchiveListItem } from "@hu/types";

import { WORKSPACE_DEFERRED_TOOLTIP_AUTHOR } from "../../initiative-workspace-ux/constants";
import {
  WorkspaceDeferredActions,
  WorkspaceEmptyState,
  WorkspaceMetricsRow,
  WorkspacePublicLink,
  WorkspaceRecordItem,
  WorkspaceRecordList,
  WorkspaceSectionShell,
} from "../../initiative-workspace-ux";
import {
  getLatestPublicCivicArchiveForInitiative,
  listMyPublicCivicArchiveRecords,
} from "../../public-civic-archive/api";

interface InitiativePublicCivicArchiveWorkspaceProps {
  initiative: Initiative;
}

const AUTHOR_DEFERRED_ACTIONS = ["Prepare archive draft", "Publish archive record"];

function formatArchiveStatus(input: { publishedCount: number; draftCount: number }): string {
  if (input.publishedCount === 0 && input.draftCount === 0) {
    return "No archive record";
  }

  if (input.publishedCount > 0 && input.draftCount === 0) {
    return input.publishedCount === 1 ? "Published archive record" : "Published archive records";
  }

  if (input.publishedCount === 0 && input.draftCount > 0) {
    return input.draftCount === 1 ? "Draft archive record" : "Draft archive records";
  }

  return "Draft and published archive records";
}

export function InitiativePublicCivicArchiveWorkspace({
  initiative,
}: InitiativePublicCivicArchiveWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedRecords, setPublishedRecords] = useState<PublicCivicArchiveListItem[]>([]);
  const [latestArchiveRecordId, setLatestArchiveRecordId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);

  const loadArchiveRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [publicArchive, myRecords] = await Promise.all([
        getLatestPublicCivicArchiveForInitiative(initiative.initiativeId),
        listMyPublicCivicArchiveRecords().catch(() => []),
      ]);

      setPublishedRecords(publicArchive.records);
      setLatestArchiveRecordId(publicArchive.latestArchiveRecordId);
      setDraftCount(
        myRecords.filter(
          (record) => record.initiativeId === initiative.initiativeId && record.status === "draft",
        ).length,
      );
    } catch {
      setPublishedRecords([]);
      setLatestArchiveRecordId(null);
      setDraftCount(0);
      setError("Public civic archive records are not available for this initiative yet.");
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadArchiveRecords();
  }, [loadArchiveRecords]);

  const archiveStatus = useMemo(
    () =>
      formatArchiveStatus({
        publishedCount: publishedRecords.length,
        draftCount,
      }),
    [draftCount, publishedRecords.length],
  );

  const latestRecord = useMemo(() => {
    if (!latestArchiveRecordId) {
      return null;
    }

    return (
      publishedRecords.find((record) => record.archiveRecordId === latestArchiveRecordId) ??
      publishedRecords[0] ??
      null
    );
  }, [latestArchiveRecordId, publishedRecords]);

  return (
    <WorkspaceSectionShell
      purpose="Public Civic Archive preserves verified civic knowledge for future communities. Archive records are permanent after publication and remain reference-only links to the civic pipeline."
      metrics={
        <WorkspaceMetricsRow>
          <div>
            <dt>Archive status</dt>
            <dd>{archiveStatus}</dd>
          </div>
          <div>
            <dt>Published archive records</dt>
            <dd>{publishedRecords.length}</dd>
          </div>
          {draftCount > 0 ? (
            <div>
              <dt>Workspace drafts</dt>
              <dd>{draftCount}</dd>
            </div>
          ) : null}
        </WorkspaceMetricsRow>
      }
      loading={loading ? "Loading civic archive records..." : null}
      error={error}
      deferredActions={
        <WorkspaceDeferredActions
          note="Workspace archive authoring is not connected yet."
          actions={AUTHOR_DEFERRED_ACTIONS}
          tooltip={WORKSPACE_DEFERRED_TOOLTIP_AUTHOR}
          authorWorkflow
        />
      }
      emptyState={
        !loading && !error && publishedRecords.length === 0 && draftCount === 0 ? (
          <WorkspaceEmptyState
            title="No civic archive record exists yet"
            explanation="Verified public impact can be archived into the Humanity Union Public Civic Archive."
            nextStep="Complete public impact verification, then prepare an archive record when civic knowledge is ready to preserve."
          />
        ) : !loading && !error && publishedRecords.length === 0 && draftCount > 0 ? (
          <WorkspaceEmptyState
            title="No published archive record is public yet"
            explanation="A workspace draft exists, but publication has not completed."
            nextStep="Review the draft and publish the archive record when civic knowledge is ready."
          />
        ) : null
      }
      links={<WorkspacePublicLink href="/civic-archive" label="View Civic Archive" />}
    >
      {latestRecord ? (
        <WorkspaceRecordItem
          title={
            <Link href={`/civic-archive/${encodeURIComponent(latestRecord.archiveRecordId)}`}>
              {latestRecord.title}
            </Link>
          }
          meta={`Version ${latestRecord.archivedVersion} · ${latestRecord.implementationPeriod} · ${latestRecord.community}`}
          body={latestRecord.summary}
        />
      ) : null}

      {publishedRecords.length > 1 ? (
        <WorkspaceRecordList>
          {publishedRecords.map((record) => (
            <WorkspaceRecordItem
              key={record.archiveRecordId}
              title={
                <Link href={`/civic-archive/${encodeURIComponent(record.archiveRecordId)}`}>
                  {record.title}
                </Link>
              }
              meta={`Version ${record.archivedVersion} · archived ${record.archivedAt}`}
            />
          ))}
        </WorkspaceRecordList>
      ) : null}
    </WorkspaceSectionShell>
  );
}
