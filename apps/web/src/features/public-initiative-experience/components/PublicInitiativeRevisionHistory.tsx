"use client";

import type { PublicInitiativeWithVersionHistory } from "@hu/types";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface PublicInitiativeRevisionHistoryProps {
  initiativeId: string;
  history: PublicInitiativeWithVersionHistory;
  onRevisionSelect: (version: number) => void;
}

export function PublicInitiativeRevisionHistory({
  initiativeId,
  history,
  onRevisionSelect,
}: PublicInitiativeRevisionHistoryProps) {
  const originalVersion = history.revisions.at(-1)?.version;

  return (
    <section className="pie-revisions" aria-labelledby="pie-revisions-title">
      <div className="pie-revisions__header">
        <h2 id="pie-revisions-title">Revision History</h2>
        {history.revisions.length > 0 ? (
          <button
            type="button"
            className="pie-revisions__view-all"
            onClick={() => onRevisionSelect(history.revisions[0]!.version)}
          >
            View all revisions
          </button>
        ) : null}
      </div>

      {history.revisions.length === 0 ? (
        <p className="pie-empty">No revisions have been published.</p>
      ) : (
        <ol className="pie-revisions__list">
          {history.revisions.map((revision) => (
            <li key={revision.revisionId}>
              <button
                type="button"
                className="pie-revisions__item"
                onClick={() => onRevisionSelect(revision.version)}
              >
                <span className="pie-revisions__version">
                  Version {revision.version}
                  {revision.isCurrent ? " · Current" : ""}
                  {revision.version === originalVersion ? " · Original" : ""}
                </span>
                <span className="pie-revisions__date">{formatDate(revision.publishedAt)}</span>
                <span className="pie-revisions__summary">{revision.revisionSummary}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="pie-revisions__route-note">
        Revisions open in the central Revision stage for{" "}
        <span className="pie-revisions__initiative-id">{initiativeId}</span>.
      </p>
    </section>
  );
}
