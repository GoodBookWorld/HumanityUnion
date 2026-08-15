import type { InitiativeProposalIntelligenceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part D, Section 2/3 (Automatic Proposal
 * Collection / Proposal Intelligence Panel).
 *
 * Renders the deterministic Proposal Intelligence Snapshot — Grouped
 * Improvements, Duplicate Detection, Proposal Categories, Evidence
 * (Helpful totals), Authors, and Open Proposal Questions. Every listed
 * item links back to Discussion via `discussionUrl`. Nothing here is
 * editable — this is a read-only display of already-persisted,
 * deterministically-derived data, never a form and never AI-invented.
 *
 * Mirrors `InitiativeAnalysisSourceSnapshotPanel` (Part B) in spirit and
 * layout, adapted to Proposal Groups instead of Topics/Arguments/Concerns.
 */
export function InitiativeProposalIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeProposalIntelligenceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <section className="iip-source-panel" aria-labelledby="iip-source-panel-title">
        <h3 id="iip-source-panel-title" className="iip-source-panel__title">
          Proposal Sources
        </h3>
        <p className="iip-source-panel__lede" role="status">
          No Proposal-marked comments have been collected for this Initiative yet. This panel will
          populate automatically once participants mark comments as proposals in Discussion.
        </p>
      </section>
    );
  }

  return (
    <section className="iip-source-panel" aria-labelledby="iip-source-panel-title">
      <h3 id="iip-source-panel-title" className="iip-source-panel__title">
        Proposal Sources
      </h3>
      <p className="iip-source-panel__lede">
        Automatically collected and grouped from Discussion — nothing below is editable or invented.
      </p>

      <div className="iip-source-panel__stats" role="list" aria-label="Proposal collection statistics">
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.totalCandidateCount}</span>
          <span className="iip-source-panel__stat-label">Proposal Candidates</span>
        </div>
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.groups.length}</span>
          <span className="iip-source-panel__stat-label">Grouped Improvements</span>
        </div>
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.duplicateGroupCount}</span>
          <span className="iip-source-panel__stat-label">Likely Duplicates</span>
        </div>
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.openProposalQuestions.length}</span>
          <span className="iip-source-panel__stat-label">Open Questions</span>
        </div>
      </div>

      {snapshot.analysisReference ? (
        <p className="iip-source-panel__lede">
          Built on the published Collaborative Analysis: &ldquo;{snapshot.analysisReference.title}&rdquo;
        </p>
      ) : null}

      <div className="iip-source-panel__section">
        <h4 className="iip-source-panel__section-title">Grouped Improvements</h4>
        {snapshot.groups.length > 0 ? (
          <ul className="iip-source-panel__group-list" aria-label="Grouped proposal improvements">
            {snapshot.groups.map((group) => (
              <li key={group.groupId} className="iip-source-panel__group" data-duplicate={group.isDuplicateGroup}>
                <span>&ldquo;{group.representativeExcerpt}&rdquo;</span>
                <span className="iip-source-panel__group-meta">
                  {group.category} · {group.memberCount} mention(s) · {group.totalHelpfulCount} Helpful
                  {group.isDuplicateGroup ? " · Likely duplicate" : ""} · {group.authorDisplayNames.join(", ")}
                  {" · "}
                  <a href={group.discussionUrl}>View in Discussion</a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-source-panel__empty">No proposal groups identified yet.</p>
        )}
      </div>

      <div className="iip-source-panel__section">
        <h4 className="iip-source-panel__section-title">Open Proposal Questions</h4>
        {snapshot.openProposalQuestions.length > 0 ? (
          <ul className="iip-source-panel__group-list" aria-label="Open proposal questions">
            {snapshot.openProposalQuestions.map((item) => (
              <li key={item.candidateId} className="iip-source-panel__group">
                <span>&ldquo;{item.excerpt}&rdquo;</span>
                <span className="iip-source-panel__group-meta">
                  — {item.authorDisplayName} · <a href={item.discussionUrl}>View in Discussion</a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-source-panel__empty">No unresolved proposal questions identified yet.</p>
        )}
      </div>
    </section>
  );
}
