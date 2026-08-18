"use client";

import type { InitiativeCollectiveDecisionIntelligenceSnapshot } from "@hu/types";

export function InitiativeCollectiveDecisionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot;
  /** @deprecated Unused after Step 04 — Decision Session is SOURCE_OPTIONAL. */
  lifecycleProfile?: string | null;
}) {
  if (snapshot.isEmpty) {
    return (
      <p className="icd-source-panel__empty">
        Decision Sources are empty until the Initiative is available.
      </p>
    );
  }

  return (
    <section className="icd-source-panel" aria-label="Decision Sources">
      <ul className="icd-source-panel__list">
        {snapshot.decisionSessionReference ? (
          <li className="icd-source-panel__item">
            <span className="icd-source-panel__label">Decision Session (optional)</span>
            <p className="icd-source-panel__summary">
              {`${snapshot.decisionSessionReference.title} — ${snapshot.decisionSessionReference.options.length} option(s), ${snapshot.decisionSessionReference.risks.length} risk(s)`}
            </p>
          </li>
        ) : null}
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">Published Petition</span>
          <p className="icd-source-panel__summary">
            {snapshot.petitionReference
              ? `${snapshot.petitionReference.title} — Participants ${snapshot.petitionReference.participantSignatures}, Members ${snapshot.petitionReference.memberSignatures}, Visitors ${snapshot.petitionReference.visitorSignals}`
              : "No published Petition yet"}
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">Published Revision</span>
          <p className="icd-source-panel__summary">
            {snapshot.revisionReference
              ? `v${snapshot.revisionReference.version} — ${snapshot.revisionReference.revisionSummary}`
              : "No published Revision yet"}
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">Collaborative Analysis</span>
          <p className="icd-source-panel__summary">
            {snapshot.analysisReference?.title ?? "No published Analysis yet"}
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">Improvement Proposals</span>
          <p className="icd-source-panel__summary">
            {snapshot.proposalReferences.length} referenced proposal(s)
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">Consistency Checks</span>
          <p className="icd-source-panel__summary">
            {snapshot.consistencyChecks.filter((check) => check.status === "warning").length} warning(s)
            of {snapshot.consistencyChecks.length}
          </p>
        </li>
      </ul>
    </section>
  );
}
