"use client";

import type { InitiativeCivicArchiveIntelligenceSnapshot } from "@hu/types";

import { InitiativeCivicArchiveCompletenessPanel } from "./InitiativeCivicArchiveCompletenessPanel";

export function InitiativeCivicArchiveIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeCivicArchiveIntelligenceSnapshot;
  /** @deprecated Unused after Step 04 — Public Impact is SOURCE_OPTIONAL. */
  lifecycleProfile?: string | null;
}) {
  if (snapshot.isEmpty) {
    return (
      <p className="ica-source-panel__empty">
        Civic Archive Sources are empty until the Initiative is available.
      </p>
    );
  }

  return (
    <div className="ica-source-panel">
      <section aria-label="Civic Archive Sources">
        <ul className="ica-source-panel__list">
          <li className="ica-source-panel__item">
            <span className="ica-source-panel__label">Upstream Packages</span>
            <p className="ica-source-panel__summary">
              {[
                snapshot.analysisReference ? "Analysis" : null,
                snapshot.proposalReferences.length > 0
                  ? `${snapshot.proposalReferences.length} Proposal(s)`
                  : null,
                snapshot.revisionReference ? "Revision" : null,
                snapshot.petitionReference ? "Petition" : null,
                snapshot.decisionSessionReference ? "Decision Session" : null,
                snapshot.decisionReference ? "Collective Decision" : null,
                snapshot.commitmentPackageReference ? "Commitments" : null,
                snapshot.trackingPackageReference ? "Tracking" : null,
                snapshot.officialResponsePackageReference ? "Official Responses" : null,
                snapshot.publicImpactReportReference ? "Public Impact (optional)" : null,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "No upstream published packages yet — missing optional sources are recorded honestly"}
            </p>
          </li>
          <li className="ica-source-panel__item">
            <span className="ica-source-panel__label">Community Participation</span>
            <p className="ica-source-panel__summary">
              {snapshot.participationStatistics.signatureCount} signature(s) ·{" "}
              {snapshot.participationStatistics.supportCount} support ·{" "}
              {snapshot.participationStatistics.activeAllyCount} ally(ies)
            </p>
          </li>
          <li className="ica-source-panel__item">
            <span className="ica-source-panel__label">Consistency Checks</span>
            <p className="ica-source-panel__summary">
              {snapshot.consistencyChecks.filter((check) => check.status === "warning").length}{" "}
              warning(s) of {snapshot.consistencyChecks.length}
            </p>
          </li>
        </ul>
      </section>
      <InitiativeCivicArchiveCompletenessPanel completeness={snapshot.completeness} />
    </div>
  );
}
