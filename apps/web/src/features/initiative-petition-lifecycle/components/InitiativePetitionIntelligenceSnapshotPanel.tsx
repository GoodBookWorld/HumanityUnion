import type { InitiativePetitionIntelligenceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part F, Section 2/3 (Petition Sources / Petition
 * Draft Builder).
 *
 * Renders the deterministic Petition Intelligence Snapshot — the Published
 * Revision this Petition is built from, the Published Collaborative
 * Analysis and Improvement Proposals that informed it, and read-only
 * consistency checks. Nothing here is editable — this is a display of
 * already-persisted, deterministically-derived data, never a form and
 * never AI-invented.
 *
 * Mirrors `InitiativeRevisionIntelligenceSnapshotPanel` (Part E) in spirit
 * and layout.
 */
export function InitiativePetitionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativePetitionIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <section className="ipl-source-panel" aria-labelledby="ipl-source-panel-title">
        <h3 id="ipl-source-panel-title" className="ipl-source-panel__title">
          Petition Sources
        </h3>
        <p className="ipl-source-panel__lede" role="status">
          A Petition cannot be built yet — this Initiative has no Published Revision. This panel will
          populate automatically once the Author publishes a Revision.
        </p>
      </section>
    );
  }

  return (
    <section className="ipl-source-panel" aria-labelledby="ipl-source-panel-title">
      <h3 id="ipl-source-panel-title" className="ipl-source-panel__title">
        Petition Sources
      </h3>
      <p className="ipl-source-panel__lede">
        Automatically collected from the Published Initiative, Collaborative Analysis, Improvement
        Proposals, and Revision — nothing below is editable or invented.
      </p>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">Published Revision</h4>
        {snapshot.revisionReference ? (
          <div className="ipl-source-panel__item">
            <strong>Version {snapshot.revisionReference.version}</strong>
            <span className="ipl-source-panel__item-meta">{snapshot.revisionReference.revisionSummary}</span>
          </div>
        ) : (
          <p className="ipl-source-panel__empty">No published Revision yet.</p>
        )}
      </div>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">Published Collaborative Analysis</h4>
        {snapshot.analysisReference ? (
          <div className="ipl-source-panel__item">
            <strong>{snapshot.analysisReference.title}</strong>
            <span className="ipl-source-panel__item-meta">{snapshot.analysisReference.summary}</span>
          </div>
        ) : (
          <p className="ipl-source-panel__empty">No published Collaborative Analysis yet.</p>
        )}
      </div>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">Published Improvement Proposals</h4>
        {snapshot.proposalReferences.length > 0 ? (
          <ul className="ipl-source-panel__list" aria-label="Accepted improvement proposals">
            {snapshot.proposalReferences.map((proposal) => (
              <li key={proposal.proposalId} className="ipl-source-panel__item">
                <strong>{proposal.title}</strong>
                <span className="ipl-source-panel__item-meta">
                  {proposal.status === "accepted" ? "Accepted" : "Partially accepted"} · {proposal.summary}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ipl-source-panel__empty">No accepted Improvement Proposals referenced.</p>
        )}
      </div>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">Consistency Checks</h4>
        <ul className="ipl-source-panel__list" aria-label="Consistency checks">
          {snapshot.consistencyChecks.map((check) => (
            <li
              key={check.checkId}
              className="ipl-source-panel__item"
              data-tone={check.status === "warning" ? "warning" : undefined}
            >
              <strong>{check.label}</strong>
              <span className="ipl-source-panel__item-meta">{check.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
