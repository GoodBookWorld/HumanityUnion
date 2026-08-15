import type { InitiativeRevisionIntelligenceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part E, Section 2/3 (Revision Sources / Intelligent
 * Revision Builder).
 *
 * Renders the deterministic Revision Intelligence Snapshot — Published
 * Improvement Proposals (eligible / unresolved), Missing References,
 * Conflict Warnings, and Consistency Checks. Every listed item links back
 * to Discussion via `discussionUrl` where applicable. Nothing here is
 * editable — this is a read-only display of already-persisted,
 * deterministically-derived data, never a form and never AI-invented.
 *
 * Mirrors `InitiativeProposalIntelligenceSnapshotPanel` (Part D) in spirit
 * and layout, adapted to Revision's Conflict Detection / Change Summary
 * tools (Part 6).
 */
export function InitiativeRevisionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeRevisionIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <section className="irv-source-panel" aria-labelledby="irv-source-panel-title">
        <h3 id="irv-source-panel-title" className="irv-source-panel__title">
          Revision Sources
        </h3>
        <p className="irv-source-panel__lede" role="status">
          No published Improvement Proposals are available for this Initiative yet. This panel will
          populate automatically once the Author publishes Improvement Proposals.
        </p>
      </section>
    );
  }

  const unresolved = snapshot.eligibleProposals.filter((proposal) => proposal.status === "published");

  return (
    <section className="irv-source-panel" aria-labelledby="irv-source-panel-title">
      <h3 id="irv-source-panel-title" className="irv-source-panel__title">
        Revision Sources
      </h3>
      <p className="irv-source-panel__lede">
        Automatically collected from the published Initiative, Collaborative Analysis, and Improvement
        Proposals — nothing below is editable or invented.
      </p>

      <div className="irv-source-panel__stats" role="list" aria-label="Revision source statistics">
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{snapshot.eligibleProposals.length}</span>
          <span className="irv-source-panel__stat-label">Eligible Proposals</span>
        </div>
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{unresolved.length}</span>
          <span className="irv-source-panel__stat-label">Unresolved</span>
        </div>
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{snapshot.missingReferenceProposalIds.length}</span>
          <span className="irv-source-panel__stat-label">Missing References</span>
        </div>
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{snapshot.conflictWarnings.length}</span>
          <span className="irv-source-panel__stat-label">Conflict Warnings</span>
        </div>
      </div>

      {snapshot.analysisReference ? (
        <p className="irv-source-panel__lede">
          Built on the published Collaborative Analysis: &ldquo;{snapshot.analysisReference.title}&rdquo;
        </p>
      ) : null}

      <div className="irv-source-panel__section">
        <h4 className="irv-source-panel__section-title">Published Improvement Proposals</h4>
        {snapshot.eligibleProposals.length > 0 ? (
          <ul className="irv-source-panel__list" aria-label="Eligible improvement proposals">
            {snapshot.eligibleProposals.map((proposal) => (
              <li key={proposal.proposalId} className="irv-source-panel__item">
                <strong>{proposal.title}</strong>
                <span className="irv-source-panel__item-meta">
                  {proposal.status === "included_in_revision" ? "Included in Revision" : "Unresolved"} ·{" "}
                  {proposal.originalAuthorDisplayNames.join(", ")}
                  {" · "}
                  <a href={snapshot.discussionUrl}>View in Discussion</a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="irv-source-panel__empty">No eligible Improvement Proposals yet.</p>
        )}
      </div>

      <div className="irv-source-panel__section">
        <h4 className="irv-source-panel__section-title">Conflict Warnings</h4>
        {snapshot.conflictWarnings.length > 0 ? (
          <ul className="irv-source-panel__list" aria-label="Conflict warnings">
            {snapshot.conflictWarnings.map((warning) => (
              <li key={warning.section} className="irv-source-panel__item" data-tone="warning">
                <strong>{warning.sectionLabel}</strong>
                <span className="irv-source-panel__item-meta">{warning.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="irv-source-panel__empty">No conflicting changes detected.</p>
        )}
      </div>

      <div className="irv-source-panel__section">
        <h4 className="irv-source-panel__section-title">Consistency Checks</h4>
        <ul className="irv-source-panel__list" aria-label="Consistency checks">
          {snapshot.consistencyChecks.map((check) => (
            <li
              key={check.checkId}
              className="irv-source-panel__item"
              data-tone={check.status === "warning" ? "warning" : undefined}
            >
              <strong>{check.label}</strong>
              <span className="irv-source-panel__item-meta">{check.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
