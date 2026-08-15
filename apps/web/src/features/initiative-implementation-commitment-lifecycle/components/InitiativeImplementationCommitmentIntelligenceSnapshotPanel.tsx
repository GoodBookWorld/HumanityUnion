"use client";

import type { InitiativeImplementationCommitmentIntelligenceSnapshot } from "@hu/types";

export function InitiativeImplementationCommitmentIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeImplementationCommitmentIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <p className="iic-source-panel__empty">
        Implementation Commitment Sources are empty until a Collective Decision is closed.
      </p>
    );
  }

  return (
    <section className="iic-source-panel" aria-label="Implementation Commitment Sources">
      <ul className="iic-source-panel__list">
        <li className="iic-source-panel__item">
          <span className="iic-source-panel__label">Published Collective Decision</span>
          <p className="iic-source-panel__summary">
            {snapshot.decisionReference
              ? `${snapshot.decisionReference.title} — ${snapshot.decisionReference.approvedActions.length} Approved Action(s)`
              : "No published Collective Decision yet"}
          </p>
        </li>
        <li className="iic-source-panel__item">
          <span className="iic-source-panel__label">Active Allies</span>
          <p className="iic-source-panel__summary">{snapshot.activeAllyCount} active</p>
        </li>
        <li className="iic-source-panel__item">
          <span className="iic-source-panel__label">Consistency Checks</span>
          <p className="iic-source-panel__summary">
            {snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s)
            of {snapshot.consistencyChecks.length}
          </p>
        </li>
      </ul>
    </section>
  );
}
