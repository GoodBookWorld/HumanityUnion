"use client";

import type { InitiativePublicImpactIntelligenceSnapshot } from "@hu/types";

export function InitiativePublicImpactIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativePublicImpactIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <p className="ipi-source-panel__empty">
        Public Impact Sources are empty until an Official Response Package has been published.
      </p>
    );
  }

  return (
    <section className="ipi-source-panel" aria-label="Public Impact Sources">
      <ul className="ipi-source-panel__list">
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">Published Official Response Package</span>
          <p className="ipi-source-panel__summary">
            {snapshot.officialResponsePackageReference
              ? snapshot.officialResponsePackageReference.outcomeKind ===
                "no_official_response_received"
                ? `${snapshot.officialResponsePackageReference.title} — No official response received`
                : `${snapshot.officialResponsePackageReference.title} — ${snapshot.officialResponseSummaries.length} Response(s)`
              : "No published Official Response Package yet"}
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">Implementation Tracking</span>
          <p className="ipi-source-panel__summary">
            {snapshot.trackingPackageReference
              ? `${snapshot.trackingPackageReference.title} — ${snapshot.trackingRecords.length} Tracking Record(s)`
              : "No published Implementation Tracking Package yet"}
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">Completed Commitments</span>
          <p className="ipi-source-panel__summary">{snapshot.completedCommitmentCount} completed</p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">Community Participation</span>
          <p className="ipi-source-panel__summary">
            {snapshot.participationStatistics.signatureCount} signature(s) ·{" "}
            {snapshot.participationStatistics.supportCount} support ·{" "}
            {snapshot.participationStatistics.activeAllyCount} ally(ies)
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">Evidence References</span>
          <p className="ipi-source-panel__summary">{snapshot.evidenceItems.length} reference(s)</p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">Consistency Checks</span>
          <p className="ipi-source-panel__summary">
            {snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s)
            of {snapshot.consistencyChecks.length}
          </p>
        </li>
      </ul>
    </section>
  );
}
