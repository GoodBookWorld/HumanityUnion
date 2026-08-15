"use client";

import type { InitiativeDecisionSessionIntelligenceSnapshot } from "@hu/types";

export function InitiativeDecisionSessionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeDecisionSessionIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <p className="ids-source-panel__empty">
        Decision Sources are empty until a Petition (and upstream Revision/Analysis) is published.
      </p>
    );
  }

  return (
    <section className="ids-source-panel" aria-label="Decision Sources">
      <ul className="ids-source-panel__list">
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">Published Petition</span>
          <p className="ids-source-panel__summary">
            {snapshot.petitionReference
              ? `${snapshot.petitionReference.title} — Participants ${snapshot.petitionReference.participantSignatures}, Members ${snapshot.petitionReference.memberSignatures}, Visitors ${snapshot.petitionReference.visitorSignals}`
              : "No published Petition yet"}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">Published Revision</span>
          <p className="ids-source-panel__summary">
            {snapshot.revisionReference
              ? `v${snapshot.revisionReference.version} — ${snapshot.revisionReference.revisionSummary}`
              : "No published Revision yet"}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">Collaborative Analysis</span>
          <p className="ids-source-panel__summary">
            {snapshot.analysisReference?.title ?? "No published Analysis yet"}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">Improvement Proposals</span>
          <p className="ids-source-panel__summary">
            {snapshot.proposalReferences.length} referenced proposal(s)
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">Active Ally recommendations</span>
          <p className="ids-source-panel__summary">
            {snapshot.allyRecommendations.length} advisory recommendation(s) from{" "}
            {snapshot.activeAllyCount} Active Ally(ies)
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">Open collaboration comments</span>
          <p className="ids-source-panel__summary">
            {snapshot.openComments.length} recent comment(s) summarised
          </p>
        </li>
      </ul>
    </section>
  );
}
