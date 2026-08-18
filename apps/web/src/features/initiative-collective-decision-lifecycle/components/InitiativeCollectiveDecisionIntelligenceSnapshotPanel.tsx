"use client";

import type {
  InitiativeCollectiveDecisionIntelligenceSnapshot,
  InitiativeLifecycleProfile,
} from "@hu/types";

import { requiresDecisionSessionBeforeCollectiveDecision } from "../../public-initiative-experience/initiative-lifecycle-shell";

export function InitiativeCollectiveDecisionIntelligenceSnapshotPanel({
  snapshot,
  lifecycleProfile,
}: {
  snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}) {
  const requireDecisionSession = requiresDecisionSessionBeforeCollectiveDecision(lifecycleProfile);

  if (snapshot.isEmpty) {
    return (
      <p className="icd-source-panel__empty">
        {requireDecisionSession
          ? "Decision Sources are empty until a Decision Session is published."
          : "Decision Sources are empty until the Initiative is available."}
      </p>
    );
  }

  return (
    <section className="icd-source-panel" aria-label="Decision Sources">
      <ul className="icd-source-panel__list">
        {requireDecisionSession ? (
          <li className="icd-source-panel__item">
            <span className="icd-source-panel__label">Published Decision Session</span>
            <p className="icd-source-panel__summary">
              {snapshot.decisionSessionReference
                ? `${snapshot.decisionSessionReference.title} — ${snapshot.decisionSessionReference.options.length} option(s), ${snapshot.decisionSessionReference.risks.length} risk(s)`
                : "No published Decision Session yet"}
            </p>
          </li>
        ) : snapshot.decisionSessionReference ? (
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
