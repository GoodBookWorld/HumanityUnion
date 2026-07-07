"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Initiative, PublicCivicArchiveListItem } from "@hu/types";

import {
  getLatestPublicCivicArchiveForInitiative,
  listMyPublicCivicArchiveRecords,
} from "../../public-civic-archive/api";

import "./execution-pipeline-workspace.css";

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
    <div className="execution-pipeline-workspace">
      <p className="execution-pipeline-workspace__note">
        Public Civic Archive preserves verified civic knowledge for future communities. Archive
        records are permanent after publication and remain reference-only links to the civic
        pipeline.
      </p>

      <dl className="execution-pipeline-workspace__summary">
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
      </dl>

      <div className="execution-pipeline-workspace__deferred">
        <p className="execution-pipeline-workspace__deferred-title">Author actions (coming soon)</p>
        <p className="execution-pipeline-workspace__note">
          Workspace archive authoring is not connected yet.
        </p>
        <div className="execution-pipeline-workspace__deferred-actions">
          {AUTHOR_DEFERRED_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              disabled
              title="Workspace archive authoring is not connected yet."
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="execution-pipeline-workspace__empty">Loading civic archive records...</p>
      ) : null}

      {error ? <p className="execution-pipeline-workspace__empty">{error}</p> : null}

      {!loading && !error && publishedRecords.length === 0 && draftCount === 0 ? (
        <p className="execution-pipeline-workspace__empty">
          No civic archive record exists for this initiative yet. Verified public impact can be
          archived into the Humanity Union Public Civic Archive when authoring is connected.
        </p>
      ) : null}

      {!loading && !error && publishedRecords.length === 0 && draftCount > 0 ? (
        <p className="execution-pipeline-workspace__empty">
          A workspace draft exists, but no published archive record is public yet.
        </p>
      ) : null}

      {latestRecord ? (
        <div className="execution-pipeline-workspace__item">
          <h3>Latest published archive record</h3>
          <Link href={`/civic-archive/${encodeURIComponent(latestRecord.archiveRecordId)}`}>
            {latestRecord.title}
          </Link>
          <p className="execution-pipeline-workspace__meta">
            Version {latestRecord.archivedVersion} · {latestRecord.implementationPeriod} ·{" "}
            {latestRecord.community}
          </p>
          <p>{latestRecord.summary}</p>
        </div>
      ) : null}

      {publishedRecords.length > 1 ? (
        <ul className="execution-pipeline-workspace__list">
          {publishedRecords.map((record) => (
            <li key={record.archiveRecordId} className="execution-pipeline-workspace__item">
              <Link href={`/civic-archive/${encodeURIComponent(record.archiveRecordId)}`}>
                {record.title}
              </Link>
              <p className="execution-pipeline-workspace__meta">
                Version {record.archivedVersion} · archived {record.archivedAt}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="execution-pipeline-workspace__links">
        <Link href="/civic-archive">Browse Humanity Union Public Civic Archive</Link>
      </p>
    </div>
  );
}
