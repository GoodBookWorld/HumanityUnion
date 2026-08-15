"use client";

import type { InitiativeOfficialResponseIntelligenceSnapshot } from "@hu/types";

export function InitiativeOfficialResponseIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeOfficialResponseIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <p className="ior-source-panel__empty">
        Official Response Sources are empty until an Implementation Tracking Package has been published.
      </p>
    );
  }

  return (
    <section className="ior-source-panel" aria-label="Official Response Sources">
      <ul className="ior-source-panel__list">
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">Published Implementation Tracking Package</span>
          <p className="ior-source-panel__summary">
            {snapshot.trackingPackageReference
              ? `${snapshot.trackingPackageReference.title} — ${snapshot.trackingRecords.length} Tracking Record(s)`
              : "No published Implementation Tracking Package yet"}
          </p>
        </li>
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">Completed Commitments</span>
          <p className="ior-source-panel__summary">{snapshot.completedCommitmentCount} completed</p>
        </li>
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">Active Allies</span>
          <p className="ior-source-panel__summary">{snapshot.activeAllyCount} active</p>
        </li>
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">Consistency Checks</span>
          <p className="ior-source-panel__summary">
            {snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s)
            of {snapshot.consistencyChecks.length}
          </p>
        </li>
      </ul>
    </section>
  );
}
