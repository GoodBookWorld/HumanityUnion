"use client";

import type { InitiativeImplementationTrackingIntelligenceSnapshot } from "@hu/types";

export function InitiativeImplementationTrackingIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeImplementationTrackingIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <p className="iit-source-panel__empty">
        Implementation Tracking Sources are empty until Implementation Commitments are published and
        at least one is Accepted.
      </p>
    );
  }

  return (
    <section className="iit-source-panel" aria-label="Implementation Tracking Sources">
      <ul className="iit-source-panel__list">
        <li className="iit-source-panel__item">
          <span className="iit-source-panel__label">Published Commitment Package</span>
          <p className="iit-source-panel__summary">
            {snapshot.packageReference
              ? `${snapshot.packageReference.title} — ${snapshot.acceptedCommitments.length} Accepted Commitment(s)`
              : "No published Commitment Package yet"}
          </p>
        </li>
        <li className="iit-source-panel__item">
          <span className="iit-source-panel__label">Active Allies</span>
          <p className="iit-source-panel__summary">{snapshot.activeAllyCount} active</p>
        </li>
        <li className="iit-source-panel__item">
          <span className="iit-source-panel__label">Consistency Checks</span>
          <p className="iit-source-panel__summary">
            {snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s)
            of {snapshot.consistencyChecks.length}
          </p>
        </li>
      </ul>
    </section>
  );
}
